(() => {
const $ = s => document.querySelector(s);
const canvas = $('#humanCanvas'), ctx = canvas.getContext('2d');
const widget = $('#humanWidget');
const controls = {
  gender: $('#genderSelect'), color: $('#colorPicker'),
  glow: $('#glowRange'), density: $('#densityRange'),
  eyeTrack: $('#eyeTrackCheck'), headTrack: $('#headTrackCheck'),
  blink: $('#blinkCheck'), transparent: $('#transparentCheck')
};
let state = {
  gender:'female', accent:'#69ff9a', glow:18, density:34,
  targetX:0, targetY:0, eyeX:0, eyeY:0, headX:0, headY:0,
  blink:0, blinkAt:performance.now()+2200, blinkStarted:0, speaking:false,
  micStream:null, camStream:null, analyser:null, audioContext:null, audioLevel:0,
  privacy:false, history:[]
};

const STORAGE_KEYS={settings:'ale.settings.v2',history:'ale.history.v2',position:'ale.position.v2'};

function readStorage(key,fallback){
  try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback}
}
function writeStorage(key,value){
  try{localStorage.setItem(key,JSON.stringify(value))}catch{}
}
function saveSettings(){
  writeStorage(STORAGE_KEYS.settings,{
    gender:controls.gender.value,color:controls.color.value,glow:controls.glow.value,
    density:controls.density.value,eyeTrack:controls.eyeTrack.checked,
    headTrack:controls.headTrack.checked,blink:controls.blink.checked,
    transparent:controls.transparent.checked,provider:$('#providerSelect').value
  });
}
function restoreSettings(){
  const saved=readStorage(STORAGE_KEYS.settings,{});
  if(saved.gender==='female'||saved.gender==='male') controls.gender.value=saved.gender;
  if(/^#[0-9a-f]{6}$/i.test(saved.color||'')) controls.color.value=saved.color;
  if(saved.glow!==undefined) controls.glow.value=clamp(Number(saved.glow)||0,0,40);
  if(saved.density!==undefined) controls.density.value=clamp(Number(saved.density)||34,10,65);
  for(const key of ['eyeTrack','headTrack','blink','transparent']){
    if(typeof saved[key]==='boolean') controls[key].checked=saved[key];
  }
  if(['auto','offline','ollama'].includes(saved.provider)) $('#providerSelect').value=saved.provider;
  state.gender=controls.gender.value;state.glow=+controls.glow.value;state.density=+controls.density.value;
  $('#humanName').textContent=`ALE • ${state.gender.toUpperCase()}`;
}

function hexToRgb(hex){
  const n = parseInt(hex.slice(1),16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}
function updateTheme(){
  state.accent = controls.color.value;
  const [r,g,b] = hexToRgb(state.accent);
  document.documentElement.style.setProperty('--accent',state.accent);
  document.documentElement.style.setProperty('--accent-rgb',`${r},${g},${b}`);
}
function lerp(a,b,t){return a+(b-a)*t}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function setStatus(text,mode){
  $('#statusText').textContent=text;
  $('#humanMode').textContent=mode || text.toUpperCase();
}

function addChatMessage(role,text,{persist=true}={}){
  const content=String(text||'').trim();if(!content)return;
  const item=document.createElement('div');
  item.className=`chat-message ${role}`;
  item.textContent=content;
  $('#chatLog').appendChild(item);
  $('#chatLog').scrollTop=$('#chatLog').scrollHeight;
  if(persist&&(role==='user'||role==='assistant')){
    state.history.push({role,content});
    state.history=state.history.slice(-20);
    writeStorage(STORAGE_KEYS.history,state.history);
  }
}

function restoreHistory(){
  const saved=readStorage(STORAGE_KEYS.history,[]);
  state.history=Array.isArray(saved)?saved.filter(item=>
    (item?.role==='user'||item?.role==='assistant')&&typeof item?.content==='string'
  ).slice(-20):[];
  if(!state.history.length) addChatMessage('system','ALE siap. Mode lokal aktif.',{persist:false});
  else state.history.forEach(item=>addChatMessage(item.role,item.content,{persist:false}));
}

function drawBinaryFace(t){
  const w=canvas.width,h=canvas.height,cx=w/2,cy=h/2+8;
  ctx.clearRect(0,0,w,h);
  const rgb=hexToRgb(state.accent);
  const accent=`rgb(${rgb.join(',')})`;
  const glow=`rgba(${rgb.join(',')},.55)`;

  const mx = controls.headTrack.checked ? state.headX*20 : 0;
  const my = controls.headTrack.checked ? state.headY*12 : 0;
  ctx.save();
  ctx.translate(mx,my);
  ctx.rotate((controls.headTrack.checked ? state.headX : 0)*0.045);

  // halo
  ctx.save();
  ctx.strokeStyle=`rgba(${rgb.join(',')},.18)`;
  ctx.lineWidth=2;
  for(let i=0;i<4;i++){
    ctx.beginPath(); ctx.arc(cx,cy,252+i*22,(t*.00008)+i*.45,Math.PI*1.72+i*.35); ctx.stroke();
  }
  ctx.restore();

  // shoulders
  ctx.beginPath();
  ctx.moveTo(cx-280, h-36); ctx.quadraticCurveTo(cx-170,h-150,cx-106,h-154);
  ctx.quadraticCurveTo(cx,h-104,cx+112,h-154); ctx.quadraticCurveTo(cx+180,h-152,cx+292,h-38);
  ctx.strokeStyle=`rgba(${rgb.join(',')},.25)`; ctx.lineWidth=16; ctx.shadowBlur=state.glow;ctx.shadowColor=accent;ctx.stroke();

  // face silhouette
  const jaw = state.gender==='male' ? 0.90 : 0.78;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx-150,cy-210);
  ctx.bezierCurveTo(cx-210,cy-128,cx-198,cy+84,cx-105*jaw,cy+205);
  ctx.bezierCurveTo(cx-50,cy+260,cx+53,cy+260,cx+115*jaw,cy+200);
  ctx.bezierCurveTo(cx+205,cy+88,cx+205,cy-110,cx+146,cy-210);
  ctx.bezierCurveTo(cx+92,cy-265,cx-92,cy-270,cx-150,cy-210);
  ctx.closePath();
  ctx.clip();

  // dark fill / inner glow
  const grad=ctx.createRadialGradient(cx-40,cy-60,20,cx,cy,270);
  grad.addColorStop(0,`rgba(${rgb.join(',')},.17)`);
  grad.addColorStop(.7,'rgba(1,8,5,.88)');
  grad.addColorStop(1,'rgba(0,0,0,.96)');
  ctx.fillStyle=grad;ctx.fillRect(cx-240,cy-300,480,600);

  // binary field
  const spacing = Math.max(8,70-state.density);
  ctx.font=`${Math.max(9,spacing*.72)}px monospace`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.shadowColor=accent;ctx.shadowBlur=Math.min(18,state.glow*.65);
  for(let y=cy-255;y<cy+265;y+=spacing){
    for(let x=cx-210;x<cx+215;x+=spacing*.78){
      const flick=(Math.sin(x*.047+y*.031+t*.002)+1)/2;
      const a=.17+.67*flick;
      ctx.fillStyle=`rgba(${rgb.join(',')},${a})`;
      ctx.fillText(((Math.floor((x+y+t/80)/spacing))&1)?'1':'0',x+(Math.sin(y*.03+t*.001)*2),y);
    }
  }
  ctx.restore();

  // face outline
  ctx.strokeStyle=`rgba(${rgb.join(',')},.72)`;ctx.lineWidth=2.4;ctx.shadowBlur=state.glow;ctx.shadowColor=accent;
  ctx.beginPath();
  ctx.moveTo(cx-150,cy-210);
  ctx.bezierCurveTo(cx-210,cy-128,cx-198,cy+84,cx-105*jaw,cy+205);
  ctx.bezierCurveTo(cx-50,cy+260,cx+53,cy+260,cx+115*jaw,cy+200);
  ctx.bezierCurveTo(cx+205,cy+88,cx+205,cy-110,cx+146,cy-210);
  ctx.bezierCurveTo(cx+92,cy-265,cx-92,cy-270,cx-150,cy-210); ctx.stroke();

  // brows
  const browY=cy-61;
  ctx.lineWidth=state.gender==='male'?8:5;
  ctx.strokeStyle=`rgba(${rgb.join(',')},.65)`;
  ctx.beginPath();ctx.moveTo(cx-120,browY-8);ctx.quadraticCurveTo(cx-75,browY-28,cx-30,browY-8);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx+27,browY-8);ctx.quadraticCurveTo(cx+77,browY-28,cx+124,browY-8);ctx.stroke();

  // eyes
  const ex = controls.eyeTrack.checked ? state.eyeX*13 : 0;
  const ey = controls.eyeTrack.checked ? state.eyeY*7 : 0;
  const blink=state.blink;
  function eye(x,y){
    const open=18*(1-blink);
    ctx.shadowBlur=10; ctx.shadowColor=accent;
    ctx.fillStyle='rgba(210,255,220,.95)';
    ctx.beginPath();
    ctx.ellipse(x,y,45,Math.max(1.3,open),0,0,Math.PI*2);ctx.fill();
    if(open>4){
      ctx.fillStyle=accent;ctx.beginPath();ctx.arc(x+ex,y+ey,10,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#04120a';ctx.beginPath();ctx.arc(x+ex,y+ey,4.2,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x+ex+3,y+ey-3,2,0,Math.PI*2);ctx.fill();
    }
  }
  eye(cx-76,cy-30); eye(cx+76,cy-30);

  // nose
  ctx.shadowBlur=8;ctx.strokeStyle=`rgba(${rgb.join(',')},.35)`;ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(cx,cy-8);ctx.quadraticCurveTo(cx-14,cy+48,cx+4,cy+72);ctx.stroke();

  // mouth / lip sync
  const amp = state.speaking ? .15 + state.audioLevel*.85 : .05;
  const mouthOpen = clamp(amp*22,2,24);
  ctx.fillStyle=`rgba(${rgb.join(',')},.24)`;
  ctx.strokeStyle=`rgba(${rgb.join(',')},.80)`;
  ctx.lineWidth=2.4;
  ctx.beginPath();ctx.ellipse(cx,cy+126,state.gender==='male'?54:49,mouthOpen,0,0,Math.PI*2);ctx.fill();ctx.stroke();

  // chin / center tracking reticle
  ctx.strokeStyle=`rgba(${rgb.join(',')},.14)`;ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(cx,cy,282,0,Math.PI*2);ctx.stroke();

  ctx.restore();
}

function animate(t){
  state.eyeX=lerp(state.eyeX,state.targetX,.10);
  state.eyeY=lerp(state.eyeY,state.targetY,.10);
  state.headX=lerp(state.headX,state.targetX,.055);
  state.headY=lerp(state.headY,state.targetY,.055);

  if(controls.blink.checked){
    if(!state.blinkStarted&&t>=state.blinkAt) state.blinkStarted=t;
    if(state.blinkStarted){
      const progress=clamp((t-state.blinkStarted)/210,0,1);
      state.blink=Math.sin(progress*Math.PI);
      if(progress>=1){
        state.blink=0;state.blinkStarted=0;state.blinkAt=t+1800+Math.random()*3600;
      }
    }
  } else {state.blink=0;state.blinkStarted=0;state.blinkAt=t+1800;}

  if(state.analyser){
    const data=new Uint8Array(state.analyser.frequencyBinCount);
    state.analyser.getByteFrequencyData(data);
    const avg=data.reduce((a,b)=>a+b,0)/data.length;
    state.audioLevel=clamp(avg/120,0,1);
  } else {
    state.audioLevel=state.speaking ? .45+.35*Math.sin(t*.018) : 0;
  }
  drawBinaryFace(t);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

function pointerTrack(clientX,clientY){
  const r=widget.getBoundingClientRect();
  state.targetX=clamp(((clientX-r.left)/r.width-.5)*2,-1,1);
  state.targetY=clamp(((clientY-r.top)/r.height-.5)*2,-1,1);
}
window.addEventListener('pointermove',e=>pointerTrack(e.clientX,e.clientY),{passive:true});

controls.gender.addEventListener('change',()=>{
  state.gender=controls.gender.value; $('#humanName').textContent=`ALE • ${state.gender.toUpperCase()}`;saveSettings();
});
controls.color.addEventListener('input',()=>{updateTheme();saveSettings()});
controls.glow.addEventListener('input',()=>{state.glow=+controls.glow.value;saveSettings()});
controls.density.addEventListener('input',()=>{state.density=+controls.density.value;saveSettings()});
for(const input of [controls.eyeTrack,controls.headTrack,controls.blink]) input.addEventListener('change',saveSettings);
controls.transparent.addEventListener('change',()=>{
  widget.classList.toggle('transparent-mode',controls.transparent.checked);saveSettings();
});
$('#providerSelect').addEventListener('change',saveSettings);
restoreSettings();updateTheme();widget.classList.toggle('transparent-mode',controls.transparent.checked);restoreHistory();

$('#panelToggle').onclick=()=>$('#controlPanel').classList.toggle('hidden-panel');
$('#closePanel').onclick=()=>$('#controlPanel').classList.add('hidden-panel');
async function setPrivacy(enabled){
  state.privacy=enabled;
  document.body.classList.toggle('privacy',enabled);
  $('#privacyToggle').classList.toggle('is-active',enabled);
  $('#privacyToggle').setAttribute('aria-pressed',String(enabled));
  $('#privacyToggle').setAttribute('aria-label',enabled?'Nonaktifkan mode privasi':'Aktifkan mode privasi');
  if(enabled){await stopMic();stopCamera();setStatus('Mode privasi aktif','PRIVACY');}
  else setStatus('Mode lokal siap','IDLE');
}
$('#privacyToggle').onclick=()=>setPrivacy(!state.privacy);

$('#minimizeHumanBtn').onclick=()=>{
  widget.classList.add('hidden'); $('#restoreHumanBtn').classList.remove('hidden');
};
$('#restoreHumanBtn').onclick=()=>{
  widget.classList.remove('hidden'); $('#restoreHumanBtn').classList.add('hidden');
};

$('#speakBtn').onclick=()=>{
  state.speaking=!state.speaking;
  $('#speakBtn').classList.toggle('is-active',state.speaking);
  $('#speakBtn').setAttribute('aria-pressed',String(state.speaking));
  setStatus(state.speaking?'Speaking simulation':'Ready',state.speaking?'SPEAKING':'IDLE');
};

async function stopMic(){
  if(state.micStream) state.micStream.getTracks().forEach(track=>track.stop());
  state.micStream=null;state.analyser=null;
  if(state.audioContext){await state.audioContext.close().catch(()=>{});state.audioContext=null;}
  $('#micState').textContent='off';$('#listenBtn').classList.remove('is-active');
  $('#listenBtn').setAttribute('aria-pressed','false');
}
async function toggleMic(){
  if(state.micStream){
    await stopMic();setStatus('Mikrofon mati','IDLE');return;
  }
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Browser tidak mendukung akses mikrofon');
    state.micStream=await navigator.mediaDevices.getUserMedia({audio:true});
    state.audioContext=new (window.AudioContext||window.webkitAudioContext)();
    const src=state.audioContext.createMediaStreamSource(state.micStream);
    state.analyser=state.audioContext.createAnalyser();state.analyser.fftSize=256;src.connect(state.analyser);
    $('#micState').textContent='on';$('#listenBtn').classList.add('is-active');
    $('#listenBtn').setAttribute('aria-pressed','true');setStatus('Mendengarkan','LISTENING');
  }catch(e){await stopMic();addChatMessage('system','Mikrofon gagal: '+e.message,{persist:false});}
}
$('#listenBtn').onclick=toggleMic; $('#micCapability').onclick=toggleMic;

function stopCamera(){
  if(state.camStream) state.camStream.getTracks().forEach(track=>track.stop());
  state.camStream=null;$('#cameraPreview').srcObject=null;$('#camState').textContent='off';
  $('#cameraBtn').classList.remove('is-active');$('#cameraBtn').setAttribute('aria-pressed','false');
}
async function toggleCamera(){
  if(state.camStream){
    stopCamera();setStatus('Kamera mati','IDLE');return;
  }
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Browser tidak mendukung akses kamera');
    state.camStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});
    $('#cameraPreview').srcObject=state.camStream;await $('#cameraPreview').play();
    $('#camState').textContent='on';$('#cameraBtn').classList.add('is-active');
    $('#cameraBtn').setAttribute('aria-pressed','true');setStatus('Kamera aktif','VISION');
  }catch(e){stopCamera();addChatMessage('system','Kamera gagal: '+e.message,{persist:false});}
}
$('#cameraBtn').onclick=toggleCamera; $('#camCapability').onclick=toggleCamera;

$('#localCapability').onclick=()=>addChatMessage('system','ALE berjalan pada perangkat ini. Percakapan tersimpan hanya di browser lokal.',{persist:false});
$('#netCapability').onclick=()=>checkHealth(true);
$('#cloudCapability').onclick=()=>addChatMessage('system','Mode cloud menunggu secret server. Key tidak akan disimpan di browser atau GitHub.',{persist:false});
$('#agentCapability').onclick=()=>addChatMessage('system',`Mode terpilih: ${$('#providerSelect').selectedOptions[0].textContent}.`,{persist:false});

async function sendChat(){
  const msg=$('#chatInput').value.trim(); if(!msg)return;
  const priorHistory=state.history.slice(-12);
  addChatMessage('user',msg);$('#chatInput').value='';
  setStatus('Berpikir','THINKING');$('#sendBtn').disabled=true;
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),50000);
  try{
    const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:msg,history:priorHistory,provider:$('#providerSelect').value}),signal:controller.signal});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const data=await res.json();
    const answer=String(data.reply||'Jawaban kosong.');
    addChatMessage('assistant',answer);$('#providerState').textContent=data.provider||'local';
    state.speaking=true;setStatus('Berbicara','SPEAKING');
    setTimeout(()=>{state.speaking=false;setStatus('Mode lokal siap','IDLE')},Math.min(7000,900+answer.length*24));
  }catch(e){
    addChatMessage('system',e.name==='AbortError'?'Permintaan melewati batas waktu.':'Backend tidak tersambung: '+e.message,{persist:false});
    setStatus('Backend bermasalah','ERROR');
  }finally{
    clearTimeout(timeout);$('#sendBtn').disabled=false;$('#chatInput').focus();
  }
}
$('#sendBtn').onclick=sendChat;
$('#chatInput').addEventListener('keydown',e=>{if(e.key==='Enter')sendChat()});
$('#clearChatBtn').onclick=()=>{
  state.history=[];writeStorage(STORAGE_KEYS.history,[]);$('#chatLog').replaceChildren();
  addChatMessage('system','Percakapan lokal telah dihapus.',{persist:false});
};

// draggable floating widget
let drag=null;
$('#dragHandle').addEventListener('pointerdown',e=>{
  const r=widget.getBoundingClientRect();
  drag={dx:e.clientX-r.left,dy:e.clientY-r.top};
  e.currentTarget.setPointerCapture(e.pointerId);
});
$('#dragHandle').addEventListener('pointermove',e=>{
  if(!drag)return;
  const maxX=innerWidth-widget.offsetWidth, maxY=innerHeight-widget.offsetHeight;
  widget.style.left=clamp(e.clientX-drag.dx,0,maxX)+'px';
  widget.style.top=clamp(e.clientY-drag.dy,80,maxY)+'px';
});
function saveWidgetPosition(){
  const r=widget.getBoundingClientRect();
  writeStorage(STORAGE_KEYS.position,{left:r.left/innerWidth,top:r.top/innerHeight});
}
$('#dragHandle').addEventListener('pointerup',()=>{drag=null;saveWidgetPosition()});
$('#dragHandle').addEventListener('pointercancel',()=>drag=null);

function restoreWidgetPosition(){
  const saved=readStorage(STORAGE_KEYS.position,null);if(!saved)return;
  const maxX=Math.max(0,innerWidth-widget.offsetWidth),maxY=Math.max(80,innerHeight-widget.offsetHeight);
  widget.style.left=clamp(Number(saved.left)*innerWidth,0,maxX)+'px';
  widget.style.top=clamp(Number(saved.top)*innerHeight,80,maxY)+'px';
}
window.addEventListener('resize',restoreWidgetPosition,{passive:true});
requestAnimationFrame(restoreWidgetPosition);

async function checkHealth(verbose=false){
  try{
    const response=await fetch('/api/health',{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const data=await response.json();$('#backendState').textContent='online';$('#backendState').classList.remove('is-error');
    setStatus('Mode lokal siap','IDLE');
    if(verbose)addChatMessage('system',`Backend ALE ${data.version} aktif dalam mode ${data.mode}.`,{persist:false});
  }catch(e){
    $('#backendState').textContent='offline';$('#backendState').classList.add('is-error');setStatus('Backend offline','ERROR');
    if(verbose)addChatMessage('system','Backend tidak dapat dihubungi: '+e.message,{persist:false});
  }
}
checkHealth();

window.addEventListener('beforeunload',()=>{
  if(state.micStream)state.micStream.getTracks().forEach(track=>track.stop());
  if(state.camStream)state.camStream.getTracks().forEach(track=>track.stop());
});

if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}
})();
