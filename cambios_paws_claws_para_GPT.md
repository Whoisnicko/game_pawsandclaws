# Paws & Claws — cambios hechos por Claude (Beta 0.40)

Archivo: `paws_claws_beta040_selfcontained.html` (juego 2D en canvas, un solo HTML). Todo está en un repo git local (4 commits, sin remoto). Abajo: qué se cambió, por qué, y el diff exacto.

## Resumen

1. **Versión unificada (`d1f04ff`)**: el menú decía "Beta 0.38" y la pestaña "Beta 0.40". Ahora una constante `GAME_VERSION` (+ `GAME_SUBTITLE`) al inicio del `<script>` alimenta `document.title` y el `.startTitle` del menú.
2. **Solapamientos de HUD (`05fe160`)**, causa común: capas de CSS (Beta 0.28→0.40) que reescriben posiciones con `!important` y valores fijos en rem.
   - `#message`: una regla tardía `.uiPanel,.window,#message{position:relative}` anulaba su `position:absolute` (abajo-izquierda) y lo dejaba fuera de pantalla arriba. Se sacó `#message` de esa regla.
   - Etiquetas de NPC (`drawWorldNpc`): el cuadro del rol (y-h-24) se pisaba con el nombre (baseline y-h-8). Ahora rol en y-h-38/-28 y el hint en y-h-64/-49.
   - Diario vs minimapa: `#miniWrap` tenía `top:7.2rem` fijo y el Diario creció. Ahora `top:calc(var(--mini-top,7.2rem) + .6rem)`, con `--mini-top` seteada por un `ResizeObserver` sobre `#questTracker`.
   - Inventario: los stats se dibujaban en el canvas (390x520) en una franja donde el CSS puso las ranuras Collar/Botas. Ahora van en 2 líneas cortas (`ATQ · DEF` / `HP · MP`) en el hueco central.
3. **Bandas en el camino (`6671f9b`)**: no eran coordenadas decimales ni `imageSmoothingEnabled` (ya estaban bien: `Math.round` y smoothing en false). La causa era `drawVillageCobble`, que dibujaba una franja gris translúcida por tile (y+30%, alto 46%) que al repetirse por fila formaba rayas. Se quitó esa franja; las piedritas se mantienen.
4. **Aviso de misión y progreso (`8bef8f6`)**: la imagen de fondo de `#questToast` ya trae el texto "Quest Updated" y el título se dibujaba encima. Ahora el título va en una píldora (`.questToastText`) debajo del banner. El Diario muestra progreso (`kills/target` para "cats", `count/target` si la misión tiene target) vía `questProgressLabel(q)`.

## Cómo se verificó

Con Playwright (servidor local): capturas de cada zona, medición de `getBoundingClientRect` de los paneles, cero errores de JS (solo 404 de favicon).

## Pendiente / no probado

- Cueva del Rey Gato y pantalla de victoria: la prueba quedó incompleta (entré a la cueva y peleé con los primeros enemigos; no llegué al jefe).
- Modo 2 jugadores y modo táctil no probados.
- La imagen del aviso de misión dice "Quest Updated" en inglés (está dentro del PNG).
- Posible: sin botín tras matar un guerrero (una sola muerte observada).

## Diff completo (de d1f04ff a HEAD; el commit d1f04ff en sí agrega el archivo entero, con el cambio de versión descrito arriba)

```diff
diff --git a/paws_claws_beta040_selfcontained.html b/paws_claws_beta040_selfcontained.html
index 1b9f4c3..c23d06d 100644
--- a/paws_claws_beta040_selfcontained.html
+++ b/paws_claws_beta040_selfcontained.html
@@ -505,7 +505,7 @@ body.touch-mode #dialog{width:min(88vw,40rem);bottom:6.85rem}
 /* ===== Beta 0.30 AAA UI + combat feel pass ===== */
 :root{--ornate-edge:rgba(214,182,112,.32);--ornate-glow:rgba(214,182,112,.11);--ornate-shadow:rgba(0,0,0,.32)}
 #playerHud,.uiPanel,.window,#message,#hotbar,#miniWrap{box-shadow:0 1rem 2.1rem var(--ornate-shadow), inset 0 1px 0 rgba(255,255,255,.045)}
-.uiPanel,.window,#message{position:relative}
+.uiPanel,.window{position:relative}
 .uiPanel::before,.window::before,#message::before{content:"";position:absolute;inset:.34rem;border-radius:inherit;pointer-events:none;border:1px solid rgba(255,255,255,.03)}
 .uiPanel::after,.window::after,#message::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(214,182,112,.06)}
 .playerCard{background:linear-gradient(180deg,rgba(12,21,31,.96),rgba(8,14,22,.98));border-color:rgba(104,132,158,.42)}
@@ -1199,6 +1199,7 @@ body.touch-mode #miniWrap{
 #toastName{font-family:var(--font-display);color:#f0ddb2}
 #toast .small{font-size:.62rem!important;color:#b7c4cf!important}
 
+.questToastText{position:absolute;left:50%;top:calc(100% + .2rem);transform:translateX(-50%);white-space:nowrap;padding:.15rem .6rem;border-radius:.5rem;background:rgba(8,13,20,.85);border:1px solid rgba(214,182,112,.35);color:#f3e2bd;font-size:.68rem;font-weight:800;text-shadow:0 1px 2px #000}
 .questToast{
   position:absolute;z-index:25;left:50%;top:4.1rem;transform:translateX(-50%);width:18rem;height:3.2rem;display:none;
   align-items:center;justify-content:center;text-align:center;padding:.25rem 2.2rem .2rem 3rem;color:#f3e2bd;font-size:.72rem;font-weight:800;
@@ -1526,7 +1527,7 @@ body.touch-mode .hudPremiumBuff {
 }
 #miniWrap{
   right:max(1rem, calc(50vw - min(94vw,3000px)/2 + 1rem))!important;
-  top:7.2rem!important;
+  top:calc(var(--mini-top, 7.2rem) + .6rem)!important;
   width:12.4rem!important;
   height:8.1rem!important;
   padding:.28rem!important;
@@ -1765,6 +1766,15 @@ const GAME_SUBTITLE = 'Desktop Polish + Premium HUD';
 document.title = `Paws & Claws Beta ${GAME_VERSION} — ${GAME_SUBTITLE}`;
 document.querySelector('.startTitle').textContent = `Paws & Claws · Beta ${GAME_VERSION}`;
 
+// El minimapa se apila debajo del Diario, sea cual sea su altura (evita superposición).
+(() => {
+  const tracker = document.getElementById('questTracker');
+  if (!tracker || !window.ResizeObserver) return;
+  const sync = () => tracker.parentElement.style.setProperty('--mini-top', (tracker.offsetTop + tracker.offsetHeight) + 'px');
+  new ResizeObserver(sync).observe(tracker);
+  sync();
+})();
+
 // ============================================================
 // PAWS & CLAWS — BETA 0.35 REAL UI ASSET INTEGRATION
 // World / viewport / renderer overhaul
@@ -2301,7 +2311,7 @@ function seedDynamicWorld(){
 // ---------------------------
 // Quests / economy / interaction
 // ---------------------------
-function showQuestToast(text){if(!UI.questToast)return;UI.questToast.textContent=text;UI.questToast.style.display='flex';questToastTimer=2.5;}
+function showQuestToast(text){if(!UI.questToast)return;UI.questToast.innerHTML='<span class="questToastText"></span>';UI.questToast.firstChild.textContent=text;UI.questToast.style.display='flex';questToastTimer=2.5;}
 function acceptQuest(id){const q=quests[id];if(!q.active&&!q.claimed){q.active=true;selectedQuestId=id;setMessage('Nueva misión: '+q.title);showQuestToast(q.title);}renderQuestLog();}
 function checkQuests(){
   if(quests.cats.active&&!quests.cats.done&&kills>=quests.cats.target){quests.cats.done=true;setMessage('✅ Misión lista: '+quests.cats.title);}
@@ -2838,10 +2848,7 @@ function drawVillageCobble(tx,ty,s,screenH){
   if(total<=0||isWaterTile(tx,ty))return;
   if(!isPathTile(tx,ty)&&total<.24)return;
   ctx.save();
-  const fillA=isPathTile(tx,ty)?.21:.11;
-  const plazaBoost=plaza.strength*.18+(plaza.core?.10:0);
-  ctx.fillStyle=`rgba(${118+Math.floor(plaza.strength*12)},${114+Math.floor(plaza.strength*12)},${110+Math.floor(plaza.strength*14)},${fillA+.16*total+plazaBoost})`;
-  ctx.fillRect(s.x+1,Math.round(s.y+screenH*.30),TILE_SIZE-2,Math.round(screenH*.46));
+  // Sin franja base por tile: al repetirse en cada fila dibujaba bandas horizontales sobre el camino.
   const count=(isPathTile(tx,ty)?4:3)+(plaza.strength>.25?1:0);
   for(let i=0;i<count;i++){
     const rw=5+Math.floor(tileHash(tx,ty,73+i*11)*6),rh=2+Math.floor(tileHash(tx,ty,74+i*11)*3);
@@ -2930,8 +2937,8 @@ function drawWorldNpc(n){
   }
   if(!h){drawAssetBottom(n.asset,n.x,n.y,w);const im=drawAssets[n.asset];h=im?assetSize(n.asset,w).h:72;}
   drawOutlinedText(n.name,s.x,s.y-h-8,'#fff',12);
-  if(n.role){ctx.fillStyle='rgba(8,12,16,.76)';ctx.fillRect(Math.round(s.x-28),Math.round(s.y-h-24),56,12);drawOutlinedText(n.role,s.x,s.y-h-14,n.roleColor||'#ddd',8)}
-  if(players[0]&&dist(players[0],n)<112&&!overlay){ctx.fillStyle='rgba(8,12,16,.82)';ctx.fillRect(Math.round(s.x-54),Math.round(s.y-h-40),108,20);drawOutlinedText(worldNpcHintLabel(n),s.x,s.y-h-25,'#fff',9)}
+  if(n.role){ctx.fillStyle='rgba(8,12,16,.76)';ctx.fillRect(Math.round(s.x-28),Math.round(s.y-h-38),56,12);drawOutlinedText(n.role,s.x,s.y-h-28,n.roleColor||'#ddd',8)}
+  if(players[0]&&dist(players[0],n)<112&&!overlay){ctx.fillStyle='rgba(8,12,16,.82)';ctx.fillRect(Math.round(s.x-54),Math.round(s.y-h-64),108,20);drawOutlinedText(worldNpcHintLabel(n),s.x,s.y-h-49,'#fff',9)}
 }
 function drawChest(ch){
   const key=ch.asset,s=worldToScreen(ch.x,ch.y),sheet=drawAssets[key+'_sheet'],baseW=TILE_SIZE*1.46,pulse=(Math.sin(worldClock*2.6+ch.x*.0013)+1)/2;
@@ -3098,9 +3105,10 @@ function renderHud(){
     </div></div>`;
   }).join('');
   const active=Object.values(quests).filter(q=>q.active&&!q.claimed),buffActive=players.some(p=>p.buffs&&p.buffs.inn>0),day=dayCycleState();
-  UI.tracker.innerHTML=`<div class="trackerTitle">Diario</div>${active.length?active.map(q=>`<div class="trackerLine"><span>${q.title}</span><span>${q.done?'Lista':'Activa'}</span></div>`).join(''):`<div class="trackerEmpty">Hablá con los NPCs para aceptar trabajos.</div>`}<div class="trackerMeta"><div>${day.name} · Oro ${gold}</div><div>Pociones ${consumables.potion} · Metal ${materials.metal} · Hierba ${materials.herb}</div>${buffActive?`<div>Beneficio de posada activo</div>`:''}</div>`;
+  UI.tracker.innerHTML=`<div class="trackerTitle">Diario</div>${active.length?active.map(q=>`<div class="trackerLine"><span>${q.title}</span><span>${questProgressLabel(q)}</span></div>`).join(''):`<div class="trackerEmpty">Hablá con los NPCs para aceptar trabajos.</div>`}<div class="trackerMeta"><div>${day.name} · Oro ${gold}</div><div>Pociones ${consumables.potion} · Metal ${materials.metal} · Hierba ${materials.herb}</div>${buffActive?`<div>Beneficio de posada activo</div>`:''}</div>`;
   renderMinimap();
 }
+function questProgressLabel(q){if(q.done)return 'Lista';if(q.id==='cats')return `${Math.min(kills,q.target)}/${q.target}`;if(q.target)return `${q.count||0}/${q.target}`;return 'Activa';}
 function renderMinimap(){
   const rect=minimap.getBoundingClientRect(),w=rect.width,h=rect.height;if(w<2||h<2)return;
   mctx.clearRect(0,0,w,h);mctx.fillStyle='#0b1118';mctx.fillRect(0,0,w,h);mctx.strokeStyle='#42546a';mctx.strokeRect(.5,.5,w-1,h-1);
@@ -3150,7 +3158,7 @@ function renderItemDetail(p,it){
 }
 function renderInventory(){
   const p=players.find(p=>p.id===activeInventoryPlayer)||players[0];document.getElementById('invSub').textContent=`${p.name} · ${p.role} · juego pausado`;document.getElementById('coinLabel').textContent='Oro '+gold; const tab1=document.getElementById('tabP1'),tab2=document.getElementById('tabP2'); if(tab1)tab1.classList.toggle('active',activeInventoryPlayer===1); if(tab2)tab2.classList.toggle('active',activeInventoryPlayer===2);
-  pctx.clearRect(0,0,paperCanvas.width,paperCanvas.height);pctx.imageSmoothingEnabled=false;const im=drawAssets[p.sheet];if(im){const f=frameXY(0);pctx.drawImage(im,f.sx,f.sy,SHEET_CELL,SHEET_CELL,112,148,168,168)}pctx.fillStyle='#fff';pctx.textAlign='center';pctx.font='bold 19px monospace';pctx.fillText(p.name,195,378);pctx.font='12px monospace';pctx.fillStyle='#aab5bf';pctx.fillText(`ATQ ${p.attack} · DEF ${p.def} · HP ${p.maxHp} · MP ${p.maxMp}`,195,401);
+  pctx.clearRect(0,0,paperCanvas.width,paperCanvas.height);pctx.imageSmoothingEnabled=false;const im=drawAssets[p.sheet];if(im){const f=frameXY(0);pctx.drawImage(im,f.sx,f.sy,SHEET_CELL,SHEET_CELL,112,148,168,168)}pctx.fillStyle='#fff';pctx.textAlign='center';pctx.font='bold 19px monospace';pctx.fillText(p.name,195,360);pctx.font='11px monospace';pctx.fillStyle='#aab5bf';pctx.fillText(`ATQ ${p.attack} · DEF ${p.def}`,195,382);pctx.fillText(`HP ${p.maxHp} · MP ${p.maxMp}`,195,398);
   const ids={head:'slotHead',weapon:'slotWeapon',armor:'slotArmor',charm:'slotCharm',boots:'slotBoots',artifact:'slotArtifact'};Object.keys(ids).forEach(k=>{const el=document.getElementById(ids[k]),it=p.equip[k];el.style.borderColor=it?it.color:'#405166';el.innerHTML=`<div class="label">${SLOT_LABEL[k]}</div>${it?`<div class="slotEquip"><span class="slotIconFrame ${uiRarityClass(it)}"><img src="${ASSET_PATHS[it.asset]}"></span><div class="slotMeta"><div class="slotName" style="color:${it.color}">${it.name}</div><div class="slotPower">Poder +${it.power}</div></div></div>`:`<div class="slotEmpty">Vacío</div>`}`});
   const bag=document.getElementById('bag');bag.innerHTML=p.inventory.length?p.inventory.map(it=>{const equipped=p.equip[it.slot]===it;return `<button class="item${equipped?' equippedItem':''}" data-equip="${it.id}" data-rarity="${it.rarity}"><span class="itemIconFrame ${uiRarityClass(it)}"><img src="${ASSET_PATHS[it.asset]}"></span><div><div class="tier" style="color:${it.color}">${it.rarity}${equipped?' · EQUIPADO':''}</div><div class="iname">${it.name}</div><div class="imeta">${SLOT_LABEL[it.slot]} · Poder +${it.power}</div></div></button>`}).join(''):`<div class="muted">Mochila vacía.</div>`;
   const selected=p.inventory.find(i=>i.id===selectedItemId)||p.inventory[0]||Object.values(p.equip).find(Boolean)||null;renderItemDetail(p,selected);
```
