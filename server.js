const http=require('http'),fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const {WebSocketServer}=require('ws');
const BUILD_VERSION='v79.0-bot-combat-fix';
const PORT=Number(process.env.PORT||3000),WIN_ROUNDS=6,WIN_KILLS=10,HP={fighter:75,balanced:100,heavy:150,interceptor:90,striker:175},PROT=3000,BREAK=5000,RESPAWN_DELAY=3500,RECONNECT_GRACE=600000,CLASH_STEALTH=4000,LOCK_RANGE=4200,MISSILE_RANGE=5200,LOCK_DURATION=3000,LOCK_HEARTBEAT_TIMEOUT=850;
const PLANE_SPEED_MULT={fighter:1.15,balanced:1,heavy:.88,interceptor:1.34,striker:.82};
const planeNormalMaxSpeed=p=>25+200*(PLANE_SPEED_MULT[p?.ty]||1);
const TEAM_DEFS=[
  {id:'blue',name:'Blue',color:'#2a6fe0'},
  {id:'red',name:'Red',color:'#e03030'},
  {id:'green',name:'Green',color:'#20b85a'},
  {id:'yellow',name:'Yellow',color:'#f1c40f'},
  {id:'purple',name:'Purple',color:'#9b59b6'},
  {id:'orange',name:'Orange',color:'#f39c12'}
];
const COLOR_DEFS=[
  {id:'electric-red',name:'Electric Red',color:'#FF3B30'},
  {id:'vermilion',name:'Vermilion',color:'#FF6B00'},
  {id:'orange',name:'Orange',color:'#FF9500'},
  {id:'gold',name:'Gold',color:'#F2C94C'},
  {id:'yellow',name:'Yellow',color:'#FFD60A'},
  {id:'lime',name:'Lime',color:'#A8E063'},
  {id:'green',name:'Green',color:'#34C759'},
  {id:'emerald',name:'Emerald',color:'#00A878'},
  {id:'teal',name:'Teal',color:'#00A6A6'},
  {id:'cyan',name:'Cyan',color:'#00C2FF'},
  {id:'sky',name:'Sky',color:'#4DABF7'},
  {id:'blue',name:'Blue',color:'#2F80ED'},
  {id:'royal',name:'Royal Blue',color:'#5B5FEF'},
  {id:'indigo',name:'Indigo',color:'#3F51B5'},
  {id:'violet',name:'Violet',color:'#7A5AF8'},
  {id:'purple',name:'Purple',color:'#9B51E0'},
  {id:'magenta',name:'Magenta',color:'#D946EF'},
  {id:'pink',name:'Pink',color:'#FF5E9A'},
  {id:'rose',name:'Rose',color:'#E83E8C'},
  {id:'brown',name:'Earth',color:'#A15C38'}
];
const COLOR_BY_ID=Object.fromEntries(COLOR_DEFS.map(c=>[c.id,c]));
const COLOR_BY_INDEX=Object.fromEntries(COLOR_DEFS.map((c,i)=>[i,c]));
const TEAM_BY_ID=Object.fromEntries(TEAM_DEFS.map(t=>[t.id,t]));
const activeTeams=r=>TEAM_DEFS.slice(0,r.teamCount||2);
const teamIds=r=>activeTeams(r).map(t=>t.id);
const TEAMCOL=Object.fromEntries(TEAM_DEFS.map(t=>[t.id,t.color]));
const TEAMNAME=Object.fromEntries(TEAM_DEFS.map(t=>[t.id,t.name]));
const page=()=>fs.readFileSync(path.join(__dirname,'public','index.html'));
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wav':'audio/wav','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
const server=http.createServer((req,res)=>{
  try{
    const cleanPath=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`).pathname;
    if(cleanPath==='/api/version'){
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      return res.end(JSON.stringify({version:BUILD_VERSION,serverTime:Date.now()}));
    }
    if(cleanPath==='/healthz') {
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      return res.end(JSON.stringify({status:'ok',version:BUILD_VERSION,uptime:Math.round(process.uptime())}));
    }
    if(cleanPath==='/api/games'){
      const games=Object.values(rooms).filter(r=>r.state!=='over'&&Object.keys(r.players).length>0).map(r=>{
        const host=r.players[r.host];
        return {roomId:r.code,mode:r.mode,state:r.state,players:list(r).length,maxPlayers:r.mode==='clash'?null:20,teams:r.teamCount||2,lives:r.lives||1,host:host?.n||'Host'};
      }).sort((a,b)=>a.state===b.state?b.players-a.players:(a.state==='playing'?-1:a.state==='between'&&b.state!=='playing'?-1:1));
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
      return res.end(JSON.stringify({games}));
    }
    const rel=cleanPath==='/'||cleanPath==='/index.html'?'index.html':cleanPath.replace(/^\/+/, '');
    const full=path.resolve(__dirname,'public',rel);
    const pubRoot=path.resolve(__dirname,'public');
    if(full!==pubRoot&&!full.startsWith(pubRoot+path.sep))return res.writeHead(403).end('Forbidden');
    if(!fs.existsSync(full)||!fs.statSync(full).isFile())return res.writeHead(404).end('Not found');
    const ext=path.extname(full).toLowerCase();
    res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','Cache-Control':ext==='.wav'?'public, max-age=3600':'no-store, no-cache, must-revalidate'});
    fs.createReadStream(full).pipe(res);
  }catch{res.writeHead(500).end('Server error')}
});
const wss=new WebSocketServer({server,maxPayload:128*1024,perMessageDeflate:false});
const rooms={};let nextId=1;
// Local social layer: profiles/friendships persist in data/social.json, while online presence
// and invitations are live WebSocket state. This is intended for local/LAN play, not public auth.
const SOCIAL_DIR=path.resolve(process.env.MAYDAY_DATA_DIR||path.join(__dirname,'data')),SOCIAL_FILE=path.join(SOCIAL_DIR,'social.json');
fs.mkdirSync(SOCIAL_DIR,{recursive:true});
let socialStore={profiles:{}};
try{const saved=JSON.parse(fs.readFileSync(SOCIAL_FILE,'utf8'));if(saved&&saved.profiles&&typeof saved.profiles==='object')socialStore=saved}catch{}
const socialSockets=new Map(),pendingSocialInvites=new Map();
const socialParties=new Map(),pendingPartyInvites=new Map();
function partySnapshot(p){return {id:p.id,leaderId:p.leaderId,mode:p.mode||'',members:[...p.members].map(id=>socialStore.profiles[id]).filter(Boolean).map(x=>({id:x.id,name:x.name,code:x.code,online:!!socialSockets.get(x.id)&&socialSockets.get(x.id).readyState===1}))}}
function publishParty(p){if(!p)return;const msg={t:'socialPartyState',party:partySnapshot(p)};for(const id of p.members){const sw=socialSockets.get(id);if(sw&&sw.readyState===1)send(sw,msg)}}
function removePartyMember(id){for(const p of socialParties.values()){if(!p.members.has(id))continue;p.members.delete(id);if(p.members.size<2){for(const left of p.members){const sw=socialSockets.get(left);if(sw&&sw.readyState===1)send(sw,{t:'socialPartyState',party:null})}socialParties.delete(p.id);return}if(p.leaderId===id)p.leaderId=p.members.values().next().value;publishParty(p);return}}

const hashToken=t=>crypto.createHash('sha256').update(String(t||'')).digest('hex');
function saveSocial(){try{const tmp=SOCIAL_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(socialStore,null,2));fs.renameSync(tmp,SOCIAL_FILE)}catch(e){console.error('Could not save MAYDAY social data:',e.message)}}
function safeName(n){return String(n||'Pilot').replace(/[<>\\\"']/g,'').trim().slice(0,14)||'Pilot'}
function preferredPlayerName(value,identity=null){const raw=String(value??'').trim();if(raw&&raw.toLocaleLowerCase()!=='pilot')return safeName(raw);return identity?.name?safeName(identity.name):safeName(raw)}
function makeGameUid(reserved=new Set(Object.values(socialStore.profiles).map(p=>String(p.code||'')))){let uid;do{uid=String(crypto.randomInt(100000,1000000))}while(reserved.has(uid));reserved.add(uid);return uid}
// Migrate older alphanumeric Friend Codes to six-digit numeric Game UIDs at startup.
// Internal profile IDs remain unchanged, so accepted friendships and pending requests survive.
function migrateGameUids(){const used=new Set();let changed=false;for(const p of Object.values(socialStore.profiles)){const current=String(p.code||'');if(/^\d{6}$/.test(current)&&!used.has(current)){used.add(current);continue}p.code=makeGameUid(used);changed=true}if(changed)saveSocial()}
migrateGameUids();
function findProfileByCode(code){const c=String(code||'').trim();if(!/^\d{6}$/.test(c))return null;return Object.values(socialStore.profiles).find(p=>String(p.code)===c)||null}
function authProfile(id,token){const p=socialStore.profiles[String(id||'')];if(!p||!token||!p.tokenHash)return null;const a=Buffer.from(hashToken(token)),b=Buffer.from(p.tokenHash);return a.length===b.length&&crypto.timingSafeEqual(a,b)?p:null}
function socialPublic(p){
  const sw=socialSockets.get(p.id),online=!!(sw&&sw.readyState===1);
  let activeRoom=null;
  if(online){const preferred=rooms[p.roomCode];activeRoom=preferred&&roomContainsProfile(preferred,p.id)?preferred:(Object.values(rooms).find(r=>roomContainsProfile(r,p.id))||null)}
  let status='offline',roomCode='',mode='',roomState='';
  if(online){
    if(activeRoom){roomCode=activeRoom.code;mode=activeRoom.mode;roomState=activeRoom.state;const spectator=[...(activeRoom.spectators||[])].some(client=>client.profileId===p.id);status=activeRoom.state==='over'?'results':activeRoom.state==='playing'?(spectator?'spectating':'playing'):activeRoom.state==='between'?(spectator?'spectating':'between'):'room'}
    else {status='lobby'}
  }
  return {id:p.id,code:p.code,name:p.name,online,status,roomCode,mode,roomState}
}
function socialPayload(p){return {t:'socialState',profile:{id:p.id,code:p.code,name:p.name},friends:(p.friends||[]).map(id=>socialStore.profiles[id]).filter(Boolean).map(socialPublic).sort((a,b)=>Number(b.online)-Number(a.online)||a.name.localeCompare(b.name)),incomingRequests:(p.requestsIn||[]).map(id=>socialStore.profiles[id]).filter(Boolean).map(x=>({id:x.id,code:x.code,name:x.name})),outgoingRequests:(p.requestsOut||[]).map(id=>socialStore.profiles[id]).filter(Boolean).map(x=>({id:x.id,code:x.code,name:x.name}))}}
function sendSocialState(p){const sw=socialSockets.get(p?.id);if(sw&&sw.readyState===1)send(sw,socialPayload(p))}
function refreshSocialNeighborhood(p){if(!p)return;sendSocialState(p);for(const id of [...(p.friends||[]),...(p.requestsIn||[]),...(p.requestsOut||[])]){const other=socialStore.profiles[id];if(other)sendSocialState(other)}}
function createSocialProfile(name){const id=crypto.randomBytes(16).toString('hex'),token=crypto.randomBytes(32).toString('hex');const profile={id,tokenHash:hashToken(token),code:makeGameUid(),name:safeName(name),friends:[],requestsIn:[],requestsOut:[],status:'lobby',roomCode:'',mode:'',roomState:''};socialStore.profiles[id]=profile;saveSocial();return {profile,token}}
function roomContainsProfile(r,profileId){return !!r&&([...list(r)].some(p=>p.profileId===profileId&&p.connected!==false)||[...(r.spectators||[])].some(sw=>sw.profileId===profileId))}
function updateProfileStatus(p,m){
  const status=['lobby','room','playing','spectating','between','results'].includes(m.status)?m.status:'online';
  if(status==='lobby'){p.status='lobby';p.roomCode='';p.mode='';p.roomState='';refreshSocialNeighborhood(p);return}
  const code=String(m.roomCode||'').toUpperCase(),r=rooms[code];
  if(!r||!roomContainsProfile(r,p.id)){p.status='online';p.roomCode='';p.mode='';p.roomState='';refreshSocialNeighborhood(p);return}
  p.status=status;p.roomCode=code;p.mode=r.mode;p.roomState=r.state;refreshSocialNeighborhood(p)
}
function detachSocketFromRoom(ws){
  const code=ws.room,r=code&&rooms[code];
  if(!r){ws.room=null;ws.spectator=false;ws.spectatorRoom=null;delete ws.id;return}
  if(ws.spectator){r.spectators?.delete(ws);ws.spectator=false;ws.spectatorRoom=null;ws.room=null;delete ws.id;broadcastGames();return}
  const id=ws.id,p=r.players[id];
  if(p&&p.ws===ws){clearTimeout(p.reconnectTimer);clearTimeout(p.respawnTimer);delete r.players[id];if(r.host===id)r.host=Object.keys(r.players).length?Number(Object.keys(r.players)[0]):null}
  ws.room=null;ws.spectator=false;ws.spectatorRoom=null;delete ws.id;delete ws.sessionToken;
  if(!hasHumanPlayers(r)){clearTimeout(r.timer);for(const p of list(r)){clearTimeout(p.respawnTimer);clearTimeout(p.reconnectTimer)}delete rooms[r.code];broadcastGames();return}
  rcast(r,info(r));if(r.state==='playing')checkRound(r);broadcastGames();
}
function handleSocialMessage(ws,m){
  if(m.t==='socialHello'){
    let profile=null,token='';
    if(m.profileId&&m.profileToken){profile=authProfile(m.profileId,m.profileToken);token=String(m.profileToken);if(!profile){send(ws,{t:'socialAuthError'});return}}
    else {const created=createSocialProfile(m.name);profile=created.profile;token=created.token}
    const suppliedName=String(m.name||'').trim();
    const newName=suppliedName&&suppliedName.toLocaleLowerCase()!=='pilot'?safeName(suppliedName):safeName(profile.name||suppliedName);
    if(profile.name!==newName){profile.name=newName;saveSocial()}
    const old=socialSockets.get(profile.id);if(old&&old!==ws){old._socialReplaced=true;try{old.close(4001,'social session replaced')}catch{}}
    ws.socialProfileId=profile.id;socialSockets.set(profile.id,ws);
    const active=Object.values(rooms).find(r=>roomContainsProfile(r,profile.id));
    if(active){profile.roomCode=active.code;profile.mode=active.mode;profile.roomState=active.state;profile.status=[...active.spectators].some(sw=>sw.profileId===profile.id)?'spectating':(active.state==='playing'?'playing':active.state==='between'?'between':active.state==='over'?'results':'room')}
    else {profile.status='lobby';profile.roomCode='';profile.mode='';profile.roomState=''}
    send(ws,{t:'socialWelcome',profile:{id:profile.id,code:profile.code,name:profile.name},profileToken:token});sendSocialState(profile);refreshSocialNeighborhood(profile);return
  }
  const profile=socialStore.profiles[ws.socialProfileId];if(!profile||socialSockets.get(profile.id)!==ws)return;
  if(m.t==='socialRename'){
    const n=safeName(m.name);if(profile.name!==n){profile.name=n;saveSocial();refreshSocialNeighborhood(profile)}return
  }
  if(m.t==='socialStatus'){updateProfileStatus(profile,m);return}
  if(m.t==='socialAddFriend'){
    const target=findProfileByCode(m.code);if(!target)return send(ws,{t:'socialActionResult',ok:false,message:'No MAYDAY profile has that Game UID.'});
    if(target.id===profile.id)return send(ws,{t:'socialActionResult',ok:false,message:'You cannot add yourself.'});
    if((profile.friends||[]).includes(target.id))return send(ws,{t:'socialActionResult',ok:false,message:'Already friends.'});
    if((profile.requestsIn||[]).includes(target.id)){profile.friends.push(target.id);target.friends.push(profile.id);profile.requestsIn=profile.requestsIn.filter(x=>x!==target.id);target.requestsOut=(target.requestsOut||[]).filter(x=>x!==profile.id);saveSocial();refreshSocialNeighborhood(profile);return send(ws,{t:'socialActionResult',ok:true,message:'Friend request accepted.'})}
    if((profile.requestsOut||[]).includes(target.id))return send(ws,{t:'socialActionResult',ok:true,message:'Friend request already sent.'});
    profile.requestsOut=profile.requestsOut||[];target.requestsIn=target.requestsIn||[];profile.requestsOut.push(target.id);target.requestsIn.push(profile.id);saveSocial();refreshSocialNeighborhood(profile);send(ws,{t:'socialActionResult',ok:true,message:`Friend request sent to ${target.name}.`});return
  }
  if(m.t==='socialFriendResponse'){
    const other=socialStore.profiles[String(m.profileId||'')];if(!other||(profile.requestsIn||[]).indexOf(other.id)<0)return send(ws,{t:'socialActionResult',ok:false,message:'That friend request is no longer available.'});
    profile.requestsIn=profile.requestsIn.filter(id=>id!==other.id);other.requestsOut=(other.requestsOut||[]).filter(id=>id!==profile.id);
    if(m.accept){profile.friends=profile.friends||[];other.friends=other.friends||[];if(!profile.friends.includes(other.id))profile.friends.push(other.id);if(!other.friends.includes(profile.id))other.friends.push(profile.id)}
    saveSocial();refreshSocialNeighborhood(profile);sendSocialState(other);send(ws,{t:'socialActionResult',ok:true,message:m.accept?`You and ${other.name} are now friends.`:'Friend request declined.'});return
  }
  if(m.t==='socialPartyInvite'){
    const target=socialStore.profiles[String(m.friendId||'')];
    if(!target||!(profile.friends||[]).includes(target.id))return send(ws,{t:'socialActionResult',ok:false,message:'You can invite only accepted friends.'});
    const recipient=socialSockets.get(target.id);if(!recipient||recipient.readyState!==1)return send(ws,{t:'socialActionResult',ok:false,message:`${target.name} is offline.`});
    let party=[...socialParties.values()].find(p=>p.members.has(profile.id));
    if(party&&party.leaderId!==profile.id)return send(ws,{t:'socialActionResult',ok:false,message:'Only the party leader can invite friends.'});
    if(!party){party={id:crypto.randomBytes(12).toString('hex'),leaderId:profile.id,members:new Set([profile.id]),mode:''};socialParties.set(party.id,party)}
    if(party.members.has(target.id))return send(ws,{t:'socialActionResult',ok:false,message:`${target.name} is already in your party.`});
    if(party.members.size>=4)return send(ws,{t:'socialActionResult',ok:false,message:'Parties can have up to 4 pilots.'});
    const inviteId=crypto.randomBytes(12).toString('hex');pendingPartyInvites.set(inviteId,{inviteId,partyId:party.id,fromId:profile.id,toId:target.id,expiresAt:Date.now()+90000});
    send(recipient,{t:'socialPartyInvite',inviteId,partyId:party.id,fromId:profile.id,fromName:profile.name,expiresAt:Date.now()+90000});
    publishParty(party);send(ws,{t:'socialActionResult',ok:true,message:`Party invitation sent to ${target.name}.`});return
  }
  if(m.t==='socialPartyInviteResponse'){
    const inv=pendingPartyInvites.get(String(m.inviteId||''));if(!inv||inv.toId!==profile.id||inv.expiresAt<Date.now()){pendingPartyInvites.delete(String(m.inviteId||''));return send(ws,{t:'socialActionResult',ok:false,message:'This party invitation has expired.'})}
    pendingPartyInvites.delete(inv.inviteId);
    if(!m.accept){const sender=socialSockets.get(inv.fromId);if(sender)send(sender,{t:'socialInviteResult',message:`${profile.name} declined your party invitation.`});return}
    if(['playing','spectating','between','results','room'].includes(profile.status))return send(ws,{t:'socialActionResult',ok:false,message:'Leave your current game or room before joining a party.'});
    removePartyMember(profile.id);const party=socialParties.get(inv.partyId);
    if(!party)return send(ws,{t:'socialActionResult',ok:false,message:'That party no longer exists.'});
    if(party.members.size>=4)return send(ws,{t:'socialActionResult',ok:false,message:'That party is full.'});
    party.members.add(profile.id);publishParty(party);send(ws,{t:'socialActionResult',ok:true,message:`Joined ${socialStore.profiles[party.leaderId]?.name||'the'} party.`});return
  }
  if(m.t==='socialPartyLeave'){removePartyMember(profile.id);send(ws,{t:'socialPartyState',party:null});return}
  if(m.t==='socialPartyCancel'){
    const party=[...socialParties.values()].find(p=>p.members.has(profile.id));
    if(!party)return;
    for(const id of party.members){const sw=socialSockets.get(id);if(sw&&sw.readyState===1)send(sw,{t:'socialPartyQueueCancelRequest'})}
    return
  }
  if(m.t==='socialPartyStart'){
    const party=[...socialParties.values()].find(p=>p.members.has(profile.id)),mode=String(m.mode||'');
    if(!party||party.leaderId!==profile.id)return send(ws,{t:'socialActionResult',ok:false,message:'Only the party leader can start matchmaking.'});
    if(!['ffa','clash','survivor'].includes(mode))return send(ws,{t:'socialActionResult',ok:false,message:'Choose an online mode first.'});
    if(party.members.size>MATCHMAKING[mode].target)return send(ws,{t:'socialActionResult',ok:false,message:'Your party is too large for this mode.'});
    const ids=[...party.members];
    if(ids.some(id=>{const p=socialStore.profiles[id],sw=socialSockets.get(id);return !p||!sw||sw.readyState!==1||['playing','spectating','between','results','room'].includes(p.status)}))return send(ws,{t:'socialActionResult',ok:false,message:'Every party member must be online and in the lobby.'});
    party.mode=mode;publishParty(party);for(const id of ids){const sw=socialSockets.get(id);if(sw)send(sw,{t:'socialPartyQueueRequest',partyId:party.id,mode,leaderId:party.leaderId})}return
  }
  if(m.t==='socialInviteFriend'){
    const target=socialStore.profiles[String(m.friendId||'')],code=String(m.roomCode||'').toUpperCase(),r=rooms[code];
    if(!target||!(profile.friends||[]).includes(target.id))return send(ws,{t:'socialActionResult',ok:false,message:'You can invite only accepted friends.'});
    if(!r||r.state==='over'||!roomContainsProfile(r,profile.id))return send(ws,{t:'socialActionResult',ok:false,message:'You must be in an active room to invite friends.'});
    const recipient=socialSockets.get(target.id);if(!recipient||recipient.readyState!==1)return send(ws,{t:'socialActionResult',ok:false,message:`${target.name} is offline.`});
    if(roomContainsProfile(r,target.id))return send(ws,{t:'socialActionResult',ok:false,message:`${target.name} is already in this room.`});
    const inviteId=crypto.randomBytes(12).toString('hex'),expiresAt=Date.now()+90000;
    console.log(`[invite ${BUILD_VERSION}] created id=${inviteId.slice(0,8)} room=${code} from=${profile.code} to=${target.code}`);
    pendingSocialInvites.set(inviteId,{inviteId,fromId:profile.id,toId:target.id,roomCode:code,expiresAt});
    send(recipient,{t:'socialInvite',inviteId,from:{id:profile.id,code:profile.code,name:profile.name},room:{code,mode:r.mode,state:r.state,players:list(r).length}});
    send(ws,{t:'socialActionResult',ok:true,message:`Invitation sent to ${target.name}.`});return
  }
  if(m.t==='socialDeclineInvite'){
    const inv=pendingSocialInvites.get(String(m.inviteId||''));if(inv&&inv.toId===profile.id){pendingSocialInvites.delete(inv.inviteId);const sender=socialSockets.get(inv.fromId);if(sender)send(sender,{t:'socialInviteResult',message:`${profile.name} declined your room invitation.`})}return
  }
  if(m.t==='socialAcceptInvite'){
    const inv=pendingSocialInvites.get(String(m.inviteId||''));
    if(!inv||inv.toId!==profile.id||inv.expiresAt<Date.now()){
      pendingSocialInvites.delete(String(m.inviteId||''));
      return send(ws,{t:'socialActionResult',ok:false,message:'This invitation has expired.'});
    }
    const r=rooms[inv.roomCode];
    if(!r||r.state==='over'){
      pendingSocialInvites.delete(inv.inviteId);
      return send(ws,{t:'socialActionResult',ok:false,message:'That room has ended.'});
    }
    // Keep the invite alive until the game socket confirms the recipient actually
    // joined as a pilot or spectator. An acceptance alone is not a successful join.
    inv.accepted=true;
    inv.acceptedAt=Date.now();
    console.log(`[invite ${BUILD_VERSION}] accepted id=${inv.inviteId.slice(0,8)} room=${r.code} profile=${profile.code}`);
    inv.expiresAt=Date.now()+30000;
    send(ws,{t:'socialJoinRoom',inviteId:inv.inviteId,roomCode:r.code,mode:r.mode,state:r.state});
    const sender=socialSockets.get(inv.fromId);
    if(sender)send(sender,{t:'socialInviteResult',status:'accepted',message:`${profile.name} accepted — joining room ${r.code}...`});
    return;
  }
  if(m.t==='socialGameJoin'){
    const inviteId=String(m.inviteId||''),inv=pendingSocialInvites.get(inviteId),code=String(m.roomCode||'').toUpperCase(),r=rooms[code];
    if(!inv||inv.toId!==profile.id||!inv.accepted||inv.expiresAt<Date.now()){
      send(ws,{t:'err',m:'This invitation has expired. Ask your friend to invite you again.',inviteId});return
    }
    if(!r||r.state==='over'){
      send(ws,{t:'err',m:'That room has ended. Ask your friend to create or reopen a room.',inviteId});return
    }
    if(inv.roomCode!==code){send(ws,{t:'err',m:'The invitation room does not match. Please accept a fresh invitation.',inviteId});return}
    try{
      // Use the already-open social socket for the room handoff. This avoids a second
      // WebSocket opening race that previously caused accepted invites to time out.
      detachSocketFromRoom(ws);
      if(r.state==='playing'||r.state==='between'){
        ws.room=r.code;ws.spectator=true;ws.spectatorRoom=r.code;ws.profileId=profile.id;r.spectators.add(ws);
        send(ws,{t:'welcome',id:null,code:r.code,mode:r.mode,spectator:true,inviteId});
        send(ws,{t:'spectate',mode:r.mode,state:r.state,round:r.round,score:r.score,spectator:true});
        send(ws,{t:'room',...info(r)});
        send(ws,{t:'snap',players:snapshotOf(r),score:r.score,round:r.round,state:r.state});
      }else{
        const joinMsg={t:'join',roomId:r.code,code:r.code,n:profile.name,ty:m.ty,colorId:m.colorId,team:m.team,profileId:profile.id};
        const id=addPlayer(ws,r,joinMsg);
        send(ws,{t:'welcome',id,code:r.code,roomId:r.code,mode:r.mode,session:r.players[id].sessionToken,inviteId});
        rcast(r,info(r));
      }
      console.log(`[invite ${BUILD_VERSION}] social-game-join id=${inviteId.slice(0,8)} room=${r.code} profile=${profile.code} socketReuse=true state=${r.state}`);
      broadcastGames();
    }catch(e){
      console.warn(`[invite ${BUILD_VERSION}] social-game-join-failed id=${inviteId.slice(0,8)} room=${code} reason=${e?.message||'unknown'}`);
      send(ws,{t:'err',m:e&&e.message==='ALL_COLORS_TAKEN'?'All 20 pilot colors are currently taken in this room.':'Could not join that room. Please ask for a new invitation.',inviteId});
    }
    return;
  }
  if(m.t==='socialLeaveGame'){
    removeMatchmakingEntry(ws,'cancelled','Search cancelled.');
    detachSocketFromRoom(ws);
    const leavingProfile=socialStore.profiles[ws.socialProfileId];
    if(leavingProfile){leavingProfile.status='lobby';leavingProfile.roomCode='';leavingProfile.mode='';leavingProfile.roomState='';refreshSocialNeighborhood(leavingProfile)}
    send(ws,{t:'socialLeaveGameResult',ok:true});return
  }
  if(m.t==='socialJoinComplete'){
    const inviteId=String(m.inviteId||''),inv=pendingSocialInvites.get(inviteId);
    if(!inv||inv.toId!==profile.id||!inv.accepted)return;
    const r=rooms[inv.roomCode],reportedCode=String(m.code||'').toUpperCase();
    const profilePresent=!!r&&roomContainsProfile(r,profile.id);
    const joined=m.ok===true&&reportedCode===inv.roomCode&&!!r&&profilePresent;
    console.log(`[invite ${BUILD_VERSION}] join-complete id=${inviteId.slice(0,8)} room=${inv.roomCode} ok=${!!m.ok} reported=${reportedCode||'-'} profilePresent=${profilePresent} result=${joined?'joined':'failed'}`);
    pendingSocialInvites.delete(inviteId);
    const sender=socialSockets.get(inv.fromId);
    if(joined){
      const mode=m.spectator?' as a spectator':' as a pilot';
      if(sender)send(sender,{t:'socialInviteResult',status:'joined',message:`${profile.name} joined room ${r.code}${mode}.`});
      send(ws,{t:'socialActionResult',ok:true,message:`Joined room ${r.code}.`});
    }else{
      const why=String(m.message||'The room connection did not complete. Try the invitation again.').slice(0,180);
      if(sender)send(sender,{t:'socialInviteResult',status:'failed',message:`${profile.name} accepted, but could not join room ${inv.roomCode}: ${why}`});
      send(ws,{t:'socialActionResult',ok:false,message:`Could not join room ${inv.roomCode}: ${why}`});
    }
    return;
  }
}
const send=(ws,o)=>ws&&ws.readyState===1&&ws.send(JSON.stringify(o));
const list=r=>Object.values(r.players);
const hasHumanPlayers=r=>list(r).some(p=>p.ai!==true);
const rcast=(r,o,except)=>{for(const p of list(r))if(p.ws!==except)send(p.ws,o);for(const sws of (r.spectators||[]))if(sws!==except)send(sws,o)};
const snapshotOf=r=>{const players={};for(const k in r.players)players[k]=pub(r,r.players[k]);return players};
const isFFA=r=>r.mode==='ffa'||r.mode==='survivor';
const colOf=(r,p)=>isFFA(r)?p.color:(TEAM_BY_ID[p.team]?.color||'#fff');
const mvpScore=p=>(p.kills||0)*120+(p.damage||0)+(p.survivalBonus||0);
const pickMVP=ps=>ps.slice().sort((a,b)=>mvpScore(b)-mvpScore(a)||(b.kills||0)-(a.kills||0)||(b.damage||0)-(a.damage||0))[0]||null;
const info=r=>({t:'room',mode:r.mode,code:r.code,host:r.host,state:r.state,score:r.score,round:r.round,teamCount:r.teamCount||2,maxPlayers:r.maxPlayers||24,teams:activeTeams(r),lives:r.lives||1,colors:COLOR_DEFS,players:Object.entries(r.players).map(([id,p])=>({id:+id,n:p.n,ai:p.ai===true,team:p.team,colorId:p.colorId,ty:p.ty,c:colOf(r,p),tn:isFFA(r)?'':(TEAM_BY_ID[p.team]?.name||p.team),lives:p.livesRemaining,online:p.connected!==false,gameUid:p.profileId&&socialStore.profiles[p.profileId]?socialStore.profiles[p.profileId].code:null}))});
const pub=(r,p)=>({n:p.n,ai:p.ai===true,team:p.team,colorId:p.colorId,c:colOf(r,p),ty:p.ty,mh:p.mh,hp:p.hp,alive:p.connected!==false&&p.alive,sc:p.sc||0,lives:p.livesRemaining,online:p.connected!==false,pr:Math.max(0,p.prot-Date.now()),rh:r.mode==='clash'?Math.max(0,(r.roundHiddenUntil||0)-Date.now()):0,sh:r.mode==='clash'?(p.shields===undefined?3:p.shields):0,su:r.mode==='clash'?Math.max(0,(p.shieldUntil||0)-Date.now()):0,p:p.p,q:p.q});
const mkCode=()=>{let c;do{c=Math.random().toString(36).replace(/[^a-z]/g,'').slice(0,4).toUpperCase()}while(c.length<4||rooms[c]);return c};
function addPlayer(ws,r,m){if(r.maxPlayers&&list(r).length>=r.maxPlayers)throw new Error('ROOM_FULL');const id=nextId++;ws.id=id;const identity=authProfile(m.profileId,m.profileToken)||(ws.socialProfileId?socialStore.profiles[ws.socialProfileId]:null);const displayName=preferredPlayerName(m.n,identity);if(identity){ws.profileId=identity.id;if(identity.name!==displayName){identity.name=displayName;saveSocial()}}const ty=HP[m.ty]?m.ty:'balanced';
  const cnt=t=>list(r).filter(p=>p.team===t).length;
  let team;
  if(isFFA(r)) team='p'+id;
  else {
    const valid=teamIds(r);
    team=valid.includes(m.team)?m.team:valid.slice().sort((a,b)=>cnt(a)-cnt(b))[0];
  }
  let colorId=COLOR_BY_ID[m.colorId]?m.colorId:null;
  if(isFFA(r)){
    const taken=new Set(list(r).map(p=>p.colorId).filter(Boolean));
    if(!colorId||taken.has(colorId)){colorId=COLOR_DEFS.find(c=>!taken.has(c.id))?.id||null;}
    if(!colorId)throw new Error('ALL_COLORS_TAKEN');
  }
  const color=colorId?(COLOR_BY_ID[colorId].color):'#ffffff';
  r.players[id]={id,ws,profileId:identity?.id||null,sessionToken:crypto.randomBytes(18).toString('hex'),connected:true,disconnectedAt:0,reconnectTimer:null,n:displayName,team,colorId,color,ty,mh:HP[ty],hp:HP[ty],alive:false,inRound:false,prot:0,sc:0,kills:0,deaths:0,damage:0,shieldUses:0,respawnTimer:null,shields:3,shieldUntil:0,livesRemaining:isFFA(r)&&r.mode==='survivor'?(r.lives||1):null,eliminated:false,p:[0,500,0],q:[0,0,0,1],lockTarget:null,lockSince:0,lockLastAt:0,shots:0,missiles:0,flares:3,recentShots:[],recentMissileTargets:[]};
  return id}

// Server-controlled simulated pilots only fill quick-match rooms; private rooms remain human-only.
// Display only a first name for simulated pilots. Keep names unique among active rooms when possible.
const firstNameOnly=value=>String(value||'').trim().split(/\s+/)[0].slice(0,14);
let pilotNamePool=[];
try {
  const names=JSON.parse(fs.readFileSync(path.join(__dirname,'pilot-names.json'),'utf8'));
  if(Array.isArray(names)){
    const seen=new Set();
    for(const raw of names){
      const candidate=firstNameOnly(raw),key=candidate.toLocaleLowerCase();
      if(candidate&&!seen.has(key)){seen.add(key);pilotNamePool.push(candidate)}
    }
  }
}catch(e){console.warn('MAYDAY pilot name pool unavailable; using built-in fallback names:',e.message)}
const FALLBACK_PILOT_NAMES=['Alex','Jordan','Sam','Jamie','Riley','Casey','Avery','Taylor','Morgan','Skyler'];
function randomPilotDisplayName(){
  const used=new Set();
  for(const activeRoom of Object.values(rooms))for(const pilot of list(activeRoom))if(pilot?.n)used.add(firstNameOnly(pilot.n).toLocaleLowerCase());
  if(pilotNamePool.length){
    for(let i=0;i<80;i++){const candidate=pilotNamePool[crypto.randomInt(pilotNamePool.length)];if(!used.has(candidate.toLocaleLowerCase()))return candidate}
    const available=pilotNamePool.filter(n=>!used.has(n.toLocaleLowerCase()));
    if(available.length)return available[crypto.randomInt(available.length)];
  }
  const fallback=FALLBACK_PILOT_NAMES.filter(n=>!used.has(n.toLocaleLowerCase()));
  if(fallback.length)return fallback[crypto.randomInt(fallback.length)];
  for(let i=0;i<100;i++){const candidate='Sky'+crypto.randomInt(100,1000);if(!used.has(candidate.toLocaleLowerCase()))return candidate}
  return 'Jet'+crypto.randomInt(100,1000);
}
function addAIPilot(r){
  const id=nextId++,valid=teamIds(r);
  const counts=Object.fromEntries(valid.map(t=>[t,list(r).filter(p=>p.team===t).length]));
  const team=isFFA(r)?'p'+id:valid.slice().sort((a,b)=>counts[a]-counts[b])[0];
  const taken=new Set(list(r).map(p=>p.colorId).filter(Boolean));
  const colorDef=COLOR_DEFS.find(c=>!taken.has(c.id))||COLOR_DEFS[(id-1)%COLOR_DEFS.length];
  const types=['balanced','fighter','interceptor','heavy','striker'];
  const ty=types[Math.floor(Math.random()*types.length)];
  r.players[id]={
    id,ws:null,profileId:null,sessionToken:null,connected:true,disconnectedAt:0,reconnectTimer:null,
    n:randomPilotDisplayName(),ai:true,team,colorId:colorDef.id,color:colorDef.color,ty,
    mh:HP[ty],hp:HP[ty],alive:false,inRound:false,prot:0,sc:0,kills:0,deaths:0,damage:0,shieldUses:0,
    respawnTimer:null,shields:3,shieldUntil:0,livesRemaining:r.mode==='survivor'?(r.lives||1):null,eliminated:false,
    p:[0,850,0],q:[0,0,0,1],lockTarget:null,lockSince:0,lockLastAt:0,shots:0,missiles:0,flares:3,
    aiYaw:Math.random()*Math.PI*2,aiPitch:0,aiRoll:0,aiTurnDir:Math.random()<.5?-1:1,
    aiSkill:.34+Math.random()*.24,aiNextShot:Date.now()+500+Math.random()*1100,aiTargetId:null,
    aiManeuver:'cruise',aiManeuverUntil:Date.now()+1800+Math.random()*2600,aiPhase:Math.random()*Math.PI*2,
    aiBreakCooldown:Date.now()+3500+Math.random()*5000,aiAttackPass:0
  };
  return r.players[id];
}
function aiHashText(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function aiSeededRand(seed){seed=((seed>>>0)^0x9e3779b9)>>>0;seed=Math.imul(seed^(seed>>>16),0x45d9f3b);seed=Math.imul(seed^(seed>>>16),0x45d9f3b);seed=(seed^(seed>>>16))>>>0;return seed/4294967296}
const AI_SPAWN_ZONES=[{x:-5200,z:-500},{x:5200,z:500},{x:-3600,z:3900},{x:3600,z:-3900},{x:-1200,z:-5200},{x:1200,z:5200}];
function aiQuaternion(yaw,pitch,roll=0){
  // Yaw, pitch and bank are composed as a normalized aircraft attitude quaternion.
  const hy=yaw/2,hp=pitch/2,hr=roll/2;
  const sy=Math.sin(hy),cy=Math.cos(hy),sp=Math.sin(hp),cp=Math.cos(hp),sr=Math.sin(hr),cr=Math.cos(hr);
  return [sp*cy*cr+cp*sy*sr,cp*sy*cr-sp*cy*sr,cp*cy*sr-sp*sy*cr,cp*cy*cr+sp*sy*sr];
}
function aiSpawnPosition(r,p){
  if(r.mode!=='clash'){
    const x=(Math.random()-.5)*2400,z=(Math.random()-.5)*2400;
    return {p:[x,450+Math.random()*650,z],yaw:Math.random()*Math.PI*2};
  }
  const zones=AI_SPAWN_ZONES.map((z,i)=>({...z,i})),baseSeed=aiHashText(r.code+'|CS|'+r.round);
  for(let i=zones.length-1;i>0;i--){const j=Math.floor(aiSeededRand(baseSeed+i*7919)*(i+1));[zones[i],zones[j]]=[zones[j],zones[i]]}
  const ti=Math.max(0,teamIds(r).indexOf(p.team)),zone=zones[ti%zones.length];
  const seed=aiHashText(r.code+'|CS|'+r.round+'|'+p.team+'|'+p.id);
  const a=aiSeededRand(seed)*Math.PI*2,rad=aiSeededRand(seed^0x7f4a7c15)*380+150;
  const x=zone.x+Math.cos(a)*rad,z=zone.z+Math.sin(a)*rad;
  return {p:[x,850,z],yaw:Math.atan2(-x,z)};
}

const queueTimeoutOverride=Number(process.env.MAYDAY_MATCHMAKING_TIMEOUT_MS)||0;
const MATCHMAKING={
  ffa:{target:8,minPlayers:1,timeoutMs:queueTimeoutOverride?Math.max(250,queueTimeoutOverride):20000},
  clash:{target:8,minPlayers:1,timeoutMs:queueTimeoutOverride?Math.max(250,queueTimeoutOverride):25000},
  survivor:{target:6,minPlayers:1,timeoutMs:queueTimeoutOverride?Math.max(250,queueTimeoutOverride):20000}
};
const matchmakingQueues=Object.fromEntries(Object.keys(MATCHMAKING).map(mode=>[mode,[]]));
const matchmakingLastPublished=Object.create(null);
function publishMatchmakingQueue(mode,now=Date.now(),force=false){
  const cfg=MATCHMAKING[mode],queue=matchmakingQueues[mode];if(!cfg||!queue)return;
  if(!force&&now-(matchmakingLastPublished[mode]||0)<1000)return;
  matchmakingLastPublished[mode]=now;
  for(let i=queue.length-1;i>=0;i--){
    const entry=queue[i];
    if(entry.ws.readyState!==1||entry.ws.matchmakingEntry!==entry||entry.ws.room){queue.splice(i,1);if(entry.ws.matchmakingEntry===entry)entry.ws.matchmakingEntry=null}
  }
  for(let i=0;i<queue.length;i++){
    const entry=queue[i];
    send(entry.ws,{t:'matchmaking',status:'searching',mode,players:queue.length,target:cfg.target,minPlayers:cfg.minPlayers,waitedSeconds:Math.max(0,Math.floor((now-entry.queuedAt)/1000)),position:i+1});
  }
}
function removeMatchmakingEntry(ws,status='cancelled',message=''){
  const entry=ws.matchmakingEntry;if(!entry)return false;
  const queue=matchmakingQueues[entry.mode]||[],idx=queue.indexOf(entry);
  if(idx>=0)queue.splice(idx,1);
  ws.matchmakingEntry=null;
  const cfg=MATCHMAKING[entry.mode];
  send(ws,{t:'matchmaking',status,mode:entry.mode,message,players:queue.length,target:cfg?.target||0,minPlayers:cfg?.minPlayers||2});
  publishMatchmakingQueue(entry.mode,Date.now(),true);
  return true;
}
function queueForMatchmaking(ws,m){
  const mode=String(m.mode||''),cfg=MATCHMAKING[mode];if(!cfg)return send(ws,{t:'err',m:'Choose Dogfight, Clash Squad, or Survivor for online matchmaking.'});
  if(ws.room)return send(ws,{t:'err',m:'Leave your current room before searching for a match.'});
  if(ws.matchmakingEntry){if(ws.matchmakingEntry.mode===mode&&ws.matchmakingEntry.partyId===(m.partyId||'')){publishMatchmakingQueue(mode,Date.now(),true);return}removeMatchmakingEntry(ws,'cancelled','Previous search cancelled.')}
  const identity=authProfile(m.profileId,m.profileToken);if(!identity)return send(ws,{t:'err',m:'Sign in to your MAYDAY profile before party matchmaking.'});
  let partyId='';if(m.partyId){const party=socialParties.get(String(m.partyId));if(!party||!party.members.has(identity.id)||party.mode!==mode)return send(ws,{t:'err',m:'Your party is no longer ready. Return to the lobby and invite your friends again.'});partyId=party.id;if(party.members.size>cfg.target)return send(ws,{t:'err',m:'Your party is too large for this mode.'})}
  for(const queuedMode of Object.keys(matchmakingQueues))for(const entry of [...matchmakingQueues[queuedMode]])if(entry.profileId===identity.id&&entry.ws!==ws)removeMatchmakingEntry(entry.ws,'replaced','Your MAYDAY profile started a new matchmaking search in another tab.');
  const queue=matchmakingQueues[mode];if(queue.length>=256)return send(ws,{t:'err',m:'This mode’s matchmaking queue is busy. Please try again shortly.'});
  const entry={ws,mode,queuedAt:Date.now(),profileId:identity.id,partyId,player:{n:safeName(m.n),ty:HP[m.ty]?m.ty:'balanced',colorId:COLOR_BY_ID[m.colorId]?m.colorId:null,profileId:identity.id,profileToken:String(m.profileToken||'')}};
  ws.matchmakingEntry=entry;queue.push(entry);publishMatchmakingQueue(mode,Date.now(),true);processMatchmakingQueues()
}
function queueUnits(mode){
  const queue=matchmakingQueues[mode],units=[],seen=new Set();
  for(const e of queue){if(!e.partyId){units.push([e]);continue}if(seen.has(e.partyId))continue;seen.add(e.partyId);const p=socialParties.get(e.partyId);if(!p)continue;const group=queue.filter(x=>x.partyId===e.partyId&&x.mode===mode&&p.members.has(x.profileId));if(group.length===p.members.size&&p.members.size>=2)units.push(group.sort((a,b)=>[...p.members].indexOf(a.profileId)-[...p.members].indexOf(b.profileId)))}
  return units.sort((a,b)=>Math.min(...a.map(e=>e.queuedAt))-Math.min(...b.map(e=>e.queuedAt)))
}
function selectMatchBatch(mode,target,partial=false){
  const chosen=[];let count=0;for(const unit of queueUnits(mode)){if(count+unit.length>target)continue;chosen.push(unit);count+=unit.length;if(count===target)break}
  return count===target||partial&&count>=MATCHMAKING[mode].minPlayers?chosen.flat():null
}
function createQuickMatch(mode,batch){
  const cfg=MATCHMAKING[mode];
  let eligible=batch.filter(entry=>entry.ws.readyState===1&&entry.ws.matchmakingEntry===entry&&!entry.ws.room);
  // If any party member drops at the last moment, never seat the remaining members
  // separately; return the surviving party members to the lobby with a clear error.
  for(const partyId of new Set(eligible.map(e=>e.partyId).filter(Boolean))){
    const party=socialParties.get(partyId),group=eligible.filter(e=>e.partyId===partyId);
    if(!party||group.length!==party.members.size||group.some(e=>!party.members.has(e.profileId))){
      for(const e of group)send(e.ws,{t:'matchmaking',status:'error',mode,message:'A party member disconnected before the match started. Invite everyone and search again.'});
      eligible=eligible.filter(e=>e.partyId!==partyId);
    }
  }
  for(const entry of batch)if(entry.ws.matchmakingEntry===entry)entry.ws.matchmakingEntry=null;
  if(eligible.length<cfg.minPlayers){
    for(const entry of eligible)send(entry.ws,{t:'matchmaking',status:'error',mode,message:'Not enough pilots remained connected. Search again to find a match.'});
    for(const modeName of Object.keys(matchmakingQueues))publishMatchmakingQueue(modeName,Date.now(),true);
    return;
  }
  const r={code:mkCode(),mode,teamCount:2,maxPlayers:cfg.target,lives:1,host:null,state:'lobby',score:{},round:0,players:{},spectators:new Set(),timer:null,quickMatch:true,startedAt:Date.now(),aiBackfillUntil:Date.now()+90000};
  if(mode==='clash')for(const team of activeTeams(r))r.score[team.id]=0;
  rooms[r.code]=r;
  const seated=[],partyTeams=new Map(),teamCounts=Object.fromEntries(activeTeams(r).map(t=>[t.id,0]));
  if(mode==='clash'){
    const groups=[];for(const e of eligible){const key=e.partyId||'solo:'+e.profileId;let g=groups.find(x=>x.key===key);if(!g){g={key,entries:[]};groups.push(g)}g.entries.push(e)}
    for(const g of groups){const team=activeTeams(r).map(t=>t.id).sort((a,b)=>teamCounts[a]-teamCounts[b])[0];partyTeams.set(g.key,team);teamCounts[team]+=g.entries.length}
  }
  for(const entry of eligible){
    try{
      const key=entry.partyId||'solo:'+entry.profileId,playerSpec=mode==='clash'?Object.assign({},entry.player,{team:partyTeams.get(key)}):entry.player;
      const id=addPlayer(entry.ws,r,playerSpec);
      if(!r.host)r.host=id;
      seated.push({entry,id});
    }catch(e){
      entry.ws.room=null;delete entry.ws.id;delete entry.ws.sessionToken;
      send(entry.ws,{t:'matchmaking',status:'error',mode,message:'Could not join the match. Please search again.'});
    }
  }
  if(seated.length<cfg.minPlayers){
    for(const p of list(r)){p.ws.room=null;delete p.ws.id;send(p.ws,{t:'err',m:'Matchmaking could not seat enough pilots. Please try again.'});try{p.ws.close(1011,'matchmaking failed')}catch{}}
    delete rooms[r.code];return;
  }
  for(let i=seated.length;i<cfg.target;i++)addAIPilot(r);
  for(const p of list(r)){
    p.sc=0;p.kills=0;p.deaths=0;p.damage=0;p.shieldUses=0;p.eliminated=false;
    p.livesRemaining=mode==='survivor'?r.lives:null;
  }
  r.score={};
  if(mode==='clash')for(const team of activeTeams(r))r.score[team.id]=0;
  for(const {entry,id} of seated){
    send(entry.ws,{t:'matchmaking',status:'matched',mode,players:list(r).length,target:cfg.target,aiPlayers:list(r).filter(p=>p.ai).length,roomCode:r.code});
    send(entry.ws,{t:'welcome',id,code:r.code,roomId:r.code,mode,session:r.players[id].sessionToken,quickMatch:true});
  }
  // Send the regular lobby snapshot first so existing clients initialize their room state,
  // then start the first round through the same protocol as manually hosted games.
  rcast(r,info(r));
  startRound(r);
  rcast(r,info(r));
  broadcastGames();
  console.log('[matchmaking] started mode='+mode+' room='+r.code+' humans='+seated.length+' ai='+list(r).filter(p=>p.ai).length);
}
function backfillQueuedPilots(mode,queue,now){
  const cfg=MATCHMAKING[mode],minimumWait=Math.min(5000,Math.max(500,Math.round(cfg.timeoutMs/2)));
  // Keep recently-arrived pilots together: do not siphon an older queued pilot into
  // another live room while a newer pilot is still within the same backfill window.
  if(queue.some(entry=>now-entry.queuedAt<minimumWait))return;
  for(let i=0;i<queue.length;){
    const entry=queue[i];
    if(now-entry.queuedAt<minimumWait){i++;continue}
    const room=Object.values(rooms)
      .filter(r=>r.quickMatch&&r.mode===mode&&r.state==='playing'&&(r.aiBackfillUntil||0)>now&&list(r).some(p=>p.ai))
      .sort((a,b)=>(a.startedAt||0)-(b.startedAt||0))[0];
    if(!room){i++;continue}
    const bot=list(room).filter(p=>p.ai).sort((a,b)=>(a.kills||0)-(b.kills||0)||Number(a.alive)-Number(b.alive))[0];
    if(!bot){i++;continue}
    queue.splice(i,1);
    if(entry.ws.matchmakingEntry===entry)entry.ws.matchmakingEntry=null;
    clearTimeout(bot.respawnTimer);clearTimeout(bot.reconnectTimer);delete room.players[bot.id];
    try{
      const id=addPlayer(entry.ws,room,entry.player),player=room.players[id];
      player.sc=0;player.kills=0;player.deaths=0;player.damage=0;player.shieldUses=0;player.eliminated=false;
      player.livesRemaining=mode==='survivor'?(room.lives||1):null;
      spawn(player,room);
      send(entry.ws,{t:'matchmaking',status:'matched',mode,players:list(room).length,target:cfg.target,aiPlayers:list(room).filter(p=>p.ai).length,roomCode:room.code,backfill:true});
      send(entry.ws,{t:'welcome',id,code:room.code,roomId:room.code,mode,session:player.sessionToken,quickMatch:true,backfill:true});
      rcast(room,info(room));
      send(entry.ws,{t:'round',n:room.round,score:room.score,mode:room.mode,lives:room.lives||1,hidden:Math.max(0,(room.roundHiddenUntil||0)-Date.now()),spectatorReady:true,backfill:true});
      send(entry.ws,{t:'snap',players:snapshotOf(room),score:room.score,round:room.round,state:room.state});
      broadcastGames();
      console.log('[matchmaking] backfilled mode='+mode+' room='+room.code+' human='+player.n+' aiRemaining='+list(room).filter(p=>p.ai).length);
    }catch(e){
      room.players[bot.id]=bot;
      entry.ws.room=null;delete entry.ws.id;delete entry.ws.sessionToken;
      send(entry.ws,{t:'matchmaking',status:'error',mode,message:'Could not join the live match. Please search again.'});
    }
  }
}
function processMatchmakingQueues(now=Date.now()){
  for(const mode of Object.keys(MATCHMAKING)){
    const cfg=MATCHMAKING[mode],queue=matchmakingQueues[mode];
    for(let i=queue.length-1;i>=0;i--){const e=queue[i];if(e.ws.readyState!==1||e.ws.matchmakingEntry!==e||e.ws.room){queue.splice(i,1);if(e.ws.matchmakingEntry===e)e.ws.matchmakingEntry=null}}
    let batch=selectMatchBatch(mode,cfg.target,false);
    if(!batch){const units=queueUnits(mode),oldest=units.length?Math.min(...units.flat().map(e=>e.queuedAt)):Infinity;if(now-oldest>=cfg.timeoutMs)batch=selectMatchBatch(mode,cfg.target,true)}
    if(batch){const picked=new Set(batch);matchmakingQueues[mode]=queue.filter(e=>!picked.has(e));createQuickMatch(mode,batch)}
    publishMatchmakingQueue(mode,now)
  }
}

const spawn=(p,r=null)=>{if(p.ai&&r){const point=aiSpawnPosition(r,p);p.p=point.p;p.aiYaw=point.yaw;p.aiPitch=0;p.q=aiQuaternion(p.aiYaw,0)}p.inRound=true;p.alive=true;p.hp=p.mh;p.prot=Date.now()+PROT;p.lastSpawn=Date.now();p.shields=p.shields===undefined?3:3;p.shieldUntil=0;p.flares=3;p.lockTarget=null;p.lockSince=0;p.lockLastAt=0;p.eliminated=false};
function startRound(r){clearTimeout(r.timer);r.round++;r.state='playing';r.roundHiddenUntil=r.mode==='clash'?Date.now()+CLASH_STEALTH:0;list(r).forEach(p=>{if(r.mode==='survivor')p.livesRemaining=r.lives||1;
  // A disconnected Clash pilot is eliminated for this round. Do not respawn an
  // offline pilot as alive/invulnerable; they can rejoin in the next round.
  if(r.mode==='clash'&&p.connected===false){p.alive=false;p.inRound=false;p.hp=0;return}
  spawn(p,r)});
  rcast(r,{t:'round',n:r.round,score:r.score,mode:r.mode,lives:r.lives||1,hidden:r.mode==='clash'?CLASH_STEALTH:0,spectatorReady:true})}
function endRound(r,win){if(r.state!=='playing')return;r.state='between';if(win)r.score[win]=(r.score[win]||0)+1;
  rcast(r,{t:'roundend',win,score:r.score,round:r.round,teams:activeTeams(r)});broadcastGames();
  r.timer=setTimeout(()=>{if(!rooms[r.code])return;
    if(win&&r.score[win]>=WIN_ROUNDS){r.state='over';const players=list(r).map(p=>({n:p.n,ai:p.ai===true,c:colOf(r,p),team:p.team,kills:p.kills||0,deaths:p.deaths||0,damage:p.damage||0,shields:p.shieldUses||0,shots:p.shots||0,missiles:p.missiles||0,flares:p.flares||0,survivalBonus:p.team===win&&p.alive?20:0}));const teams=activeTeams(r).map(t=>({id:t.id,name:t.name,color:t.color,score:r.score[t.id]||0,kills:list(r).filter(p=>p.team===t.id).reduce((a,p)=>a+(p.kills||0),0),damage:list(r).filter(p=>p.team===t.id).reduce((a,p)=>a+(p.damage||0),0)})).sort((a,b)=>b.score-a.score||b.kills-a.kills||b.damage-a.damage);const mvp=pickMVP(players.filter(p=>p.team===win).length?players.filter(p=>p.team===win):players);rcast(r,{t:'matchend',mode:'clash',win,score:r.score,teams,mvp,players})}
    else if(list(r).length)startRound(r)},BREAK)}
function checkRound(r){if(r.mode!=='clash'||r.state!=='playing')return;
  // Only connected pilots with positive HP count as survivors. Unexpected
  // disconnects must not leave an invulnerable, stale pilot blocking a team win.
  const remaining=teamIds(r).filter(t=>list(r).some(p=>p.connected!==false&&p.alive&&p.hp>0&&p.team===t));
  if(remaining.length>1)return;
  endRound(r,remaining.length===1?remaining[0]:null)}
function kill(r,vid,sid){const v=r.players[vid],s=r.players[sid];if(!v)return;v.alive=false;v.inRound=false;v.hp=0;v.shieldUntil=0;v.deaths=(v.deaths||0)+1;if(v.lockTarget!==null&&v.lockTarget!==undefined){const oldTarget=r.players[v.lockTarget];if(oldTarget?.ws)send(oldTarget.ws,{t:'locklost',by:vid})}v.lockTarget=null;v.lockSince=0;v.lockLastAt=0;if(s&&s!==v)s.kills=(s.kills||0)+1;
  rcast(r,{t:'kill',victim:vid,by:s?sid:null,vn:v.n,bn:s?s.n:null,x:v.p});send(v.ws,{t:'dead',by:s?s.n:null});checkRound(r)}
function ffaRespawnLater(r,v,by=null,crash=false){clearTimeout(v.respawnTimer);v.respawnTimer=setTimeout(()=>{if(!rooms[r.code]||r.state!=='playing'||!r.players[v.id]||v.alive)return;spawn(v,r);send(v.ws,{t:'respawn',by,crash})},RESPAWN_DELAY)}
function ffaKill(r,v,vid,s,sid){s.sc++;s.kills=(s.kills||0)+1;v.deaths=(v.deaths||0)+1;v.alive=false;v.hp=0;v.shieldUntil=0;rcast(r,{t:'kill',victim:vid,by:sid,vn:v.n,bn:s.n,x:v.p});
  if(s.sc>=WIN_KILLS){r.state='over';clearTimeout(v.respawnTimer);const players=list(r).map(p=>({n:p.n,ai:p.ai===true,c:p.color,team:p.team,sc:p.sc,kills:p.kills||0,deaths:p.deaths||0,damage:p.damage||0,survivalBonus:p.alive?20:0})).sort((a,b)=>b.sc-a.sc);rcast(r,{t:'matchend',mode:'ffa',win:s.n,wc:s.color,mvp:pickMVP(players),players})}
  else ffaRespawnLater(r,v,s.n,false)}
function ffaCrash(r,v){if(r.state!=='playing'||!v.alive)return;v.alive=false;v.inRound=false;v.hp=0;v.shieldUntil=0;v.deaths=(v.deaths||0)+1;if(v.lockTarget!==null&&v.lockTarget!==undefined){const oldTarget=r.players[v.lockTarget];if(oldTarget?.ws)send(oldTarget.ws,{t:'locklost',by:v.id})}v.lockTarget=null;v.lockSince=0;v.lockLastAt=0;rcast(r,{t:'kill',victim:v.id,by:null,vn:v.n,bn:null,x:v.p});send(v.ws,{t:'dead',by:null,crash:true});ffaRespawnLater(r,v,null,true)}
function survivorRespawnLater(r,v,by=null,crash=false){clearTimeout(v.respawnTimer);v.respawnTimer=setTimeout(()=>{if(!rooms[r.code]||r.state!=='playing'||!r.players[v.id]||v.alive||v.livesRemaining<=0)return;spawn(v,r);send(v.ws,{t:'respawn',by,crash,lives:v.livesRemaining,mode:'survivor'});checkSurvivor(r)},RESPAWN_DELAY)}
function survivorEnd(r,w){if(r.state!=='playing')return;r.state='over';clearTimeout(r.timer);const winner=w;const players=list(r).map(p=>({n:p.n,ai:p.ai===true,c:p.color,team:p.team,kills:p.kills||0,deaths:p.deaths||0,damage:p.damage||0,lives:p.livesRemaining||0,alive:p.alive,shots:p.shots||0,missiles:p.missiles||0,flares:p.flares||0,survivalBonus:p.alive?80:0}));rcast(r,{t:'matchend',mode:'survivor',win:winner?winner.n:null,wc:winner?winner.color:null,lives:r.lives,mvp:pickMVP(players),players})}
function checkSurvivor(r){if(r.mode!=='survivor'||r.state!=='playing')return;const eligible=list(r).filter(p=>p.connected!==false&&p.livesRemaining>0);if(eligible.length!==1)return;const w=eligible[0];if(w.alive)survivorEnd(r,w)}
function survivorKill(r,v,s,vid,sid,crash=false){if(!v||!v.alive)return;v.alive=false;v.inRound=false;v.hp=0;v.shieldUntil=0;v.deaths=(v.deaths||0)+1;if(v.lockTarget!==null&&v.lockTarget!==undefined){const oldTarget=r.players[v.lockTarget];if(oldTarget?.ws)send(oldTarget.ws,{t:'locklost',by:v.id})}v.lockTarget=null;v.lockSince=0;v.lockLastAt=0;if(s&&s!==v)s.kills=(s.kills||0)+1;v.livesRemaining=Math.max(0,(v.livesRemaining||1)-1);rcast(r,{t:'kill',victim:vid,by:sid??null,vn:v.n,bn:s?s.n:null,x:v.p,lives:v.livesRemaining});if(v.livesRemaining>0){send(v.ws,{t:'dead',by:s?s.n:null,crash,lives:v.livesRemaining});survivorRespawnLater(r,v,s?s.n:null,crash)}else{v.eliminated=true;send(v.ws,{t:'dead',by:s?s.n:null,crash,lives:0,eliminated:true});checkSurvivor(r)}}
function damage(r,vid,sid,amt){const v=r.players[vid],s=r.players[sid],now=Date.now();
  if(r.state!=='playing'||!v||!s||!v.connected||!s.connected||!v.alive||vid===sid||v.team===s.team)return;if(now<v.prot)return;if(r.mode==='clash'&&now<(r.roundHiddenUntil||0))return;if(r.mode==='clash'&&v.shieldUntil>now)return;v.shieldUntil=0;
  const dealt=Math.min(Math.max(v.hp,0),amt);v.hp-=amt;s.damage=(s.damage||0)+dealt;if(v.hp<=0){if(r.mode==='ffa')ffaKill(r,v,vid,s,sid);else if(r.mode==='survivor')survivorKill(r,v,s,vid,sid,false);else kill(r,vid,sid)}}

let lastAIPilotTick=0;
const aiClamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const aiAngleDelta=(a,b)=>((b-a+Math.PI*3)%(Math.PI*2))-Math.PI;
function runAIPilots(now=Date.now()){
  const dt=lastAIPilotTick?aiClamp((now-lastAIPilotTick)/1000,.02,.16):.1;
  lastAIPilotTick=now;
  for(const r of Object.values(rooms)){
    if(r.state!=='playing')continue;
    const active=list(r);
    for(const bot of active){
      if(!bot.ai||bot.connected===false||!bot.alive||!Array.isArray(bot.p))continue;
      const targets=active.filter(p=>p.id!==bot.id&&p.connected!==false&&p.alive&&p.hp>0&&p.team!==bot.team&&Array.isArray(p.p));
      if(!targets.length)continue;
      const distTo=p=>Math.hypot(p.p[0]-bot.p[0],p.p[1]-bot.p[1],p.p[2]-bot.p[2]);
      targets.sort((a,b)=>distTo(a)-distTo(b));
      let target=targets.find(p=>p.id===bot.aiTargetId);
      if(!target||distTo(target)>distTo(targets[0])*1.32)target=targets[0];
      bot.aiTargetId=target.id;
      let dx=target.p[0]-bot.p[0],dy=target.p[1]-bot.p[1],dz=target.p[2]-bot.p[2];
      let dist=Math.max(1,Math.hypot(dx,dy,dz)),horizontal=Math.max(1,Math.hypot(dx,dz));
      const baseYaw=Math.atan2(-dx,-dz),edge=5400;
      bot.aiPhase=(Number.isFinite(bot.aiPhase)?bot.aiPhase:0)+dt*(.35+(bot.aiSkill||.4)*.5);
      if(!Number.isFinite(bot.aiManeuverUntil)||now>=bot.aiManeuverUntil){
        const roll=Math.random();
        bot.aiManeuver=dist<1150?(roll<.32?'break-turn':roll<.58?'scissors':roll<.78?'vertical-extension':'attack-pass'):(roll<.24?'climb':roll<.45?'dive':roll<.68?'wide-turn':roll<.84?'barrel-bank':'cruise');
        bot.aiManeuverUntil=now+(bot.aiManeuver==='break-turn'?850+Math.random()*900:1500+Math.random()*3300);
      }
      let desiredYaw=baseYaw;
      const weave=Math.sin(bot.aiPhase*1.7+(bot.id%7))*0.11;
      if(bot.aiManeuver==='break-turn'){desiredYaw+=bot.aiTurnDir*(.9+Math.min(1.1,1800/dist));}
      else if(bot.aiManeuver==='scissors'){desiredYaw+=bot.aiTurnDir*(1.05+Math.sin(bot.aiPhase*3)*.32);}
      else if(bot.aiManeuver==='wide-turn'){desiredYaw+=bot.aiTurnDir*.42+weave;}
      else if(bot.aiManeuver==='attack-pass'){desiredYaw+=bot.aiTurnDir*.16+weave*.4;}
      else if(bot.aiManeuver==='barrel-bank'){desiredYaw+=Math.sin(bot.aiPhase*2.2)*.52;}
      else desiredYaw+=weave;
      if(dist<800&&bot.aiManeuver==='attack-pass')desiredYaw+=bot.aiTurnDir*.25;
      if(Math.abs(bot.p[0])>edge||Math.abs(bot.p[2])>edge){desiredYaw=Math.atan2(-bot.p[0],bot.p[2]);bot.aiTurnDir=bot.p[0]*Math.cos(bot.aiYaw)+bot.p[2]*Math.sin(bot.aiYaw)>0?-1:1;bot.aiManeuver='recover';bot.aiManeuverUntil=now+1700;}
      bot.aiYaw=Number.isFinite(bot.aiYaw)?bot.aiYaw:baseYaw;
      bot.aiPitch=Number.isFinite(bot.aiPitch)?bot.aiPitch:0;bot.aiRoll=Number.isFinite(bot.aiRoll)?bot.aiRoll:0;
      const turnRate=bot.aiManeuver==='break-turn'||bot.aiManeuver==='scissors'?2.15:1.35+(bot.aiSkill||.4)*.55;
      bot.aiYaw+=aiClamp(aiAngleDelta(bot.aiYaw,desiredYaw),-turnRate*dt,turnRate*dt);
      let desiredPitch=aiClamp(Math.atan2(dy,horizontal)*.48,-.34,.34);
      if(bot.aiManeuver==='climb')desiredPitch=Math.max(desiredPitch,.23+Math.sin(bot.aiPhase)*.08);
      else if(bot.aiManeuver==='dive')desiredPitch=Math.min(desiredPitch,-.2+Math.sin(bot.aiPhase)*.06);
      else if(bot.aiManeuver==='vertical-extension')desiredPitch=Math.sin(bot.aiPhase*1.6)*.34;
      else if(bot.aiManeuver==='recover')desiredPitch=aiClamp((850-bot.p[1])*.001,-.2,.2);
      bot.aiPitch+=aiClamp(desiredPitch-bot.aiPitch,-.58*dt,.58*dt);
      const bankTarget=aiClamp(-aiAngleDelta(bot.aiYaw,desiredYaw)*1.7,-.68,.68)+(bot.aiManeuver==='barrel-bank'?Math.sin(bot.aiPhase*4)*.52:0);
      bot.aiRoll+=aiClamp(bankTarget-bot.aiRoll,-1.8*dt,1.8*dt);
      bot.q=aiQuaternion(bot.aiYaw,bot.aiPitch,bot.aiRoll);
      const cp=Math.cos(bot.aiPitch),forward=[-Math.sin(bot.aiYaw)*cp,Math.sin(bot.aiPitch),-Math.cos(bot.aiYaw)*cp];
      const speed=bot.aiManeuver==='climb'?165:bot.aiManeuver==='dive'?205:dist<700?105:dist<1800?155:190;
      bot.p[0]=aiClamp(bot.p[0]+forward[0]*speed*dt,-6000,6000);
      bot.p[1]=aiClamp(bot.p[1]+forward[1]*speed*dt,360,1750);
      bot.p[2]=aiClamp(bot.p[2]+forward[2]*speed*dt,-6000,6000);
      dx=target.p[0]-bot.p[0];dy=target.p[1]-bot.p[1];dz=target.p[2]-bot.p[2];
      dist=Math.max(1,Math.hypot(dx,dy,dz));
      const facing=(forward[0]*dx+forward[1]*dy+forward[2]*dz)/dist;
      if(now>=bot.aiNextShot&&dist<3200&&facing>.36&&!(r.mode==='clash'&&now<(r.roundHiddenUntil||0))){
        const direction=[dx/dist,dy/dist,dz/dist];
        bot.shots=(bot.shots||0)+1;
        rcast(r,{t:'shot',p:bot.p.slice(),d:direction,by:bot.id,tid:target.id});
        const rangeFactor=Math.max(.2,1-dist/3900);
        if(Math.random()<bot.aiSkill*rangeFactor)damage(r,target.id,bot.id,25);
        bot.aiNextShot=now+(r.mode==='clash'?1000:760)+Math.random()*550;
      }
    }
  }
}

function broadcastGames(){
  const games=Object.values(rooms).filter(r=>r.state!=='over'&&Object.keys(r.players).length>0).map(r=>({roomId:r.code,mode:r.mode,state:r.state,players:list(r).length,teams:r.teamCount||2,lives:r.lives||1,host:r.players[r.host]?.n||'Host'}));
  const msg={t:'games',games};
  // Social sockets only need presence/friend messages; avoid pushing the game roster 20 times/sec to them.
  for(const client of wss.clients)if(!client.socialProfileId)send(client,msg);
}
wss.on('connection',ws=>{
  ws.isAlive=true;
  ws.on('pong',()=>{ws.isAlive=true});
  ws.on('error',e=>console.warn('MAYDAY WebSocket error:',e?.message||e));
  ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
    if(typeof m.t==='string'&&m.t.startsWith('social')){handleSocialMessage(ws,m);return}
    if(m.t==='leave'){removeMatchmakingEntry(ws,'cancelled','Search cancelled.');detachSocketFromRoom(ws);const leaver=socialStore.profiles[ws.profileId];if(leaver){leaver.status='lobby';leaver.roomCode='';leaver.mode='';leaver.roomState='';refreshSocialNeighborhood(leaver)}send(ws,{t:'left',ok:true});return}
    if(m.t==='matchmake'){queueForMatchmaking(ws,m);return}
    if(m.t==='matchmakeCancel'){if(!removeMatchmakingEntry(ws,'cancelled','Search cancelled.'))send(ws,{t:'matchmaking',status:'cancelled',mode:m.mode||'',message:'Search cancelled.'});return}
    if(ws.matchmakingEntry&&!['matchmake','matchmakeCancel'].includes(m.t))removeMatchmakingEntry(ws,'cancelled','Search cancelled.');
    let r=rooms[ws.room];
    if(m.t==='host'&&!r){
      r={code:mkCode(),mode:['ffa','clash','survivor'].includes(m.mode)?m.mode:'ffa',teamCount:2,maxPlayers:24,lives:1,host:null,state:'lobby',score:{},round:0,players:{},spectators:new Set(),timer:null};
      
      if(r.mode==='clash') for(const t of activeTeams(r)) r.score[t.id]=0;rooms[r.code]=r;
      let id;try{id=addPlayer(ws,r,m)}catch(e){delete rooms[r.code];return send(ws,{t:'err',m:'Could not create the room.'})}
      r.host=id;send(ws,{t:'welcome',id,code:r.code,roomId:r.code,mode:r.mode,session:r.players[id].sessionToken});rcast(r,info(r));broadcastGames();return}
    if(m.t==='join'&&!r){const requestedCode=String(m.roomId||m.code||'').toUpperCase().trim();
      if(m.inviteId)console.log(`[invite ${BUILD_VERSION}] game-join-request id=${String(m.inviteId).slice(0,8)} room=${requestedCode} profileAuthenticated=${!!authProfile(m.profileId,m.profileToken)}`);
      const rr=rooms[requestedCode];
      if(!rr){if(m.inviteId)console.warn(`[invite ${BUILD_VERSION}] join-rejected id=${String(m.inviteId).slice(0,8)} reason=no-room room=${requestedCode}`);return send(ws,{t:'err',m:'No active room with that Room ID.',inviteId:m.inviteId||null})}
      if(rr.state==='playing'||rr.state==='between'){
        ws.room=rr.code;ws.spectator=true;ws.spectatorRoom=rr.code;const spectatorIdentity=authProfile(m.profileId,m.profileToken);if(spectatorIdentity)ws.profileId=spectatorIdentity.id;rr.spectators.add(ws);
        send(ws,{t:'welcome',id:null,code:rr.code,mode:rr.mode,spectator:true,inviteId:m.inviteId||null});
        send(ws,{t:'spectate',mode:rr.mode,state:rr.state,round:rr.round,score:rr.score,spectator:true});
        send(ws,{t:'room',...info(rr)});
        send(ws,{t:'snap',players:snapshotOf(rr),score:rr.score,round:rr.round,state:rr.state});
        broadcastGames();
        return;
      }
      let id;try{id=addPlayer(ws,rr,m)}catch(e){if(e&&e.message==='ALL_COLORS_TAKEN')return send(ws,{t:'err',m:'All 20 pilot colors are currently taken in this room.'});return send(ws,{t:'err',m:'Could not join the room.'})}send(ws,{t:'welcome',id,code:rr.code,roomId:rr.code,mode:rr.mode,session:rr.players[id].sessionToken,inviteId:m.inviteId||null});
      rcast(rr,info(rr));broadcastGames();return}
    if((m.t==='reconnect'||m.t==='resume')&&!r){const rr=rooms[String(m.code||'').toUpperCase().trim()];
      const token=String(m.session||'');
      const candidate=rr&&Object.values(rr.players).find(p=>p.sessionToken===token);
      if(!rr||!candidate)return send(ws,{t:'err',m:'That MAYDAY match is no longer available for reconnect.'});
      if(candidate.connected&&candidate.ws&&candidate.ws!==ws){
        // The browser may have lost its transport while the server still considers
        // the old socket connected. A valid session token proves this reconnect is
        // the same pilot, so retire the stale socket and let the new one take over.
        try{candidate.ws.close(4001,'session resumed on a new connection')}catch(e){try{candidate.ws.terminate()}catch{}}
      }
      clearTimeout(candidate.reconnectTimer);candidate.reconnectTimer=null;candidate.ws=ws;candidate.connected=true;candidate.disconnectedAt=0;ws.id=candidate.id;ws.room=rr.code;ws.sessionToken=candidate.sessionToken;ws.profileId=candidate.profileId||null;
      send(ws,{t:'welcome',id:candidate.id,code:rr.code,roomId:rr.code,mode:rr.mode,session:candidate.sessionToken,resumed:true});
      send(ws,{t:'resume',mode:rr.mode,state:rr.state,round:rr.round,score:rr.score,lives:rr.lives||1,alive:candidate.alive,eliminated:candidate.eliminated});
      rcast(rr,info(rr));return}
    if(!r)return;const id=ws.id,me=r.players[id];if(ws.spectator)return; if(!me||me.ws!==ws)return;
    if(m.t==='type'&&r.state==='lobby'){
      const ty=HP[m.ty]?m.ty:null;
      if(!ty)return send(ws,{t:'err',m:'Unknown aircraft type.'});
      me.ty=ty;me.mh=HP[ty];me.hp=HP[ty];
      rcast(r,info(r));
    }
    else     if(m.t==='setlives'&&id===r.host&&r.mode==='survivor'&&r.state==='lobby'){r.lives=Math.min(5,Math.max(1,Number(m.lives)||1));for(const p of list(r))p.livesRemaining=r.lives;rcast(r,info(r))}
    else if(m.t==='color'&&isFFA(r)&&(r.state==='lobby'||r.state==='between')){const c=COLOR_BY_ID[m.colorId];if(!c)return send(ws,{t:'err',m:'Unknown color.'});const taken=list(r).some(p=>p.id!==id&&p.colorId===c.id);if(taken)return send(ws,{t:'err',m:'That color is already taken.'});me.colorId=c.id;me.color=c.color;rcast(r,info(r))}
    else if(m.t==='setmaxplayers'&&id===r.host&&!r.quickMatch&&(r.state==='lobby'||r.state==='between')){
      const next=Math.min(24,Math.max(2,Number(m.maxPlayers)||24));
      if(next<list(r).length)return send(ws,{t:'err',m:'Maximum players cannot be lower than the current room size.'});
      r.maxPlayers=next;rcast(r,info(r))
    }
    else if(m.t==='setteams'&&id===r.host&&r.mode==='clash'&&(r.state==='lobby'||r.state==='between')){
      const next=Math.min(6,Math.max(2,Number(m.teamCount)||2));
      if(next!==r.teamCount){
        r.teamCount=next;
        const valid=teamIds(r);
        for(const p of list(r)){
          if(!valid.includes(p.team)){
            const counts=Object.fromEntries(valid.map(t=>[t,list(r).filter(x=>x.team===t).length]));
            p.team=valid.slice().sort((a,b)=>counts[a]-counts[b])[0];
          }
        }
        const nextScore={};for(const t of valid)nextScore[t]=r.score[t]||0;r.score=nextScore;
      }
      rcast(r,info(r))
    }
    else if(m.t==='team'&&r.mode==='clash'&&teamIds(r).includes(m.team)&&(r.state==='lobby'||r.state==='between')){me.team=m.team;rcast(r,info(r));broadcastGames()}
    else if(m.t==='start'&&id===r.host&&r.state==='lobby'){
      if(list(r).length<2)return send(ws,{t:'err',m:'At least 2 pilots are required to start this mode.'});
      if(r.mode==='clash'){const n=t=>list(r).filter(p=>p.team===t).length;const missing=teamIds(r).filter(t=>n(t)<1);
        if(missing.length)return send(ws,{t:'err',m:`Each team needs at least one player. Missing: ${missing.map(t=>TEAMNAME[t]).join(', ')}`});
        r.score={};for(const t of teamIds(r))r.score[t]=0;r.round=0;startRound(r);broadcastGames()}
      else if(r.mode==='survivor'){r.score={};r.round=0;for(const p of list(r)){p.sc=0;p.kills=0;p.deaths=0;p.damage=0;p.shieldUses=0;p.livesRemaining=r.lives||1;p.eliminated=false}startRound(r);broadcastGames()}
      else{list(r).forEach(p=>{p.sc=0;p.kills=0;p.deaths=0;p.damage=0;p.shieldUses=0});r.score={};r.round=0;startRound(r);broadcastGames()}}
    else if(m.t==='again'&&id===r.host&&r.state==='over'){r.state='lobby';r.score={};if(r.mode==='clash')for(const t of teamIds(r))r.score[t]=0;if(r.mode==='survivor')for(const p of list(r))p.livesRemaining=r.lives||1;r.round=0;for(const p of list(r)){p.alive=false;p.inRound=false;p.sc=0;p.kills=0;p.deaths=0;p.damage=0;p.shieldUses=0;p.eliminated=false}rcast(r,info(r))}
    else if(m.t==='s'){if(me.alive){me.p=m.p;me.q=m.q}}
    else if(m.t==='quickalert'){
      const now=Date.now();
      if(r.mode!=='clash'||r.state!=='playing')return send(ws,{t:'quickalertsent',ok:false,message:'MAYDAY alert is available during a live Clash Squad round.'});
      const wait=5000-(now-(me.lastQuickAlertAt||0));
      if(wait>0)return send(ws,{t:'quickalertsent',ok:false,message:`Wait ${Math.ceil(wait/1000)}s before sending another alert.`});
      me.lastQuickAlertAt=now;
      // Broadcast the discreet MAYDAY signal room-wide: all teams and spectators.
      // The notification intentionally contains no sender name or team information.
      rcast(r,{t:'quickalert'});
      send(ws,{t:'quickalertsent',ok:true});
    }
    else if(m.t==='shoot'){const now=Date.now(),d=Array.isArray(m.d)&&m.d.length===3?m.d.map(Number):null,mag=d?Math.hypot(...d):0;if(me.connected&&me.alive&&r.state==='playing'&&d&&d.every(Number.isFinite)&&Number.isFinite(mag)&&mag>.5&&mag<5000&&!(r.mode==='clash'&&now<(r.roundHiddenUntil||0))){const unit=d.map(x=>x/mag);me.shots=(me.shots||0)+1;me.recentShots=(me.recentShots||[]).filter(x=>now-x.at<3500);me.recentShots.push({at:now,d:unit,p:Array.isArray(m.p)&&m.p.length===3&&m.p.every(Number.isFinite)?m.p.map(Number):me.p.slice()});if(me.recentShots.length>12)me.recentShots.shift();rcast(r,{t:'shot',p:m.p,d:unit,by:id,tid:m.tid||null},ws)}}
    else if(m.t==='mfire'){const t=r.players[Number(m.tid)];const now=Date.now();const dist=t&&t.p&&me.p?Math.hypot(me.p[0]-t.p[0],me.p[1]-t.p[1],me.p[2]-t.p[2]):Infinity;const sameTeam=t&&t.team===me.team;const valid=t&&t.connected&&t.alive&&!sameTeam&&dist<=MISSILE_RANGE&&me.lockTarget===t.id&&now-me.lockSince>=3000;if(me.connected&&me.alive&&r.state==='playing'&&valid&&!(r.mode==='clash'&&now<(r.roundHiddenUntil||0))){me.missiles=(me.missiles||0)+1;me.recentMissileTargets=(me.recentMissileTargets||[]).filter(x=>now-x.at<15000);me.recentMissileTargets.push({targetId:t.id,at:now});if(me.recentMissileTargets.length>4)me.recentMissileTargets.shift();rcast(r,{t:'mfire',p:m.p,d:m.d,tid:m.tid,by:id},ws);me.lockTarget=null;me.lockSince=0;me.lockLastAt=0}else if(me.connected)send(ws,{t:'err',m:'Missile launch rejected: target is out of lock range or lock is not stable.'})}
    else if(m.t==='mfire'){const t=r.players[Number(m.tid)];const now=Date.now();const dist=t&&t.p&&me.p?Math.hypot(me.p[0]-t.p[0],me.p[1]-t.p[1],me.p[2]-t.p[2]):Infinity;const sameTeam=t&&t.team===me.team;const valid=t&&t.connected&&t.alive&&!sameTeam&&dist<=MISSILE_RANGE&&me.lockTarget===t.id&&now-me.lockSince>=3000;if(me.connected&&me.alive&&r.state==='playing'&&valid&&!(r.mode==='clash'&&now<(r.roundHiddenUntil||0))){me.missiles=(me.missiles||0)+1;me.recentMissileTargets=(me.recentMissileTargets||[]).filter(x=>now-x.at<15000);me.recentMissileTargets.push({targetId:t.id,at:now});if(me.recentMissileTargets.length>4)me.recentMissileTargets.shift();rcast(r,{t:'mfire',p:m.p,d:m.d,tid:m.tid,by:id},ws);me.lockTarget=null;me.lockSince=0;me.lockLastAt=0}else if(me.connected)send(ws,{t:'err',m:'Missile launch rejected: target is out of lock range or lock is not stable.'})}
    else if(m.t==='shield'){if(me.connected&&r.mode==='clash'&&r.state==='playing'&&me.alive&&me.shields>0&&Date.now()>me.shieldUntil){me.shields--;me.shieldUses=(me.shieldUses||0)+1;me.shieldUntil=Date.now()+7000;rcast(r,{t:'shield',id, n:me.shields,until:me.shieldUntil},null)}}
    else if(m.t==='flare'){if(me.connected&&me.alive&&r.state==='playing'&&(me.flares||0)>0){me.flares--;rcast(r,{t:'flare',id,p:m.p},ws)}}
    else if(m.t==='botHit'){
      if(!me.connected||!me.alive||r.state!=='playing')return;
      const victim=r.players[Number(m.id)],now=Date.now();
      if(!victim||victim.ai!==true||victim.connected===false||!victim.alive||victim.team===me.team||!Array.isArray(victim.p))return;
      if(r.mode==='clash'&&now<(r.roundHiddenUntil||0))return;
      if(m.weapon==='missile'){
        const launches=me.recentMissileTargets||[];
        const launchIndex=launches.findIndex(x=>x.targetId===victim.id&&now-x.at<=15000);
        if(launchIndex<0)return;
        launches.splice(launchIndex,1);
        damage(r,victim.id,me.id,50);
        return;
      }
      const shots=me.recentShots||[];
      const shotIndex=shots.findIndex(shot=>{
        if(now-shot.at>3500||!Array.isArray(shot.p)||!Array.isArray(shot.d))return false;
        const delta=victim.p.map((x,i)=>x-shot.p[i]),dist=Math.hypot(...delta);
        if(!Number.isFinite(dist)||dist<1||dist>6500)return false;
        const aim=delta.map(x=>x/dist),dot=shot.d.reduce((sum,x,i)=>sum+x*aim[i],0);
        const along=delta.reduce((sum,x,i)=>sum+x*shot.d[i],0);
        const miss=Math.hypot(...delta.map((x,i)=>x-shot.d[i]*along));
        return dot>=0.62&&along>0&&miss<180;
      });
      if(shotIndex<0)return;
      shots.splice(shotIndex,1);
      damage(r,victim.id,me.id,25);
    }
    else if(m.t==='hit'){
      if(!me.connected||!me.alive||r.state!=='playing')return;
      const victim=r.players[Number(m.id)],now=Date.now();
      if(!victim||!victim.p||!me.p)return;
      const delta=victim.p.map((x,i)=>x-me.p[i]),dist=Math.hypot(...delta);
      if(!Number.isFinite(dist)||dist>6500||dist<1)return;
      const aim=delta.map(x=>x/dist),shots=(me.recentShots||[]);
      const shotIndex=shots.findIndex(shot=>now-shot.at<=3500&&shot.d.reduce((sum,x,i)=>sum+x*aim[i],0)>=0.45);
      if(shotIndex<0)return;
      shots.splice(shotIndex,1);damage(r,victim.id,id,25);
    }
    else if(m.t==='mhit'){
      if(!me.connected||!me.alive||r.state!=='playing')return;
      const attacker=r.players[Number(m.by)],now=Date.now();
      if(!attacker||!attacker.connected||attacker.team===me.team)return;
      const launches=attacker.recentMissileTargets||[];
      const launchIndex=launches.findIndex(x=>x.targetId===me.id&&now-x.at<=15000);
      if(launchIndex<0)return;
      launches.splice(launchIndex,1);damage(r,id,attacker.id,50);
    }
    else if(m.t==='crash'){if(me.connected&&me.alive&&r.state==='playing'&&Date.now()>me.prot+1000){if(r.mode==='ffa')ffaCrash(r,me);else if(r.mode==='survivor')survivorKill(r,me,null,id,null,true);else kill(r,id,null)}}
    else if(m.t==='lock'){
      const now=Date.now();
      const clearCurrentLock=()=>{
        if(me.lockTarget!==null&&me.lockTarget!==undefined){const oldTarget=r.players[me.lockTarget];if(oldTarget?.ws)send(oldTarget.ws,{t:'locklost',by:id})}
        me.lockTarget=null;me.lockSince=0;me.lockLastAt=0;
      };
      if(m.id===null||m.id===undefined||!Number.isFinite(Number(m.id))){clearCurrentLock();return}
      const t=r.players[Number(m.id)],dist=t&&t.p&&me.p?Math.hypot(me.p[0]-t.p[0],me.p[1]-t.p[1],me.p[2]-t.p[2]):Infinity;
      const valid=me.connected&&me.alive&&t&&t.connected&&t.alive&&t.id!==id&&t.team!==me.team&&dist<=LOCK_RANGE&&r.state==='playing'&&!(r.mode==='clash'&&now<(r.roundHiddenUntil||0));
      if(!valid){clearCurrentLock();return}
      // If the client stopped sending lock heartbeats, the lock was broken even if it later reacquires the same target.
      if(me.lockTarget!==t.id||!me.lockLastAt||now-me.lockLastAt>LOCK_HEARTBEAT_TIMEOUT){
        if(me.lockTarget!==null&&me.lockTarget!==undefined){const oldTarget=r.players[me.lockTarget];if(oldTarget?.ws)send(oldTarget.ws,{t:'locklost',by:id})}
        me.lockSince=now;
      }
      me.lockTarget=t.id;me.lockLastAt=now;
      if(now-me.lockSince>=LOCK_DURATION)send(t.ws,{t:'locked',by:id,n:me.n,c:colOf(r,me)});
    }
  });
  ws.on('close',(code,reason)=>{if(ws.matchmakingEntry)removeMatchmakingEntry(ws,'cancelled','Connection closed.');if(ws.socialProfileId&&socialSockets.get(ws.socialProfileId)===ws){socialSockets.delete(ws.socialProfileId);const sp=socialStore.profiles[ws.socialProfileId];if(sp){sp.status='offline';sp.roomCode='';sp.mode='';sp.roomState='';refreshSocialNeighborhood(sp)}}const r=rooms[ws.room];if(!r)return;if(ws.spectator){r.spectators?.delete(ws);return;}const p=r.players[ws.id];if(!p||p.ws!==ws)return;
    const explicitLeave=code===1000&&String(reason||'')==='left room';
    if(explicitLeave){
      delete r.players[ws.id];clearTimeout(p.reconnectTimer);
      if(!hasHumanPlayers(r)){clearTimeout(r.timer);for(const p of list(r)){clearTimeout(p.respawnTimer);clearTimeout(p.reconnectTimer)}delete rooms[r.code];broadcastGames();return}
      if(r.host===ws.id)r.host=+Object.keys(r.players)[0];
      rcast(r,info(r));if(r.state==='playing')checkRound(r);broadcastGames();return;
    }
    // Unexpected disconnect: keep the player's full session for 10 minutes so a tab close, refresh,
    // browser crash, or accidental navigation does not permanently remove them from the room.
    p.ws=null;p.connected=false;p.disconnectedAt=Date.now();clearTimeout(p.reconnectTimer);
    // In Clash Squad, an offline aircraft cannot be hit by server-authoritative
    // damage, so eliminate it from this round immediately and re-check the winner.
    if(r.mode==='clash'&&r.state==='playing'){p.alive=false;p.inRound=false;p.hp=0;p.lockTarget=null;p.lockSince=0;p.lockLastAt=0;checkRound(r)}else if(r.mode==='survivor'&&r.state==='playing'){checkSurvivor(r)}
    p.reconnectTimer=setTimeout(()=>{const cur=rooms[r.code]?.players[p.id];if(!cur||cur.connected)return;delete r.players[p.id];
      if(!hasHumanPlayers(r)){clearTimeout(r.timer);for(const pl of list(r)){clearTimeout(pl.respawnTimer);clearTimeout(pl.reconnectTimer)}delete rooms[r.code];broadcastGames();return}
      if(r.host===p.id)r.host=+Object.keys(r.players)[0];rcast(r,info(r));if(r.state==='playing')checkRound(r);broadcastGames();
    },RECONNECT_GRACE);
    rcast(r,info(r));broadcastGames();});
});
// Keep game snapshots frequent, but send the lightweight room-list refresh once per second.
const matchmakingTimer=setInterval(()=>processMatchmakingQueues(),500);
const aiTimer=setInterval(runAIPilots,100);
aiTimer.unref?.();
const snapshotTimer=setInterval(()=>{for(const r of Object.values(rooms)){if(r.state==='playing'&&r.mode==='clash')checkRound(r);if(r.state!=='playing'&&r.state!=='between')continue;
  const players={};for(const k in r.players)players[k]=pub(r,r.players[k]);rcast(r,{t:'snap',players,score:r.score,round:r.round,state:r.state})}},50);
const roomListTimer=setInterval(broadcastGames,1000);
// Render and other internet hosts may close idle connections; ping clients so dead sockets are detected.
const heartbeatTimer=setInterval(()=>{for(const client of wss.clients){if(client.isAlive===false){client.terminate();continue}client.isAlive=false;try{client.ping()}catch{client.terminate()}}},25000);
heartbeatTimer.unref?.();roomListTimer.unref?.();snapshotTimer.unref?.();
let shuttingDown=false;
function shutdown(signal){if(shuttingDown)return;shuttingDown=true;console.log(`MAYDAY ${signal}: shutting down gracefully`);clearInterval(heartbeatTimer);clearInterval(roomListTimer);clearInterval(snapshotTimer);clearInterval(matchmakingTimer);clearInterval(aiTimer);for(const client of wss.clients){try{send(client,{t:'serverRestarting',message:'MAYDAY server is restarting. Active rooms will end; reconnect after it is back.'});client.close(1012,'service restart')}catch{try{client.terminate()}catch{}}}const force=setTimeout(()=>{for(const client of wss.clients)try{client.terminate()}catch{}process.exit(0)},8000);force.unref?.();server.close(()=>{clearTimeout(force);process.exit(0)})}
process.on('SIGTERM',()=>shutdown('SIGTERM'));process.on('SIGINT',()=>shutdown('SIGINT'));
server.listen(PORT,'0.0.0.0',()=>{
  console.log(`\nMAYDAY ${BUILD_VERSION} (Dogfight + Clash Squad + Survivor) running!\n  You:      http://localhost:${PORT}\n  Health:   http://localhost:${PORT}/healthz\n  Version:  http://localhost:${PORT}/api/version\n  Data dir: ${SOCIAL_DIR}`);
  if(!process.env.MAYDAY_DATA_DIR)console.log('  Storage: local ./data directory (configure MAYDAY_DATA_DIR for a persistent cloud volume)');
  for(const l of Object.values(os.networkInterfaces()))for(const i of l)if(i.family==='IPv4'&&!i.internal)console.log(`  Friend:   http://${i.address}:${PORT}  (same Wi-Fi/network)`);
});
