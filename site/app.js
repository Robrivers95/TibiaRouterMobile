const DEFAULT_ACTION_SETS = [
  { id:'hunt', name:'Hunt', actions:[
    { id:'heal', label:'Heal', icon:'✚', key:'F1' },
    { id:'mana', label:'Mana', icon:'◆', key:'F2' },
    { id:'rune', label:'Rune', icon:'✦', key:'F3' },
    { id:'spell', label:'Spell', icon:'⚡', key:'F4' }
  ]},
  { id:'support', name:'Support', actions:[
    { id:'support1', label:'Support 1', icon:'◈', key:'F5' },
    { id:'support2', label:'Support 2', icon:'◇', key:'F6' },
    { id:'support3', label:'Support 3', icon:'△', key:'F7' },
    { id:'support4', label:'Support 4', icon:'◎', key:'F8' }
  ]},
  { id:'utility', name:'Utility', actions:[
    { id:'utility1', label:'Slot 1', icon:'◉', key:'F9' },
    { id:'utility2', label:'Slot 2', icon:'◌', key:'F10' },
    { id:'utility3', label:'Slot 3', icon:'□', key:'F11' },
    { id:'utility4', label:'Slot 4', icon:'○', key:'F12' }
  ]}
]

const DIRS = ['E','NE','N','NW','W','SW','S','SE']
const QUALITY = {
  data: { label:'720p · DATA', width:1280, height:720, fps:30, bitrateKbps:1500 },
  balanced: { label:'AUTO · BAL', width:1920, height:1080, fps:30, bitrateKbps:2500 },
  quality: { label:'1080p · HQ', width:1920, height:1080, fps:30, bitrateKbps:4000 }
}
const $ = id => document.getElementById(id)
const deepClone = value => JSON.parse(JSON.stringify(value))

function loadActionSets(){
  try {
    const parsed = JSON.parse(localStorage.getItem('trm-actions') || 'null')
    if(Array.isArray(parsed) && parsed.length) return parsed
  } catch {}
  return deepClone(DEFAULT_ACTION_SETS)
}

class DemoTransport {
  constructor(){ this.stateListener=()=>{}; this.streamListener=()=>{}; this.character={x:48,y:46}; this.timer=null }
  async connect(){ this.stateListener('demo') }
  disconnect(){ clearInterval(this.timer); this.stateListener('offline') }
  sendRealtime(event){ console.debug('[demo/realtime]',event) }
  sendReliable(event){
    console.debug('[demo/reliable]',event)
    if(event.type==='direction' && event.active){
      const delta={N:[0,-1],NE:[1,-1],E:[1,0],SE:[1,1],S:[0,1],SW:[-1,1],W:[-1,0],NW:[-1,-1]}[event.direction]
      if(delta){ this.character.x=Math.max(8,Math.min(88,this.character.x+delta[0]*2)); this.character.y=Math.max(10,Math.min(82,this.character.y+delta[1]*2)); const ch=$('demoCharacter'); ch.style.left=`${this.character.x}%`; ch.style.top=`${this.character.y}%` }
    }
    if(event.type==='action') showToast(`Demo: ${event.actionId}`)
  }
  sendText(text){ console.debug('[demo/chat]',text); showToast(`Chat demo: ${text.slice(0,34)}`) }
  onState(fn){ this.stateListener=fn; fn('demo') }
  onStream(fn){ this.streamListener=fn; fn(null) }
}

class WebRtcTransport {
  constructor({signalingUrl,sessionId}){ this.signalingUrl=signalingUrl; this.sessionId=sessionId; this.pc=null; this.ws=null; this.channels={}; this.stateListener=()=>{}; this.streamListener=()=>{} }
  onState(fn){ this.stateListener=fn }
  onStream(fn){ this.streamListener=fn }
  async connect(){
    this.stateListener('connecting')
    this.pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]})
    this.channels.realtime=this.pc.createDataChannel('inputRealtime',{ordered:false,maxRetransmits:0})
    this.channels.reliable=this.pc.createDataChannel('inputReliable')
    this.channels.text=this.pc.createDataChannel('textInput')
    this.pc.ontrack=e=>this.streamListener(e.streams[0]||null)
    this.pc.onconnectionstatechange=()=>{
      const s=this.pc.connectionState
      if(s==='connected') this.stateListener('connected')
      else if(s==='failed'||s==='disconnected') this.stateListener('reconnecting')
      else if(s==='closed') this.stateListener('offline')
    }
    this.pc.onicecandidate=e=>e.candidate&&this.signal({type:'ice',candidate:e.candidate})
    this.ws=new WebSocket(this.signalingUrl)
    await new Promise((resolve,reject)=>{ const t=setTimeout(()=>reject(new Error('Timeout de signaling')),8000); this.ws.onopen=()=>{clearTimeout(t);resolve()}; this.ws.onerror=()=>{clearTimeout(t);reject(new Error('No se pudo abrir signaling WebSocket'))} })
    this.ws.onmessage=async event=>{
      let message; try{message=JSON.parse(String(event.data))}catch{return}
      try{
        if(message.type==='answer'&&message.sdp) await this.pc.setRemoteDescription(message.sdp)
        if(message.type==='ice'&&message.candidate) await this.pc.addIceCandidate(message.candidate)
      }catch(error){ console.warn('WebRTC signaling error',error) }
    }
    this.signal({type:'join',role:'viewer'})
    const offer=await this.pc.createOffer({offerToReceiveVideo:true,offerToReceiveAudio:false})
    await this.pc.setLocalDescription(offer)
    this.signal({type:'offer',sdp:offer,quality:getQualityPayload()})
  }
  disconnect(){ Object.values(this.channels).forEach(ch=>ch?.close?.()); this.pc?.close(); this.ws?.close(); this.stateListener('offline') }
  signal(payload){ if(this.ws?.readyState===WebSocket.OPEN) this.ws.send(JSON.stringify({...payload,sessionId:this.sessionId})) }
  sendChannel(name,payload){ const ch=this.channels[name]; if(ch?.readyState==='open') ch.send(JSON.stringify(payload)) }
  sendRealtime(event){ this.sendChannel('realtime',event) }
  sendReliable(event){ this.sendChannel('reliable',event) }
  sendText(text){ this.sendChannel('text',{type:'chat',text}) }
}

let actionSets=loadActionSets()
let transport=new DemoTransport()
let mode='touch'
let currentSet=0
let editorSet=0
let activeDirection='STOP'
let touchPointer=null
let mousePointer=null
let secondPointer=null
let toastTimer=null
let quality=localStorage.getItem('trm-quality')||'data'

const statusLabels={demo:'DEMO',connecting:'CONECTANDO',connected:'CONECTADO',reconnecting:'RECONECTANDO',offline:'SIN HOST'}

function getQualityPayload(){ return {profile:quality,...QUALITY[quality]} }
function persistActions(){ localStorage.setItem('trm-actions',JSON.stringify(actionSets)) }
function bindTransport(next){ try{transport.disconnect()}catch{} transport=next; transport.onState(updateState); transport.onStream(setStream); transport.connect().catch(error=>{updateState('offline');showToast(error.message||'No se pudo conectar')}) }
function updateState(state){ $('statusText').textContent=statusLabels[state]||String(state).toUpperCase(); $('statusPill').className=`status-pill status-${state}` }
function setStream(stream){ const video=$('streamVideo'); video.srcObject=stream||null; video.classList.toggle('hidden',!stream); $('demoScene').classList.toggle('hidden',!!stream) }

function renderActions(){
  const set=actionSets[currentSet]
  $('setName').textContent=set.name
  $('actionGrid').innerHTML=''
  set.actions.forEach(action=>{
    const button=document.createElement('button'); button.className='action-button'; button.setAttribute('aria-label',action.label)
    button.innerHTML=`<span class="action-icon">${escapeHtml(action.icon)}</span><span class="action-label">${escapeHtml(action.label)}</span>`
    button.addEventListener('pointerdown',event=>{ event.preventDefault(); transport.sendReliable({type:'action',key:action.key,actionId:action.id}); navigator.vibrate?.(18) })
    $('actionGrid').appendChild(button)
  })
}
function changeSet(delta){ currentSet=(currentSet+delta+actionSets.length)%actionSets.length; renderActions(); navigator.vibrate?.(10) }
function escapeHtml(value){ return String(value).replace(/[&<>'\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[ch]||ch)) }

function renderEditor(){
  const set=actionSets[editorSet]; $('editorSetName').textContent=`Set ${set.name}`; $('actionEditor').innerHTML=''
  set.actions.forEach((action,index)=>{
    const row=document.createElement('div'); row.className='action-edit-row'
    row.innerHTML=`<input maxlength="2" aria-label="Icono" value="${escapeHtml(action.icon)}"><input maxlength="18" aria-label="Nombre" value="${escapeHtml(action.label)}"><input maxlength="12" aria-label="Tecla" value="${escapeHtml(action.key)}">`
    const [icon,label,key]=row.querySelectorAll('input')
    const save=()=>{ action.icon=icon.value||'●'; action.label=label.value||`Slot ${index+1}`; action.key=(key.value||`F${index+1}`).toUpperCase(); persistActions(); renderActions() }
    ;[icon,label,key].forEach(input=>input.addEventListener('change',save))
    $('actionEditor').appendChild(row)
  })
}

function quantizeDirection(dx,dy){ if(Math.hypot(dx,dy)<18)return'STOP'; const angle=Math.atan2(-dy,dx); return DIRS[(Math.round(angle/(Math.PI/4)+8))%8] }
function joystickMove(x,y){
  const rect=$('joystick').getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2; let dx=x-cx,dy=y-cy; const radius=rect.width*.31,len=Math.hypot(dx,dy)
  if(len>radius){dx=dx/len*radius;dy=dy/len*radius} $('joystickThumb').style.transform=`translate(${dx}px,${dy}px)`
  const next=quantizeDirection(dx,dy); if(next!==activeDirection){ if(activeDirection!=='STOP')transport.sendReliable({type:'direction',direction:activeDirection,active:false}); if(next!=='STOP')transport.sendReliable({type:'direction',direction:next,active:true}); activeDirection=next }
}
function joystickEnd(){ if(activeDirection!=='STOP')transport.sendReliable({type:'direction',direction:activeDirection,active:false}); activeDirection='STOP'; $('joystickThumb').style.transform='translate(0,0)' }
function normalizedPoint(x,y){ const r=$('inputSurface').getBoundingClientRect(); return{x:Math.max(0,Math.min(1,(x-r.left)/r.width)),y:Math.max(0,Math.min(1,(y-r.top)/r.height))} }
function openChat(){ $('chatSheet').classList.remove('hidden-ui'); $('inputSurface').classList.add('blocked'); setTimeout(()=>$('chatInput').focus(),40) }
function closeChat(){ $('chatInput').blur(); $('chatSheet').classList.add('hidden-ui'); $('inputSurface').classList.remove('blocked') }
function showToast(message){ clearTimeout(toastTimer); $('toast').textContent=message; $('toast').classList.remove('hidden-ui'); toastTimer=setTimeout(()=>$('toast').classList.add('hidden-ui'),2400) }

$('joystick').addEventListener('pointerdown',e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);joystickMove(e.clientX,e.clientY)})
$('joystick').addEventListener('pointermove',e=>e.currentTarget.hasPointerCapture(e.pointerId)&&joystickMove(e.clientX,e.clientY))
$('joystick').addEventListener('pointerup',joystickEnd); $('joystick').addEventListener('pointercancel',joystickEnd)
$('prevSet').addEventListener('click',()=>changeSet(-1)); $('nextSet').addEventListener('click',()=>changeSet(1))
$('modeButton').addEventListener('click',()=>{ mode=mode==='touch'?'mouse':'touch'; $('modeIcon').textContent=mode==='touch'?'☝':'⌁'; $('modeText').textContent=mode==='touch'?'Touch':'Mouse'; showToast(mode==='touch'?'Touch directo activo':'Trackpad / mouse activo') })

$('inputSurface').addEventListener('contextmenu',e=>e.preventDefault())
$('inputSurface').addEventListener('pointerdown',e=>{
  e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId)
  if(touchPointer && touchPointer.id!==e.pointerId){ secondPointer={id:e.pointerId}; return }
  if(mode==='touch'){ const p=normalizedPoint(e.clientX,e.clientY); touchPointer={id:e.pointerId,...p}; transport.sendReliable({type:'pointer',phase:'down',...p,button:0}) }
  else mousePointer={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false}
})
$('inputSurface').addEventListener('pointermove',e=>{
  if(mode==='touch'&&touchPointer?.id===e.pointerId){ const p=normalizedPoint(e.clientX,e.clientY); transport.sendRealtime({type:'pointer',phase:'move',...p}) }
  else if(mode==='mouse'&&mousePointer?.id===e.pointerId){ const dx=e.clientX-mousePointer.x,dy=e.clientY-mousePointer.y; if(Math.abs(dx)+Math.abs(dy)>2)mousePointer.moved=true; mousePointer.x=e.clientX;mousePointer.y=e.clientY;transport.sendRealtime({type:'pointerDelta',dx,dy}) }
})
$('inputSurface').addEventListener('pointerup',e=>{
  if(secondPointer?.id===e.pointerId){ secondPointer=null; transport.sendReliable({type:'mouseClick',button:2}); return }
  if(mode==='touch'&&touchPointer?.id===e.pointerId){ const p=normalizedPoint(e.clientX,e.clientY); transport.sendReliable({type:'pointer',phase:'up',...p,button:0}); touchPointer=null }
  else if(mode==='mouse'&&mousePointer?.id===e.pointerId){ if(!mousePointer.moved)transport.sendReliable({type:'mouseClick',button:0}); mousePointer=null }
})
$('inputSurface').addEventListener('pointercancel',()=>{touchPointer=null;mousePointer=null;secondPointer=null})

$('chatButton').addEventListener('click',openChat); $('chatClose').addEventListener('click',closeChat)
$('chatForm').addEventListener('submit',e=>{e.preventDefault();const text=$('chatInput').value.trim();if(!text)return;transport.sendText(text);$('chatInput').value='';closeChat();navigator.vibrate?.(12)})
$('fullscreenButton').addEventListener('click',async()=>{try{await document.documentElement.requestFullscreen?.()}catch{}})
$('settingsButton').addEventListener('click',()=>{renderEditor();$('settingsModal').classList.remove('hidden-ui')})
$('settingsClose').addEventListener('click',()=>$('settingsModal').classList.add('hidden-ui'))
$('settingsModal').addEventListener('pointerdown',e=>{if(e.target===$('settingsModal'))$('settingsModal').classList.add('hidden-ui')})

document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===tab))
  document.querySelectorAll('.tab-panel').forEach(panel=>panel.classList.toggle('hidden-ui',panel.dataset.panel!==tab.dataset.tab))
}))

$('signalingInput').value=localStorage.getItem('trm-signaling')||''; $('sessionInput').value=localStorage.getItem('trm-session')||'demo'
$('connectButton').addEventListener('click',()=>{ const signalingUrl=$('signalingInput').value.trim(),sessionId=$('sessionInput').value.trim(); if(!signalingUrl||!sessionId)return showToast('Falta signaling URL o Session ID'); if(!/^wss?:\/\//i.test(signalingUrl))return showToast('Usa una URL ws:// o wss://'); localStorage.setItem('trm-signaling',signalingUrl);localStorage.setItem('trm-session',sessionId);$('settingsModal').classList.add('hidden-ui');bindTransport(new WebRtcTransport({signalingUrl,sessionId})) })
$('demoButton').addEventListener('click',()=>{$('settingsModal').classList.add('hidden-ui');bindTransport(new DemoTransport())})
$('editorPrevSet').addEventListener('click',()=>{editorSet=(editorSet-1+actionSets.length)%actionSets.length;renderEditor()})
$('editorNextSet').addEventListener('click',()=>{editorSet=(editorSet+1)%actionSets.length;renderEditor()})
$('resetControls').addEventListener('click',()=>{actionSets=deepClone(DEFAULT_ACTION_SETS);persistActions();renderEditor();renderActions();showToast('Controles restablecidos')})
document.querySelectorAll('.quality-option').forEach(button=>button.addEventListener('click',()=>{ quality=button.dataset.quality;localStorage.setItem('trm-quality',quality);renderQuality();transport.sendReliable({type:'quality',...getQualityPayload()}) }))
function renderQuality(){ $('qualityPill').textContent=QUALITY[quality].label; document.querySelectorAll('.quality-option').forEach(b=>b.classList.toggle('active',b.dataset.quality===quality)) }

renderActions();renderEditor();renderQuality();bindTransport(new DemoTransport())
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn))
