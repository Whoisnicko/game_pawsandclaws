import {Simulation,PROTOCOL} from './simulation.mjs';
const headers={'content-type':'application/json','access-control-allow-origin':'*','cache-control':'no-store'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
export class GameRoom {
  constructor(state,env){this.state=state;this.env=env;this.sim=null;this.last=Date.now();this.ready=state.blockConcurrencyWhile(async()=>{const saved=await state.storage.get('beta050');this.sim=new Simulation(saved);for(const ws of state.getWebSockets()){if(ws.readyState===1){const a=ws.deserializeAttachment();if(a?.role)this.sim.join(a.role);}}});}
  sockets(){return this.state.getWebSockets().filter(s=>s.readyState===1);}
  broadcast(value){const data=JSON.stringify(value);for(const s of this.sockets())try{s.send(data);}catch{}}
  async flush(){await this.state.storage.put('beta050',this.sim.data);this.broadcast(this.sim.snapshot());}
  async fetch(request){await this.ready;return this.state.blockConcurrencyWhile(async()=>{
    if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'websocket_required'},426);
    const url=new URL(request.url);if(url.searchParams.get('v')!=='50')return json({error:'beta050_client_required'},409);
    const taken=new Set(this.sockets().map(s=>s.deserializeAttachment().role));const role=!taken.has('bruno')?'bruno':!taken.has('nala')?'nala':null;if(!role)return json({error:'room_full'},409);
    const pair=new WebSocketPair(),server=pair[1];server.serializeAttachment({role,last:0,count:0});this.state.acceptWebSocket(server,[role]);this.sim.join(role);
    server.send(JSON.stringify({type:'welcome',protocol:PROTOCOL,role,players:this.sockets().length,states:[],enemies:[],drops:[]}));
    await this.flush();await this.state.storage.setAlarm(Date.now()+100);return new Response(null,{status:101,webSocket:pair[0]});
  });}
  async webSocketMessage(ws,message){await this.ready;return this.state.blockConcurrencyWhile(async()=>{
    if(typeof message!=='string'||message.length>2048)return;let d;try{d=JSON.parse(message);}catch{return;}if(!d||typeof d!=='object')return;
    const a=ws.deserializeAttachment(),now=Date.now();if(!a)return;if(now-a.last>1000){a.last=now;a.count=0;}if(++a.count>60){ws.serializeAttachment(a);return;}ws.serializeAttachment(a);
    if(d.type==='ping'){ws.send(JSON.stringify({type:'pong',t:d.t}));return;}
    this.sim.command(a.role,d,now);
    if(d.type!=='input')await this.flush();
  });}
  async alarm(){await this.ready;return this.state.blockConcurrencyWhile(async()=>{
    const roles=new Set(this.sockets().map(s=>s.deserializeAttachment().role));for(const r of [...this.sim.connected])if(!roles.has(r))this.sim.leave(r);
    if(!roles.size){await this.state.storage.put('beta050',this.sim.data);return;}
    const now=Date.now();this.sim.tick(Math.min(.1,(now-this.last)/1000),now);this.last=now;await this.flush();await this.state.storage.setAlarm(Date.now()+100);
  });}
  async webSocketClose(ws){await this.ready;return this.state.blockConcurrencyWhile(async()=>{const a=ws.deserializeAttachment();try{ws.close(1000,'closed');}catch{}if(a)this.sim.leave(a.role);await this.flush();});}
  async webSocketError(ws){return this.webSocketClose(ws);}
}
export default {async fetch(request,env){const url=new URL(request.url);
  if(request.method==='OPTIONS')return new Response(null,{headers:{...headers,'access-control-allow-methods':'POST,GET,OPTIONS','access-control-allow-headers':'content-type'}});
  if(url.pathname==='/health')return json({ok:true,service:'paws-claws-coop-beta050',version:'0.50',protocol:PROTOCOL});
  if(url.pathname==='/create'&&request.method==='POST'){const bytes=crypto.getRandomValues(new Uint8Array(4)),alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return json({room:'PAWS-'+Array.from(bytes,b=>alphabet[b%alphabet.length]).join(''),protocol:PROTOCOL});}
  if(/^\/ws\/PAWS-[A-Z0-9]{4}$/.test(url.pathname))return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(url.pathname.slice(4))).fetch(request);
  return json({error:'not_found'},404);
}};
