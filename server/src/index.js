import { WebSocketServer, WebSocket } from 'ws'

const port=Number(process.env.PORT||8080)
const wss=new WebSocketServer({port})
const rooms=new Map()

function getRoom(id){if(!rooms.has(id))rooms.set(id,new Set());return rooms.get(id)}
function safeSend(peer,message){if(peer.readyState===WebSocket.OPEN)peer.send(JSON.stringify(message))}

wss.on('connection',socket=>{
  socket.meta={sessionId:null,role:null}
  socket.on('message',raw=>{
    let message;try{message=JSON.parse(String(raw))}catch{return}
    const sessionId=typeof message.sessionId==='string'?message.sessionId.trim():''
    if(!sessionId||sessionId.length>128)return
    if(message.type==='join'){
      if(socket.meta.sessionId){rooms.get(socket.meta.sessionId)?.delete(socket)}
      socket.meta={sessionId,role:message.role||'unknown'}
      getRoom(sessionId).add(socket)
      for(const peer of getRoom(sessionId))if(peer!==socket)safeSend(peer,{type:'peer-joined',sessionId,role:socket.meta.role})
      return
    }
    if(socket.meta.sessionId!==sessionId)return
    for(const peer of getRoom(sessionId))if(peer!==socket)safeSend(peer,message)
  })
  socket.on('close',()=>{
    const {sessionId,role}=socket.meta;if(!sessionId)return
    const room=rooms.get(sessionId);room?.delete(socket)
    if(room?.size===0)rooms.delete(sessionId);else for(const peer of room)safeSend(peer,{type:'peer-left',sessionId,role})
  })
})
console.log(`TibiaRouter signaling listening on :${port}`)
