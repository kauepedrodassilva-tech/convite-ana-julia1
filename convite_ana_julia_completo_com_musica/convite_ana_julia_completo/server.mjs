import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, 'public');
const dataDir = path.join(here, 'data');
const uploadDir = path.join(dataDir, 'uploads');
const dbFile = path.join(dataDir, 'db.json');
fs.mkdirSync(uploadDir, {recursive: true});

const env = (k, d = '') => process.env[k] || d;
const uid = () => crypto.randomUUID();

/* ------------------------------------------------------------------ *
 * Banco de dados (arquivo JSON, como no projeto original)
 * ------------------------------------------------------------------ */
const initial = {
  schema: 2,
  settings: {
    eventName: 'Birthday 19 — Ana Júlia',
    eventDate: '2026-12-06T12:00:00-03:00',
    address: 'Endereço a confirmar',
    mapsUrl: '', musicUrl: '', heroImage: '',
    adminEmail: env('ADMIN_EMAIL', 'admin@convite.local'),
    rsvpEnabled: true,
    reservationsEnabled: true
  },
  gifts: [
    ['Perfume', 'Uma fragrância delicada para perfumar o novo ciclo.'],
    ['Maquiagem', 'Um item de make para realçar a beleza da aniversariante.'],
    ['Bolsa', 'Uma bolsa linda para acompanhar a Ana nos próximos passeios.'],
    ['Bijuteria ou acessório', 'Brincos, colar, pulseira… um detalhe que faz toda a diferença.'],
    ['Flores', 'Um buquê colorido para alegrar o dia.'],
    ['Vale-presente', 'Para ela escolher exatamente o que quiser.'],
    ['Chocolate', 'Porque doce nunca é demais em dia de festa.'],
    ['Um mimo surpresa', 'Surpreenda a Ana com algo feito com carinho.']
  ].map(([name, description], i) => ({id: 'g' + (i + 1), name, description, image: '', active: true, chosenBy: null, chosenAt: null, createdAt: new Date().toISOString()})),
  rsvps: []
};

/** Migra bancos criados pela versão antiga (roleta + reservas) para o novo modelo. */
function migrate(d) {
  if (d.schema === 2) return d;
  const reservations = (d.reservations || []).filter(r => r.status === 'active');
  for (const g of d.gifts || []) {
    g.description ??= '';
    g.image ??= '';
    g.chosenBy = null; g.chosenAt = null;
    g.createdAt ??= new Date().toISOString();
    const taken = reservations.filter(r => r.giftId === g.id);
    if (taken.length) {
      g.chosenBy = taken[0].rsvpId; g.chosenAt = taken[0].createdAt;
      if (taken.length > 1) console.warn(`Aviso: o presente "${g.name}" tinha ${taken.length} reservas; apenas a primeira foi mantida.`);
    }
    delete g.quantity;
  }
  for (const r of d.rsvps || []) {
    r.people = r.attendance === 'yes' ? 1 + (Number(r.companions) || 0) : 0;
    delete r.companions; // agora a quantidade total fica em "people"
  }
  delete d.reservations;
  d.schema = 2;
  return d;
}

let db;
if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify(initial, null, 2));
db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
if (db.schema !== 2) {
  fs.copyFileSync(dbFile, dbFile + '.backup-pre-v2');
  db = migrate(db);
}
db.settings.reservationsEnabled ??= true;

function save() {
  // gravação atômica: arquivo temporário + rename
  const tmp = dbFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, dbFile);
}
save();

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }

/**
 * Transação: executa fn() e grava em disco SEM nenhum "await" no meio.
 * Como o Node processa um único trecho síncrono por vez, a verificação
 * ("o presente ainda está livre?") e a gravação ("agora é do convidado X")
 * acontecem de forma indivisível — duas requisições simultâneas nunca
 * conseguem escolher o mesmo presente. Se algo falhar, o estado é revertido.
 */
function tx(fn) {
  const snapshot = JSON.stringify(db);
  try { const r = fn(); save(); return r; }
  catch (e) { db = JSON.parse(snapshot); throw e; }
}

/* ------------------------------------------------------------------ *
 * Utilidades
 * ------------------------------------------------------------------ */
const sessions = new Map(); // token -> criadoEm
const SESSION_TTL = 12 * 3600 * 1000;
const adminPassword = env('ADMIN_PASSWORD', 'AnaJulia19!Troque');
const adminEmail = () => db.settings.adminEmail.toLowerCase();
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

const send = (res, status, obj) => {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': 'same-origin'});
  res.end(JSON.stringify(obj));
};
const readBody = (req, limit = 1e6) => new Promise((resolve, reject) => {
  let s = '';
  req.on('data', c => { s += c; if (s.length > limit) { reject(new HttpError(413, 'Corpo muito grande')); req.destroy(); } });
  req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new HttpError(400, 'JSON inválido')); } });
});

function isAdmin(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return false;
  const t = h.slice(7), created = sessions.get(t);
  if (!created) return false;
  if (Date.now() - created > SESSION_TTL) { sessions.delete(t); return false; }
  return true;
}

// tentativas de login (proteção simples contra força bruta)
const attempts = new Map();
function throttle(ip, ok) {
  const now = Date.now(), a = attempts.get(ip) || {n: 0, until: 0, first: now};
  if (a.until > now) throw new HttpError(429, 'Muitas tentativas. Aguarde alguns minutos.');
  if (ok) { attempts.delete(ip); return; }
  if (now - a.first > 600000) { a.n = 0; a.first = now; }
  a.n++; if (a.n >= 8) a.until = now + 600000;
  attempts.set(ip, a);
}

const normName = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// convidado identificado pelo token recebido na confirmação de presença
function guestFromReq(req) {
  const t = String(req.headers['x-guest-token'] || '');
  if (t.length < 20) return null;
  return db.rsvps.find(r => r.token && r.token.length === t.length && safeEqual(r.token, t)) || null;
}
const giftOf = r => r && db.gifts.find(g => g.chosenBy === r.id) || null;
const guestSummary = r => r && ({name: r.name, attendance: r.attendance, people: r.people, gift: giftOf(r) ? {id: giftOf(r).id, name: giftOf(r).name} : null});
const publicSettings = () => { const {adminEmail: _omit, ...rest} = db.settings; return rest; };
const publicGift = (g, me) => ({id: g.id, name: g.name, description: g.description, image: g.image, buyUrl: g.buyUrl || '', available: !g.chosenBy, mine: !!me && g.chosenBy === me.id});

/* ------------------------------------------------------------------ *
 * Imagens dos presentes
 * ------------------------------------------------------------------ */
const IMG_LOCAL = /^\/uploads\/[a-f0-9-]+\.(jpg|png|webp)$/;
function saveImageData(dataUrl) {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw new HttpError(400, 'Imagem inválida. Use PNG, JPG ou WebP.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 2 * 1024 * 1024) throw new HttpError(400, 'Imagem muito grande (máx. 2 MB).');
  const okMagic = (m[1] === 'png' && buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])))
    || (m[1] === 'jpeg' && buf[0] === 0xff && buf[1] === 0xd8)
    || (m[1] === 'webp' && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP');
  if (!okMagic) throw new HttpError(400, 'O arquivo não parece ser uma imagem válida.');
  const name = uid() + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(uploadDir, name), buf);
  return '/uploads/' + name;
}
const removeLocalImage = url => { if (IMG_LOCAL.test(url || '')) fs.rm(path.join(here, 'data', url), {force: true}, () => {}); };

/** Valida o link de compra: aceita só http/https; se faltar o esquema (ex.: "www.loja.com"), acrescenta https://. */
function normalizeBuyUrl(raw) {
  let v = String(raw || '').trim();
  if (!v) return '';
  if (v.length > 500 || /\s/.test(v)) throw new HttpError(400, 'Link de compra inválido. Confira o endereço.');
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
  let u;
  try { u = new URL(v); } catch { throw new HttpError(400, 'Link de compra inválido. Confira o endereço.'); }
  if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) throw new HttpError(400, 'Link de compra inválido. Use um endereço http:// ou https:// completo.');
  return u.href;
}

function readGiftFields(b) {
  const name = String(b.name || '').trim(), description = String(b.description || '').trim();
  if (!name || name.length > 120) throw new HttpError(400, 'Informe o nome do presente (até 120 caracteres).');
  if (description.length > 300) throw new HttpError(400, 'A descrição pode ter até 300 caracteres.');
  let image = String(b.image || '').trim();
  if (image && !IMG_LOCAL.test(image) && !/^https?:\/\/\S{1,500}$/i.test(image)) throw new HttpError(400, 'Link de imagem inválido.');
  return {name, description, image, buyUrl: normalizeBuyUrl(b.buyUrl)};
}

/* ------------------------------------------------------------------ *
 * Rotas
 * ------------------------------------------------------------------ */
async function api(req, res, p, ip) {
  const method = req.method;

  /* ---------- públicas ---------- */
  if (method === 'GET' && p === '/api/public') {
    const me = guestFromReq(req);
    return send(res, 200, {settings: publicSettings(), gifts: db.gifts.filter(g => g.active).map(g => publicGift(g, me)), me: guestSummary(me)});
  }

  if (method === 'POST' && p === '/api/rsvp') {
    const b = await readBody(req);
    const out = tx(() => {
      if (!db.settings.rsvpEnabled) throw new HttpError(403, 'As confirmações estão encerradas.');
      const name = String(b.name || '').trim().replace(/\s+/g, ' ');
      const attendance = b.attendance === 'yes' ? 'yes' : b.attendance === 'no' ? 'no' : null;
      const message = String(b.message || '').trim();
      if (name.length < 2 || name.length > 100) throw new HttpError(400, 'Informe seu nome completo.');
      if (!attendance) throw new HttpError(400, 'Informe se você irá comparecer.');
      let people = 0;
      if (attendance === 'yes') {
        people = Number(b.people);
        if (!Number.isInteger(people) || people < 1 || people > 10) throw new HttpError(400, 'Informe quantas pessoas irão (de 1 a 10, incluindo você).');
      }
      if (message.length > 500) throw new HttpError(400, 'A mensagem é muito longa.');

      const existing = db.rsvps.find(r => normName(r.name) === normName(name));
      if (existing && existing.token) {
        throw new HttpError(409, 'Este nome já confirmou presença. Se você já confirmou, use o mesmo aparelho/navegador para escolher seu presente; se precisar de ajuda, fale com a Ana.');
      }
      const token = crypto.randomBytes(24).toString('hex');
      let r = existing; // resposta antiga (sem token) é "adotada" uma única vez
      if (r) Object.assign(r, {name, attendance, people, message, token});
      else { r = {id: uid(), name, attendance, people, message, token, createdAt: new Date().toISOString()}; db.rsvps.push(r); }
      return {token, guest: guestSummary(r)};
    });
    return send(res, 201, {message: out.guest.attendance === 'yes' ? 'Presença confirmada! Obrigada ♥' : 'Resposta registrada. Sentiremos sua falta ♥', ...out});
  }

  if (method === 'POST' && p === '/api/gift/choose') {
    const b = await readBody(req);
    const out = tx(() => {
      if (!db.settings.reservationsEnabled) throw new HttpError(403, 'A escolha de presentes está encerrada.');
      const me = guestFromReq(req);
      if (!me) throw new HttpError(401, 'Confirme sua presença primeiro para escolher um presente.');
      if (me.attendance !== 'yes') throw new HttpError(403, 'Apenas convidados com presença confirmada podem escolher presente.');
      const mine = giftOf(me);
      if (mine) throw new HttpError(409, `Você já escolheu um presente (${mine.name}). Cada convidado pode escolher apenas um.`);
      const g = db.gifts.find(x => x.id === b.giftId && x.active);
      if (!g) throw new HttpError(404, 'Este presente não está mais na lista.');
      if (g.chosenBy) throw new HttpError(409, 'Ops! Alguém acabou de escolher este presente. Escolha outro da lista.');
      g.chosenBy = me.id; g.chosenAt = new Date().toISOString();
      return {guest: guestSummary(me)};
    });
    return send(res, 201, {message: 'Presente escolhido! Obrigada pelo carinho ♥', ...out});
  }

  if (method === 'POST' && p === '/api/login') {
    const b = await readBody(req);
    const ok = String(b.email || '').toLowerCase() === adminEmail() && safeEqual(b.password ?? '', adminPassword);
    throttle(ip, ok);
    if (!ok) throw new HttpError(401, 'E-mail ou senha incorretos.');
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now());
    return send(res, 200, {token});
  }

  /* ---------- administrativas ---------- */
  if (!isAdmin(req)) throw new HttpError(401, 'Sessão expirada. Entre novamente.');

  if (method === 'GET' && p === '/api/admin') {
    const byId = id => db.rsvps.find(r => r.id === id);
    return send(res, 200, {
      settings: db.settings,
      gifts: db.gifts.map(g => ({...g, chosenByName: g.chosenBy ? byId(g.chosenBy)?.name || '(convidado removido)' : '', chosenByPeople: g.chosenBy ? byId(g.chosenBy)?.people || 0 : 0})),
      rsvps: db.rsvps.map(r => ({...r, giftId: giftOf(r)?.id || '', giftName: giftOf(r)?.name || ''}))
    });
  }

  if (method === 'POST' && p === '/api/gift') {
    const b = await readBody(req, 4e6);
    tx(() => {
      const f = readGiftFields(b);
      if (b.imageData) f.image = saveImageData(b.imageData);
      db.gifts.push({id: uid(), ...f, active: true, chosenBy: null, chosenAt: null, createdAt: new Date().toISOString()});
    });
    return send(res, 201, {ok: true});
  }

  const gm = /^\/api\/gift\/([^/]+?)(\/release)?$/.exec(p);
  if (gm) {
    const gid = gm[1];
    if (method === 'POST' && gm[2]) {
      tx(() => { const g = db.gifts.find(x => x.id === gid); if (!g) throw new HttpError(404, 'Presente não encontrado.'); g.chosenBy = null; g.chosenAt = null; });
      return send(res, 200, {ok: true});
    }
    if (method === 'PUT') {
      const b = await readBody(req, 4e6);
      tx(() => {
        const g = db.gifts.find(x => x.id === gid); if (!g) throw new HttpError(404, 'Presente não encontrado.');
        const f = readGiftFields(b), old = g.image;
        if (b.imageData) f.image = saveImageData(b.imageData);
        Object.assign(g, f);
        if (old !== g.image) removeLocalImage(old);
      });
      return send(res, 200, {ok: true});
    }
    if (method === 'PATCH') {
      const b = await readBody(req);
      tx(() => { const g = db.gifts.find(x => x.id === gid); if (!g) throw new HttpError(404, 'Presente não encontrado.'); g.active = !!b.active; });
      return send(res, 200, {ok: true});
    }
    if (method === 'DELETE') {
      tx(() => {
        const g = db.gifts.find(x => x.id === gid); if (!g) throw new HttpError(404, 'Presente não encontrado.');
        if (g.chosenBy) throw new HttpError(409, 'Este presente já foi escolhido. Libere-o antes de excluir.');
        db.gifts = db.gifts.filter(x => x.id !== gid);
        removeLocalImage(g.image);
      });
      return send(res, 200, {ok: true});
    }
  }

  if (method === 'PUT' && p === '/api/settings') {
    const b = await readBody(req);
    tx(() => {
      if (!b.eventName || !b.eventDate || !b.adminEmail) throw new HttpError(400, 'Preencha nome, data e e-mail.');
      for (const k of ['eventName', 'eventDate', 'address', 'mapsUrl', 'musicUrl', 'heroImage', 'adminEmail']) if (k in b) db.settings[k] = String(b[k]);
      for (const k of ['rsvpEnabled', 'reservationsEnabled']) if (k in b) db.settings[k] = !!b[k];
    });
    return send(res, 200, {ok: true});
  }

  if (method === 'GET' && p === '/api/rsvps') return send(res, 200, {rsvps: db.rsvps.map(({token, ...r}) => r)});

  if (method === 'DELETE' && p.startsWith('/api/rsvp/')) {
    const rid = p.split('/').pop();
    tx(() => {
      for (const g of db.gifts) if (g.chosenBy === rid) { g.chosenBy = null; g.chosenAt = null; } // libera o presente do convidado removido
      db.rsvps = db.rsvps.filter(r => r.id !== rid);
    });
    return send(res, 200, {ok: true});
  }

  throw new HttpError(404, 'Rota não encontrada.');
}

const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg'};

async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Guest-Token'});
    return res.end();
  }
  const p = new URL(req.url, 'http://localhost').pathname;
  if (p.startsWith('/api/')) {
    try { return await api(req, res, p, req.socket.remoteAddress || ''); }
    catch (e) { return send(res, e.status || 500, {error: e.status ? e.message : 'Erro interno'}); }
  }
  // arquivos enviados pelo painel ficam em data/uploads
  const isUpload = p.startsWith('/uploads/');
  const root = isUpload ? uploadDir : pub;
  const filePath = isUpload ? path.resolve(uploadDir, '.' + p.slice('/uploads'.length)) : (p === '/' ? path.join(pub, 'index.html') : path.resolve(pub, '.' + p));
  if (!filePath.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}); return res.end('Arquivo não encontrado'); }
    const h = {'Content-Type': types[path.extname(filePath)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff'};
    if (isUpload) h['Cache-Control'] = 'public, max-age=86400';
    res.writeHead(200, h); res.end(buf);
  });
}

const port = Number(env('PORT', '4173'));
http.createServer(handler).listen(port, '0.0.0.0', () => console.log(`Convite disponível em http://localhost:${port}`));
