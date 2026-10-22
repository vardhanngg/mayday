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

client = client.replace(/const MAYDAY_BUILD='[^']+';/, "const MAYDAY_BUILD='v74.0-portal-edition';\nconst PORTAL_STANDALONE=true;");
assert(client.includes('const PORTAL_STANDALONE=true;'), 'Could not set the Portal Edition build marker.');

// The portal build is single-player only. Guard backend entry points, remove startup social
// connections, and remove the version endpoint request so no game-server request is sent.
client = replaceOnce(client, 'function connect(req){', 'function connect(req){if(PORTAL_STANDALONE){console.warn("Online rooms are disabled in Portal Edition.");return false;}', 'multiplayer socket entry point');
client = replaceOnce(client, 'function connectSocial(){', 'function connectSocial(){if(PORTAL_STANDALONE)return;', 'social socket entry point');
const versionRequest = /fetch\('\/api\/version'.*?\n(?=document\.getElementById\('acceptSocialInvite'\))/s;
assert(versionRequest.test(client), 'Could not find the server-version request to remove.');
client = client.replace(versionRequest, "const portalBuildBadge=document.getElementById('buildVersionBadge');if(portalBuildBadge)portalBuildBadge.textContent='MAYDAY · FLIGHT CHALLENGE';\n");
client = replaceOnce(client, 'setMusic(true);connectSocial();setInterval(', 'setMusic(true);setInterval(', 'automatic social connection at startup');
client = client.replace(/const MAYDAY_BUILD='v74\.0-portal-edition';/, "const MAYDAY_BUILD='v74.0-portal-edition';");
client = client.replaceAll("'/audio/", "'./audio/").replaceAll('"/audio/', '"./audio/');

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
"function portalShowMissionComplete(){window.__portalGameFrozen=true;portalSdkStop();const panel=document.getElementById('portalResult');if(panel)panel.style.display='flex'}"
].join('\n');
client = replaceOnce(client, "const MAYDAY_BUILD='v74.0-portal-edition';\nconst PORTAL_STANDALONE=true;\n" + viewportHelper,
  "const MAYDAY_BUILD='v74.0-portal-edition';\nconst PORTAL_STANDALONE=true;\n" + viewportHelper + "\n" + sdkHelpers,
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
"html,body{margin:0;width:100%;height:100%;overflow:hidden!important;background:#030812;overscroll-behavior:none}",
"body{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(100vw,177.7778vh);height:min(100vh,56.25vw);overflow:hidden;background:#030812}",
"body>canvas:not(#radar){position:absolute!important;inset:0;width:100%!important;height:100%!important;z-index:0;pointer-events:none}",
"#lobby{position:absolute!important;inset:0!important;width:100%;height:100%;box-sizing:border-box;overflow:hidden!important;padding:clamp(8px,2.3vh,24px);justify-content:center;align-items:center}",
"#lobby>h1{font-size:clamp(1.6rem,5vh,3.5rem);margin:0 0 8px}",
"#buildVersionBadge,#openSettings,#friendsToggle,#friendsSidebar,#openGamesPanel,#recoveryPanel{display:none!important}",
"#menu{width:min(94%,900px);max-width:900px;max-height:94%;overflow:hidden;margin:auto}",
"#menu>div:first-child,#menu>div:nth-child(2),#menu>label,#menu>p,#modeHelp,#err{display:none!important}",
"#modePicker>div:first-child{font-size:clamp(1rem,2.5vh,1.3rem);text-align:center;margin-bottom:14px}",
".modeGrid{grid-template-columns:minmax(0,560px)!important;justify-content:center;gap:10px;margin:0}",
".modeCard:not([data-mode='challenge']){display:none!important}",
".modeCard[data-mode='challenge']{display:block!important;width:100%;height:clamp(140px,30vh,245px);min-height:0;padding:clamp(16px,3vh,30px)!important}",
".modeCard[data-mode='challenge'] .modeName{font-size:clamp(1.3rem,3vw,2.4rem)!important}",
".modeCard[data-mode='challenge'] .modeMeta{font-size:clamp(.82rem,1.6vw,1.1rem)!important;line-height:1.45}",
".modeCard[data-mode='challenge'] .modeArt{font-size:clamp(5rem,10vw,9rem)}",
"#selectedModePanel{max-width:560px;margin:0 auto}",
"#actionRow{display:none;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:10px}",
"#hostMode,#joinMode,#practiceMode,#backToModes{display:none!important}",
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
"@media(orientation:portrait) and (max-width:760px){body{width:min(100vw,56.25vh);height:min(100vh,177.7778vw)}#lobby>h1{font-size:clamp(1.4rem,3.2vh,2.4rem)}.modeCard[data-mode='challenge']{height:clamp(120px,23vh,195px)}#portalResult h1{font-size:clamp(1.8rem,4vh,2.8rem)}#radar{width:clamp(90px,26vw,150px)!important;height:clamp(90px,26vw,150px)!important;right:5px!important;bottom:5px!important}}"
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
html = html.replace('<div id="modePicker">', '<div id="portalInstructions">Solo flight training. Fly through the next arch, collect every flag, then destroy each target with unguided missiles. Touching a ring, building, or the ground crashes your plane and resets the run.</div>\n<div id="modePicker">');
const resultOverlay = '<div id="portalResult"><h1>MISSION COMPLETE</h1><p>You cleared all five flight-challenge levels. Ready to test your skills again?</p><div class="portalActions"><button id="portalReplay">FLY AGAIN</button><button id="portalHome">MAIN MENU</button></div></div>';
html = html.replace(/<\/body>\s*<\/html>/i,
  resultOverlay +
  '<script src="./client.js"></script>' +
  '<script>document.getElementById("portalReplay").addEventListener("click",function(){document.getElementById("portalResult").style.display="none";portalSdkCommercialBreak(function(){startFlightChallenge()})});document.getElementById("portalHome").addEventListener("click",function(){goMainMenu()});</script></body></html>');
html = html.replaceAll('src="/audio/', 'src="./audio/');

// Fail the build if a portal-incompatible or backend-dependent path remains in active page setup.
assert(!html.includes('google-adsense-account'), 'AdSense metadata remains in the portal HTML.');
assert(!html.includes('cdnjs.cloudflare.com'), 'External Three.js CDN reference remains.');
assert(!html.includes('/client.js?v='), 'Website client path remains.');
assert(html.includes('src="./vendor/three.min.js"'), 'Local Three.js tag is missing.');
assert((html.match(/<script[^>]+src=["']https?:/gi) || []).every(tag => tag.includes(pokiSdkUrl)),
  'Unexpected external script detected. Only the Poki SDK may be external.');
assert(!client.includes("fetch('/api/version'"), 'API version fetch remains in the portal client.');
assert(!client.includes("const PORTAL_STANDALONE=true;\nfunction portalViewportSize"), 'Portal viewport helper insertion failed.');
assert(client.includes("function connect(req){if(PORTAL_STANDALONE)"), 'Multiplayer socket guard is missing.');
assert(client.includes("function connectSocial(){if(PORTAL_STANDALONE)return;"), 'Social socket guard is missing.');
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
  build: 'v74.0-portal-edition',
  output: path.relative(repoRoot, outDir),
  files: ['index.html', 'client.js', 'vendor/three.min.js', ...assetNames.map(n=>'audio/'+n)],
  localAudioFiles: assetNames.length,
  externalScripts,
  adSenseMetadata: html.includes('google-adsense-account'),
  externalThreeCdn: html.includes('cdnjs.cloudflare.com')
}, null, 2));
