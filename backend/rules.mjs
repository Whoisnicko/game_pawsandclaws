// Stats and item rules extracted from stable 0.47.2.
const RARITIES = [
  {name:'Común',color:'#c6ccd2',mult:1}, {name:'Raro',color:'#46a8ff',mult:1.35},
  {name:'Épico',color:'#b967f2',mult:1.8}, {name:'Legendario',color:'#f2b73b',mult:2.45}
];
const SLOT_LABEL = {head:'Cabeza',weapon:'Arma',armor:'Pechera',charm:'Collar',boots:'Botas',artifact:'Artefacto'};
const ITEM_ASSET = {weapon:'item_sword',head:'item_helm',armor:'item_armor',charm:'item_collar',boots:'item_boots',artifact:'item_artifact'};

function makeItem(slot,level=1,forcedTier=null){
  const idx=forcedTier===null?(Math.random()<.05?3:Math.random()<.22?2:Math.random()<.55?1:0):forcedTier;
  const rr=RARITIES[idx]; const names={weapon:['Hueso Tallado','Colmillo Azul','Espada del Sabueso','Mandíbula de Cerbero'],head:['Capucha de Viaje','Casco del Rastreador','Yelmo del Mastín','Corona de Cerbero'],armor:['Arnés de Cuero','Pechera del Pastor','Coraza de Guerra','Armadura del Alfa'],charm:['Collar de Cuero','Medalla de Caza','Collar Rúnico','Collar del Primer Alfa'],boots:['Botas Simples','Botas del Galgo','Grebas de Caza','Pisadas Celestiales'],artifact:['Piedra de Olfato','Tótem de la Manada','Orbe Lunar','Corazón Ancestral']}[slot];
  return {id:Math.random().toString(36).slice(2),slot,tier:idx,rarity:rr.name,color:rr.color,power:Math.round((5+level*2.5)*rr.mult),name:names[Math.min(3,Math.floor(level/3))],asset:ITEM_ASSET[slot]};
}
function makePlayer(id,x,y,name,role,sheet){
  const tank=role==='Guardián';
  const p={kind:'player',id,name,role,sheet,x,y,r:15,level:1,xp:0,next:85,points:1,skills:{power:0,dash:0,howl:0},baseHp:tank?185:130,baseMp:tank?72:96,baseAtk:tank?19:16,baseDef:tank?5:2,baseSpeed:tank?278:325,hp:0,maxHp:0,mp:0,maxMp:0,attack:0,def:0,speed:0,stam:100,dirX:1,dirY:0,state:'idle',anim:0,attackCd:0,dashCd:0,skillCd:0,combo:0,comboTimer:0,inv:0,flash:0,buffs:{inn:0},equip:{head:null,weapon:null,armor:null,charm:null,boots:null,artifact:null},inventory:[]};
  recalc(p); return p;
}
function recalc(p){
  let atk=p.baseAtk*(1+p.skills.power*.1),hp=p.baseHp,mp=p.baseMp,def=p.baseDef,sp=p.baseSpeed,e=p.equip;
  if(e.weapon)atk+=e.weapon.power;
  if(e.head){def+=Math.round(e.head.power*.25);hp+=e.head.power*2}
  if(e.armor){def+=Math.round(e.armor.power*.4);hp+=e.armor.power*4}
  if(e.charm){hp+=e.charm.power*2;mp+=Math.round(e.charm.power*.6)}
  if(e.boots)sp+=e.boots.power*2;
  if(e.artifact){atk+=Math.round(e.artifact.power*.5);mp+=Math.round(e.artifact.power*1.2)}
  if(p.buffs&&p.buffs.inn>0){atk+=2;def+=1;hp+=10;mp+=6}
  const oldHpMax=p.maxHp||hp, oldMpMax=p.maxMp||mp;
  p.attack=Math.round(atk);p.maxHp=Math.round(hp);p.maxMp=Math.round(mp);p.def=def;p.speed=sp;
  if(!p.hp)p.hp=p.maxHp; else p.hp=Math.min(p.maxHp,p.hp+p.maxHp-oldHpMax);
  if(!p.mp&&p.mp!==0)p.mp=p.maxMp; else if(oldMpMax===0)p.mp=p.maxMp; else p.mp=Math.min(p.maxMp,p.mp+p.maxMp-oldMpMax);
}
export {makeItem,makePlayer,recalc};
