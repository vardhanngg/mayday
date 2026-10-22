import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const portalDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(portalDir, '..');
const publicDir = path.join(repoRoot, 'public');
const outDir = path.join(portalDir, 'dist');
const pokiSdkUrl = 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function replaceOnce(text, search, replacement, label) {
  const at = text.indexOf(search);
  assert(at >= 0, 'Portal build could not find ' + label);
  assert(text.indexOf(search, at + search.length) < 0, 'Portal build found multiple occurrences of ' + label);
  return text.slice(0, at) + replacement + text.slice(at + search.length);
}

let html = await fs.readFile(path.join(publicDir, 'index.html'), 'utf8');
let client = await fs.readFile(path.join(publicDir, 'client.js'), 'utf8');
const threePath = path.join(portalDir, 'node_modules', 'three', 'build', 'three.min.js');
await fs.access(threePath);

client = client.replace(/const MAYDAY_BUILD='[^']+';/, "const MAYDAY_BUILD='v75.0-portal-all-modes';\nconst PORTAL_STANDALONE=true;");
assert(client.includes('const PORTAL_STANDALONE=true;'), 'Could not set the Portal Edition build marker.');

// The portal build is single-player only. Guard backend entry points, remove startup social
// connections, and remove the version endpoint request so no game-server request is sent.
client = replaceOnce(client, 'function connect(first){', 'function connect(first){if(PORTAL_STANDALONE){console.warn("Online rooms are disabled in Portal Edition.");return false;}', 'multiplayer socket entry point');
client = replaceOnce(client, 'function connectSocial(){', 'function connectSocial(){if(PORTAL_STANDALONE)return;', 'social socket entry point');
const versionRequest = /fetch\('\/api\/version'.*?\n(?=document\.getElementById\('acceptSocialInvite'\))/s;
assert(versionRequest.test(client), 'Could not find the server-version request to remove.');
client = client.replace(versionRequest, "const portalBuildBadge=document.getElementById('buildVersionBadge');if(portalBuildBadge)portalBuildBadge.textContent='MAYDAY · PORTAL EDITION';\n");
client = replaceOnce(client, 'setMusic(true);connectSocial();\nsetInterval(', 'setMusic(true);\nsetInterval(', 'automatic social connection at startup');
client = client.replace(/const MAYDAY_BUILD='v74\.0-portal-edition';/, "const MAYDAY_BUILD='v75.0-portal-all-modes';");
client = client.replaceAll("'/audio/", "'./audio/").replaceAll('"/audio/', '"./audio/');

// Wire the portal modes to local AI instead of network rooms.
client = replaceOnce(client, "shieldMesh.visible=roomMode==='clash'&&alive&&shieldUntil>performance.now();", "shieldMesh.visible=(roomMode==='clash'||(PORTAL_STANDALONE&&portalGameMode==='clash'))&&alive&&shieldUntil>performance.now();", 'portal shield visual');
client = replaceOnce(client, "if(e.code==='KeyQ'&&roomMode==='clash'&&alive&&shields>0&&performance.now()>shieldUntil&&ws&&ws.readyState===1){ws.send(JSON.stringify({t:'shield'}));e.preventDefault()}", "if(e.code==='KeyQ'&&PORTAL_STANDALONE&&portalGameMode==='clash'&&inGame){portalActivateShield();e.preventDefault()}if(e.code==='KeyQ'&&roomMode==='clash'&&alive&&shields>0&&performance.now()>shieldUntil&&ws&&ws.readyState===1){ws.send(JSON.stringify({t:'shield'}));e.preventDefault()}", 'portal Q shield');
client = replaceOnce(client, "function mobileActivateShield(){if(roomMode==='clash'&&alive&&shields>0&&performance.now()>shieldUntil&&ws&&ws.readyState===1)ws.send(JSON.stringify({t:'shield'}));else if(roomMode!=='clash')toast('Shield is only available in Clash Squad')}", "function mobileActivateShield(){if(PORTAL_STANDALONE&&portalGameMode==='clash'){portalActivateShield();return}if(roomMode==='clash'&&alive&&shields>0&&performance.now()>shieldUntil&&ws&&ws.readyState===1)ws.send(JSON.stringify({t:'shield'}));else if(roomMode!=='clash')toast('Shield is only available in Clash Squad')}", 'portal mobile shield');
const modePickerHandler = /document\.querySelectorAll\('\.modeCard'\)\.forEach\(card=>card\.onclick=\(\)=>\{[\s\S]*?\}\);\ndocument\.getElementById\('backToModes'\)\.onclick=/;
assert(modePickerHandler.test(client), 'Could not find mode-card selection handler.');
client = client.replace(modePickerHandler, "document.querySelectorAll('.modeCard').forEach(card=>card.onclick=()=>{selectedMode=card.dataset.mode;document.querySelectorAll('.modeCard').forEach(c=>c.classList.toggle('selected',c===card));const base=MODE_META[selectedMode]||MODE_META.practice;const info={name:base.name,help:portalModeHelp(selectedMode)};document.querySelector('.modeGrid').style.display='none';document.getElementById('selectedModePanel').style.display='block';document.getElementById('selectedModeTitle').textContent=info.name;document.getElementById('selectedModeMeta').textContent=info.help;document.getElementById('practiceSettings').style.display=selectedMode==='challenge'?'none':'block';document.getElementById('actionRow').style.display='flex';document.getElementById('hostMode').style.display='none';document.getElementById('joinMode').style.display='none';document.getElementById('practiceMode').style.display=selectedMode==='challenge'?'none':'inline-block';document.getElementById('practiceMode').textContent=({ffa:'START DOGFIGHT',clash:'START CLASH SQUAD',survivor:'START SURVIVOR',practice:'ENTER PRACTICE'})[selectedMode]||'START MODE';document.getElementById('challengeMode').style.display=selectedMode==='challenge'?'inline-block':'none';document.getElementById('backToModes').style.display='inline-block';document.getElementById('joinBox').style.display='none';errEl.textContent='';document.getElementById('modeHelp').textContent=info.help});\ndocument.getElementById('backToModes').onclick=");
client = replaceOnce(client, "document.getElementById('practiceMode').onclick=()=>{if(selectedMode==='practice')startPractice()};", "document.getElementById('practiceMode').onclick=()=>{if(['ffa','clash','survivor','practice'].includes(selectedMode))startPortalMode(selectedMode)};", 'solo mode start action');
client = replaceOnce(client, "document.getElementById('challengeMode').onclick=()=>{if(selectedMode==='challenge')startFlightChallenge()};", "document.getElementById('challengeMode').onclick=()=>{if(selectedMode==='challenge')startPortalMode('challenge')};", 'challenge mode start action');
const playerHitPattern = /function practicePlayerHit\(amount,source\)\{[\s\S]*?\n\}/;
assert(playerHitPattern.test(client), 'Could not locate the player damage handler.');
client = client.replace(playerHitPattern, "function practicePlayerHit(amount,source){if(!practiceMode||!alive||performance.now()<spawnGrace)return;if(PORTAL_STANDALONE&&portalGameMode==='clash'&&performance.now()<portalShieldUntil){toast('SQUAD SHIELD BLOCKED THE HIT');return}hp=Math.max(0,hp-amount);vibrateOnHit(amount);shake=Math.max(shake,.12+(amount>20?.22:0));const sourceLabel=i18nBotName(source);if(hp>0){toast('HIT BY '+sourceLabel+' • '+Math.round(hp)+' HP');return}const cp=plane.position.clone();const gy=Math.max(height(cp.x,cp.z),0);cp.y=Math.max(cp.y,gy+3);explode(cp,true);createCrashFire(cp,2800);alive=false;plane.visible=false;if(PORTAL_STANDALONE){portalHandlePlayerDown(sourceLabel+' shot you down');return}practiceRespawnAt=performance.now()+2200;toast(sourceLabel+' SHOT YOU DOWN • RESPAWNING')");
const botHitPattern = /function practiceBotHit\(id,amount\)\{[\s\S]*?\n\}/;
assert(botHitPattern.test(client), 'Could not locate the bot damage handler.');
client = client.replace(botHitPattern, "function practiceBotHit(id,amount){if(!practiceMode)return;const r=remotes[id];if(!r||!r.practice||!r.alive)return;r.hp-=amount;snapPlayers[id].hp=Math.max(0,r.hp);if(r.hp<=0){r.hp=0;r.alive=false;r.respawnAt=(PORTAL_STANDALONE&&portalGameMode==='clash')?Number.POSITIVE_INFINITY:performance.now()+1800;r.sc=(r.sc||0)+1;snapPlayers[id].alive=false;snapPlayers[id].hp=0;snapPlayers[id].sc=r.sc;practiceKills++;const cp=r.mesh.position.clone();explode(cp,true);createCrashFire(cp,2800);r.mesh.visible=false;showKillConfirm('DRONE '+id.split('-')[1]);toast('TARGET DRONE '+id.split('-')[1]+' DESTROYED • '+practiceKills+' kills');if(PORTAL_STANDALONE)portalOnBotKilled()}else if(r.hp<70){toast('DRONE '+id.split('-')[1]+' HIT • '+Math.round(r.hp)+' HP')}}");
client = replaceOnce(client, "if(challengeMode)restartFlightChallengeRun();practiceRespawnAt=performance.now()+(challengeMode?2800:1800);toast(challengeMode?'💥 CRASH! ENTIRE CHALLENGE RESET':'💥 Training crash — respawning')", "if(challengeMode)restartFlightChallengeRun();if(PORTAL_STANDALONE&&!challengeMode&&portalGameMode==='clash'){portalResolveClashRound(false)}else if(PORTAL_STANDALONE&&!challengeMode&&portalGameMode==='survivor'){portalHandlePlayerDown('crash')}else{practiceRespawnAt=performance.now()+(challengeMode?2800:1800);toast(challengeMode?'💥 CRASH! ENTIRE CHALLENGE RESET':'💥 Training crash — respawning')}", 'portal mode crash handling');
client = replaceOnce(client, "ren.render(scene,cam)}", "if(PORTAL_STANDALONE)portalUpdateModeHud();ren.render(scene,cam)}", 'portal mode objective HUD');

// Size all game calculations to the centered game stage instead of the browser window.
const viewportHelper = [
"function portalViewportSize(){const b=document.body;return{width:Math.max(1,Math.round(b.clientWidth||640)),height:Math.max(1,Math.round(b.clientHeight||360))}}"
].join('\n');
client = client.replace("const PORTAL_STANDALONE=true;", "const PORTAL_STANDALONE=true;\n" + viewportHelper);
client = client.replaceAll('innerWidth', 'portalViewportSize().width').replaceAll('innerHeight', 'portalViewportSize().height');

// Poki SDK lifecycle and ad-break adapter. Breaks pause the render/update loop while the
// SDK is showing an ad, then resume the run. If the SDK is unavailable in local testing,
// the game continues without blocking play.
const sdkHelpers = [
"let portalSdkReady=false,portalGameplayActive=false,portalWaitingForStart=false,portalBreakActive=false;",
"async function portalInitializeSdk(){try{if(!window.PokiSDK)return;await window.PokiSDK.init();portalSdkReady=true;window.PokiSDK.gameLoadingFinished();if(portalWaitingForStart)portalSdkStart()}catch(e){console.warn('Poki SDK unavailable; continuing without ads.',e)}}",
"portalInitializeSdk();",
"function portalSdkStart(){if(window.__portalGameFrozen)return;if(!portalSdkReady){portalWaitingForStart=true;return}portalWaitingForStart=false;if(!portalGameplayActive){portalGameplayActive=true;try{window.PokiSDK.gameplayStart()}catch(e){portalGameplayActive=false}}}",
"function portalSdkStop(){if(portalGameplayActive){portalGameplayActive=false;try{window.PokiSDK.gameplayStop()}catch(e){}}}",
"function portalSdkCommercialBreak(onResume){if(portalBreakActive)return;const resume=typeof onResume==='function'?onResume:portalSdkStart;if(!portalSdkReady||!window.PokiSDK){window.__portalGameFrozen=false;resume();return}portalBreakActive=true;window.__portalGameFrozen=true;portalSdkStop();Promise.resolve().then(()=>window.PokiSDK.commercialBreak(()=>{try{if(typeof engineGain!=='undefined'&&engineGain&&typeof AC!=='undefined'&&AC)engineGain.gain.setValueAtTime(0,AC.currentTime);if(typeof missileFlySound==='function')missileFlySound(false)}catch(e){}})).catch(()=>{}).finally(()=>{window.__portalGameFrozen=false;portalBreakActive=false;resume()})}",
"function portalShowMissionComplete(title,body){window.__portalGameFrozen=true;portalSdkStop();const panel=document.getElementById('portalResult');const h=panel&&panel.querySelector('h1');const p=panel&&panel.querySelector('p');const replay=document.getElementById('portalReplay');if(h)h.textContent=title||'MISSION COMPLETE';if(p)p.textContent=body||'You cleared all five flight-challenge levels. Ready to test your skills again?';if(replay)replay.textContent=portalGameMode==='challenge'?'FLY AGAIN':'PLAY AGAIN';if(panel)panel.style.display='flex'}"
].join('\n');

const portalModeFunctions = String.raw`let portalGameMode='challenge',portalGameStartedAt=0,portalLives=5,portalClashRound=1,portalClashWins=0,portalClashRoundResolving=false,portalShieldCharges=3,portalShieldUntil=0;
function portalModeHelp(mode){return ({ffa:'Solo Dogfight against six AI pilots. Reach 10 drone kills to win.',clash:'Three-round solo squad trial against six AI aircraft. Eliminate the whole squad each round; Q activates a 7-second shield.',survivor:'Five lives. Keep flying, defeat AI aircraft, and last as long as possible.',practice:'Free-flight training arena with AI target aircraft. No score limit.',challenge:'Five precision-flight levels. Pass arches, collect flags, and destroy targets with unguided missiles.'})[mode]||'Select a game mode.'}
function portalActivateShield(){if(!inGame||portalGameMode!=='clash')return;if(portalShieldCharges<=0||performance.now()<portalShieldUntil){toast('NO SHIELD CHARGE READY');return}portalShieldCharges--;portalShieldUntil=performance.now()+7000;shields=portalShieldCharges;shieldUntil=portalShieldUntil;toast('SQUAD SHIELD ACTIVE • 7 SECONDS')}
function portalUpdateModeHud(){const el=document.getElementById('portalModeHud');if(!el)return;if(!inGame||!PORTAL_STANDALONE||portalGameMode==='challenge'||window.__portalGameFrozen){el.style.display='none';return}const elapsed=Math.max(0,Math.floor((performance.now()-portalGameStartedAt)/1000));const clock=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0');const enemies=typeof PRACTICE_BOT_DEFS!=='undefined'?PRACTICE_BOT_DEFS.filter(function(d){return remotes[d.id]&&remotes[d.id].alive}).length:0;let label='';if(portalGameMode==='ffa')label='DOGFIGHT  •  '+practiceKills+'/10 KILLS';else if(portalGameMode==='clash')label='CLASH SQUAD  •  ROUND '+portalClashRound+'/3  •  ROUNDS WON '+portalClashWins+'  •  ENEMIES '+enemies+'/6  •  Q SHIELDS '+portalShieldCharges;else if(portalGameMode==='survivor')label='SURVIVOR  •  LIVES '+portalLives+'/5  •  KILLS '+practiceKills+'  •  '+clock;else label='PRACTICE  •  DRONE KILLS '+practiceKills+'  •  ESC TO EXIT';el.textContent=label;el.style.display='block'}
function portalOnBotKilled(){if(portalGameMode==='ffa'&&practiceKills>=10){portalShowMissionComplete('DOGFIGHT VICTORY','You reached 10 drone kills. Fly again to start a new dogfight.');return}if(portalGameMode==='clash'&&typeof PRACTICE_BOT_DEFS!=='undefined'&&PRACTICE_BOT_DEFS.every(function(d){return !remotes[d.id]||remotes[d.id].alive===false}))portalResolveClashRound(true)}
function portalResolveClashRound(won){if(portalGameMode!=='clash'||portalClashRoundResolving||window.__portalGameFrozen)return;portalClashRoundResolving=true;if(won)portalClashWins++;if(portalClashRound>=3){portalClashRoundResolving=false;portalShowMissionComplete(portalClashWins>=2?'CLASH SQUAD VICTORY':'CLASH SQUAD DEFEAT','You won '+portalClashWins+' of 3 rounds. Play again for another best-of-three battle.');return}setTimeout(function(){portalSdkCommercialBreak(function(){portalClashRound++;portalClashRoundResolving=false;clearWorld();if(plane){scene.remove(plane);plane=null}practiceRespawnAt=0;roomMode='practice';practiceMode=true;challengeMode=false;inGame=true;over=false;alive=true;spectatorMode=false;ws=null;roomCode='';myId='portal-player';myTeam='portal-player';snapPlayers={};maxhp=(PT[ptype]||PT.balanced).hp;hp=maxhp;plane=makePlane(myColor,ptype);plane.userData.team=myTeam;plane.userData.col=myColor;ensureShield();shields=3;shieldUntil=0;portalShieldCharges=3;portalShieldUntil=0;reset();makePracticeArena();document.getElementById('lobby').style.display='none';showGameplayUi();document.getElementById('radar').style.display='block';winEl.style.display='none';bannerEl.textContent='';shieldHud.style.display='none';spectatorHud.style.display='none';setMusic(false);portalSdkStart();toast('CLASH SQUAD • ROUND '+portalClashRound+' OF 3 • ELIMINATE ALL SIX DRONES')})},0)}
function portalHandlePlayerDown(reason){if(portalGameMode==='clash'){portalResolveClashRound(false);return}if(portalGameMode==='survivor'){portalLives=Math.max(0,portalLives-1);if(portalLives<=0){portalShowMissionComplete('SURVIVAL OVER','You used all five lives and scored '+practiceKills+' drone kills. Try again to beat your score.');return}practiceRespawnAt=performance.now()+2200;toast('AIRCRAFT LOST • '+portalLives+' LIVES REMAINING');return}practiceRespawnAt=performance.now()+2200;toast((reason||'AIRCRAFT LOST').toUpperCase()+' • RESPAWNING')}
function startPortalMode(mode){if(['ffa','clash','survivor','practice','challenge'].indexOf(mode)<0)mode='practice';portalGameMode=mode;portalGameStartedAt=performance.now();portalLives=5;portalClashRound=1;portalClashWins=0;portalClashRoundResolving=false;portalShieldCharges=3;portalShieldUntil=0;if(mode==='challenge'){startFlightChallenge();return}startPortalCombat(mode)}
function startPortalCombat(mode){clearKillReplay();initAudio();saveSet();try{setFriendsSidebarOpen(false)}catch(e){}challengeMode=false;roomMode='practice';practiceDifficulty=document.getElementById('practiceDifficulty').value||'normal';practiceMode=true;inGame=true;over=false;alive=true;spectatorMode=false;isHost=false;roomInfo=null;roomCode='';ws=null;myId='portal-player';myTeam='portal-player';practiceKills=0;snapPlayers={};clearWorld();if(plane){scene.remove(plane);plane=null}practiceRespawnAt=0;myColor=COLOR_BY_ID[selectedColorId]?.color||'#ffffff';maxhp=(PT[ptype]||PT.balanced).hp;hp=maxhp;plane=makePlane(myColor,ptype);plane.userData.team=myTeam;plane.userData.col=myColor;ensureShield();shields=mode==='clash'?3:0;shieldUntil=0;portalShieldCharges=3;portalShieldUntil=0;RANGE=4000;reset();makePracticeArena();document.getElementById('lobby').style.display='none';showGameplayUi();document.getElementById('radar').style.display='block';winEl.style.display='none';bannerEl.textContent='';shieldHud.style.display='none';spectatorHud.style.display='none';setMusic(false);portalSdkStart();toast(({ffa:'DOGFIGHT • FIRST TO 10 DRONE KILLS',clash:'CLASH SQUAD • ROUND 1 OF 3 • ELIMINATE ALL SIX DRONES',survivor:'SURVIVOR • FIVE LIVES • OUTLAST THE AI PILOTS',practice:'PRACTICE ARENA • FLY FREELY AND TRAIN AGAINST AI'})[mode]||'MAYDAY PORTAL EDITION')}`;

client = replaceOnce(client, "const MAYDAY_BUILD='v75.0-portal-all-modes';\nconst PORTAL_STANDALONE=true;\n" + viewportHelper,
  "const MAYDAY_BUILD='v75.0-portal-all-modes';\nconst PORTAL_STANDALONE=true;\n" + viewportHelper + "\n" + sdkHelpers + "\n" + portalModeFunctions,
  'portal SDK helper insertion point');

// Pause the simulation while a Poki commercial break is active.
client = replaceOnce(client, 'function loop(){requestAnimationFrame(loop);', 'function loop(){requestAnimationFrame(loop);if(window.__portalGameFrozen)return;', 'animation-loop pause point');

// Start/stop SDK gameplay tracking from the standalone challenge lifecycle.
client = replaceOnce(client, "toast('FLIGHT CHALLENGE • PASS 7 ARCHES · COLLECT 7 FLAGS · DESTROY 3 TARGETS WITH UNGUIDED F MISSILES');",
  "toast('FLIGHT CHALLENGE • PASS 7 ARCHES · COLLECT 7 FLAGS · DESTROY 5 TARGETS');portalSdkStart();",
  'Flight Challenge start event');
client = replaceOnce(client, "function goMainMenu(){",
  "function goMainMenu(){window.__portalGameFrozen=false;portalSdkStop();const portalResult=document.getElementById('portalResult');if(portalResult)portalResult.style.display='none';",
  'main-menu SDK stop event');
client = replaceOnce(client, "function restartFlightChallengeRun(){",
  "function restartFlightChallengeRun(){portalSdkCommercialBreak();",
  'crash/restart ad break');
client = replaceOnce(client,
  "flightChallenge.currentLevel++;syncFlightChallengeLevel();const next=FLIGHT_CHALLENGE_LEVELS[flightChallenge.currentLevel];toast('LEVEL '+(flightChallenge.currentLevel+1)+' UNLOCKED • '+next.name)",
  "flightChallenge.currentLevel++;syncFlightChallengeLevel();portalSdkCommercialBreak();const next=FLIGHT_CHALLENGE_LEVELS[flightChallenge.currentLevel];toast('LEVEL '+(flightChallenge.currentLevel+1)+' UNLOCKED • '+next.name)",
  'between-level ad break');
client = replaceOnce(client,
  "else{flightChallenge.finished=true;toast('FLIGHT CHALLENGE COMPLETE • ALL FIVE LEVELS CLEARED!')}",
  "else{flightChallenge.finished=true;portalShowMissionComplete();toast('FLIGHT CHALLENGE COMPLETE • ALL FIVE LEVELS CLEARED!')}",
  'mission completion event');

// Portal-specific UI: only show the standalone mode and provide a clear completion/replay flow.
const portalCss = [
"#portalModeHud{display:none;position:absolute;z-index:35;top:10px;left:50%;transform:translateX(-50%);max-width:94%;padding:9px 13px;border:1px solid rgba(125,224,255,.35);border-radius:10px;background:rgba(3,12,24,.84);color:#eaf7ff;font:900 clamp(10px,1.1vw,13px)/1.35 system-ui,sans-serif;letter-spacing:.045em;text-align:center;box-shadow:0 5px 20px rgba(0,0,0,.3);pointer-events:none;white-space:normal}",
"html,body{margin:0;width:100%;height:100%;overflow:hidden!important;background:#030812;overscroll-behavior:none}",
"body{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(100vw,177.7778vh);height:min(100vh,56.25vw);overflow:hidden;background:#030812}",
"body>canvas:not(#radar){position:absolute!important;inset:0;width:100%!important;height:100%!important;z-index:0;pointer-events:none}",
"#lobby{position:absolute!important;inset:0!important;width:100%;height:100%;box-sizing:border-box;overflow:hidden!important;padding:clamp(8px,2.3vh,24px);justify-content:center;align-items:center}",
"#lobby>h1{font-size:clamp(1.6rem,5vh,3.5rem);margin:0 0 8px}",
"#buildVersionBadge,#openSettings,#friendsToggle,#friendsSidebar,#openGamesPanel,#recoveryPanel{display:none!important}",
"#menu{width:min(94%,900px);max-width:900px;max-height:94%;overflow:hidden;margin:auto}",
"#menu>div:first-child,#menu>div:nth-child(2),#menu>label,#menu>p,#modeHelp,#err{display:none!important}",
"#modePicker>div:first-child{font-size:clamp(1rem,2.5vh,1.3rem);text-align:center;margin-bottom:14px}",
".modeGrid{grid-template-columns:repeat(3,minmax(0,1fr))!important;justify-content:center;gap:10px;margin:0}",
".modeCard{display:block!important;min-height:0;height:clamp(108px,16vh,142px);padding:12px!important}",
".modeCard .modeName{font-size:clamp(1rem,1.7vw,1.45rem)!important;line-height:1.12}",
".modeCard .modeMeta{font-size:clamp(.72rem,1.05vw,.91rem)!important;line-height:1.35}",
".modeCard .modeArt{font-size:clamp(2.8rem,5vw,4.5rem)}",
"#selectedModePanel{max-width:800px;margin:0 auto}",
"#actionRow{display:none;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:10px}",
"#hostMode,#joinMode{display:none!important}#practiceMode,#challengeMode{display:none}#backToModes{display:inline-block!important}",
"#challengeMode{display:inline-block!important;min-width:220px}",
"#portalInstructions{display:block;max-width:660px;margin:0 auto 15px;text-align:center;color:#d5e8f7;font-size:clamp(.78rem,1.45vw,1rem);line-height:1.5;opacity:.9}",
"#win.resultsScreen{overflow:hidden}",
"#hud,#score,#radar,#set,#lock,#warn,#win,#banner,#toast,#roomCodeHud,#shieldHud,#spectatorHud,#gameSettingsBtn,#exitPracticeBtn,#killReplayBtn,#hudEditBtn,#mobileControls,#mobileSettingsBtn,#settingsPanel,#confirmDialog,#landscapeGate,#hudEditor{position:absolute!important}",
"#portalResult{position:absolute;inset:0;z-index:50;display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;box-sizing:border-box;text-align:center;background:radial-gradient(circle at 50% 25%,rgba(32,80,112,.97),rgba(2,7,18,.985) 75%);color:#fff;font-family:system-ui,sans-serif}",
"#portalResult h1{font-size:clamp(2rem,6vh,4rem);margin:0;letter-spacing:.04em}",
"#portalResult p{font-size:clamp(.95rem,2vh,1.2rem);max-width:620px;line-height:1.5;color:#d4e5f2}",
"#portalResult .portalActions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}",
"#portalResult button{min-width:160px}",
"#portalHome{background:rgba(255,255,255,.12);color:#fff}",
"@media(max-width:760px){.modeGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px}.modeCard{height:clamp(100px,18vh,140px);padding:10px!important}.modeCard .modeMeta{font-size:clamp(.68rem,1.6vw,.84rem)!important}}",
"@media(orientation:portrait) and (max-width:760px){body{width:min(100vw,56.25vh);height:min(100vh,177.7778vw)}#lobby>h1{font-size:clamp(1.4rem,3.2vh,2.4rem)}.modeGrid{grid-template-columns:1fr!important;max-height:62vh;overflow:auto}.modeCard{height:auto;min-height:96px}.modeCard .modeArt{font-size:3rem}#portalResult h1{font-size:clamp(1.8rem,4vh,2.8rem)}#radar{width:clamp(90px,26vw,150px)!important;height:clamp(90px,26vw,150px)!important;right:5px!important;bottom:5px!important}}"
].join('\n');
html = html.replace('</style>', portalCss + '\n</style>');
html = html.replace(/<meta name="google-adsense-account"[^>]*>\s*/i, '');
const cdnThree = /<script\s+src=["']https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\/three\.min\.js["']\s*>\s*<\/script>/i;
assert(cdnThree.test(html), 'Could not find the external Three.js script tag.');
html = html.replace(cdnThree, '<script src="./vendor/three.min.js"></script>');
const clientScript = /<script\s+src=["']\/client\.js\?v=[^"']*["']\s*>\s*<\/script>/i;
assert(clientScript.test(html), 'Could not find the client script tag.');
html = html.replace(clientScript, '');
assert(html.includes('</head>'), 'HTML head closing tag is missing.');
html = html.replace('</head>', '<script src="' + pokiSdkUrl + '"></script></head>');
html = html.replace('<div id="modePicker">', '<div id="portalInstructions">Choose any of the five solo modes. Combat modes use local AI aircraft; online rooms and friend connections are disabled in this portal build.</div>\n<div id="modePicker">');
const resultOverlay = '<div id="portalModeHud" aria-live="polite"></div><div id="portalResult"><h1>MISSION COMPLETE</h1><p>You cleared all five flight-challenge levels. Ready to test your skills again?</p><div class="portalActions"><button id="portalReplay">FLY AGAIN</button><button id="portalHome">MAIN MENU</button></div></div>';
html = html.replace(/<\/body>\s*<\/html>/i,
  resultOverlay +
  '<script src="./client.js"></script>' +
  '<script>document.getElementById("portalReplay").addEventListener("click",function(){const mode=portalGameMode||"challenge";document.getElementById("portalResult").style.display="none";portalSdkCommercialBreak(function(){startPortalMode(mode)})});document.getElementById("portalHome").addEventListener("click",function(){goMainMenu()});</script></body></html>');
html = html.replaceAll('src="/audio/', 'src="./audio/');

// Fail the build if a portal-incompatible or backend-dependent path remains in active page setup.
assert(!html.includes('google-adsense-account'), 'AdSense metadata remains in the portal HTML.');
assert(!html.includes('cdnjs.cloudflare.com'), 'External Three.js CDN reference remains.');
assert(!html.includes('/client.js?v='), 'Website client path remains.');
assert(html.includes('src="./vendor/three.min.js"'), 'Local Three.js tag is missing.');
const externalScriptSrcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]).filter(src => /^https?:/i.test(src));
assert(externalScriptSrcs.every(src => src === pokiSdkUrl),
  'Unexpected external script detected. Only the Poki SDK may be external.');
assert(!client.includes("fetch('/api/version'"), 'API version fetch remains in the portal client.');
assert(client.includes("const PORTAL_STANDALONE=true;\nfunction portalViewportSize"), 'Portal viewport helper insertion failed.');
assert(client.includes("function connect(first){if(PORTAL_STANDALONE)"), 'Multiplayer socket guard is missing.');
assert(client.includes("function connectSocial(){if(PORTAL_STANDALONE)return;"), 'Social socket guard is missing.');
assert(client.includes("function startPortalMode(mode)"), 'All-five-mode controller is missing.');
assert(client.includes("portalResolveClashRound(true)"), 'Offline Clash Squad rounds are missing.');
assert(client.includes("portalLives+'/5'"), 'Survivor lives HUD is missing.');
assert(html.includes('data-mode="survivor"') && html.includes('data-mode="ffa"') && html.includes('data-mode="clash"') && html.includes('data-mode="practice"') && html.includes('data-mode="challenge"'), 'All five mode cards must remain in the portal HTML.');
assert(client.includes("window.__portalGameFrozen)return;"), 'Render-loop pause guard is missing.');
assert(client.includes("portalShowMissionComplete();"), 'Mission-complete flow is missing.');

await fs.rm(outDir, {recursive:true, force:true});
await fs.mkdir(path.join(outDir, 'vendor'), {recursive:true});
await fs.mkdir(path.join(outDir, 'audio'), {recursive:true});
await fs.writeFile(path.join(outDir, 'index.html'), html);
await fs.writeFile(path.join(outDir, 'client.js'), client);
await fs.copyFile(threePath, path.join(outDir, 'vendor', 'three.min.js'));
await fs.cp(path.join(publicDir, 'audio'), path.join(outDir, 'audio'), {recursive:true});

const assetNames = (await fs.readdir(path.join(outDir, 'audio'))).filter(n => /\.(wav|mp3|ogg|mp4|webm)$/i.test(n));
assert(assetNames.length > 0, 'No local audio assets were copied.');
for (const name of assetNames) assert((await fs.stat(path.join(outDir, 'audio', name))).size > 0, 'Empty asset: ' + name);
const externalScripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]).filter(src => /^https?:/i.test(src));
console.log(JSON.stringify({
  build: 'v75.0-portal-all-modes',
  output: path.relative(repoRoot, outDir),
  files: ['index.html', 'client.js', 'vendor/three.min.js', ...assetNames.map(n=>'audio/'+n)],
  localAudioFiles: assetNames.length,
  externalScripts,
  adSenseMetadata: html.includes('google-adsense-account'),
  externalThreeCdn: html.includes('cdnjs.cloudflare.com')
}, null, 2));
