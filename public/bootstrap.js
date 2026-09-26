// Bootstrap
bindTouchControls();
bindGameplayKeyboard();
bindMenuAndUi();
bindImageMenu();
bindOnlineCoopUi();
try{ loadTiledMap(EMBEDDED_VILLAGE_MAP); }catch(err){ console.error('Map bootstrap failed',err); mapModel=null; tileLayers=Object.create(null); }
resizeGame();loadAssets().then(()=>{generateNpcSpriteSheets();setMessage(`Assets listos: ${loadedAssets}/${Object.keys(ASSET_PATHS).length}.`)});

window.addEventListener('pointerdown',()=>AudioManager.unlock(),{passive:true});
window.addEventListener('keydown',()=>AudioManager.unlock(),{passive:true});

