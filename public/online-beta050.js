/* Beta 0.50 adapter. SOLO retains the stable 0.47.2 implementation. */
const betaOriginal={updatePlayer,updateOnlineCoop,onlineHandleMessage,onlineApplyWelcomeAfterStart,interact,dash,usePotion,activeNpcs,renderHud,renderInventory,openInventory,openShop,openInnShop,acceptQuest,claimQuest,renderSkills,bindMenuAndUi,drawScene,updateWorldNpcs};
let betaSnapshot=null,betaInventoryKey='',betaInputClock=0;
let betaLocalInput={x:0,y:0};
const BETA_NET_PREDICTION=Object.freeze({
  hardSnap:170,
  movingCorrection:4.2,
  idleCorrection:11,
  tickLead:.05,
  maxLead:.16
});
function betaReadLocalInput(){
  let x=0,y=0;
  const p=onlineLocalPlayer();
  if(!overlay&&p&&p.hp>0){
    x=(keys.KeyD?1:0)-(keys.KeyA?1:0)+(touchMode?touchMove.x:0);
    y=(keys.KeyS?1:0)-(keys.KeyW?1:0)+(touchMode?touchMove.y:0);
    const l=Math.hypot(x,y);
    if(l>1){x/=l;y/=l;}
  }
  betaLocalInput.x=x;betaLocalInput.y=y;
  return betaLocalInput;
}
function betaReconcileTarget(p,s){
  const moving=Math.hypot(betaLocalInput.x,betaLocalInput.y)>.01;
  if(!moving)return {x:s.x,y:s.y};
  const oneWay=clamp((onlineCoop.ping??140)/2000,0,.11);
  const lead=clamp(oneWay+BETA_NET_PREDICTION.tickLead,0,BETA_NET_PREDICTION.maxLead);
  return {x:s.x+betaLocalInput.x*p.speed*lead,y:s.y+betaLocalInput.y*p.speed*lead};
}
onlineWsUrl=room=>ONLINE_COOP_SERVER.replace(/^http/,'ws')+'/ws/'+encodeURIComponent(room)+'?v=50';
onlineWorldFromNet=(x,y)=>({x,y});
onlineApplyWelcomeAfterStart=function(){enemies=[];loot=[];hazards=[];respawnQueue=[];onlineCoop.enemies=[];onlineCoop.drops=[];players.forEach(p=>p.onlinePresent=false);betaSnapshot=null;betaInventoryKey='';};
function betaSnapshotApply(m){
  if(!onlineCoop.active||m.protocol!==50)return;betaSnapshot=m;onlineCoop.players=m.connected.length;kills=m.kills;
  for(const [role,s] of Object.entries(m.players)){
    const p=onlineRolePlayer(role);if(!p)continue;const oldScene=p.scene,oldX=p.x,oldY=p.y,isLocal=p===onlineLocalPlayer();Object.assign(p,s);p.onlinePresent=m.connected.includes(role);
    if(isLocal&&oldScene===s.scene){
      const target=betaReconcileTarget(p,s),err=Math.hypot(oldX-target.x,oldY-target.y);
      p.x=oldX;p.y=oldY;p.netServerX=s.x;p.netServerY=s.y;p.netTargetX=target.x;p.netTargetY=target.y;
      if(err>BETA_NET_PREDICTION.hardSnap){p.x=s.x;p.y=s.y;p.netTargetX=s.x;p.netTargetY=s.y;}
    }else{
      p.netTargetX=s.x;p.netTargetY=s.y;
      if(oldScene===s.scene&&Math.hypot(oldX-s.x,oldY-s.y)<220){p.x=oldX;p.y=oldY;}
    }
    // Restore references so native equipment highlighting and comparison remain correct.
    for(const slot of Object.keys(p.equip))if(p.equip[slot])p.equip[slot]=p.inventory.find(i=>i.id===p.equip[slot].id)||p.equip[slot];
    onlineCoop.progressByRole[role]={level:p.level,xp:p.xp,next:p.next,gold:p.gold,metal:p.metal,herb:p.herb};
  }
  const lp=onlineLocalPlayer();if(!lp)return;
  if(scene!==lp.scene){closeOverlay();scene=lp.scene;inside=scene==='world'?null:scene;camera.x=lp.netTargetX;camera.y=lp.netTargetY;clampCamera();}
  gold=lp.gold;materials={metal:lp.metal,herb:lp.herb};consumables={potion:lp.potions};
  for(const id of Object.keys(quests))Object.assign(quests[id],m.quests[id],{claimed:!!lp.claims[id]});
  enemies=m.enemies.map(e=>({...e,onlineId:e.id,onlineAlive:e.alive}));onlineCoop.enemies=enemies;
  chests=m.chests.map(c=>({...c,openAnim:c.open?1:0,opening:false}));onlineCoop.drops=m.drops.map(d=>({...d,t:worldClock}));
  for(const ev of m.events||[]){
    if(ev.kind==='notice'&&ev.role===onlineCoop.role)setMessage(ev.text);
    if(ev.kind==='loot'&&ev.role===onlineCoop.role){showToast(ev.item,true);AudioManager.play('pickup');}
    if(ev.scene!==scene)continue;
    if(ev.kind==='hit'||ev.kind==='hurt')addDamageNumber(ev.x,ev.y,ev.damage,ev.kind==='hurt'?'#ff8b83':'#ffffff',false);
    if(ev.kind==='skill'||ev.kind==='enemySkill')effects.push({kind:'howl',x:ev.x,y:ev.y,life:.75,max:.75});
    if(ev.kind==='dash')effects.push({kind:'dash',x:ev.x,y:ev.y,life:.26,max:.26});
    if(ev.kind==='attack'){const angle=Math.atan2(ev.dirY,ev.dirX);effects.push({kind:'slash',x:ev.x+ev.dirX*22,y:ev.y+ev.dirY*15,angle,life:.22,max:.22,strong:ev.combo===3,combo:ev.combo});}
  }
  if(m.victory&&!victoryShown){gameCompleted=true;showVictoryOverlay();}
  const signature=JSON.stringify([lp.inventory,lp.equip,lp.points,lp.gold,lp.potions,lp.metal,lp.herb]);
  if(signature!==betaInventoryKey){betaInventoryKey=signature;if(overlay==='inventory')renderInventory();if(overlay==='skills')renderSkills();if(overlay==='quest')renderQuestLog();}
  onlineUpdateHud();
}
onlineHandleMessage=function(m){
  if(m?.type==='welcome'&&m.protocol!==50){onlineStatus('El servidor no corresponde a la beta 0.50.','err');disconnectOnlineCoop();return;}
  if(m?.type==='snapshot'){betaSnapshotApply(m);return;}betaOriginal.onlineHandleMessage(m);
};
onlineAttack=p=>{if(p===onlineLocalPlayer()&&p.hp>0&&!overlay)onlineSend({type:'attack'});};
onlineSkill=p=>{if(p===onlineLocalPlayer()&&p.hp>0&&!overlay)onlineSend({type:'skill'});};
dash=function(p){
  if(!onlineCoop.active)return betaOriginal.dash(p);
  if(p!==onlineLocalPlayer()||overlay||p.hp<=0)return;
  const cost=28-p.skills.dash*4;if(p.dashCd>0||p.stam<cost)return;
  // Client-side prediction: the dash is shown immediately; the next authoritative snapshot reconciles it.
  AudioManager.play('dash');p.stam=Math.max(0,p.stam-cost);p.dashCd=.38;p.inv=.34;p.state='dash';
  effects.push({kind:'dash',x:p.x,y:p.y,life:.26,max:.26});
  const len=(p.role==='Rastreadora'?160:132)+p.skills.dash*22;movePlayer(p,p.dirX*len,p.dirY*len);
  effects.push({kind:'dash',x:p.x-p.dirX*22,y:p.y-p.dirY*12,life:.18,max:.18});
  onlineSend({type:'dash'});
};
usePotion=function(p){if(!onlineCoop.active)return betaOriginal.usePotion(p);onlineSend({type:'potion'});};
updatePlayer=function(p,dt){
  if(!onlineCoop.active)return betaOriginal.updatePlayer(p,dt);
  if(p!==onlineLocalPlayer()||p.hp<=0)return;
  const input=betaReadLocalInput(),moving=Math.hypot(input.x,input.y)>.01;
  // Immediate local movement. The Worker remains authoritative; snapshots correct drift below.
  if(!overlay&&moving){
    p.dirX=input.x;p.dirY=input.y;movePlayer(p,input.x*p.speed*dt,input.y*p.speed*dt);
    p.anim+=dt;if(p.attackCd<=0&&p.dashCd<=0&&p.skillCd<4.6)p.state='run';
  }else{
    p.anim+=dt*.6;if(p.attackCd<=0&&p.dashCd<=0&&p.skillCd<4.6)p.state='idle';
  }
  p.attackCd=Math.max(0,p.attackCd-dt);p.dashCd=Math.max(0,p.dashCd-dt);p.skillCd=Math.max(0,p.skillCd-dt);
  p.comboTimer=Math.max(0,p.comboTimer-dt);p.inv=Math.max(0,p.inv-dt);p.flash=Math.max(0,p.flash-dt);
};
updateWorldNpcs=function(dt){if(!onlineCoop.active)betaOriginal.updateWorldNpcs(dt);};
activeNpcs=function(){if(!onlineCoop.active)return betaOriginal.activeNpcs();if(scene==='world')return mapObjects.filter(o=>o.type==='npc').map(o=>({...worldNpcData(o),dirX:0,dirY:1,anim:0,moving:false,sheet:o.props.asset+'_sheet'}));return betaOriginal.activeNpcs();};
updateOnlineCoop=function(dt){
  if(!onlineCoop.active)return;
  const lp=onlineLocalPlayer(),input=betaReadLocalInput();
  for(const p of players){
    if(!Number.isFinite(p.netTargetX)){p.anim+=dt;continue;}
    const dx=p.netTargetX-p.x,dy=p.netTargetY-p.y,d=Math.hypot(dx,dy);
    if(p===lp){
      // Reconciliation is deliberately softer while moving so the controls never feel tied to RTT.
      if(d>BETA_NET_PREDICTION.hardSnap){p.x=p.netTargetX;p.y=p.netTargetY;}
      else if(d>.35){const rate=Math.hypot(input.x,input.y)>.01?BETA_NET_PREDICTION.movingCorrection:BETA_NET_PREDICTION.idleCorrection,k=1-Math.exp(-rate*dt);p.x+=dx*k;p.y+=dy*k;}
    }else{
      if(d>.7){p.dirX=dx/d;p.dirY=dy/d;}
      const k=1-Math.exp(-14*dt);p.x+=dx*k;p.y+=dy*k;
    }
    p.anim+=dt;
  }
  betaInputClock+=dt;if(betaInputClock>=.05){
    betaInputClock=0;
    onlineSend({type:'input',x:+input.x.toFixed(4),y:+input.y.toFixed(4)});
  }
  onlineCoop.pingClock+=dt;if(onlineCoop.pingClock>=2){onlineCoop.pingClock=0;onlineSend({type:'ping',t:Date.now()});}
};
interact=function(){
  if(!onlineCoop.active)return betaOriginal.interact();if(overlay==='dialog'){advanceDialogue();return;}if(overlay)return;
  const p=onlineLocalPlayer();if(!p||p.hp<=0)return;
  const n=activeNpcs().filter(n=>dist(p,n)<112).sort((a,b)=>dist(a,p)-dist(b,p))[0];
  if(n){const id={Toto:'cats',Rufus:'metal',Mora:'cave'}[n.name];if(id&&quests[id].done&&!quests[id].claimed){onlineSend({type:'quest',id});return;}
    const actions={Toto:()=>onlineSend({type:'quest',id:'cats'}),Rufus:()=>{onlineSend({type:'quest',id:'metal'});openShop();},Mora:()=>{onlineSend({type:'quest',id:'cave'});openQuestLog();},Barto:()=>openInnShop()};openDialogue({...n,action:actions[n.name]||null});return;
  }
  onlineSend({type:'interact'});
};
acceptQuest=function(id){if(onlineCoop.active)onlineSend({type:'quest',id});else betaOriginal.acceptQuest(id);};
claimQuest=function(id){if(onlineCoop.active)onlineSend({type:'quest',id});else betaOriginal.claimQuest(id);};
openInventory=function(id){return betaOriginal.openInventory(onlineCoop.active?onlineLocalPlayer().id:id);};
renderInventory=function(){if(onlineCoop.active)activeInventoryPlayer=onlineLocalPlayer().id;betaOriginal.renderInventory();if(onlineCoop.active){document.getElementById('tabP1').style.display='none';document.getElementById('tabP2').style.display='none';}};
openShop=function(){betaOriginal.openShop();if(!onlineCoop.active)return;document.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>onlineSend({type:'service',action:'buy',index:Number(b.dataset.buy)}));document.querySelectorAll('[data-craft]').forEach(b=>b.onclick=()=>onlineSend({type:'service',action:b.dataset.craft}));};
openInnShop=function(){betaOriginal.openInnShop();if(!onlineCoop.active)return;document.querySelectorAll('[data-service]').forEach(b=>b.onclick=()=>onlineSend({type:'service',action:b.dataset.service}));};
renderHud=function(){betaOriginal.renderHud();if(!onlineCoop.active)return;const p=onlineLocalPlayer();if(!p)return;UI.tracker.innerHTML=`<div class="trackerTitle">Aventura online · ${onlineCoop.room}</div>${Object.values(quests).filter(q=>q.active).map(q=>`<div class="trackerLine"><span>${q.title}</span><span>${q.claimed?'Cobrada':q.done?'Lista':'Activa'}</span></div>`).join('')}<div class="trackerMeta">${gold} oro · ${materials.metal} metal · ${materials.herb} hierba · ${consumables.potion} pociones<br>INV y diálogos no pausan la sala</div>`;};
bindMenuAndUi=function(){betaOriginal.bindMenuAndUi();
  document.getElementById('btnInv').onclick=()=>players.length&&openInventory(onlineCoop.active?onlineLocalPlayer().id:1);
  document.getElementById('btnQuest').onclick=()=>openQuestLog();document.getElementById('btnSkills').onclick=()=>openSkills();document.getElementById('btnPotion').onclick=()=>usePotion(onlineCoop.active?onlineLocalPlayer():players[0]);
  document.querySelectorAll('[data-skill]').forEach(b=>b.onclick=()=>{const skill=b.dataset.skill;if(onlineCoop.active){onlineSend({type:'upgrade',skill});return;}const p=players[0];if(p&&p.points>0&&p.skills[skill]<3){p.points--;p.skills[skill]++;recalc(p);renderSkills();}});
};
