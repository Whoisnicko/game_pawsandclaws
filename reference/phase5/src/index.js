const SERVICE = "paws-claws-coop";
const VERSION = "phase5-progression";
const ROOM_RE = /^PAWS-[A-Z0-9]{4}$/;

const PLAYER_MAX_HP = 100;
const PLAYER_RESPAWN_MS = 2600;
const PLAYER_ATTACK_COOLDOWN_MS = 460;
const PLAYER_SKILL_COOLDOWN_MS = 5000;
const ENEMY_ATTACK_COOLDOWN_MS = 1150;
const PLAYER_ATTACK_RANGE = 0.155;
const PLAYER_SKILL_RANGE = 0.245;
const ENEMY_ATTACK_RANGE = 0.115;
const DROP_PICKUP_RANGE = 0.075;

const ENEMY_DEFS = [
  { id:"cat-warrior", type:"warrior", x:.39, y:.31, maxHp:120, respawnMs:5200, xp:22, coins:5, damage:9 },
  { id:"cat-archer",  type:"archer",  x:.61, y:.29, maxHp:92,  respawnMs:5600, xp:25, coins:6, damage:8 },
  { id:"cat-mage",    type:"mage",    x:.53, y:.49, maxHp:86,  respawnMs:6200, xp:29, coins:7, damage:11 },
  { id:"cat-elite",   type:"elite",   x:.50, y:.17, maxHp:185, respawnMs:8000, xp:48, coins:12, damage:15 }
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type":"application/json; charset=utf-8",
      "cache-control":"no-store",
      "access-control-allow-origin":"*"
    }
  });
}
function normalizeRoom(value){ return String(value||"").trim().toUpperCase(); }
function randomRoom(){
  const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let out="PAWS-";
  for(let i=0;i<4;i++) out+=alphabet[Math.floor(Math.random()*alphabet.length)];
  return out;
}
function dist(a,b){ return Math.hypot((a.x||0)-(b.x||0),(a.y||0)-(b.y||0)); }
function clamp01(v,lo=0,hi=1){ v=Number(v); return Number.isFinite(v)?Math.max(lo,Math.min(hi,v)):null; }
function nextXp(level){ return 60 + Math.max(0,Number(level||1)-1)*45; }
function defaultPlayerState(role){
  return role==="bruno"
    ? {x:.42,y:.77,hp:100,alive:true,level:1,xp:0,next:60,gold:0,metal:0,herb:0}
    : {x:.58,y:.77,hp:100,alive:true,level:1,xp:0,next:60,gold:0,metal:0,herb:0};
}
function freshEnemies(){
  return ENEMY_DEFS.map(d=>({...d,hp:d.maxHp,alive:true,respawnAt:0}));
}
function publicEnemy(e){
  return {id:e.id,type:e.type,x:e.x,y:e.y,hp:e.hp,maxHp:e.maxHp,alive:e.alive,respawnAt:e.respawnAt||0};
}
function publicPlayer(role,p){ return {role,...p}; }
function randomDrop(enemy){
  const r=Math.random(); let kind="coins", amount=enemy.coins;
  if(enemy.type==="elite" && r<.45){ kind="metal"; amount=1; }
  else if(r<.22){ kind="herb"; amount=1; }
  return {id:`drop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,kind,amount,x:enemy.x,y:enemy.y,enemyId:enemy.id};
}

const TEST_CLIENT = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>Paws & Claws Phase 5</title><style>
*{box-sizing:border-box}html,body{margin:0;background:#081019;color:#eef;font-family:system-ui;height:100%}body{padding:12px}.p{max-width:900px;margin:auto}.bar{display:flex;gap:8px;flex-wrap:wrap;background:#102131;padding:10px;border:1px solid #36506a;border-radius:12px}button,input{font:inherit;padding:10px;border-radius:9px;border:1px solid #4d6984;background:#173149;color:white}button{font-weight:800}#stage{height:64vh;margin-top:10px;position:relative;overflow:hidden;border-radius:14px;border:1px solid #36506a;background:#315f34}.actor{position:absolute;transform:translate(-50%,-50%);font-size:42px}.enemy{font-size:36px}.drop{font-size:21px}.name{position:absolute;top:-17px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:800;white-space:nowrap}.hud{margin-top:10px;padding:10px;background:#102131;border:1px solid #36506a;border-radius:12px}.joy{position:absolute;left:18px;bottom:18px;width:120px;height:120px;border:2px solid #ffffff55;border-radius:50%;touch-action:none}.knob{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px;border-radius:50%;background:#a9cbe0aa}.act{position:absolute;right:18px;bottom:20px;display:grid;gap:8px}.act button{width:88px;height:64px}.dead{opacity:.25;filter:grayscale(1)}</style></head><body><div class="p"><div class="bar"><button id="create">Crear sala</button><input id="room" placeholder="PAWS-XXXX"><button id="join">Unirse</button><span id="status">offline</span></div><div id="stage"><div id="joy" class="joy"><div id="knob" class="knob"></div></div><div class="act"><button id="atk">ATQ</button><button id="skill">SKILL</button></div></div><div class="hud"><span id="me">—</span> · <span id="prog">—</span> · <span id="count">0/2</span></div></div><script>
const $=s=>document.querySelector(s),stage=$('#stage');let ws=null,role=null,state={},enemies={},drops={},input={x:0,y:0},last=performance.now(),lastSend=0;
function actor(id,cls,txt){let e=document.getElementById(id);if(!e){e=document.createElement('div');e.id=id;e.className='actor '+cls;e.innerHTML=txt+'<span class="name"></span>';stage.appendChild(e)}return e}
function setP(r,p){state[r]={...(state[r]||{}),...p};const e=actor('p-'+r,'dog',r==='bruno'?'🐕':'🐶');e.querySelector('.name').textContent=r==='bruno'?'Bruno':'Nala';e.style.left=(p.x*100)+'%';e.style.top=(p.y*100)+'%';e.classList.toggle('dead',p.alive===false)}
function setE(e){enemies[e.id]=e;const n=actor(e.id,'enemy','🐈');n.querySelector('.name').textContent=e.type+' '+Math.ceil(e.hp)+'/'+e.maxHp;n.style.left=(e.x*100)+'%';n.style.top=(e.y*100)+'%';n.classList.toggle('dead',!e.alive)}
function setD(d){drops[d.id]=d;const n=actor(d.id,'drop',d.kind==='coins'?'🪙':d.kind==='metal'?'⚙️':'🌿');n.style.left=(d.x*100)+'%';n.style.top=(d.y*100)+'%'}
function delD(id){delete drops[id];document.getElementById(id)?.remove()}
function msg(m){if(m.type==='welcome'){role=m.role;for(const p of m.states||[])setP(p.role,p);for(const e of m.enemies||[])setE(e);for(const d of m.drops||[])setD(d);$('#count').textContent=(m.players||1)+'/2'}else if(m.type==='state')setP(m.role,m);else if(m.type==='presence')$('#count').textContent=m.players+'/2';else if(m.type==='enemy'||m.type==='enemy_respawn')setE(m.enemy);else if(m.type==='drop_spawn')setD(m.drop);else if(m.type==='drop_pickup'){delD(m.dropId);if(m.player)setP(m.role,m.player)}else if(m.type==='progress'){setP(m.role,m.player)}else if(m.type==='hit'){if(m.target==='enemy')setE(m.enemy);else setP(m.target,m.player)}else if(m.type==='player_respawn')setP(m.role,m.player);renderHud()}
function renderHud(){const p=state[role];$('#me').textContent=role||'—';$('#prog').textContent=p?('Lv '+p.level+' · XP '+p.xp+'/'+p.next+' · oro '+p.gold):'—'}
function connect(code){code=code.trim().toUpperCase();ws=new WebSocket('wss://'+location.host+'/ws/'+code);ws.onopen=()=>$('#status').textContent='online';ws.onclose=()=>$('#status').textContent='offline';ws.onmessage=e=>{try{msg(JSON.parse(e.data))}catch{}}}
$('#create').onclick=async()=>{const j=await (await fetch('/create',{method:'POST'})).json();$('#room').value=j.room;connect(j.room)};$('#join').onclick=()=>connect($('#room').value);$('#atk').onclick=()=>ws?.send(JSON.stringify({type:'attack'}));$('#skill').onclick=()=>ws?.send(JSON.stringify({type:'skill'}));
const joy=$('#joy'),knob=$('#knob');let pid=null;function jm(e){const r=joy.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),l=Math.hypot(dx,dy)||1,m=r.width*.28,k=Math.min(1,m/l);input.x=dx/l*k;input.y=dy/l*k;knob.style.transform='translate('+(input.x*m)+'px,'+(input.y*m)+'px)'}joy.onpointerdown=e=>{pid=e.pointerId;joy.setPointerCapture(pid);jm(e)};joy.onpointermove=e=>{if(e.pointerId===pid)jm(e)};joy.onpointerup=joy.onpointercancel=e=>{if(e.pointerId===pid){pid=null;input.x=input.y=0;knob.style.transform='translate(0,0)'}};
function tick(now){const dt=Math.min(.05,(now-last)/1000);last=now;const p=state[role];if(p&&p.alive){p.x=Math.max(.04,Math.min(.96,p.x+input.x*dt*.32));p.y=Math.max(.05,Math.min(.95,p.y+input.y*dt*.32));setP(role,p);if(ws?.readyState===1&&now-lastSend>100){lastSend=now;ws.send(JSON.stringify({type:'state',x:p.x,y:p.y}))}}requestAnimationFrame(tick)}requestAnimationFrame(tick);
</script></body></html>`;

export class GameRoom {
  constructor(state,env){ this.state=state; this.env=env; }
  sockets(){ return this.state.getWebSockets().filter(ws=>ws.readyState===1); }
  count(){ return this.sockets().length; }
  roleTaken(role){ return this.state.getWebSockets(role).some(ws=>ws.readyState===1); }
  broadcast(payload,except=null){ const s=JSON.stringify(payload); for(const ws of this.sockets()){ if(ws===except)continue; try{ws.send(s)}catch{} } }
  async getEnemies(){ let e=await this.state.storage.get("enemies"); if(!Array.isArray(e)){e=freshEnemies();await this.state.storage.put("enemies",e)} return e; }
  async putEnemies(e){ await this.state.storage.put("enemies",e); }
  async getDrops(){ const d=await this.state.storage.get("drops"); return Array.isArray(d)?d:[]; }
  async putDrops(d){ await this.state.storage.put("drops",d); }
  currentStates(){ const r=[]; for(const ws of this.sockets()){ const a=ws.deserializeAttachment?.()||{}; if(a.role&&a.player)r.push(publicPlayer(a.role,a.player)); } return r; }
  async scheduleEnemyAlarm(enemies){
    const times=enemies.filter(e=>!e.alive&&e.respawnAt>0).map(e=>e.respawnAt);
    if(times.length) await this.state.storage.setAlarm(Math.min(...times));
  }
  async fetch(request){
    if(request.headers.get("Upgrade")?.toLowerCase()!=="websocket")return new Response("WebSocket required",{status:426});
    const role=!this.roleTaken("bruno")?"bruno":(!this.roleTaken("nala")?"nala":null);
    if(!role)return new Response("Room full",{status:409});
    const pair=new WebSocketPair(),client=pair[0],server=pair[1],player=defaultPlayerState(role);
    server.serializeAttachment({role,player,lastAttack:0,lastSkill:0,lastEnemyHit:0,lastStateAt:Date.now(),respawnAt:0});
    this.state.acceptWebSocket(server,[role]);
    const enemies=await this.getEnemies(),drops=await this.getDrops(),existing=this.currentStates().filter(s=>s.role!==role);
    server.send(JSON.stringify({type:"welcome",role,players:this.count(),states:[...existing,publicPlayer(role,player)],enemies:enemies.map(publicEnemy),drops}));
    this.broadcast({type:"presence",players:this.count()});
    return new Response(null,{status:101,webSocket:client});
  }
  async maybeRespawnPlayer(ws,a,now){
    if(a.player?.alive!==false||!a.respawnAt||now<a.respawnAt)return;
    const progress={level:a.player.level||1,xp:a.player.xp||0,next:a.player.next||nextXp(a.player.level),gold:a.player.gold||0,metal:a.player.metal||0,herb:a.player.herb||0};
    a.player={...defaultPlayerState(a.role),...progress};a.respawnAt=0;a.lastEnemyHit=now;ws.serializeAttachment(a);
    this.broadcast({type:"player_respawn",role:a.role,player:a.player});
  }
  awardXp(ws,a,amount){
    a.player.xp=(a.player.xp||0)+amount;
    while(a.player.xp>=a.player.next){ a.player.xp-=a.player.next;a.player.level=(a.player.level||1)+1;a.player.next=nextXp(a.player.level);a.player.hp=100; }
    ws.serializeAttachment(a);
    this.broadcast({type:"progress",role:a.role,player:a.player});
  }
  async spawnDrop(enemy){ const drops=await this.getDrops(),drop=randomDrop(enemy);drops.push(drop);await this.putDrops(drops);this.broadcast({type:"drop_spawn",drop});return drop; }
  async collectDrops(ws,a){
    let drops=await this.getDrops(),changed=false;
    for(const d of [...drops]){
      if(dist(a.player,d)>DROP_PICKUP_RANGE)continue;
      if(d.kind==="coins")a.player.gold=(a.player.gold||0)+d.amount;
      else if(d.kind==="metal")a.player.metal=(a.player.metal||0)+d.amount;
      else if(d.kind==="herb")a.player.herb=(a.player.herb||0)+d.amount;
      drops=drops.filter(x=>x.id!==d.id);changed=true;ws.serializeAttachment(a);
      this.broadcast({type:"drop_pickup",role:a.role,dropId:d.id,kind:d.kind,amount:d.amount,player:a.player});
    }
    if(changed)await this.putDrops(drops);
  }
  async enemyCounterAttack(ws,a,now,enemies){
    if(!a.player?.alive||now-(a.lastEnemyHit||0)<ENEMY_ATTACK_COOLDOWN_MS)return;
    const e=enemies.filter(e=>e.alive&&dist(a.player,e)<=ENEMY_ATTACK_RANGE).sort((x,y)=>dist(a.player,x)-dist(a.player,y))[0];
    if(!e)return;a.lastEnemyHit=now;a.player.hp=Math.max(0,(a.player.hp??100)-e.damage);
    if(a.player.hp<=0){a.player.alive=false;a.respawnAt=now+PLAYER_RESPAWN_MS}ws.serializeAttachment(a);
    this.broadcast({type:"hit",target:a.role,enemyId:e.id,damage:e.damage,player:a.player});
  }
  async hitEnemy(ws,a,enemy,damage,now,enemies){
    enemy.hp=Math.max(0,enemy.hp-damage);
    if(enemy.hp<=0&&enemy.alive){
      enemy.alive=false;enemy.respawnAt=now+enemy.respawnMs;
      this.awardXp(ws,a,enemy.xp);await this.spawnDrop(enemy);
      this.broadcast({type:"combat_notice",text:`${enemy.type.toUpperCase()} DERROTADO`,x:enemy.x,y:enemy.y-.055,color:"#ffe08c"});
    }
    await this.putEnemies(enemies);await this.scheduleEnemyAlarm(enemies);
    this.broadcast({type:"hit",target:"enemy",enemyId:enemy.id,by:a.role,damage,enemy:publicEnemy(enemy)});
  }
  async webSocketMessage(ws,message){
    let d;try{d=JSON.parse(typeof message==="string"?message:new TextDecoder().decode(message))}catch{return}
    const a=ws.deserializeAttachment?.()||{};if(!a.role||!a.player)return;const now=Date.now();await this.maybeRespawnPlayer(ws,a,now);
    if(d.type==="ping"){ws.send(JSON.stringify({type:"pong",t:Number(d.t)||now}));return}
    if(d.type==="state"){
      const x=clamp01(d.x,.03,.97),y=clamp01(d.y,.05,.95);if(x===null||y===null||!a.player.alive)return;
      a.player.x=x;a.player.y=y;a.lastStateAt=now;ws.serializeAttachment(a);this.broadcast({type:"state",role:a.role,...a.player},ws);
      const enemies=await this.getEnemies();await this.enemyCounterAttack(ws,a,now,enemies);await this.collectDrops(ws,a);return;
    }
    if(d.type==="attack"){
      if(!a.player.alive||now-(a.lastAttack||0)<PLAYER_ATTACK_COOLDOWN_MS)return;a.lastAttack=now;ws.serializeAttachment(a);
      const enemies=await this.getEnemies(),target=enemies.filter(e=>e.alive&&dist(a.player,e)<=PLAYER_ATTACK_RANGE).sort((x,y)=>dist(a.player,x)-dist(a.player,y))[0];
      if(!target){ws.send(JSON.stringify({type:"combat_notice",text:"FUERA DE RANGO",x:a.player.x,y:a.player.y-.05,color:"#c8d5e2"}));return}
      await this.hitEnemy(ws,a,target,a.role==="bruno"?16:13,now,enemies);return;
    }
    if(d.type==="skill"){
      if(!a.player.alive||now-(a.lastSkill||0)<PLAYER_SKILL_COOLDOWN_MS)return;a.lastSkill=now;ws.serializeAttachment(a);
      const enemies=await this.getEnemies(),hits=enemies.filter(e=>e.alive&&dist(a.player,e)<=PLAYER_SKILL_RANGE);
      this.broadcast({type:"skill_cast",role:a.role,x:a.player.x,y:a.player.y,skill:a.role==="bruno"?"guardian_howl":"tracker_burst"});
      if(!hits.length){ws.send(JSON.stringify({type:"combat_notice",text:"SIN OBJETIVOS",x:a.player.x,y:a.player.y-.05,color:"#b9c7d5"}));return}
      const dmg=a.role==="bruno"?34:27;
      for(const e of hits)await this.hitEnemy(ws,a,e,dmg,now,enemies);
      return;
    }
  }
  async alarm(){
    const enemies=await this.getEnemies(),now=Date.now();let changed=false;
    for(const e of enemies){if(!e.alive&&e.respawnAt&&now>=e.respawnAt){const d=ENEMY_DEFS.find(x=>x.id===e.id);Object.assign(e,{...d,hp:d.maxHp,alive:true,respawnAt:0});changed=true;this.broadcast({type:"enemy_respawn",enemy:publicEnemy(e)})}}
    if(changed)await this.putEnemies(enemies);await this.scheduleEnemyAlarm(enemies);
  }
  async webSocketClose(ws){try{ws.close(1000,"closed")}catch{}queueMicrotask(()=>this.broadcast({type:"presence",players:this.count()}));}
  async webSocketError(ws){try{ws.close(1011,"socket error")}catch{}queueMicrotask(()=>this.broadcast({type:"presence",players:this.count()}));}
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==="/health")return json({ok:true,status:"ok",service:SERVICE,version:VERSION,durableObjects:true,multiEnemy:true,drops:true,xp:true,skills:true});
    if(url.pathname==="/create"&&request.method==="POST")return json({ok:true,room:randomRoom()});
    if(url.pathname.startsWith("/ws/")){
      const room=normalizeRoom(decodeURIComponent(url.pathname.slice(4)));if(!ROOM_RE.test(room))return json({ok:false,error:"invalid_room"},400);
      return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(room)).fetch(request);
    }
    if(url.pathname==="/"||url.pathname==="/test")return new Response(TEST_CLIENT,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
    return json({ok:false,error:"not_found"},404);
  }
};
