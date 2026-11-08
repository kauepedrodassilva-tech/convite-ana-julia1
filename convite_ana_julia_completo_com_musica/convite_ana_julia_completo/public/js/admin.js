const $=s=>document.querySelector(s);let token='',data={};
async function api(path,opts={}){const r=await fetch('/api/'+path,{headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...opts});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Erro inesperado');return d}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function login(e){e?.preventDefault();$('#loginMsg').textContent='Validando…';try{const d=await api('login',{method:'POST',body:JSON.stringify({email:$('#email').value,password:$('#password').value})});token=d.token;sessionStorage.setItem('adminToken',token);$('#loginPanel').hidden=true;$('#adminApp').hidden=false;await load()}catch(err){$('#loginMsg').textContent=err.message}}
async function load(){try{data=await api('admin');render()}catch(e){token='';sessionStorage.removeItem('adminToken');$('#loginPanel').hidden=false;$('#adminApp').hidden=true;$('#loginMsg').textContent=e.message}}
const act=async(fn)=>{try{await fn();await load()}catch(e){alert(e.message)}};

function render(){
  const r=data.rsvps,yes=r.filter(x=>x.attendance==='yes'),people=x=>x.attendance==='yes'?(Number(x.people)||1):0;
  $('#stats').innerHTML=[[yes.length,'Total de confirmações'],[yes.reduce((n,x)=>n+people(x),0),'Pessoas confirmadas'],[r.length-yes.length,'Não irão']].map(x=>`<div class="stat"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('');

  /* confirmações */
  const q=$('#searchGuest').value.toLowerCase(),f=$('#filterAttendance').value;
  $('#guestRows').innerHTML=r.filter(x=>x.name.toLowerCase().includes(q)&&(!f||x.attendance===f)).map(x=>`<tr><td>${esc(x.name)}</td><td>${x.attendance==='yes'?'Vai':'Não vai'}</td><td>${x.attendance==='yes'?people(x):'—'}</td><td>${esc(x.message)}</td><td>${new Date(x.createdAt).toLocaleString('pt-BR')}</td><td><div class="row-actions"><button class="btn light" data-redit="${x.id}">Editar</button>${x.attendance==='yes'&&x.token?`<button class="btn light" data-link="${x.id}" title="Copia um link pessoal para o convidado recuperar o acesso em outro aparelho">Copiar link</button>`:''}<button class="btn light" data-delete="${x.id}">Excluir</button></div></td></tr>`).join('')||'<tr><td colspan="6">Nenhuma confirmação.</td></tr>';
  $('#guestRows').querySelectorAll('[data-redit]').forEach(b=>b.onclick=()=>startRsvpEdit(data.rsvps.find(x=>x.id===b.dataset.redit)));
  $('#guestRows').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{if(confirm('Excluir esta resposta?'))act(()=>api('rsvp/'+b.dataset.delete,{method:'DELETE'}))});
  $('#guestRows').querySelectorAll('[data-link]').forEach(b=>b.onclick=async()=>{const g=data.rsvps.find(x=>x.id===b.dataset.link),url=location.origin+'/?g='+g.token+'#gifts';try{await navigator.clipboard.writeText(url);b.textContent='Copiado!'}catch{prompt('Copie o link pessoal:',url)}});

  /* presentes */
  $('#giftRows').innerHTML=data.gifts.map((g,i)=>`<tr><td>${g.image?`<img class="thumb" src="${esc(g.image)}" alt="">`:'<div class="thumb thumb-empty">🎁</div>'}</td><td><b>${esc(g.name)}</b><br><small>${esc(g.description)}</small></td><td>${g.active?'<span class="pill free">Visível no convite</span>':'<span class="pill hidden">Oculto no convite</span>'}</td><td><div class="row-actions"><button class="btn light" data-move="${g.id}" data-dir="up" title="Subir" ${i===0?'disabled':''}>↑</button><button class="btn light" data-move="${g.id}" data-dir="down" title="Descer" ${i===data.gifts.length-1?'disabled':''}>↓</button><button class="btn light" data-edit="${g.id}">Editar</button><button class="btn light" data-toggle="${g.id}">${g.active?'Ocultar':'Mostrar'}</button><button class="btn light" data-delgift="${g.id}">Excluir</button></div></td></tr>`).join('')||'<tr><td colspan="4">Nenhum presente cadastrado.</td></tr>';
  const gi=id=>data.gifts.find(g=>g.id===id);
  $('#giftRows').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>startEdit(gi(b.dataset.edit)));
  $('#giftRows').querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>act(()=>api('gift/'+b.dataset.move+'/move',{method:'POST',body:JSON.stringify({direction:b.dataset.dir})})));
  $('#giftRows').querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>act(()=>api('gift/'+b.dataset.toggle,{method:'PATCH',body:JSON.stringify({active:!gi(b.dataset.toggle).active})})));
  $('#giftRows').querySelectorAll('[data-delgift]').forEach(b=>b.onclick=()=>{const g=gi(b.dataset.delgift);if(confirm(`Excluir "${g.name}"?`))act(()=>api('gift/'+g.id,{method:'DELETE'}))});

  const s=data.settings;$('#eventName').value=s.eventName;$('#eventDate').value=s.eventDate.slice(0,16);$('#address').value=s.address||'';$('#mapsUrl').value=s.mapsUrl||'';$('#musicUrl').value=s.musicUrl||'';$('#heroImage').value=s.heroImage||'';$('#adminEmail').value=s.adminEmail;$('#rsvpEnabled').checked=s.rsvpEnabled;
  const h=s.honoree||{};if(!$('#honoreeForm').dataset.dirty){$('#hName').value=h.name||'';$('#hClothing').value=h.clothingSize||'';$('#hShoe').value=h.shoeSize||''}}

/* ---------- formulário de presente (cadastrar / editar) ---------- */
let editId=null,imgValue='',imgData=null;
function showThumb(){const t=$('#giftThumb'),src=imgData||imgValue;t.hidden=!src;if(src)t.src=src;$('#giftImgClear').hidden=!src}
function resetGiftForm(){editId=null;imgValue='';imgData=null;$('#giftForm').reset();$('#giftSubmit').textContent='Adicionar presente';$('#giftCancel').hidden=true;$('#giftFormMsg').textContent='';showThumb()}
function startEdit(g){editId=g.id;imgValue=g.image||'';imgData=null;$('#giftName').value=g.name;$('#giftDesc').value=g.description||'';$('#giftImageUrl').value=/^https?:/.test(imgValue)?imgValue:'';$('#giftFile').value='';$('#giftSubmit').textContent='Salvar alterações';$('#giftCancel').hidden=false;$('#giftFormMsg').textContent='Editando “'+g.name+'”.';showThumb();$('#giftForm').scrollIntoView({behavior:'smooth',block:'center'})}
$('#giftCancel').onclick=resetGiftForm;
$('#giftImageUrl').oninput=e=>{imgData=null;imgValue=e.target.value.trim();$('#giftFile').value='';showThumb()};
$('#giftImgClear').onclick=()=>{imgValue='';imgData=null;$('#giftImageUrl').value='';$('#giftFile').value='';showThumb()};
/* reduz a imagem no navegador (máx. 900px, JPEG) para o arquivo ficar leve */
$('#giftFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const bmp=await createImageBitmap(file),k=Math.min(1,900/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(bmp,0,0,c.width,c.height);imgData=c.toDataURL('image/jpeg',.85);$('#giftImageUrl').value='';showThumb()}catch{$('#giftFormMsg').textContent='Não foi possível ler esta imagem.';e.target.value=''}};
$('#giftForm').onsubmit=async e=>{e.preventDefault();const body=JSON.stringify({name:$('#giftName').value.trim(),description:$('#giftDesc').value.trim(),image:imgValue,imageData:imgData});$('#giftFormMsg').textContent='Salvando…';try{await api(editId?'gift/'+editId:'gift',{method:editId?'PUT':'POST',body});resetGiftForm();$('#giftFormMsg').textContent='Presente salvo!';await load()}catch(err){$('#giftFormMsg').textContent=err.message}};

$('#loginForm').onsubmit=login;$('#logoutBtn').onclick=()=>{token='';sessionStorage.removeItem('adminToken');$('#loginPanel').hidden=false;$('#adminApp').hidden=true};$('#searchGuest').oninput=()=>render();$('#filterAttendance').onchange=()=>render();
$('#settingsForm').onsubmit=async e=>{e.preventDefault();$('#settingsMsg').textContent='Salvando…';try{await api('settings',{method:'PUT',body:JSON.stringify({eventName:$('#eventName').value,eventDate:new Date($('#eventDate').value).toISOString(),address:$('#address').value,mapsUrl:$('#mapsUrl').value,musicUrl:$('#musicUrl').value,heroImage:$('#heroImage').value,adminEmail:$('#adminEmail').value,rsvpEnabled:$('#rsvpEnabled').checked})});$('#settingsMsg').textContent='Configurações salvas!'}catch(e){$('#settingsMsg').textContent=e.message}};
$('#exportBtn').onclick=()=>{const rows=[['Responsável','Status','Pessoas (total)','Mensagem','Data da confirmação'],...data.rsvps.map(x=>[x.name,x.attendance==='yes'?'Confirmado':'Não vai',x.attendance==='yes'?(Number(x.people)||1):0,x.message,x.createdAt])];const csv=rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));a.download='convidados-ana-julia.csv';a.click()};
/* ---------- editar confirmação ---------- */
let reId=null;
function startRsvpEdit(x){reId=x.id;$('#reName').value=x.name;$('#reAtt').value=x.attendance;$('#rePeople').value=x.attendance==='yes'?(Number(x.people)||1):'';$('#reMsg').value=x.message||'';syncRe();$('#reFormMsg').textContent='';$('#rsvpEditForm').hidden=false;$('#rsvpEditForm').scrollIntoView({behavior:'smooth',block:'center'})}
const syncRe=()=>{$('#rePeopleBox').hidden=$('#reAtt').value!=='yes'};
$('#reAtt').onchange=syncRe;$('#reCancel').onclick=()=>{reId=null;$('#rsvpEditForm').hidden=true};
$('#rsvpEditForm').onsubmit=async e=>{e.preventDefault();$('#reFormMsg').textContent='Salvando…';try{await api('rsvp/'+reId,{method:'PUT',body:JSON.stringify({name:$('#reName').value.trim(),attendance:$('#reAtt').value,people:$('#reAtt').value==='yes'?Number($('#rePeople').value):0,message:$('#reMsg').value.trim()})});reId=null;$('#rsvpEditForm').hidden=true;await load()}catch(err){$('#reFormMsg').textContent=err.message}};

/* ---------- informações da aniversariante ---------- */
$('#honoreeForm').oninput=()=>{$('#honoreeForm').dataset.dirty='1'};
$('#honoreeForm').onsubmit=async e=>{e.preventDefault();$('#honoreeMsg').textContent='Salvando…';try{await api('honoree',{method:'PUT',body:JSON.stringify({name:$('#hName').value,clothingSize:$('#hClothing').value,shoeSize:$('#hShoe').value})});delete $('#honoreeForm').dataset.dirty;await load();$('#honoreeMsg').textContent='Informações salvas! O convite já mostra os dados atualizados.'}catch(err){$('#honoreeMsg').textContent=err.message}};

token=sessionStorage.getItem('adminToken')||'';if(token){$('#loginPanel').hidden=true;$('#adminApp').hidden=false;load()}
