import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const pub=path.join(here,'public'), dataDir=path.join(here,'data'), dbFile=path.join(dataDir,'db.json');
fs.mkdirSync(dataDir,{recursive:true});
const env=(k,d='')=>process.env[k]||d;
const initial={
 settings:{eventName:'Birthday 19 — Ana Júlia',eventDate:'2026-12-06T12:00:00-03:00',address:'Endereço a confirmar',mapsUrl:'',musicUrl:'',heroImage:'',adminEmail:env('ADMIN_EMAIL','admin@convite.local'),rsvpEnabled:true,reservationsEnabled:true},
 gifts:[
 {id:'g1',name:'Perfume',quantity:1,active:true},{id:'g2',name:'Maquiagem',quantity:1,active:true},
 {id:'g3',name:'Bolsa',quantity:1,active:true},{id:'g4',name:'Bijuteria ou acessório',quantity:0,active:true},
 {id:'g5',name:'Flores',quantity:0,active:true},{id:'g6',name:'Vale-presente',quantity:0,active:true},
 {id:'g7',name:'Chocolate',quantity:0,active:true},{id:'g8',name:'Um mimo surpresa',quantity:0,active:true}
 ],rsvps:[],reservations:[]};
if(!fs.existsSync(dbFile))fs.writeFileSync(dbFile,JSON.stringify(initial,null,2));
let db=JSON.parse(fs.readFileSync(dbFile,'utf8'));
const save=()=>fs.writeFileSync(dbFile,JSON.stringify(db,null,2));
const sessions=new Map();
const adminPassword=env('ADMIN_PASSWORD','AnaJulia19!Troque');
const adminEmail=()=>db.settings.adminEmail.toLowerCase();
const send=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'same-origin'});res.end(JSON.stringify(obj))};
const body=req=>new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1e6){reject(Error('Corpo muito grande'));req.destroy()}});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch{reject(Error('JSON inválido'))}})});
const publicGift=g=>({...g,reserved:db.reservations.filter(r=>r.giftId===g.id&&r.status==='active').length});
const auth=req=>{const h=req.headers.authorization||'';return h.startsWith('Bearer ')&&sessions.has(h.slice(7))};
const id=()=>crypto.randomUUID();
async function handler(req,res){
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'});return res.end()}
 const u=new URL(req.url,'http://localhost'),p=u.pathname;
 if(req.method==='POST'&&p==='/api/rsvp'){try{const b=await body(req);if(!db.settings.rsvpEnabled)return send(res,403,{error:'As confirmações estão encerradas.'});const name=String(b.name||'').trim(),attendance=b.attendance==='no'?'no':'yes',companions=Number(b.companions||0),message=String(b.message||'').trim();if(name.length<2||name.length>100)return send(res,400,{error:'Informe seu nome completo.'});if(!Number.isInteger(companions)||companions<0||companions>5)return send(res,400,{error:'Quantidade de acompanhantes inválida.'});if(message.length>500)return send(res,400,{error:'A mensagem é muito longa.'});db.rsvps.push({id:id(),name,attendance,companions:attendance==='yes'?companions:0,message,createdAt:new Date().toISOString()});save();return send(res,201,{message:'Resposta registrada com sucesso. Obrigada! ♥'})}catch(e){return send(res,400,{error:e.message})}}
 if(req.method==='POST'&&p==='/api/reserve'){try{const b=await body(req);if(!db.settings.reservationsEnabled)return send(res,403,{error:'As reservas de presentes estão encerradas.'});const guestName=String(b.guestName||'').trim(),g=db.gifts.find(x=>x.id===b.giftId&&x.active);if(guestName.length<2)return send(res,400,{error:'Informe seu nome na confirmação de presença antes de reservar.'});if(!g)return send(res,404,{error:'Este presente não está disponível.'});const count=db.reservations.filter(r=>r.giftId===g.id&&r.status==='active').length;if(g.quantity!==0&&count>=g.quantity)return send(res,409,{error:'Este presente acabou de ser reservado por outra pessoa. Gire novamente.'});const rsvp=db.rsvps.find(r=>r.name.toLowerCase()===guestName.toLowerCase()&&r.attendance==='yes');if(!rsvp)return send(res,400,{error:'Primeiro envie uma confirmação de presença com este nome.'});if(db.reservations.some(r=>r.rsvpId===rsvp.id&&r.status==='active'))return send(res,409,{error:'Você já reservou um presente. Peça à organização para alterar a reserva.'});db.reservations.push({id:id(),giftId:g.id,rsvpId:rsvp.id,guestName,status:'active',createdAt:new Date().toISOString()});save();return send(res,201,{message:'Presente reservado para você! Obrigada pelo carinho ♥'})}catch(e){return send(res,400,{error:e.message})}}
 if(p.startsWith('/api/')){
  try{
   if(req.method==='GET'&&p==='/api/public')return send(res,200,{settings:db.settings,gifts:db.gifts.filter(g=>g.active).map(publicGift)});
   if(req.method==='POST'&&p==='/api/login'){const b=await body(req);if(String(b.email||'').toLowerCase()!==adminEmail()||b.password!==adminPassword)return send(res,401,{error:'E-mail ou senha incorretos.'});const token=crypto.randomBytes(32).toString('hex');sessions.set(token,Date.now());return send(res,200,{token})}
   if(!auth(req))return send(res,401,{error:'Sessão expirada. Entre novamente.'});
   if(req.method==='GET'&&p==='/api/admin')return send(res,200,{settings:db.settings,gifts:db.gifts.map(publicGift),rsvps:db.rsvps.map(r=>({...r,giftName:db.gifts.find(g=>g.id===db.reservations.find(x=>x.rsvpId===r.id&&x.status==='active')?.giftId)?.name||''})),reservations:db.reservations.filter(r=>r.status==='active')});
   if(req.method==='POST'&&p==='/api/gift'){const b=await body(req),name=String(b.name||'').trim(),quantity=Number(b.quantity);if(!name||name.length>120||!Number.isInteger(quantity)||quantity<0)return send(res,400,{error:'Informe nome e quantidade válida.'});db.gifts.push({id:id(),name,quantity,active:true});save();return send(res,201,{ok:true})}
   if(p.startsWith('/api/gift/')){const gid=p.split('/').pop(),g=db.gifts.find(x=>x.id===gid);if(!g)return send(res,404,{error:'Presente não encontrado.'});if(req.method==='PATCH'){const b=await body(req);g.active=!!b.active;save();return send(res,200,{ok:true})}if(req.method==='DELETE'){if(db.reservations.some(r=>r.giftId===gid&&r.status==='active'))return send(res,409,{error:'Libere ou remova as reservas antes de excluir este presente.'});db.gifts=db.gifts.filter(x=>x.id!==gid);save();return send(res,200,{ok:true})}}
   if(req.method==='PUT'&&p==='/api/settings'){const b=await body(req);if(!b.eventName||!b.eventDate||!b.adminEmail)return send(res,400,{error:'Preencha nome, data e e-mail.'});for(const k of ['eventName','eventDate','address','mapsUrl','musicUrl','heroImage','adminEmail','rsvpEnabled','reservationsEnabled'])if(k in b)db.settings[k]=b[k];save();return send(res,200,{ok:true})}
   if(req.method==='GET'&&p==='/api/rsvps')return send(res,200,{rsvps:db.rsvps});
   if(req.method==='DELETE'&&p.startsWith('/api/rsvp/')){const rid=p.split('/').pop();db.rsvps=db.rsvps.filter(r=>r.id!==rid);db.reservations=db.reservations.filter(r=>r.rsvpId!==rid);save();return send(res,200,{ok:true})}
   return send(res,404,{error:'Rota não encontrada.'});
  }catch(e){return send(res,500,{error:e.message||'Erro interno'})}
 }
 const filePath=p==='/'?path.join(pub,'index.html'):path.resolve(pub,'.'+p);
 if(!filePath.startsWith(pub+path.sep)&&filePath!==path.join(pub,'index.html')){res.writeHead(403);return res.end('Forbidden')}
 fs.readFile(filePath,(err,buf)=>{if(err){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Arquivo não encontrado')};const ext=path.extname(filePath);const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.mp3':'audio/mpeg'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(buf)});
}
const server=http.createServer(handler);
server.listen(Number(env('PORT','4173')),'0.0.0.0',()=>console.log(`Convite disponível em http://localhost:${env('PORT','4173')}`));