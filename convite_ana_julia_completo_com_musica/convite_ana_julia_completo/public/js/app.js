const $=s=>document.querySelector(s);
let settings={}, gifts=[], honoree=null, me=null;
const TOKEN_KEY='convite_guest_token'; /* guarda só a identidade do convidado; a disponibilidade dos presentes vem sempre do servidor */
const getToken=()=>{try{return localStorage.getItem(TOKEN_KEY)||''}catch{return ''}};
const setToken=t=>{try{t?localStorage.setItem(TOKEN_KEY,t):localStorage.removeItem(TOKEN_KEY)}catch{}};
async function api(path, opts={}){const t=getToken();const r=await fetch('/api/'+path,{headers:{'Content-Type':'application/json',...(t?{'X-Guest-Token':t}:{})},...opts});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Não foi possível concluir.');return d}
function dateParts(s){const d=new Date(s);return {date:d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}),time:d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}}
function countdown(){const target=new Date(settings.eventDate||'2026-12-06T12:00:00-03:00').getTime(),n=Math.max(0,target-Date.now()),days=Math.floor(n/86400000),hours=Math.floor(n%86400000/3600000),mins=Math.floor(n%3600000/60000),secs=Math.floor(n%60000/1000);$('#countdown').innerHTML=[[days,'dias'],[hours,'horas'],[mins,'minutos'],[secs,'segundos']].map(x=>`<div><b>${x[0]}</b><span>${x[1]}</span></div>`).join('')}
const firstName=n=>String(n||'').trim().split(/\s+/)[0];
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};

/* ---------- confirmação de presença ---------- */
function buildPeopleSelect(){const s=$('#people');s.innerHTML='';s.append(new Option('Selecione…',''));for(let i=1;i<=10;i++)s.append(new Option(i===1?'1 pessoa (somente eu)':i+' pessoas',i))}
function syncPeopleField(){const yes=document.querySelector('input[name=attendance]:checked')?.value==='yes';$('#peopleGroup').hidden=!yes;$('#people').required=yes;if(!yes)$('#people').value=''}
function renderRsvp(){
  const form=$('#rsvpForm'),done=$('#rsvpDone');
  $('#rsvp').hidden=!settings.rsvpEnabled&&!me;
  form.hidden=!!me;$('#rsvpIntro').hidden=!!me;done.hidden=!me;
  if(!me)return;
  done.innerHTML='';
  if(me.attendance==='yes'){
    done.append(el('div','flower','✿'),el('h3',null,'Presença confirmada, '+firstName(me.name)+'!'),
      el('p',null,me.people===1?'Anotamos que você irá sozinho(a). Mal podemos esperar!':'Anotamos '+me.people+' pessoas no total (você e mais '+(me.people-1)+'). Mal podemos esperar!'));
    const a=el('a','btn light','Ver lista de presentes ✧');a.href='#gifts';done.append(a);
  }else{
    done.append(el('div','flower','✿'),el('h3',null,'Obrigada por avisar, '+firstName(me.name)+'!'),el('p',null,'Sentiremos sua falta, mas agradecemos o carinho ♥'));
  }
}
$('#rsvpForm').onsubmit=async e=>{e.preventDefault();const msg=$('#rsvpMsg'),att=document.querySelector('input[name=attendance]:checked')?.value;
  if(!att){msg.textContent='Informe se você irá comparecer.';return}
  if(att==='yes'&&!$('#people').value){msg.textContent='Selecione quantas pessoas irão ao evento (incluindo você).';$('#people').focus();return}
  msg.textContent='Enviando…';
  try{const d=await api('rsvp',{method:'POST',body:JSON.stringify({name:$('#name').value.trim(),attendance:att,people:att==='yes'?Number($('#people').value):0,message:$('#message').value.trim()})});
    setToken(d.token);me=d.guest;msg.textContent='';$('#rsvpForm').reset();syncPeopleField();renderRsvp();
    $('#rsvp').scrollIntoView({block:'start'})}
  catch(err){msg.textContent=err.message}};
document.querySelectorAll('input[name=attendance]').forEach(r=>r.onchange=syncPeopleField);

/* ---------- lista de presentes (somente informativa) ---------- */
function renderGifts(){
  const ul=$('#giftList');ul.innerHTML='';$('#giftEmpty').hidden=gifts.length>0;
  gifts.forEach(g=>{
    const li=el('li','gift-item'),body=el('div','gift-text');body.append(el('h3',null,g.name));if(g.description)body.append(el('p',null,g.description));
    li.append(body);ul.append(li)});
}
/* ---------- informações da aniversariante ---------- */
function renderAbout(){
  const h=honoree||{},rows=[['🌸','Nome',h.name],['👗','Tamanho de roupa',h.clothingSize],['👟','Calçado',h.shoeSize]].filter(r=>r[2]); /* campos vazios não aparecem */
  $('#about').hidden=!rows.length;if(!rows.length)return;
  $('#aboutTitle').textContent='Um pouquinho sobre '+(h.name||'a aniversariante')+' ❤️';
  const dl=$('#aboutList');dl.innerHTML='';
  rows.forEach(([ic,k,v])=>{const d=el('div','about-row');d.append(el('span','about-ic',ic),el('dt',null,k),el('dd',null,v));dl.append(d)});
}
async function refreshGifts(){try{const d=await api('public');settings=d.settings;gifts=d.gifts;honoree=d.honoree;if(getToken()&&!d.me)setToken('');me=d.me;renderRsvp();renderGifts();renderAbout()}catch(e){console.error(e)}}

async function init(){try{
  const q=new URLSearchParams(location.search).get('g'); /* link pessoal gerado pelo painel, para recuperar o acesso */
  if(q){setToken(q);history.replaceState(null,'',location.pathname+location.hash)}
  buildPeopleSelect();
  const d=await api('public');settings=d.settings;gifts=d.gifts;honoree=d.honoree;if(getToken()&&!d.me)setToken('');me=d.me;
  const parts=dateParts(settings.eventDate);$('#dateText').textContent=parts.date;$('#timeText').textContent=parts.time;$('#addressText').textContent=settings.address||'Endereço a confirmar';$('#mapBtn').href=settings.mapsUrl||'#';$('#mapBtn').style.display=settings.mapsUrl?'inline-flex':'none';
  const audio=$('#audio');audio.src='/audio/musica.mp3';audio.preload='auto';audio.load();$('#music').style.display='block';
  if(settings.heroImage){document.querySelector('.hero').style.backgroundImage=`linear-gradient(#fff9f2ed,#fff9f2ed),url("${settings.heroImage}")`;document.querySelector('.hero').style.backgroundSize='cover'}
  renderRsvp();renderGifts();renderAbout();countdown();setInterval(countdown,1000);
  setInterval(()=>{if(!document.hidden)refreshGifts()},60000); /* mantém a lista atualizada para quem deixa a página aberta */
}catch(e){console.error(e)}}
$('#openBtn').onclick=async()=>{$('#cover').classList.add('closed');try{if($('#audio').src)await $('#audio').play();$('#music').textContent='♫'}catch(e){$('#music').textContent='♫'}};
$('#music').onclick=async()=>{const a=$('#audio');if(!a.src)return;try{if(a.paused){await a.play();$('#music').textContent='♫'}else{a.pause();$('#music').textContent='♪'}}catch(e){}};
init();
