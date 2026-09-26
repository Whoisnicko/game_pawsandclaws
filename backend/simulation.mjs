import world from './world.json' with {type:'json'};
import {makeItem,makePlayer,recalc} from './rules.mjs';
export const PROTOCOL=50;
const clone=v=>JSON.parse(JSON.stringify(v));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const same=(a,b)=>a.scene===b.scene;
const slots=['weapon','armor','head','charm','boots','artifact'];
export class Simulation {
  constructor(saved=null){
    this.data=saved||{version:PROTOCOL,players:{},enemies:world.enemies.map((e,i)=>({...clone(e),id:'enemy-'+i,alive:true,respawnAt:0})),drops:[],chests:world.chests.map((c,i)=>({...clone(c),id:'chest-'+i})),quests:{cats:{active:false,done:false,claimed:false},metal:{active:false,done:false,claimed:false,count:0},cave:{active:false,done:false,claimed:false}},kills:0,victory:false,seq:0,serial:0};
    this.inputs={};this.events=[];this.connected=new Set();
  }
  join(role){
    if(!this.data.players[role]){const p=makePlayer(role==='bruno'?1:2,world.spawn.x+(role==='nala'?60:0),world.spawn.y,role==='bruno'?'Bruno':'Nala',role==='bruno'?'Guardián':'Rastreadora',role);Object.assign(p,{netRole:role,scene:'world',mp:p.maxMp,gold:45,metal:0,herb:0,potions:2,respawnAt:0,claims:{}});this.data.players[role]=p;}
    this.connected.add(role);this.inputs[role]={x:0,y:0,at:0};return this.data.players[role];
  }
  leave(role){this.connected.delete(role);delete this.inputs[role];}
  notice(role,text){this.events.push({kind:'notice',role,text});}
  safe(p){const b=world.safe;return p.scene==='world'&&p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY;}
  move(p,dx,dy){
    const bounds=p.scene==='world'?[15,world.width-15,15,world.height-15]:p.scene==='dungeon'?[80,1720,80,1120]:[85,920,90,620];
    const blocked=(x,y)=>p.scene==='world'&&world.collisions.some(r=>{const cx=clamp(x,r.x,r.x+r.width),cy=clamp(y,r.y,r.y+r.height);return (x-cx)**2+(y-cy)**2<225;});
    // Sweep short steps: a dash must not tunnel through a wall.
    const n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/8));for(let i=0;i<n;i++){const x=clamp(p.x+dx/n,bounds[0],bounds[1]);if(!blocked(x,p.y))p.x=x;const y=clamp(p.y+dy/n,bounds[2],bounds[3]);if(!blocked(p.x,y))p.y=y;}
  }
  refresh(p){const alive=p.hp>0;recalc(p);if(!alive)p.hp=0;}
  item(p,it){
    if(p.inventory.length>=18){const index=p.inventory.findLastIndex(i=>p.equip[i.slot]?.id!==i.id);if(index>=0)p.inventory.splice(index,1);else return false;}
    it.id='item-'+(++this.data.serial);p.inventory.unshift(it);if(!p.equip[it.slot]){p.equip[it.slot]=it;this.refresh(p);}this.events.push({kind:'loot',role:p.netRole,item:it});return true;
  }
  xp(p,amount){p.xp+=amount;while(p.xp>=p.next){p.xp-=p.next;p.level++;p.points++;p.next=Math.round(p.next*1.28);p.baseHp+=12;p.baseAtk+=3;this.refresh(p);p.hp=p.maxHp;}}
  damage(p,e,amount,now){
    if(!e.alive)return;e.hp=Math.max(0,e.hp-Math.round(amount));e.flash=.18;this.events.push({kind:'hit',target:e.id,damage:Math.round(amount),scene:e.scene,x:e.x,y:e.y});
    if(e.hp>0)return;e.alive=false;e.state='dead';e.respawnAt=e.type==='king'?0:now+22000;this.data.kills++;
    for(const role of this.connected){const ally=this.data.players[role];if(same(ally,e)&&distance(ally,e)<900)this.xp(ally,18+e.level*8);}
    const kind=e.type==='elite'?'metal':Math.random()<.25?'herb':'coins';
    this.data.drops.push({id:'drop-'+(++this.data.serial),kind,amount:kind==='coins'?8+e.level*3:1,x:e.x,y:e.y,scene:e.scene});
    if(e.type==='king'||Math.random()<.35)this.data.drops.push({id:'drop-'+(++this.data.serial),kind:'equipment',amount:1,item:makeItem(e.type==='king'?'artifact':slots[Math.floor(Math.random()*slots.length)],e.level,e.type==='king'?3:null),x:e.x+22,y:e.y+10,scene:e.scene});
    if(e.type==='king'){this.data.victory=true;this.events.push({kind:'victory'});}this.quests();
  }
  hurt(p,amount,now){if(p.inv>0||p.hp<=0)return;const dealt=Math.max(1,Math.round(amount-p.def));p.hp=Math.max(0,p.hp-dealt);p.inv=.56;p.flash=.18;this.events.push({kind:'hurt',role:p.netRole,damage:dealt,scene:p.scene,x:p.x,y:p.y});if(p.hp<=0){p.state='dead';p.respawnAt=now+2600;}}
  quests(){const q=this.data.quests;if(q.cats.active)q.cats.done=this.data.kills>=6;if(q.metal.active){q.metal.count=Object.values(this.data.players).reduce((s,p)=>s+p.metal,0);q.metal.done=q.metal.done||q.metal.count>=2;}if(q.cave.active)q.cave.done=this.data.victory;}
  npc(p,name){return world.npcs.some(n=>n.name===name&&p.scene==='world'&&distance(p,n)<145)||({house:'Toto',forge:'Rufus',inn:'Barto',elder:'Mora'}[p.scene]===name&&distance(p,{x:500,y:340})<145);}
  command(role,d,now=Date.now()){
    const p=this.data.players[role];if(!p||!this.connected.has(role)||!d||typeof d!=='object')return;
    if(d.type==='input'){
      if(!Number.isFinite(d.x)||!Number.isFinite(d.y))return;const n=Math.max(1,Math.hypot(d.x,d.y));this.inputs[role]={x:d.x/n,y:d.y/n,at:now};return;
    }
    if(p.hp<=0)return;
    if(d.type==='attack'){
      if(p.attackCd>0)return;p.combo=p.comboTimer>0?p.combo%3+1:1;p.comboTimer=.72;const spec=[null,[90,1,.23],[104,1.28,.28],[128,1.82,.44]][p.combo];p.attackCd=spec[2];p.state='attack';this.events.push({kind:'attack',role,scene:p.scene,x:p.x,y:p.y,dirX:p.dirX,dirY:p.dirY,combo:p.combo});
      for(const e of this.data.enemies){const n=distance(p,e)||1;if(e.alive&&same(p,e)&&n<spec[0]+e.r&&((e.x-p.x)*p.dirX+(e.y-p.y)*p.dirY)/n>-.12)this.damage(p,e,p.attack*spec[1],now);}return;
    }
    if(d.type==='skill'){
      const cost=Math.max(18,28-p.skills.howl*4);if(p.skillCd>0||p.mp<cost)return;p.mp-=cost;p.skillCd=5.1;p.state='skill';this.events.push({kind:'skill',role,scene:p.scene,x:p.x,y:p.y});for(const e of this.data.enemies)if(e.alive&&same(p,e)&&distance(p,e)<205+p.skills.howl*40)this.damage(p,e,p.attack*(1.35+p.skills.howl*.28),now);return;
    }
    if(d.type==='dash'){
      const cost=28-p.skills.dash*4;if(p.dashCd>0||p.stam<cost)return;p.stam-=cost;p.dashCd=.38;p.inv=.34;p.state='dash';const len=(role==='nala'?160:132)+p.skills.dash*22;this.move(p,p.dirX*len,p.dirY*len);this.events.push({kind:'dash',role,scene:p.scene,x:p.x,y:p.y});return;
    }
    if(d.type==='potion'){if(p.potions<1||p.hp>=p.maxHp&&p.mp>=p.maxMp)return;p.potions--;p.hp=Math.min(p.maxHp,p.hp+Math.round(p.maxHp*.45));p.mp=Math.min(p.maxMp,p.mp+Math.round(p.maxMp*.22));return;}
    if(d.type==='equip'){const it=p.inventory.find(i=>i.id===d.id);if(it){p.equip[it.slot]=it;this.refresh(p);}return;}
    if(d.type==='upgrade'){if(['power','dash','howl'].includes(d.skill)&&p.points>0&&p.skills[d.skill]<3){p.points--;p.skills[d.skill]++;this.refresh(p);}return;}
    if(d.type==='quest'){
      const name={cats:'Toto',metal:'Rufus',cave:'Mora'}[d.id],q=this.data.quests[d.id];if(!q||!this.npc(p,name))return;
      if(!q.active){if(d.id==='cave'&&!this.data.quests.cats.done)return;q.active=true;this.quests();return;}
      if(!q.done||p.claims[d.id])return;
      if(d.id==='metal'){
        // Consume the shared requirement only on the first claim.
        if(!q.claimed){let left=2;if(Object.values(this.data.players).reduce((n,a)=>n+a.metal,0)<2)return;for(const a of Object.values(this.data.players)){const take=Math.min(left,a.metal);a.metal-=take;left-=take;}}
        if(p.equip.weapon)p.equip.weapon.power+=6;else this.item(p,makeItem('weapon',p.level+1,1));this.refresh(p);
      }else if(d.id==='cats'){p.gold+=80;p.potions++;this.item(p,makeItem('armor',p.level+1,1));}else{p.potions+=2;this.item(p,makeItem('artifact',p.level+2,2));}
      q.claimed=true;p.claims[d.id]=true;return;
    }
    if(d.type==='service'){
      const inn=['rest','potion','brew'].includes(d.action);if(!this.npc(p,inn?'Barto':'Rufus'))return;
      if(d.action==='rest'&&p.gold>=15){p.gold-=15;p.buffs.inn=180;this.refresh(p);p.hp=p.maxHp;p.mp=p.maxMp;}
      if(d.action==='potion'&&p.gold>=18){p.gold-=18;p.potions++;}
      if(d.action==='brew'&&p.gold>=5&&p.herb>0){p.gold-=5;p.herb--;p.potions++;}
      if(d.action==='buy'&&Number.isInteger(d.index)&&d.index>=0&&d.index<4){const i=d.index,prices=[52,58,49,92];if(p.gold>=prices[i]){p.gold-=prices[i];const it=makeItem(['weapon','armor','boots','charm'][i],i===3?4:3,i===3?2:1);it.power=[14,12,11,16][i];this.item(p,it);}}
      if(['craftWeapon','craftArmor'].includes(d.action)){const armor=d.action==='craftArmor',it=p.equip[armor?'armor':'weapon'],metal=armor?3:2,gold=armor?35:25;if(it&&p.metal>=metal&&p.gold>=gold){p.metal-=metal;p.gold-=gold;it.power+=3;this.refresh(p);}}
      return;
    }
    if(d.type==='interact'){
      const ch=this.data.chests.find(c=>same(p,c)&&!c.open&&distance(p,c)<82);
      if(ch){if(ch.final&&!this.data.victory){this.notice(role,'El Rey Gato mantiene el cofre sellado.');return;}ch.open=true;this.item(p,makeItem(ch.final?'artifact':slots[Math.floor(Math.random()*slots.length)],p.level+1,ch.tier));if(ch.final)p.gold+=90;return;}
      if(p.scene==='world'){
        const b=world.buildings.find(b=>distance(p,b)<125);if(b){p.scene=b.props.objectId;p.x=470;p.y=545;return;}
        if(distance(p,{x:world.cave.x,y:world.cave.y+76})<185){p.scene='dungeon';p.x=190;p.y=930;return;}
      }else if(p.scene==='dungeon'){if(p.x<285&&p.y>865){p.scene='world';p.x=world.cave.x-185;p.y=world.cave.y+165;return;}}
      else if(p.y>565){const b=world.buildings.find(b=>b.props.objectId===p.scene);if(b){p.scene='world';p.x=b.x;p.y=b.y+115;}}
    }
  }
  tick(dt,now=Date.now()){
    dt=clamp(dt,0,.1);
    for(const role of this.connected){const p=this.data.players[role];
      if(p.hp<=0){if(now>=p.respawnAt){p.scene='world';p.x=world.spawn.x+(role==='nala'?60:0);p.y=world.spawn.y;p.hp=p.maxHp;p.mp=p.maxMp;p.stam=100;p.inv=2;p.respawnAt=0;p.state='idle';}continue;}
      for(const key of ['attackCd','dashCd','skillCd','comboTimer','inv','flash'])p[key]=Math.max(0,p[key]-dt);
      p.stam=Math.min(100,p.stam+36*dt);p.mp=Math.min(p.maxMp,p.mp+10*dt);
      if(p.buffs.inn>0){p.buffs.inn=Math.max(0,p.buffs.inn-dt);if(!p.buffs.inn)this.refresh(p);}
      const input=this.inputs[role],moving=input&&now-input.at<350&&(input.x||input.y);
      if(moving){p.dirX=input.x;p.dirY=input.y;this.move(p,input.x*p.speed*dt,input.y*p.speed*dt);}
      p.state=p.attackCd>0?'attack':p.dashCd>0?'dash':p.skillCd>4.6?'skill':moving?'run':'idle';p.anim+=dt;
      for(let i=this.data.drops.length-1;i>=0;i--){const d=this.data.drops[i];if(!same(p,d)||distance(p,d)>=52)continue;if(d.kind==='equipment')this.item(p,d.item);else if(d.kind==='coins')p.gold+=d.amount;else p[d.kind]+=d.amount;this.data.drops.splice(i,1);this.quests();}
    }
    for(const e of this.data.enemies){
      if(!e.alive){if(e.respawnAt&&now>=e.respawnAt&&!Array.from(this.connected).some(r=>same(this.data.players[r],e)&&distance(this.data.players[r],{x:e.homeX,y:e.homeY})<350)){const base=world.enemies[Number(e.id.slice(6))];Object.assign(e,clone(base),{alive:true,respawnAt:0});}continue;}
      e.flash=Math.max(0,(e.flash||0)-dt);e.cd-=dt;e.anim+=dt;
      const candidates=Array.from(this.connected).map(r=>this.data.players[r]).filter(p=>p.hp>0&&same(p,e)&&!this.safe(p));const p=candidates.sort((a,b)=>distance(a,e)-distance(b,e))[0];
      if(e.type==='king'&&e.phase===1&&e.hp<e.maxHp*.5){e.phase=2;e.speed*=1.12;e.dmg+=5;}
      const d=p?distance(p,e):Infinity,home={x:e.homeX,y:e.homeY};
      if(!p||d>e.aggro*1.5||distance(e,home)>e.leash){e.state='return';const h=distance(e,home);if(h>4){e.x+=(home.x-e.x)/h*e.speed*dt;e.y+=(home.y-e.y)/h*e.speed*dt;}else e.state='idle';continue;}
      e.state='aggro';const ranged=e.type==='archer'||e.type==='mage',range=ranged?240:e.type==='king'?85:48;
      if(d>range){const next={x:e.x+(p.x-e.x)/d*e.speed*dt,y:e.y+(p.y-e.y)/d*e.speed*dt,scene:e.scene};if(!this.safe(next)){e.x=next.x;e.y=next.y;}}
      else if(e.cd<=0){e.cd=e.phase===2?.9:1.3;
        if(e.type==='king'){for(const role of this.connected){const a=this.data.players[role];if(same(a,e)&&distance(a,e)<150)this.hurt(a,e.dmg,now);}this.events.push({kind:'enemySkill',x:e.x,y:e.y,scene:e.scene});}
        else this.hurt(p,e.dmg,now);
      }
    }
    this.data.seq++;
  }
  snapshot(){return {...clone(this.data),type:'snapshot',protocol:PROTOCOL,connected:[...this.connected],events:this.events.splice(0)};}
}
