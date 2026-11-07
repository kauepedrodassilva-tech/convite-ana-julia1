const $=s=>document.querySelector(s);
let settings={}, gifts=[], me=null, pending=null;
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
    const a=el('a','btn','Escolher meu presente ✧');a.href='#gifts';done.append(a);
  }else{
    done.append(el('div','flower','✿'),el('h3',null,'Obrigada por avisar, '+firstName(me.name)+'!'),el('p',null,'Sentiremos sua falta, mas agradecemos o carinho ♥'));
  }
}
$('#rsvpForm').onsubmit=async e=>{e.preventDefault();const msg=$('#rsvpMsg'),att=document.querySelector('input[name=attendance]:checked')?.value;
  if(!att){msg.textContent='Informe se você irá comparecer.';return}
  if(att==='yes'&&!$('#people').value){msg.textContent='Selecione quantas pessoas irão ao evento (incluindo você).';$('#people').focus();return}
  msg.textContent='Enviando…';
  try{const d=await api('rsvp',{method:'POST',body:JSON.stringify({name:$('#name').value.trim(),attendance:att,people:att==='yes'?Number($('#people').value):0,message:$('#message').value.trim()})});
    setToken(d.token);me=d.guest;msg.textContent='';$('#rsvpForm').reset();syncPeopleField();renderRsvp();await refreshGifts();
    $('#rsvp').scrollIntoView({block:'start'})}
  catch(err){msg.textContent=err.message}};
document.querySelectorAll('input[name=attendance]').forEach(r=>r.onchange=syncPeopleField);

/* ---------- lista de presentes ---------- */
const canChoose=()=>settings.reservationsEnabled&&me&&me.attendance==='yes'&&!me.gift;
function renderStatus(){
  const s=$('#giftStatus');s.innerHTML='';s.className='gift-status';
  let text,link;
  if(!settings.reservationsEnabled)text='A escolha de presentes está encerrada. Você ainda pode ver a lista.';
  else if(!me){text='Para escolher um presente, primeiro ';link=['confirme sua presença','#rsvp']}
  else if(me.attendance!=='yes')text='Como você não poderá comparecer, não precisa escolher presente — mas fique à vontade para conhecer a lista ♥';
  else if(me.gift){s.classList.add('ok');text='Você escolheu: '+me.gift.name+' ♥ Obrigada pelo carinho!'}
  else text='Olá, '+firstName(me.name)+'! Toque em “Quero este presente” no item que você preferir.';
  s.append(text);if(link){const a=el('a',null,link[0]);a.href=link[1];s.append(a,'.')}
}
function renderGifts(){
  renderStatus();
  const grid=$('#giftGrid');grid.innerHTML='';$('#giftEmpty').hidden=gifts.length>0;
  gifts.forEach(g=>{
    const card=el('article','gift-card '+(g.mine?'mine':g.available?'available':'taken'));
    const media=el('div','gift-media');
    if(g.image){const img=new Image();img.src=g.image;img.alt=g.name;img.loading='lazy';img.onerror=()=>{img.remove();media.append(el('span','gift-ph','🎁'))};media.append(img)}else media.append(el('span','gift-ph','🎁'));
    media.append(el('span','badge',g.mine?'Escolhido por você ♥':g.available?'Disponível':'Já escolhido'));
    const body=el('div','gift-body');body.append(el('h3',null,g.name));if(g.description)body.append(el('p',null,g.description));
    const btn=el('button','btn'+(g.available&&canChoose()?'':' light'));btn.type='button';
    if(g.available&&canChoose()){btn.textContent='Quero este presente';btn.onclick=()=>askChoose(g)}
    else{btn.disabled=true;btn.textContent=g.mine?'Seu presente ♥':g.available?(me?(me.gift?'Você já escolheu':me.attendance!=='yes'?'Indisponível':'Escolha encerrada'):'Confirme sua presença'):'Indisponível'}
    if(g.buyUrl){const buy=el('a','btn light buy','Onde comprar? ↗');buy.href=g.buyUrl;buy.target='_blank';buy.rel='noopener noreferrer';body.append(buy)}
    body.append(btn);card.append(media,body);grid.append(card)});
}
async function refreshGifts(){try{const d=await api('public');settings=d.settings;gifts=d.gifts;if(getToken()&&!d.me)setToken('');me=d.me;renderRsvp();renderGifts()}catch(e){console.error(e)}}

/* ---------- confirmação da escolha ---------- */
const dlg=$('#confirmDialog');
function askChoose(g){pending=g;$('#dialogGift').textContent=g.name;$('#dialogErr').textContent='';$('#dialogOk').disabled=false;dlg.showModal()}
$('#dialogCancel').onclick=()=>{pending=null;dlg.close()};
$('#confirmForm').onsubmit=async e=>{e.preventDefault();if(!pending)return;const ok=$('#dialogOk');ok.disabled=true;$('#dialogErr').textContent='Enviando…';
  try{const d=await api('gift/choose',{method:'POST',body:JSON.stringify({giftId:pending.id})});dlg.close();pending=null;me=d.guest;await refreshGifts();$('#giftMsg').textContent=d.message;$('#gifts').scrollIntoView({block:'start'})}
  catch(err){$('#dialogErr').textContent=err.message;ok.disabled=false;await refreshGifts();if(!canChoose()||!gifts.find(g=>g.id===pending?.id&&g.available)){setTimeout(()=>{if(dlg.open)dlg.close();$('#giftMsg').textContent=err.message},1500)}}};
dlg.addEventListener('click',e=>{if(e.target===dlg){pending=null;dlg.close()}});

async function init(){try{
  const q=new URLSearchParams(location.search).get('g'); /* link pessoal gerado pelo painel, para recuperar o acesso */
  if(q){setToken(q);history.replaceState(null,'',location.pathname+location.hash)}
  buildPeopleSelect();
  const d=await api('public');settings=d.settings;gifts=d.gifts;if(getToken()&&!d.me)setToken('');me=d.me;
  const parts=dateParts(settings.eventDate);$('#dateText').textContent=parts.date;$('#timeText').textContent=parts.time;$('#addressText').textContent=settings.address||'Endereço a confirmar';$('#mapBtn').href=settings.mapsUrl||'#';$('#mapBtn').style.display=settings.mapsUrl?'inline-flex':'none';
  const audio=$('#audio');audio.src='/audio/musica.mp3';audio.preload='auto';audio.load();$('#music').style.display='block';
  if(settings.heroImage){document.querySelector('.hero').style.backgroundImage=`linear-gradient(#fff9f2ed,#fff9f2ed),url("${settings.heroImage}")`;document.querySelector('.hero').style.backgroundSize='cover'}
  renderRsvp();renderGifts();countdown();setInterval(countdown,1000);
  setInterval(()=>{if(!document.hidden&&!dlg.open)refreshGifts()},15000); /* mantém a disponibilidade atualizada para quem está com a página aberta */
}catch(e){console.error(e)}}
$('#openBtn').onclick=async()=>{$('#cover').classList.add('closed');try{if($('#audio').src)await $('#audio').play();$('#music').textContent='♫'}catch(e){$('#music').textContent='♫'}};
$('#music').onclick=async()=>{const a=$('#audio');if(!a.src)return;try{if(a.paused){await a.play();$('#music').textContent='♫'}else{a.pause();$('#music').textContent='♪'}}catch(e){}};
init();
