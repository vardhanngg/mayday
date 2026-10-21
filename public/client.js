const MAYDAY_BUILD='v64.0-online-ready';
function inviteDebug(stage,details=''){console.info(`[MAYDAY ${MAYDAY_BUILD}][invite] ${stage}`,details)}

try{const S=JSON.parse(localStorage.getItem('fb')||'{}');if(S.n)document.getElementById('name').value=S.n;if(S.inv)document.getElementById('inv').checked=true;if(S.t)document.getElementById('ptype').value=S.t;['sp','sr','sy'].forEach(k=>{if(S[k])document.getElementById(k).value=S[k]})}catch(e){}
const T=THREE,SIZE=14000,N=170,CELL=SIZE/N;
const TOUCH_DEVICE=('ontouchstart' in window)||navigator.maxTouchPoints>0||matchMedia('(pointer:coarse)').matches;
function h2(x,y){let n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n)}
function vn(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
 return h2(xi,yi)*(1-u)*(1-v)+h2(xi+1,yi)*u*(1-v)+h2(xi,yi+1)*(1-u)*v+h2(xi+1,yi+1)*u*v}
function height(x,z){let a=1,f=0.00035,s=0,t=0;for(let i=0;i<5;i++){s+=vn(x*f,z*f)*a;t+=a;a*=.5;f*=2.1}return Math.max((s/t-0.42)*1900,-20)}
const scene=new T.Scene();scene.background=new T.Color(0x7eb7e2);scene.fog=new T.Fog(0xb9d8ec,6000,18500);
const cam=new T.PerspectiveCamera(65,innerWidth/innerHeight,0.5,20000);
const ren=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});ren.setSize(innerWidth,innerHeight);ren.setPixelRatio(Math.min(devicePixelRatio,TOUCH_DEVICE?1.25:1.75));ren.shadowMap.enabled=true;ren.shadowMap.type=T.PCFSoftShadowMap;ren.outputEncoding=T.sRGBEncoding;ren.toneMapping=T.ACESFilmicToneMapping;ren.toneMappingExposure=1.16;document.body.appendChild(ren.domElement);
const hemi=new T.HemisphereLight(0xcfe8ff,0x344334,1.0);scene.add(hemi);
const sun=new T.DirectionalLight(0xfff1d6,1.85);sun.position.set(-3200,5600,-2200);sun.castShadow=true;sun.shadow.mapSize.set(TOUCH_DEVICE?1024:2048,TOUCH_DEVICE?1024:2048);sun.shadow.camera.left=-900;sun.shadow.camera.right=900;sun.shadow.camera.top=900;sun.shadow.camera.bottom=-900;sun.shadow.camera.near=100;sun.shadow.camera.far=14000;sun.shadow.normalBias=.6;scene.add(sun.target);sun.shadow.bias=-.0002;scene.add(sun);
const fill=new T.DirectionalLight(0x86c3ff,.38);fill.position.set(2200,1800,2800);scene.add(fill);
const sky=new T.Mesh(new T.SphereGeometry(10000,48,24),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{top:{value:new T.Color(0x4a88c2)},mid:{value:new T.Color(0x8fc5ea)},horizon:{value:new T.Color(0xe7f1f7)}},vertexShader:`varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`uniform vec3 top;uniform vec3 mid;uniform vec3 horizon;varying vec3 vWorld;void main(){float h=normalize(vWorld).y;float t=smoothstep(-.18,.32,h);vec3 c=mix(horizon,mid,t);c=mix(c,top,smoothstep(.25,.95,h));gl_FragColor=vec4(c,1.0);}` }));scene.add(sky);
const tg=new T.PlaneGeometry(SIZE,SIZE,N,N);tg.rotateX(-Math.PI/2);
tg.setAttribute('color',new T.BufferAttribute(new Float32Array(tg.attributes.position.count*3),3));
const terrain=new T.Mesh(tg,new T.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:.02}));terrain.receiveShadow=true;terrain.castShadow=false;scene.add(terrain);
let tcx=1e9,tcz=1e9;
function updateTerrain(px,pz){const cx=Math.round(px/CELL)*CELL,cz=Math.round(pz/CELL)*CELL;
 if(cx===tcx&&cz===tcz)return;tcx=cx;tcz=cz;terrain.position.set(cx,0,cz);
 const p=tg.attributes.position,c=tg.attributes.color;
 for(let i=0;i<p.count;i++){const y=height(cx+p.getX(i),cz+p.getZ(i));p.setY(i,y)}
 tg.computeVertexNormals();const n=tg.attributes.normal;
 for(let i=0;i<p.count;i++){const y=p.getY(i),slope=1-Math.max(0,n.getY(i));let r,g,b;
  if(y<2){r=.62;g=.72;b=.78}else if(y<14){const k=Math.min(1,(y-2)/12);r=.75-.08*k;g=.68-.03*k;b=.46+.07*k}else if(y<360){const k=y/360;r=.15+.17*k;g=.34+.2*k;b=.11+.08*k;if(slope>.72){r=.30;g=.29;b=.27}}else if(y<760){const k=(y-360)/400;r=.34+.15*k;g=.33+.12*k;b=.30+.08*k;if(slope>.48){r+=.12;g+=.11;b+=.10}}else{const k=Math.min(1,(y-760)/700);r=.82+.12*k;g=.83+.12*k;b=.84+.12*k}
  const micro=(h2(i,7)-.5)*.045+(h2(i*3+11,19)-.5)*.025;const shade=1-Math.min(.18,slope*.22);c.setXYZ(i,Math.max(0,Math.min(1,(r+micro)*shade)),Math.max(0,Math.min(1,(g+micro)*shade)),Math.max(0,Math.min(1,(b+micro)*shade)))}
 p.needsUpdate=c.needsUpdate=true}
const waterGeo=new T.PlaneGeometry(SIZE*1.35,SIZE*1.35,32,32);waterGeo.rotateX(-Math.PI/2);
const water=new T.Mesh(waterGeo,new T.MeshStandardMaterial({color:0x1f679d,transparent:true,opacity:.72,roughness:.16,metalness:.12,depthWrite:false}));water.receiveShadow=false;scene.add(water);
// Readable 3D cloud banks: layered low-poly puffs instead of flat sprites.
const clouds=[],cloudTop=new T.MeshStandardMaterial({color:0xf4f8fb,roughness:1,metalness:0}),cloudBottom=new T.MeshStandardMaterial({color:0xc6d3df,roughness:1,metalness:0}),R=12000;
for(let i=0;i<44;i++){const m=new T.Group();const puffs=5+Math.floor(Math.random()*4);for(let j=0;j<puffs;j++){const sp=new T.Mesh(new T.SphereGeometry(1,12,8),j%4===0?cloudBottom:cloudTop);sp.position.set((Math.random()-.5)*360,(Math.random()-.5)*95,(Math.random()-.5)*240);const sx=170+Math.random()*260,sy=90+Math.random()*85,sz=140+Math.random()*220;sp.scale.set(sx,sy,sz);sp.rotation.y=Math.random()*Math.PI;m.add(sp)}m.userData={x:Math.random()*R,z:Math.random()*R,y:900+Math.random()*1450,drift:(Math.random()-.5)*1.4};m.traverse(o=>{if(o.isMesh){o.frustumCulled=true}});scene.add(m);clouds.push(m)}
function cloudBlocksSight(a,b){const dir=b.clone().sub(a),len2=dir.lengthSq();if(len2<1)return false;for(const c of clouds){const ctr=c.position.clone();const t=Math.max(0,Math.min(1,ctr.clone().sub(a).dot(dir)/len2));const p=a.clone().addScaledVector(dir,t),dx=(p.x-ctr.x)/390,dy=(p.y-ctr.y)/155,dz=(p.z-ctr.z)/350;if((dx*dx+dy*dy+dz*dz)<=1)return true}return false}

// Distant sun disk adds depth without a heavy skybox.
const sunDiskTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g=x.createRadialGradient(64,64,6,64,64,64);g.addColorStop(0,'rgba(255,250,225,1)');g.addColorStop(.32,'rgba(255,242,195,.55)');g.addColorStop(1,'rgba(255,240,190,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new T.CanvasTexture(c)})();
const sunSprite=new T.Sprite(new T.SpriteMaterial({map:sunDiskTex,transparent:true,depthWrite:false,depthTest:false}));sunSprite.scale.set(900,900,1);sunSprite.position.set(-7000,5300,-5200);scene.add(sunSprite);
// Subtle high-altitude particles give the sky scale and motion.
const skyDust=new T.Points(new T.BufferGeometry(),new T.PointsMaterial({color:0xd6ecff,size:5,sizeAttenuation:true,transparent:true,opacity:.22,depthWrite:false}));const sd=[];for(let i=0;i<650;i++){sd.push((Math.random()-.5)*14000,1200+Math.random()*5200,(Math.random()-.5)*14000)}skyDust.geometry.setAttribute('position',new T.Float32BufferAttribute(sd,3));scene.add(skyDust);
// plane factory
const L=c=>new T.MeshLambertMaterial({color:c});
const PT={fighter:{hp:75,spd:1.15,turn:1.3,sz:1.8},balanced:{hp:100,spd:1,turn:1,sz:2},heavy:{hp:150,spd:.88,turn:.75,sz:2.4},interceptor:{hp:90,spd:1.34,turn:1.1,sz:1.72},striker:{hp:175,spd:.82,turn:.7,sz:2.5}};
function makePlane(color,type){const g=new T.Group();g.userData.aircraftType=type;const m=new T.MeshStandardMaterial({color,roughness:.34,metalness:.12}),dark=new T.MeshStandardMaterial({color:0x1c2731,roughness:.3,metalness:.3}),glass=new T.MeshPhysicalMaterial({color:0x234a66,roughness:.07,metalness:.05,transparent:true,opacity:.9});
 const fus=new T.Mesh(new T.CylinderGeometry(.58,.72,7.0,16),m);fus.rotation.x=Math.PI/2;fus.position.z=.15;g.add(fus);const fusN=new T.Mesh(new T.SphereGeometry(.69,16,10),m);fusN.scale.z=1.5;fusN.position.z=-3.35;g.add(fusN);const fusT=new T.Mesh(new T.SphereGeometry(.58,16,10),m);fusT.scale.z=1.35;fusT.position.z=3.45;g.add(fusT);
 const nose=new T.Mesh(new T.ConeGeometry(.74,3.1,16),m);nose.rotation.x=-Math.PI/2;nose.position.z=-4.55;g.add(nose);
 // Separate left/right wings with thickness so both surfaces and both sides remain visible from any camera angle.
 const wingL=new T.Mesh(new T.BoxGeometry(5.4,.24,2.55),m);wingL.position.set(-3.0,.02,-.45);wingL.rotation.y=-.07;g.add(wingL);
 const wingR=new T.Mesh(new T.BoxGeometry(5.4,.24,2.55),m);wingR.position.set(3.0,.02,-.45);wingR.rotation.y=.07;g.add(wingR);
 const rootL=new T.Mesh(new T.BoxGeometry(1.9,.3,1.8),dark);rootL.position.set(-1.25,-.08,-.25);g.add(rootL);const rootR=rootL.clone();rootR.position.x=1.25;g.add(rootR);
 const tailL=new T.Mesh(new T.BoxGeometry(2.05,.18,1.45),m);tailL.position.set(-1.05,.15,3.45);g.add(tailL);const tailR=tailL.clone();tailR.position.x=1.05;g.add(tailR);
 const fin=new T.Mesh(new T.BoxGeometry(.18,2.35,1.55),m);fin.position.set(0,.95,3.55);fin.rotation.z=.06;g.add(fin);
 const canopy=new T.Mesh(new T.SphereGeometry(.72,16,12),glass);canopy.position.set(0,.72,-1.45);canopy.scale.set(.82,.55,1.45);g.add(canopy);
 const frame=new T.Mesh(new T.BoxGeometry(.08,.72,1.9),dark);frame.position.set(0,.7,-1.45);g.add(frame);
 const intakeL=new T.Mesh(new T.BoxGeometry(.5,.34,1.2),dark);intakeL.position.set(-.9,-.28,-.8);g.add(intakeL);const intakeR=intakeL.clone();intakeR.position.x=.9;g.add(intakeR);
 const exhaustL=new T.Mesh(new T.CylinderGeometry(.34,.46,1.1,12),dark);exhaustL.rotation.x=Math.PI/2;exhaustL.position.set(-.5,0,3.9);g.add(exhaustL);const exhaustR=exhaustL.clone();exhaustR.position.x=.5;g.add(exhaustR);
 const egMat=new T.MeshBasicMaterial({color:0x7dd6ff,transparent:true,opacity:.55,blending:T.AdditiveBlending,depthWrite:false});const egL=new T.Mesh(new T.ConeGeometry(.24,1.0,12),egMat);egL.rotation.x=Math.PI/2;egL.position.set(-.5,0,4.48);g.add(egL);const egR=egL.clone();egR.position.x=.5;g.add(egR);
 const p=new T.Mesh(new T.CylinderGeometry(.11,.15,1.8,12),dark);p.rotation.z=Math.PI/2;p.position.set(0,.04,4.98);g.add(p);
 const navL=new T.Mesh(new T.SphereGeometry(.13,8,6),new T.MeshBasicMaterial({color:0x4fb6ff}));navL.position.set(-4.95,.06,.15);g.add(navL);const navR=new T.Mesh(new T.SphereGeometry(.13,8,6),new T.MeshBasicMaterial({color:0xff554b}));navR.position.set(4.95,.06,.15);g.add(navR);
 const sh=new T.Mesh(new T.SphereGeometry(7.5,20,14),new T.MeshBasicMaterial({color:0x6bd5ff,transparent:true,opacity:.16,wireframe:true,depthWrite:false}));sh.visible=false;g.add(sh);
 if(type==='interceptor'){wingL.scale.set(.70,1,.72);wingR.scale.set(.70,1,.72);tailL.scale.set(.72,1,.72);tailR.scale.set(.72,1,.72);fin.scale.set(1,.78,.82);canopy.scale.set(.72,.5,1.25)}
 if(type==='striker'){wingL.scale.set(1.22,1,1.12);wingR.scale.set(1.22,1,1.12);tailL.scale.set(1.12,1,1.0);tailR.scale.set(1.12,1,1.0);fin.scale.set(1,1.18,1.04);fus.scale.set(1.08,1,1.12);fusN.scale.set(1.08,1,1.08)}
 g.userData.shield=sh;g.userData.prop=p;g.userData.glow={left:navL,right:navR};g.userData.engGlow=[egL,egR];g.scale.setScalar((PT[type]||PT.balanced).sz);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});scene.add(g);return g}


// WORLD: airports, cities, infrastructure, islands, naval units and a carrier.
const world=new T.Group();world.name='World';scene.add(world);
const wm={
 runwayGreen:new T.MeshBasicMaterial({color:0x35ff7a}),
 runway:new T.MeshStandardMaterial({color:0x2e3338,roughness:.88,metalness:.04}),
 concrete:new T.MeshStandardMaterial({color:0x9aa1a6,roughness:.82,metalness:.02}),
 white:new T.MeshBasicMaterial({color:0xf5f5f0}),
 yellow:new T.MeshBasicMaterial({color:0xffd34e}),
 road:new T.MeshStandardMaterial({color:0x25282b,roughness:.9}),
 building:new T.MeshStandardMaterial({color:0x78828d,roughness:.76,metalness:.08}),
 building2:new T.MeshStandardMaterial({color:0x5d6771,roughness:.8,metalness:.05}),
 roof:new T.MeshStandardMaterial({color:0x3f4b55,roughness:.75,metalness:.18}),
 glass:new T.MeshStandardMaterial({color:0x5e91b0,roughness:.18,metalness:.15}),
 water:new T.MeshStandardMaterial({color:0x2b79a8,roughness:.22,metalness:.1}),
 sand:new T.MeshStandardMaterial({color:0xb8a16b,roughness:1}),
 grass:new T.MeshStandardMaterial({color:0x3e6e42,roughness:1}),
 carrier:new T.MeshStandardMaterial({color:0x30373c,roughness:.72,metalness:.36}),
 carrierDeck:new T.MeshStandardMaterial({color:0x596167,roughness:.72,metalness:.2}),
 dark:new T.MeshStandardMaterial({color:0x1c2226,roughness:.4,metalness:.5}),
 shipWhite:new T.MeshStandardMaterial({color:0xd8dde0,roughness:.7,metalness:.18})
};
const worldBases={blue:null,red:null,central:null};
const landingStrips=[];
const runwayLights=[];
const solidVolumes=[];
function addSolidVolume(x,z,r,base,top){solidVolumes.push({x,z,r,base,top})}
function segPointDist2(px,pz,ax,az,bx,bz){const vx=bx-ax,vz=bz-az,wx=px-ax,wz=pz-az,dd=vx*vx+vz*vz;if(dd<1e-9)return wx*wx+wz*wz;const t=Math.max(0,Math.min(1,(wx*vx+wz*vz)/dd));const dx=px-(ax+t*vx),dz=pz-(az+t*vz);return dx*dx+dz*dz}
function solidHit(x,z,y,px,pz,py){for(const o of solidVolumes){if(Math.min(y,py)>o.top+24||Math.max(y,py)<o.base-20)continue;if(segPointDist2(o.x,o.z,px,pz,x,z)<(o.r+20)*(o.r+20))return o}return null}

const waterSites=[];
const rseed=n=>{const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x)};
function flatSite(px,pz,rad=1800){let best=null,bestScore=1e9;for(let ix=-6;ix<=6;ix++)for(let iz=-5;iz<=5;iz++){
 const x=px+ix*rad/6,z=pz+iz*rad/5,y=height(x,z),dx=height(x+45,z)-height(x-45,z),dz=height(x,z+45)-height(x,z-45),s=Math.hypot(dx,dz)/90;
 const score=s*520+Math.abs(y-220)*.08+Math.hypot(x-px,z-pz)*.018;
 if(s<0.52&&score<bestScore){bestScore=score;best={x,z,y}}
}return best||{x:px,z:pz,y:height(px,pz)}}
function waterSite(px,pz,rad=3000){let best=null,bs=1e9;for(let ix=-8;ix<=8;ix++)for(let iz=-8;iz<=8;iz++){
 const x=px+ix*rad/8,z=pz+iz*rad/8,y=height(x,z),score=Math.max(0,y+8)*28+Math.hypot(x-px,z-pz)*.012;
 if(y<7&&score<bs){bs=score;best={x,z,y}}
}return best||{x:px,z:pz,y:0}}
function mesh(geo,mat,x,y,z,scale,rot=0,cast=true,recv=true){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);if(scale)m.scale.set(...scale);m.rotation.y=rot;m.castShadow=cast;m.receiveShadow=recv;world.add(m);return m}
function box(mat,w,h,d,x,y,z,rot=0){return mesh(new T.BoxGeometry(w,h,d),mat,x,y,z,null,rot)}
function createRunway(base,heading,name,slot){
 const x=base.x,z=base.z,y=base.y+3;
 box(wm.concrete,1540,6,155,x,y,z);
 box(wm.runway,1420,1.5,128,x,y+3.6,z);
 for(let i=-650;i<=650;i+=100)box(wm.white,54,1.2,6,x+i,y+4.45,z);
 for(let i=-680;i<=680;i+=85){box(wm.yellow,4,1.8,4,x+i,y+4.5,z-58);box(wm.yellow,4,1.8,4,x+i,y+4.5,z+58)}
 for(const side of[-1,1])for(let i=-690;i<=690;i+=92){const g=new T.Mesh(new T.SphereGeometry(5,8,6),new T.MeshBasicMaterial({color:0xffffff}));g.position.set(x+i,y+9,z+side*70);world.add(g)}
 // Neutral air-landing guidance: green lights identify the runway from either approach direction.
 for(const side of[-1,1])for(let i=-690;i<=690;i+=55){
  const pole=new T.Mesh(new T.CylinderGeometry(1.15,1.15,5,7),wm.dark);pole.position.set(x+i,y+7.2,z+side*82);world.add(pole);
  const lamp=new T.Mesh(new T.SphereGeometry(3.3,8,6),wm.runwayGreen);lamp.position.set(x+i,y+10.5,z+side*82);lamp.userData.runwayLight=true;lamp.userData.phase=(i+side*13)*.01;world.add(lamp);runwayLights.push(lamp);
 }
 for(const end of[-1,1]){
  const ex=x+end*735;
  for(let j=-3;j<=3;j++){const lamp=new T.Mesh(new T.SphereGeometry(5.2,8,6),wm.runwayGreen);lamp.position.set(ex,y+12,z+j*22);lamp.userData.runwayLight=true;lamp.userData.phase=j*.18+end;world.add(lamp);runwayLights.push(lamp)}
  for(let j=1;j<=5;j++){const lamp=new T.Mesh(new T.SphereGeometry(4.2,8,6),wm.runwayGreen);lamp.position.set(ex+end*j*42,y+10,z);lamp.userData.runwayLight=true;lamp.userData.phase=j*.16;world.add(lamp);runwayLights.push(lamp)}
  const marker=new T.Mesh(new T.OctahedronGeometry(8,0),wm.runwayGreen);marker.position.set(ex,y+52,z);marker.userData.runwayLight=true;world.add(marker);runwayLights.push(marker);
 }
 // Simple neutral terminal/hangars. They are recorded as solid volumes so aircraft cannot nose into them.
 box(wm.concrete,300,5,120,x,y,z+240);
 box(wm.concrete,360,5,280,x+(slot===0?-510:510),y,z+260);
 const tx=x+(slot===0?-330:330),tz=z+290;
 box(wm.building,250,42,110,tx,y+24,tz,0);addSolidVolume(tx,tz,145,y,Math.max(height(tx,tz),0)+66);
 box(wm.glass,190,22,8,tx,y+28,tz-56);
 for(let i=-75;i<=75;i+=25)box(wm.dark,8,12,8,tx+i,y+23,z+345);
 for(let i=0;i<3;i++){
  const hx=x+(slot===0?-650:-90)+i*(slot===0?120:-120),hz=z+310;
  box(wm.building2,100,34,150,hx,y+20,hz);addSolidVolume(hx,hz,95,y,Math.max(height(hx,hz),0)+57);
  box(wm.roof,108,6,158,hx,y+39,hz);
 }
 const towerX=x+(slot===0?-70:70),towerZ=z+370;
 box(wm.concrete,28,120,28,towerX,y+60,towerZ);addSolidVolume(towerX,towerZ,24,y,Math.max(height(towerX,towerZ),0)+136);
 box(wm.glass,56,20,56,towerX,y+116,towerZ);
 box(wm.roof,64,6,64,towerX,y+130,towerZ);
 for(let i=0;i<4;i++)box(wm.dark,4,10,4,towerX-22+i*15,y+117,towerZ-30);
 const strip={name:name,x,z,surfaceY:y+4.35,length:1420,width:128,heading};
 landingStrips.push(strip);
 return {x,z,y,surfaceY:strip.surfaceY,spawnX:x+(slot===0?-530:530),spawnZ:z,heading};
}
const airBase1=flatSite(-4200,0),airBase2=flatSite(4200,0);
worldBases.blue=createRunway(airBase1,-Math.PI/2,'Air Landing Runway 01',0);
worldBases.red=createRunway(airBase2,Math.PI/2,'Air Landing Runway 02',1);
worldBases.green=worldBases.blue;worldBases.yellow=worldBases.red;
// Road network and city clusters.
function roadSegment(x,z,w,d,rot=0){const h=Math.max(height(x,z),0)+4;box(wm.road,w,2.5,d,x,h,z,rot);box(wm.white,Math.max(5,w-20),.35,3,x,h+1.45,z,rot)}
function createRoad(a,b){const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),steps=Math.ceil(len/120);for(let i=0;i<steps;i++){const t=(i+.5)/steps,x=a.x+dx*t,z=a.z+dz*t;roadSegment(x,z,110,18,Math.atan2(dx,dz))}}
const citySites=[flatSite(0,0,1300),flatSite(-2400,2100,1200),flatSite(2700,-1900,1200)];
function createCity(center,seed){const {x,z}=center,baseY=Math.max(height(x,z),0)+2;
 box(wm.concrete,1900,3,1500,x,baseY-1,z);
 for(let i=0;i<54;i++){
  const a=rseed(seed*91+i*7.1)*Math.PI*2,d=Math.sqrt(rseed(seed*17+i*11.3))*720,bx=x+Math.cos(a)*d,bz=z+Math.sin(a)*d,bh=24+rseed(seed+i*3)*130,bw=28+rseed(seed+i*13)*62,bd=28+rseed(seed+i*23)*62;
  const groundY=Math.max(height(bx,bz),0),by=groundY+bh/2+3;const m=i%3===0?wm.building2:wm.building;box(m,bw,bh,bd,bx,by,bz,rseed(seed+i)*Math.PI);addSolidVolume(bx,bz,Math.hypot(bw,bd)*.52,groundY,by+bh/2+8);if(bh>70)box(wm.roof,bw*1.05,5,bd*1.05,bx,by+bh/2+3,bz,rseed(seed+i)*Math.PI);if(i%4===0)for(const sx of[-.28,.28])for(const sz of[-.22,.22])box(wm.glass,Math.max(5,bw*.12),Math.min(22,bh*.18),2,bx+sx*bw,by+bh*.05,bz-sz*bd)
 }
 // Roads radiate from city.
 createRoad({x:x-1150,z},{x:x+1150,z});createRoad({x,z:z-900},{x,z:z+900});
 for(let i=0;i<5;i++){const ang=rseed(seed*33+i)*Math.PI*2,pt={x:x+Math.cos(ang)*900,z:z+Math.sin(ang)*700};createRoad({x,z},pt)}
 // central civic tower
 const th=190,gy=Math.max(height(x,z),0);box(wm.building,52,th,52,x,gy+th/2+4,z);addSolidVolume(x,z,38,gy,gy+th+12);box(wm.glass,70,24,70,x,gy+th+10,z);
}
createCity(citySites[0],101);createCity(citySites[1],202);createCity(citySites[2],303);
// Trees: low-poly forest pockets around the playable world, kept clear of airports and dense city blocks.
const treeTrunk=new T.MeshStandardMaterial({color:0x5a3b22,roughness:1});
const treeLeaf=[new T.MeshStandardMaterial({color:0x2f6b35,roughness:1}),new T.MeshStandardMaterial({color:0x3f7f3f,roughness:1}),new T.MeshStandardMaterial({color:0x285a2e,roughness:1})];
function createTree(x,z,scale,variant=0){const g=new T.Group();const h=Math.max(height(x,z),0);g.position.set(x,h,z);const trunk=new T.Mesh(new T.CylinderGeometry(2.4*scale,3.8*scale,34*scale,7),treeTrunk);trunk.position.y=17*scale;g.add(trunk);
 const s=1+variant*.08;for(let i=0;i<3;i++){const c=new T.Mesh(new T.ConeGeometry((26-i*4)*scale*s,54*scale,9),treeLeaf[(variant+i)%treeLeaf.length]);c.position.y=(43+i*22)*scale;c.rotation.y=(variant*.7+i)*1.7;g.add(c)}
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});world.add(g)}
function tooCloseToStructures(x,z){for(const b of landingStrips)if(Math.hypot(x-b.x,z-b.z)<980)return true;for(const c of citySites)if(Math.hypot(x-c.x,z-c.z)<980)return true;return false}
function createTreeField(cx,cz,radius,count,seed){let made=0,tries=0;while(made<count&&tries<count*12){tries++;const a=rseed(seed+tries*1.37)*Math.PI*2,d=Math.sqrt(rseed(seed*3.1+tries*5.7))*radius,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;if(tooCloseToStructures(x,z)||height(x,z)<8)continue;createTree(x,z,.72+rseed(seed*9+tries)*.62,Math.floor(rseed(seed*11+tries)*3));made++}}
createTreeField(-1800,3300,1150,42,901);createTreeField(1800,2500,1050,38,902);createTreeField(-5600,-2000,1250,36,903);createTreeField(5200,1850,1250,36,904);createTreeField(400,-1150,850,22,905);
// Bridge and river canyon feature near the central city.
(function createBridge(){const x=1150,z=420,y=Math.max(height(x,z),0)+18;box(wm.concrete,760,12,70,x,y,z);for(let i=-330;i<=330;i+=110){box(wm.concrete,24,90,24,x+i,y-48,z-20);box(wm.concrete,24,90,24,x+i,y-48,z+20)}for(let i=-340;i<=340;i+=48)box(wm.white,5,2,6,x+i,y+8,z);})();
// Coastal islands: low-poly mounds emerging through the water.
function createIsland(x,z,sx,sz,seed){const y=0;const base=mesh(new T.SphereGeometry(1,28,14),wm.sand,x,y-18,z,[sx,55,sz]);const top=mesh(new T.SphereGeometry(1,24,12),wm.grass,x,y+8,z,[sx*.72,32,sz*.72]);
 for(let i=0;i<8;i++){const a=rseed(seed+i)*Math.PI*2,d=.4+.45*rseed(seed+i*8),tx=x+Math.cos(a)*sx*d,tz=z+Math.sin(a)*sz*d,h=10+35*rseed(seed+i*2);box(wm.building2,18,h,18,tx,h/2+3,tz,rseed(seed+i*3)*Math.PI)}
}
const is1=waterSite(0,5000,3800),is2=waterSite(3600,4200,2800);createIsland(is1.x,is1.z,520,340,611);createIsland(is2.x,is2.z,420,290,712);
// Naval base and ships around the main carrier area.
function createShip(x,z,len=150,wide=32,carrier=false){const y=12;const g=new T.Group();g.position.set(x,y,z);g.rotation.y=(rseed(x*.01+z*.02)-.5)*.35;const hull=new T.Mesh(new T.BoxGeometry(wide,18,len),wm.carrier);hull.position.y=0;g.add(hull);if(carrier){const deck=new T.Mesh(new T.BoxGeometry(wide+22,5,len+26),wm.carrierDeck);deck.position.y=11;g.add(deck);const island=new T.Mesh(new T.BoxGeometry(34,48,70),wm.shipWhite);island.position.set(0,34,len*.18);g.add(island);const mast=new T.Mesh(new T.CylinderGeometry(3,3,55,10),wm.dark);mast.position.set(0,76,len*.18);g.add(mast);for(let i=-4;i<=4;i+=2){const light=new T.Mesh(new T.SphereGeometry(1.8,8,6),new T.MeshBasicMaterial({color:0xffdf8a}));light.position.set(i*6,14,-len*.42);g.add(light)}}else{const cabin=new T.Mesh(new T.BoxGeometry(wide*.5,28,55),wm.shipWhite);cabin.position.set(0,19,10);g.add(cabin);const mast=new T.Mesh(new T.CylinderGeometry(2,2,30,8),wm.dark);mast.position.set(0,42,10);g.add(mast)}g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});world.add(g);return g}
const carrierSite=waterSite(-7000,5200,5000);createShip(carrierSite.x,carrierSite.z,520,130,true);createShip(carrierSite.x+360,carrierSite.z+180,190,38,false);createShip(carrierSite.x-300,carrierSite.z-240,170,34,false);
// Naval base on the nearest low coastal site to the carrier.
(function createNavalBase(){const x=carrierSite.x+800,z=carrierSite.z+250,h=10;box(wm.concrete,520,7,330,x,h,z);for(let i=-2;i<=2;i++){box(wm.building2,72,42,88,x+i*100,h+24,z-70);box(wm.roof,78,6,94,x+i*100,h+48,z-70)}box(wm.concrete,45,16,430,x-290,h+6,z+20);box(wm.concrete,45,16,430,x+290,h+6,z+20)})();
// Airport and navigation beacons.
function beacon(x,z,color=0xffe0a0){const h=Math.max(height(x,z),0)+7;const b=box(wm.dark,4,26,4,x,h+13,z);const l=new T.Mesh(new T.SphereGeometry(5,8,6),new T.MeshBasicMaterial({color}));l.position.set(x,h+30,z);world.add(l)}
for(const b of[worldBases.blue,worldBases.red]){for(const dx of[-720,-360,0,360,720])beacon(b.x+dx,b.z,0xeef7ff);beacon(b.x,b.z+420,0xffd45a)}
// Expose world landmarks for later gameplay systems / navigation.
window.flightWorld={bases:worldBases,cities:citySites,runways:landingStrips,carrier:{x:carrierSite.x,z:carrierSite.z},islands:[is1,is2]};


let lastLockSync=0;
let plane=null,myId=null,ws=null,hp=100,throttle=.6,speed=75,camMode=0,invert=-1,alive=false,spectatorMode=false,ptype='balanced',maxhp=100,protEnd=0,myTeam='blue',roomCode='',isHost=false,roomInfo=null,score={},roundNo=0,inGame=false,specIdx=0,lastShot=0,boost=100,wasBoost=false,lastMissile=0,lastBeep=0,lastNoLock=0,lastWarnBeep=0,over=false,winEnd=0,smokeT=0,shake=0,lockId=null,lockT=0,snapPlayers={},teamCount=2,shields=3,shieldUntil=0,spectatorName='',practiceMode=false,practiceKills=0,practiceClock=0,practiceDifficulty='normal',flares=3,flareCooldown=0,missileWarningUntil=0,lastMissileWarn=0,killCamActive=false,killCamAttackerId=null,killCamUntil=0;
const LOCK_RANGE=4200,MISSILE_SEEKER_RANGE=4800,MISSILE_PROXIMITY=65,MISSILE_BREAK_TIME=1.35,MISSILE_SEEKER_CONE=1.05;
let intentionalDisconnect=false,roomExitInProgress=false;
const remotes={},bullets=[],bg=new T.CylinderGeometry(.4,.4,16,5).rotateX(Math.PI/2),bm=new T.MeshBasicMaterial({color:0xffee55});
function spawnBullet(p,d,mine){const m=new T.Mesh(bg,bm);m.position.fromArray(p);m.quaternion.setFromUnitVectors(MZ,new T.Vector3().fromArray(d).normalize());scene.add(m);const b={m,d:new T.Vector3().fromArray(d),life:2,mine};bullets.push(b);return b}
const sP=document.getElementById('sp'),sR=document.getElementById('sr'),sY=document.getElementById('sy'),setBox=document.getElementById('set');
function saveSet(){try{localStorage.setItem('fb',JSON.stringify({n:document.getElementById('name').value,inv:document.getElementById('inv').checked,t:document.getElementById('ptype').value,sp:sP.value,sr:sR.value,sy:sY.value}))}catch(e){}}
document.querySelectorAll('#set input').forEach(i=>i.onchange=()=>{i.blur();saveSet()});
let myColor='#fff',roomMode='clash',spawnGrace=0,roundHiddenUntil=0,pickedColor='#fff',selectedColorId='electric-red',landed=false,landingStrip=null;
let deathCamActive=false,deathCamPos=new T.Vector3(),deathCamLook=new T.Vector3(),deathCamUntil=0;
const KILL_REPLAY_WINDOW=6000,KILL_REPLAY_HISTORY_MS=8500,KILL_REPLAY_AVAILABLE_MS=3000;
let killReplayHistory=[],killReplayClip=[],killReplayAvailableUntil=0,killReplayActive=false,killReplayStartedAt=0,killReplayDuration=0,killReplayResume=null,killReplayPreparedAt=-Infinity,killReplayAttackerId=null;
const killReplayBtn=document.getElementById('killReplayBtn');
const warns={},warnEl=document.getElementById('warn');
const winEl=document.getElementById('win'),shieldHud=document.getElementById('shieldHud'),spectatorHud=document.getElementById('spectatorHud');
let shieldMesh=null;
function ensureShield(){if(!plane)return;shieldMesh=plane.userData.shield||null}
function updateShieldVisual(){ensureShield();if(shieldMesh){shieldMesh.visible=roomMode==='clash'&&alive&&shieldUntil>performance.now();if(shieldMesh.visible){const pulse=.95+.08*Math.sin(performance.now()*.02);shieldMesh.scale.setScalar(pulse)}}}
function updateSpectatorHud(){if(!inGame||alive||(!spectatorMode&&roomMode!=='clash'&&roomMode!=='survivor')){spectatorHud.style.display='none';return}const r=specId&&remotes[specId],sp=specId&&snapPlayers[specId];spectatorHud.style.display='block';spectatorHud.textContent=r&&sp?`SPECTATING  ${sp.n}${r.team&&TN[r.team]?`  •  ${TN[r.team].toUpperCase()} TEAM`:''}  •  TAB NEXT`:(spectatorMode?'SPECTATING  •  waiting for a pilot':'SPECTATING  •  waiting for a survivor');}
let AC=null,engOsc=null,musicGain=null,missileAudio=0,menuMusic=null,menuMusicReady=false,menuMusicPlaying=false,menuSfx={};
function initAudio(){if(!AC){AC=new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();
 engOsc=AC.createOscillator();engOsc.type='sawtooth';const eg=AC.createGain();eg.gain.value=.02;const ef=AC.createBiquadFilter();ef.type='lowpass';ef.frequency.value=360;engOsc.connect(ef);ef.connect(eg);eg.connect(AC.destination);engOsc.start();
 menuMusic=new Audio('/audio/mayday-entry.wav');menuMusic.loop=true;menuMusic.volume=.34;menuMusic.preload='auto';menuMusicReady=true;
 menuSfx.gun='/audio/gunshot.wav';menuSfx.launch='/audio/missile-launch.wav';menuSfx.explosion='/audio/explosion.wav';menuSfx.fire='/audio/fire-loop.wav';menuSfx.shield='/audio/shield.wav';menuSfx.missile='/audio/missile-loop.wav';}
 if(AC.state==='suspended')AC.resume()}
function playFile(key,vol=1,rate=1){initAudio();const src=menuSfx[key];if(!src)return;const a=new Audio(src);a.volume=vol;a.playbackRate=rate;a.play().catch(()=>{});return a}
function setMusic(on){initAudio();if(!menuMusicReady)return;const want=!!on&&!inGame;if(want){menuMusicPlaying=true;menuMusic.play().catch(()=>{})}else{menuMusicPlaying=false;menuMusic.pause();menuMusic.currentTime=0}}
function tone(f,d,type,v,f2){if(!AC)return;const o=AC.createOscillator(),g=AC.createGain(),t=AC.currentTime;o.type=type||'square';o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);g.gain.setValueAtTime(v||.1,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g);g.connect(AC.destination);o.start();o.stop(t+d)}
function noise(d,v,fc){if(!AC)return;const n=Math.max(1,Math.floor(AC.sampleRate*d)),b=AC.createBuffer(1,n,AC.sampleRate),a=b.getChannelData(0);for(let i=0;i<n;i++)a[i]=(Math.random()*2-1)*(1-i/n);const s=AC.createBufferSource();s.buffer=b;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=fc||1200;const g=AC.createGain();g.gain.value=v||.2;s.connect(f);f.connect(g);g.connect(AC.destination);s.start()}
function gunSound(){playFile('gun',.36,.94+Math.random()*.12)}
function missileLaunchSound(){playFile('launch',.42,.96+Math.random()*.08)}
function missileFlySound(on){if(!menuSfx.missile)return;initAudio();if(on){if(window._missileAudio)return;const a=new Audio(menuSfx.missile);a.loop=true;a.volume=.12;a.play().catch(()=>{});window._missileAudio=a;missileAudio=1}else if(window._missileAudio){window._missileAudio.pause();window._missileAudio=null;missileAudio=0}}
function shieldSound(){playFile('shield',.34,1)}
function createFlare(pos,owner){const g=new T.Group();g.position.copy(pos);const core=new T.Mesh(new T.SphereGeometry(2.8,10,8),new T.MeshBasicMaterial({color:0xfff1a3,transparent:true,opacity:.98,blending:T.AdditiveBlending,depthWrite:false}));g.add(core);const glow=new T.Mesh(new T.SphereGeometry(9,10,8),new T.MeshBasicMaterial({color:0xff7a00,transparent:true,opacity:.26,blending:T.AdditiveBlending,depthWrite:false}));g.add(glow);scene.add(g);flareSites.push({g,life:2.5,owner:String(owner||''),vel:new T.Vector3(0,8,0)});}
const missiles=[],parts=[],crashSites=[],flareSites=[],pg=new T.SphereGeometry(1,6,5),MZ=new T.Vector3(0,0,-1);let particleBudget=700;
function createCrashFire(pos,life=4300){const g=new T.Group();g.position.copy(pos);g.position.y=Math.max(g.position.y,Math.max(height(g.position.x,g.position.z),0)+0.8);const rings=[];for(let i=0;i<3;i++){const mat=new T.MeshBasicMaterial({color:i===0?0xffd166:i===1?0xff6b1a:0xff2d00,transparent:true,opacity:.8,blending:T.AdditiveBlending,depthWrite:false});const m=new T.Mesh(new T.ConeGeometry(8-i*1.2,26+i*8,8),mat);m.position.set((i-1)*5,10+i*4,(i%2?3:-3));g.add(m);rings.push(m)}const smoke=new T.Mesh(new T.SphereGeometry(12,10,8),new T.MeshBasicMaterial({color:0x242424,transparent:true,opacity:.33,depthWrite:false}));smoke.position.y=35;g.add(smoke);scene.add(g);const fireAudio=new Audio('/audio/fire-loop.wav');fireAudio.loop=true;fireAudio.volume=.11;fireAudio.play().catch(()=>{});crashSites.push({g,life,max:life,rings,smoke,nextAudio:performance.now()+180+Math.random()*320,fireAudio});if(crashSites.length>12){const q=crashSites.shift();scene.remove(q.g);if(q.fireAudio){q.fireAudio.pause();q.fireAudio.currentTime=0}}}

const tailPos=o=>new T.Vector3(0,0,9).applyQuaternion(o.quaternion).add(o.position);
function puff(pos,color,size,life,vel,op,o){o=o||{};while(parts.length>=particleBudget){const q0=parts.shift();if(!q0)break;scene.remove(q0.m);q0.m.material.dispose()}const m=new T.Mesh(pg,new T.MeshBasicMaterial({color,transparent:true,opacity:op||.7,blending:o.add?T.AdditiveBlending:T.NormalBlending,depthWrite:false}));
 m.position.copy(pos);m.scale.setScalar(size);scene.add(m);
 parts.push({m,life,max:life,vel,size,op:op||.7,grow:o.grow===undefined?1.5:o.grow,grav:o.grav||0});
 if(parts.length>700){const q=parts.shift();scene.remove(q.m);q.m.material.dispose()}}
function explode(pos,big){const sc=big?1.5:1,V=r=>new T.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize().multiplyScalar(r);
 puff(pos,0xffffff,22*sc,.18,new T.Vector3(),1,{add:true,grow:1.2});
 puff(pos,0xff9a30,10*sc,.5,new T.Vector3(),.35,{add:true,grow:9});
 for(let i=0;i<16*sc;i++)puff(pos,[0xffe27a,0xff9a1a,0xff5a0a][i%3],(6+Math.random()*7)*sc,.6+Math.random()*.7,V(20+Math.random()*60*sc),.85,{add:true,grow:2.4});
 for(let i=0;i<18*sc;i++)puff(pos,0xffb040,1.3,1.2+Math.random(),V(60+Math.random()*180*sc),1,{add:true,grow:-.6,grav:90});
 for(let i=0;i<16*sc;i++)puff(pos,i%2?0x2a2a2a:0x444444,(9+Math.random()*9)*sc,3+Math.random()*2,V(10+Math.random()*25).add(new T.Vector3(0,12+Math.random()*14,0)),.55,{grow:2.6});
 const d=plane?pos.distanceTo(plane.position):0,vol=Math.min(1,1500/Math.max(d,1));
 shake=Math.max(shake,Math.min(1,900/Math.max(d,60))*(big?1:.6));
 playFile('explosion',.48,1); noise(1.4,.22*vol,600);tone(70,1,'sine',.16*vol,25);setTimeout(()=>noise(.5,.1*vol,300),120)}
function spawnMissile(p,d,tid,mine,by){const g=new T.Group();g.add(new T.Mesh(new T.CylinderGeometry(1.2,1.2,10,8).rotateX(Math.PI/2),L(0xdddddd)));
 const c=new T.Mesh(new T.ConeGeometry(1.2,3,8).rotateX(-Math.PI/2),L(0xff4422));c.position.z=-6.5;g.add(c);
 const v=new T.Vector3().fromArray(d),sp=v.length();g.position.fromArray(p);scene.add(g);missiles.push({m:g,dir:v.normalize(),sp,tid:String(tid),mine,by,life:15})}
// Missile seekers lock only onto enemy aircraft.
const tgtObj=tid=>tid===String(myId)?plane:(remotes[String(tid)]&&remotes[String(tid)].mesh);
function emitSmoke(o,h){if(h===undefined||h>60)return;const bad=h<=30,t=tailPos(o);puff(t,bad?0x151515:0x777777,bad?6:4.5,2.4,new T.Vector3(0,8,0),.6,{grow:3});if(bad)puff(t,0xff7a1a,3.5,.3,new T.Vector3(),.9,{add:true,grow:.5})}

const keys={};
let mouseControls=false,mouseSensitivity=100,mouseDX=0,mouseDY=0;
try{const S=JSON.parse(localStorage.getItem('maydaySettings')||'{}');mouseControls=!!S.mouseControls;const saved=Number(S.mouseSensitivity);mouseSensitivity=Number.isFinite(saved)?(saved>0&&saved<=2.01?saved*100:saved):100;mouseSensitivity=Math.max(1,Math.min(200,mouseSensitivity));}catch(e){}
function saveMaydaySettings(){try{localStorage.setItem('maydaySettings',JSON.stringify({mouseControls,mouseSensitivity}))}catch(e){}}
function syncSettingsUi(){const mc=document.getElementById('mouseControls'),ms=document.getElementById('mouseSensitivity'),mv=document.getElementById('mouseSensitivityValue');if(mc)mc.checked=mouseControls;if(ms)ms.value=mouseSensitivity;if(mv)mv.textContent=Math.round(mouseSensitivity)+'%'}
let pointerLocked=false,settingsWasMouseLocked=false;
function requestMaydayPointerLock(){
  if(mobileTouchEnabled||!inGame||!mouseControls||document.pointerLockElement)return;
  const target=document.body;
  try{const p=target.requestPointerLock?.({unadjustedMovement:true});if(p&&p.catch)p.catch(()=>target.requestPointerLock?.().catch?.(()=>{}))}catch(e){try{target.requestPointerLock?.()}catch(_){}}
}
function unlockMaydayPointer(){try{if(document.pointerLockElement)document.exitPointerLock()}catch(e){};document.body.classList.remove('maydayMouseLocked');pointerLocked=false}
function updateMaydayPointerLockUi(){
  pointerLocked=document.pointerLockElement===document.body||document.pointerLockElement===document.documentElement||!!document.pointerLockElement;
  const locked=inGame&&mouseControls&&pointerLocked;
  document.body.classList.toggle('maydayMouseLocked',locked);
}
function openSettings(){
  settingsWasMouseLocked=pointerLocked;
  syncSettingsUi();
  if(inGame)unlockMaydayPointer();
  const p=document.getElementById('settingsPanel');if(p)p.style.display='flex';
}
function closeSettings(){
  const p=document.getElementById('settingsPanel');if(p)p.style.display='none';
  if(inGame&&mouseControls&&!mobileTouchEnabled)requestMaydayPointerLock();
}
document.addEventListener('pointerlockchange',updateMaydayPointerLockUi);


addEventListener('keydown',e=>{const target=e.target;const isTextEntry=!!(target&&(target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)));if(isTextEntry)return;if(killReplayActive){e.preventDefault();if(e.code==='KeyP')finishKillReplay();else keys[e.code]=false;return}if(e.code==='KeyP'&&inGame){e.preventDefault();if(practiceMode)return;if(killReplayClip.length>1&&performance.now()<killReplayAvailableUntil)startKillReplay();else toast('No recent kill replay available');return}keys[e.code]=true;if(e.code==='F1'&&e.shiftKey&&inGame){e.preventDefault();if(pointerLocked)unlockMaydayPointer();else if(mouseControls)requestMaydayPointerLock();return}if(e.code==='Escape'&&inGame){e.preventDefault();keys[e.code]=false;return}if(e.code==='KeyG'&&!e.repeat&&inGame){if(roomMode==='clash'&&!spectatorMode&&ws&&ws.readyState===1){e.preventDefault();toast('HOLD G FOR 1 SECOND TO SEND MAYDAY');clearMaydayHold();maydayHoldTimer=setTimeout(()=>{maydayHoldTimer=0;if(inGame&&roomMode==='clash'&&!spectatorMode&&ws&&ws.readyState===1)ws.send(JSON.stringify({t:'quickalert'}))},1100)}else if(roomMode==='clash'&&spectatorMode){toast('SPECTATORS CANNOT SEND MAYDAY ALERTS');e.preventDefault()}return}if(e.code==='Tab'&&inGame){specIdx+=e.shiftKey?-1:1;specId=null;e.preventDefault();return}if(e.code==='KeyQ'&&roomMode==='clash'&&alive&&shields>0&&performance.now()>shieldUntil&&ws&&ws.readyState===1){ws.send(JSON.stringify({t:'shield'}));e.preventDefault()}
if(e.code==='KeyR'&&inGame&&alive&&flares>0&&performance.now()>flareCooldown){flareCooldown=performance.now()+900;flares--;const p=tailPos(plane).addScaledVector(fw.clone().multiplyScalar(-24),1);createFlare(p,myId);if(practiceMode){toast('FLARES DEPLOYED • '+flares+' left')}else if(ws&&ws.readyState===1)ws.send(JSON.stringify({t:'flare',p:p.toArray()}));e.preventDefault()}if(e.code==='KeyM'&&inGame){mapStyle=mapStyle==='rotate'?'north':'rotate';toast(mapStyle==='north'?'RADAR: NORTH-UP':'RADAR: ROTATING');e.preventDefault()}if(e.code==='KeyX'&&inGame&&alive){e.preventDefault()}if(e.code==='KeyO'&&inGame){const hide=setBox.style.display!=='none';setBox.style.display=hide?'none':'block';const gs=document.getElementById('gameSettingsBtn');if(gs)gs.style.display=hide?'none':'block';e.preventDefault();return}if(e.code==='Minus')RANGE=Math.min(RANGE*1.4,12000);if(e.code==='Equal')RANGE=Math.max(RANGE/1.4,1000);if(e.code==='KeyC'&&!keys.KeyX)camMode=(camMode+1)%3;if(e.code==='KeyI')invert*=-1;if(e.code.startsWith('Arrow')||e.code==='Space')e.preventDefault()});
addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='KeyG')clearMaydayHold();if(e.code==='Space'&&mouseControls)keys.Space=false});
addEventListener('contextmenu',e=>{if(inGame&&mouseControls)e.preventDefault()});
addEventListener('mousemove',e=>{if(killReplayActive){mouseDX=0;mouseDY=0;return}if(inGame&&mouseControls&&pointerLocked){mouseDX+=e.movementX||0;mouseDY+=e.movementY||0;mouseDX=Math.max(-120,Math.min(120,mouseDX));mouseDY=Math.max(-120,Math.min(120,mouseDY))}});
addEventListener('mousedown',e=>{if(killReplayActive){e.preventDefault();return}if(!inGame||!mouseControls)return;initAudio();if(e.button===0){keys.Space=true;e.preventDefault()}else if(e.button===2){keys.KeyX=true;e.preventDefault()}else if(e.button===1){if(roomMode==='clash'&&alive&&shields>0&&performance.now()>shieldUntil&&ws&&ws.readyState===1){ws.send(JSON.stringify({t:'shield'}));e.preventDefault()}}});
addEventListener('mouseup',e=>{if(e.button===0)keys.Space=false;if(e.button===2)keys.KeyX=false});
addEventListener('auxclick',e=>{if(inGame&&mouseControls)e.preventDefault()});
// Touch controls are an optional input layer over the existing keyboard controls.
const mobileTouchEnabled=TOUCH_DEVICE;
const mobileInput={pitch:0,yaw:0,roll:0,throttle:0,brake:0,boost:false,fire:false,missile:false,rear:false,mayday:false};
const mobileControlsEl=document.getElementById('mobileControls'),mobileStickEl=document.getElementById('mobileStick'),mobileStickNub=document.getElementById('mobileStickNub');
const hudEditBtn=document.getElementById('hudEditBtn'),hudEditorEl=document.getElementById('hudEditor'),landscapeGateEl=document.getElementById('landscapeGate');
if(hudEditBtn)hudEditBtn.style.display='none';
let hudEditMode=false,hudDragEl=null,hudDragPointer=null,hudDragOffset={x:0,y:0};
const HUD_LAYOUT_KEY='mayday-mobile-hud-v63';
const LEGACY_HUD_LAYOUT_KEY='mayday-mobile-hud-v62';
const MOBILE_PREFS_KEY='maydayMobileSettingsV63';
const DEFAULT_MOBILE_HUD={
 stick:{x:2.5,y:60}, throttle:{x:15.5,y:57}, brake:{x:15.5,y:69}, boost:{x:15.5,y:81},
 camera:{x:75,y:53}, fire:{x:87,y:53}, flare:{x:75,y:66}, missile:{x:87,y:66}, shield:{x:75,y:79}, rear:{x:87,y:79}, mayday:{x:75,y:40}
};
const TWO_THUMB_PRESET={stick:{x:2.5,y:58},throttle:{x:15,y:55},brake:{x:15,y:66},boost:{x:15,y:77},camera:{x:74,y:43},fire:{x:86,y:51},flare:{x:74,y:64},missile:{x:86,y:64},shield:{x:74,y:77},rear:{x:86,y:77},mayday:{x:74,y:30}};
const FOUR_FINGER_PRESET={stick:{x:2.5,y:61},throttle:{x:17,y:56},brake:{x:17,y:67},boost:{x:17,y:78},camera:{x:67,y:12},fire:{x:87,y:22},missile:{x:87,y:34},flare:{x:75,y:34},shield:{x:75,y:47},rear:{x:87,y:47},mayday:{x:75,y:20}};
function cloneJson(v){return JSON.parse(JSON.stringify(v))}
function normalizeHudItems(source){const out={};for(const [key,p0] of Object.entries(DEFAULT_MOBILE_HUD)){const p=(source&&source[key])||p0;out[key]={x:Number.isFinite(+p.x)?Math.max(0,Math.min(100,+p.x)):p0.x,y:Number.isFinite(+p.y)?Math.max(0,Math.min(100,+p.y)):p0.y,size:Number.isFinite(+p.size)?Math.max(.65,Math.min(1.5,+p.size)):1,opacity:Number.isFinite(+p.opacity)?Math.max(.25,Math.min(1,+p.opacity)):1,hidden:!!p.hidden}}return out}
function readMobileHudState(){try{const raw=JSON.parse(localStorage.getItem(HUD_LAYOUT_KEY)||'null');if(raw&&raw.items){return{activeSlot:['A','B','C'].includes(raw.activeSlot)?raw.activeSlot:'A',items:normalizeHudItems(raw.items),slots:{A:normalizeHudItems(raw.slots?.A||raw.items),B:normalizeHudItems(raw.slots?.B||DEFAULT_MOBILE_HUD),C:normalizeHudItems(raw.slots?.C||DEFAULT_MOBILE_HUD)}}}}catch(_){}try{const legacy=JSON.parse(localStorage.getItem(LEGACY_HUD_LAYOUT_KEY)||'{}');const migrated=normalizeHudItems(legacy);return{activeSlot:'A',items:migrated,slots:{A:cloneJson(migrated),B:normalizeHudItems(DEFAULT_MOBILE_HUD),C:normalizeHudItems(DEFAULT_MOBILE_HUD)}}}catch(_){const d=normalizeHudItems(DEFAULT_MOBILE_HUD);return{activeSlot:'A',items:d,slots:{A:cloneJson(d),B:normalizeHudItems(DEFAULT_MOBILE_HUD),C:normalizeHudItems(DEFAULT_MOBILE_HUD)}}}}
let hudLayoutState=readMobileHudState(),activeHudSlot=hudLayoutState.activeSlot||'A',selectedHudKey='stick';
function readMobilePreferences(){const defaults={joystickSensitivity:1,cameraSensitivity:1,invertPitch:!!document.getElementById('inv')?.checked,autoLevel:false,flightModel:'arcade',graphicsPreset:TOUCH_DEVICE?'medium':'high',showFps:false,vibrateOnHit:!!TOUCH_DEVICE,showLabels:true};try{const saved=JSON.parse(localStorage.getItem(MOBILE_PREFS_KEY)||'{}');return{...defaults,...saved,joystickSensitivity:Math.max(.5,Math.min(1.8,Number(saved.joystickSensitivity)||1)),cameraSensitivity:Math.max(.4,Math.min(2.4,Number(saved.cameraSensitivity)||1)),flightModel:saved.flightModel==='realistic'?'realistic':'arcade',graphicsPreset:['low','medium','high'].includes(saved.graphicsPreset)?saved.graphicsPreset:defaults.graphicsPreset}}catch(_){return defaults}}
let mobilePrefs=readMobilePreferences(),mobileLookPointer=null,mobileLookLast={x:0,y:0},mobileCameraYaw=0,mobileCameraPitch=0;
function persistMobilePreferences(){try{localStorage.setItem(MOBILE_PREFS_KEY,JSON.stringify(mobilePrefs))}catch(_){} }
function mobileHudItems(){if(!mobileControlsEl)return[];return [mobileStickEl,...mobileControlsEl.querySelectorAll('button[data-hud-key]')].filter(Boolean)}
function hudKeyFor(el){return el?.dataset?.hudKey||''}
function currentHudItems(){return hudLayoutState.items||normalizeHudItems(DEFAULT_MOBILE_HUD)}
function persistHudState(){hudLayoutState.activeSlot=activeHudSlot;try{localStorage.setItem(HUD_LAYOUT_KEY,JSON.stringify(hudLayoutState))}catch(_){} }
function applyHudItemStyle(el,key){const cfg=currentHudItems()[key]||normalizeHudItems(DEFAULT_MOBILE_HUD)[key];if(!el||!cfg)return;el.style.scale=String(cfg.size||1);el.style.transformOrigin='top left';el.style.opacity=(cfg.hidden&&hudEditMode)?'.32':String(cfg.opacity??1);el.style.visibility=(cfg.hidden&&!hudEditMode)?'hidden':'visible';el.style.pointerEvents=(cfg.hidden&&!hudEditMode)?'none':'';el.classList.toggle('hud-control-hidden',!!cfg.hidden);el.classList.toggle('hudItemSelected',!!hudEditMode&&selectedHudKey===key);el.setAttribute('aria-hidden',String(!!cfg.hidden&&!hudEditMode));if(key!=='stick'){const label=el.dataset.originalLabel||(el.dataset.originalLabel=el.textContent);el.textContent=mobilePrefs.showLabels?label:''}}
function writeMobileHudLayout(){const items=currentHudItems();for(const el of mobileHudItems()){const key=hudKeyFor(el);if(!key||!items[key])continue;const r=el.getBoundingClientRect();items[key].x=+(Math.max(0,Math.min(100,r.left/Math.max(1,innerWidth)*100))).toFixed(3);items[key].y=+(Math.max(0,Math.min(100,r.top/Math.max(1,innerHeight)*100))).toFixed(3)}hudLayoutState.items=items;persistHudState()}
function applyMobileHudLayout(useSaved=true){if(!mobileControlsEl)return;if(!useSaved)hudLayoutState.items=normalizeHudItems(DEFAULT_MOBILE_HUD);const items=currentHudItems();for(const el of mobileHudItems()){const key=hudKeyFor(el),p=items[key]||normalizeHudItems(DEFAULT_MOBILE_HUD)[key];el.style.position='fixed';el.style.right='auto';el.style.bottom='auto';el.style.left=`${Math.max(0,Math.min(100,Number(p.x)||0))}vw`;el.style.top=`${Math.max(0,Math.min(100,Number(p.y)||0))}vh`;el.style.touchAction='none';applyHudItemStyle(el,key)}requestAnimationFrame(()=>{for(const el of mobileHudItems()){const r=el.getBoundingClientRect();let x=Math.max(0,Math.min(innerWidth-r.width,r.left)),y=Math.max(0,Math.min(innerHeight-r.height,r.top));el.style.left=`${x}px`;el.style.top=`${y}px`}writeMobileHudLayout();syncHudEditorForSelection()})}
function syncHudEditorForSelection(){const cfg=currentHudItems()[selectedHudKey]||{};const sel=document.getElementById('hudControlSelect'),slot=document.getElementById('hudSlotSelect'),size=document.getElementById('hudSizeRange'),sizeV=document.getElementById('hudSizeValue'),op=document.getElementById('hudOpacityRange'),opV=document.getElementById('hudOpacityValue'),hide=document.getElementById('hudHideControl'),labels=document.getElementById('hudShowLabels');if(sel&&sel.value!==selectedHudKey)sel.value=selectedHudKey;if(slot&&slot.value!==activeHudSlot)slot.value=activeHudSlot;if(size){size.value=cfg.size||1;if(sizeV)sizeV.textContent=Math.round((cfg.size||1)*100)+'%'}if(op){op.value=cfg.opacity??1;if(opV)opV.textContent=Math.round((cfg.opacity??1)*100)+'%'}if(hide)hide.checked=!!cfg.hidden;if(labels)labels.checked=!!mobilePrefs.showLabels;for(const el of mobileHudItems())applyHudItemStyle(el,hudKeyFor(el))}
function setHudEditMode(enabled){hudEditMode=!!enabled&&!!inGame&&mobileTouchEnabled;if(mobileControlsEl)mobileControlsEl.classList.toggle('hud-editing',hudEditMode);if(hudEditorEl)hudEditorEl.style.display=hudEditMode?'block':'none';if(hudEditBtn)hudEditBtn.textContent=hudEditMode?'☷ EDITING HUD':'☷ HUD SETTINGS';if(hudEditMode){resetMobileStick();mobileControlsEl?.querySelectorAll('button.active').forEach(b=>b.classList.remove('active'));syncHudEditorForSelection();toast('DRAG CONTROLS TO MOVE THEM')}else{hudDragEl=null;hudDragPointer=null;for(const el of mobileHudItems())applyHudItemStyle(el,hudKeyFor(el))}}
function updateLandscapeGate(){if(!landscapeGateEl)return;const portrait=!!(mobileTouchEnabled&&inGame&&innerHeight>innerWidth);landscapeGateEl.style.display=portrait?'flex':'none';if(portrait&&hudEditMode)setHudEditMode(false);if(hudEditBtn)hudEditBtn.style.display=mobileTouchEnabled&&inGame&&!portrait?'block':'none';const msb=document.getElementById('mobileSettingsBtn');if(msb)msb.style.display=mobileTouchEnabled&&inGame&&!portrait?'block':'none';if(portrait){resetMobileStick();mobileControlsEl?.querySelectorAll('button[data-hud-key]').forEach(b=>{const m=b.dataset.mobileHold;if(m){keys[{throttle:'KeyW',brake:'KeyS',boost:'ShiftLeft',fire:'Space',missile:'KeyF',rear:'KeyX',mayday:'KeyG'}[m]]=false;mobileInput[m]=false}})}}
async function requestLandscapeForGame(){if(!mobileTouchEnabled)return;const root=document.documentElement;try{if(!document.fullscreenElement&&root.requestFullscreen)await root.requestFullscreen({navigationUI:'hide'})}catch(_){}try{if(screen.orientation&&typeof screen.orientation.lock==='function')await screen.orientation.lock('landscape')}catch(_){}updateLandscapeGate()}
function beginHudDrag(e,el){if(!hudEditMode||!el)return;const key=hudKeyFor(el);if(!key)return;e.preventDefault();e.stopImmediatePropagation();selectedHudKey=key;hudDragEl=el;hudDragPointer=e.pointerId;const r=el.getBoundingClientRect();hudDragOffset={x:e.clientX-r.left,y:e.clientY-r.top};el.setPointerCapture?.(e.pointerId);syncHudEditorForSelection()}
mobileControlsEl?.addEventListener('pointerdown',e=>{if(!hudEditMode)return;const el=e.target.closest('.mobileStick,button[data-hud-key]');if(el)beginHudDrag(e,el)},true);
document.addEventListener('pointermove',e=>{if(!hudEditMode||!hudDragEl||e.pointerId!==hudDragPointer)return;e.preventDefault();const w=hudDragEl.getBoundingClientRect().width,h=hudDragEl.getBoundingClientRect().height;const x=Math.max(0,Math.min(innerWidth-w,e.clientX-hudDragOffset.x)),y=Math.max(0,Math.min(innerHeight-h,e.clientY-hudDragOffset.y));hudDragEl.style.left=`${x}px`;hudDragEl.style.top=`${y}px`},{capture:true,passive:false});
function endHudDrag(e){if(!hudDragEl||(e?.pointerId!=null&&e.pointerId!==hudDragPointer))return;hudDragEl=null;hudDragPointer=null;writeMobileHudLayout()}
document.addEventListener('pointerup',endHudDrag,true);document.addEventListener('pointercancel',endHudDrag,true);
hudEditBtn?.addEventListener('click',()=>setHudEditMode(!hudEditMode));document.getElementById('hudDoneBtn')?.addEventListener('click',()=>setHudEditMode(false));
document.getElementById('hudResetBtn')?.addEventListener('click',()=>{hudLayoutState.items=normalizeHudItems(DEFAULT_MOBILE_HUD);hudLayoutState.slots[activeHudSlot]=cloneJson(hudLayoutState.items);persistHudState();applyMobileHudLayout(true);toast('HUD LAYOUT RESET')});
document.querySelectorAll('[data-preset]').forEach(btn=>btn.addEventListener('click',()=>{const positions=btn.dataset.preset==='four'?FOUR_FINGER_PRESET:TWO_THUMB_PRESET;const items=currentHudItems();for(const [k,p] of Object.entries(positions))items[k]={...(items[k]||{}),x:p.x,y:p.y};hudLayoutState.items=items;persistHudState();applyMobileHudLayout(true);toast(btn.dataset.preset==='four'?'FOUR-FINGER PRESET APPLIED':'TWO-THUMB PRESET APPLIED')}));
document.getElementById('hudControlSelect')?.addEventListener('change',e=>{selectedHudKey=e.target.value;syncHudEditorForSelection()});
document.getElementById('hudSlotSelect')?.addEventListener('change',e=>{activeHudSlot=e.target.value;hudLayoutState.activeSlot=activeHudSlot;persistHudState()});
document.getElementById('hudSaveSlotBtn')?.addEventListener('click',()=>{writeMobileHudLayout();hudLayoutState.slots[activeHudSlot]=cloneJson(currentHudItems());persistHudState();toast(`LAYOUT ${activeHudSlot} SAVED`)});
document.getElementById('hudLoadSlotBtn')?.addEventListener('click',()=>{hudLayoutState.items=normalizeHudItems(hudLayoutState.slots[activeHudSlot]||DEFAULT_MOBILE_HUD);applyMobileHudLayout(true);toast(`LAYOUT ${activeHudSlot} LOADED`)});
document.getElementById('hudSizeRange')?.addEventListener('input',e=>{const cfg=currentHudItems()[selectedHudKey];if(!cfg)return;cfg.size=Number(e.target.value)||1;const out=document.getElementById('hudSizeValue');if(out)out.textContent=Math.round(cfg.size*100)+'%';for(const el of mobileHudItems())if(hudKeyFor(el)===selectedHudKey)applyHudItemStyle(el,selectedHudKey);writeMobileHudLayout()});
document.getElementById('hudOpacityRange')?.addEventListener('input',e=>{const cfg=currentHudItems()[selectedHudKey];if(!cfg)return;cfg.opacity=Number(e.target.value)||1;const out=document.getElementById('hudOpacityValue');if(out)out.textContent=Math.round(cfg.opacity*100)+'%';for(const el of mobileHudItems())if(hudKeyFor(el)===selectedHudKey)applyHudItemStyle(el,selectedHudKey);writeMobileHudLayout()});
document.getElementById('hudHideControl')?.addEventListener('change',e=>{const cfg=currentHudItems()[selectedHudKey];if(!cfg)return;cfg.hidden=e.target.checked;for(const el of mobileHudItems())if(hudKeyFor(el)===selectedHudKey)applyHudItemStyle(el,selectedHudKey);writeMobileHudLayout()});
document.getElementById('hudShowLabels')?.addEventListener('change',e=>{mobilePrefs.showLabels=e.target.checked;persistMobilePreferences();for(const el of mobileHudItems())applyHudItemStyle(el,hudKeyFor(el))});
document.getElementById('retryLandscapeBtn')?.addEventListener('click',requestLandscapeForGame);

// Orientation locking must be requested within the user's tap gesture when supported.
document.addEventListener('pointerdown',e=>{if(!mobileTouchEnabled||inGame)return;if(e.target.closest('#practiceMode,#hostMode,#join,#acceptSocialInvite,#start'))requestLandscapeForGame()},{capture:true});
function mobileSettingValue(id){return document.getElementById(id)}
function syncMobileSettingsUi(){const setRange=(id,value,out,mult='×')=>{const el=mobileSettingValue(id),o=mobileSettingValue(out);if(el)el.value=value;if(o)o.textContent=Number(value).toFixed(1)+mult};setRange('mobileJoystickSensitivity',mobilePrefs.joystickSensitivity,'mobileJoystickSensitivityValue');setRange('mobileCameraSensitivity',mobilePrefs.cameraSensitivity,'mobileCameraSensitivityValue');for(const [id,key] of [['mobileInvertPitch','invertPitch'],['mobileAutoLevel','autoLevel'],['mobileShowFps','showFps'],['mobileVibrateHit','vibrateOnHit']]){const el=mobileSettingValue(id);if(el)el.checked=!!mobilePrefs[key]}const fm=mobileSettingValue('mobileFlightModel'),gp=mobileSettingValue('mobileGraphicsPreset'),support=mobileSettingValue('mobileVibrationSupport');if(fm)fm.value=mobilePrefs.flightModel;if(gp)gp.value=mobilePrefs.graphicsPreset;if(support)support.textContent=('vibrate' in navigator)?'':'Not supported'}
function applyGraphicsPreset(preset,save=true){const allowed=['low','medium','high'];graphicsPreset=allowed.includes(preset)?preset:'medium';mobilePrefs.graphicsPreset=graphicsPreset;const cfg=graphicsPreset==='low'?{dpr:TOUCH_DEVICE ? .82 : 1,shadow:false,shadowSize:512,particles:150,fogNear:4300,fogFar:14000}:graphicsPreset==='medium'?{dpr:TOUCH_DEVICE?1.05:1.35,shadow:true,shadowSize:1024,particles:360,fogNear:5500,fogFar:17000}:{dpr:TOUCH_DEVICE?1.3:1.75,shadow:true,shadowSize:2048,particles:700,fogNear:6000,fogFar:18500};particleBudget=cfg.particles;graphicsFogNear=cfg.fogNear;graphicsFogFar=cfg.fogFar;ren.setPixelRatio(Math.min(devicePixelRatio,cfg.dpr));ren.setSize(innerWidth,innerHeight);ren.shadowMap.enabled=cfg.shadow;sun.castShadow=cfg.shadow;sun.shadow.mapSize.set(cfg.shadowSize,cfg.shadowSize);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}ren.shadowMap.needsUpdate=true;scene.fog.near=cfg.fogNear;scene.fog.far=cfg.fogFar;if(save)persistMobilePreferences()}
let graphicsPreset=mobilePrefs.graphicsPreset,graphicsFogNear=6000,graphicsFogFar=18500;
function openMobileSettings(){if(!mobileTouchEnabled)return;if(hudEditMode)setHudEditMode(false);setMobileVisible(false);syncMobileSettingsUi();const panel=mobileSettingValue('mobileSettingsPanel');if(panel)panel.style.display='flex';}
function closeMobileSettings(){const panel=mobileSettingValue('mobileSettingsPanel');if(panel)panel.style.display='none';if(inGame&&!spectatorMode&&!hudEditMode)setMobileVisible(true)}
mobileSettingValue('mobileSettingsBtn')?.addEventListener('click',openMobileSettings);mobileSettingValue('mobileSettingsDone')?.addEventListener('click',closeMobileSettings);mobileSettingValue('mobileSettingsPanel')?.addEventListener('click',e=>{if(e.target.id==='mobileSettingsPanel')closeMobileSettings()});
mobileSettingValue('mobileJoystickSensitivity')?.addEventListener('input',e=>{mobilePrefs.joystickSensitivity=Number(e.target.value)||1;syncMobileSettingsUi();persistMobilePreferences()});mobileSettingValue('mobileCameraSensitivity')?.addEventListener('input',e=>{mobilePrefs.cameraSensitivity=Number(e.target.value)||1;syncMobileSettingsUi();persistMobilePreferences()});
mobileSettingValue('mobileInvertPitch')?.addEventListener('change',e=>{mobilePrefs.invertPitch=e.target.checked;invert=mobilePrefs.invertPitch?1:-1;const invBox=document.getElementById('inv');if(invBox)invBox.checked=mobilePrefs.invertPitch;saveSet();persistMobilePreferences()});
mobileSettingValue('mobileAutoLevel')?.addEventListener('change',e=>{mobilePrefs.autoLevel=e.target.checked;persistMobilePreferences()});mobileSettingValue('mobileFlightModel')?.addEventListener('change',e=>{mobilePrefs.flightModel=e.target.value==='realistic'?'realistic':'arcade';persistMobilePreferences();toast('FLIGHT MODEL: '+mobilePrefs.flightModel.toUpperCase())});mobileSettingValue('mobileGraphicsPreset')?.addEventListener('change',e=>{applyGraphicsPreset(e.target.value);toast('GRAPHICS: '+graphicsPreset.toUpperCase())});mobileSettingValue('mobileShowFps')?.addEventListener('change',e=>{mobilePrefs.showFps=e.target.checked;const meter=mobileSettingValue('fpsMeter');if(meter)meter.style.display=mobilePrefs.showFps?'block':'none';persistMobilePreferences()});mobileSettingValue('mobileVibrateHit')?.addEventListener('change',e=>{mobilePrefs.vibrateOnHit=e.target.checked;persistMobilePreferences();if(e.target.checked&&navigator.vibrate)navigator.vibrate(20)});
mobileSettingValue('mobileSettingsReset')?.addEventListener('click',()=>{mobilePrefs={...mobilePrefs,joystickSensitivity:1,cameraSensitivity:1,invertPitch:false,autoLevel:false,flightModel:'arcade',graphicsPreset:TOUCH_DEVICE?'medium':'high',showFps:false,vibrateOnHit:!!TOUCH_DEVICE,showLabels:true};invert=-1;const invBox=document.getElementById('inv');if(invBox)invBox.checked=false;saveSet();persistMobilePreferences();applyGraphicsPreset(mobilePrefs.graphicsPreset,false);const meter=mobileSettingValue('fpsMeter');if(meter)meter.style.display='none';syncMobileSettingsUi();toast('MOBILE SETTINGS RESET')});
let lastHitVibration=0;function vibrateOnHit(amount=10){if(!mobileTouchEnabled||!mobilePrefs.vibrateOnHit||typeof navigator.vibrate!=='function')return;const now=performance.now();if(now-lastHitVibration<180)return;lastHitVibration=now;try{navigator.vibrate(amount>=35?[45,28,65]:amount>=15?35:18)}catch(_){}}
let fpsFrames=0,fpsLast=performance.now(),fpsAverage=0;const fpsMeter=mobileSettingValue('fpsMeter');function updateFpsMeter(dt){if(!mobilePrefs.showFps)return;fpsFrames++;const now=performance.now();if(now-fpsLast>=400){const elapsed=now-fpsLast,instant=fpsFrames*1000/Math.max(1,elapsed);fpsAverage=fpsAverage?fpsAverage*.65+instant*.35:instant;if(fpsMeter){fpsMeter.textContent=`FPS ${Math.round(fpsAverage)} · ${graphicsPreset.toUpperCase()}`;fpsMeter.style.display='block'}fpsFrames=0;fpsLast=now}}
function touchLookStart(e){if(!mobileTouchEnabled||!inGame||!alive||hudEditMode||mobileSettingValue('mobileSettingsPanel')?.style.display==='flex'||e.pointerType!=='touch')return;if(mobileLookPointer!==null)return;mobileLookPointer=e.pointerId;mobileLookLast={x:e.clientX,y:e.clientY};try{ren.domElement.setPointerCapture(e.pointerId)}catch(_){}e.preventDefault()}
function touchLookMove(e){if(!mobileTouchEnabled||mobileLookPointer!==e.pointerId)return;const dx=e.clientX-mobileLookLast.x,dy=e.clientY-mobileLookLast.y;mobileLookLast={x:e.clientX,y:e.clientY};mobileCameraYaw=T.MathUtils.clamp(mobileCameraYaw-dx*.006*mobilePrefs.cameraSensitivity,-2.25,2.25);mobileCameraPitch=T.MathUtils.clamp(mobileCameraPitch-dy*.005*mobilePrefs.cameraSensitivity,-.72,.72);e.preventDefault()}
function touchLookEnd(e){if(e&&mobileLookPointer!==e.pointerId)return;mobileLookPointer=null}
ren.domElement.style.touchAction=mobileTouchEnabled?'none':'auto';ren.domElement.addEventListener('pointerdown',touchLookStart,{passive:false});ren.domElement.addEventListener('pointermove',touchLookMove,{passive:false});ren.domElement.addEventListener('pointerup',touchLookEnd);ren.domElement.addEventListener('pointercancel',touchLookEnd);
{invert=mobilePrefs.invertPitch?1:-1;const invBox=document.getElementById('inv');if(invBox)invBox.checked=!!mobilePrefs.invertPitch}
syncMobileSettingsUi();applyGraphicsPreset(graphicsPreset,false);if(fpsMeter)fpsMeter.style.display=mobilePrefs.showFps?'block':'none';persistHudState();

applyMobileHudLayout(true);
addEventListener('orientationchange',()=>setTimeout(()=>{applyMobileHudLayout(true);updateLandscapeGate()},120));

let mobileStickPointer=null;
function resetMobileStick(){mobileStickPointer=null;mobileInput.pitch=mobileInput.yaw=mobileInput.roll=0;if(mobileStickNub)mobileStickNub.style.transform='translate(0px,0px)'}
function setMobileVisible(visible){if(!mobileControlsEl)return;mobileControlsEl.classList.toggle('active',!!visible&&mobileTouchEnabled);if(!visible){Object.keys(mobileInput).forEach(k=>mobileInput[k]=false);resetMobileStick();mobileControlsEl.querySelectorAll('button.active').forEach(b=>b.classList.remove('active'))}}
function mobileDeployFlares(){if(!inGame||!alive||flares<=0||performance.now()<=flareCooldown||!plane)return;flareCooldown=performance.now()+900;flares--;const p=tailPos(plane).addScaledVector(fw.clone().multiplyScalar(-24),1);createFlare(p,myId);if(practiceMode)toast('FLARES DEPLOYED • '+flares+' left');else if(ws&&ws.readyState===1)ws.send(JSON.stringify({t:'flare',p:p.toArray()}))}
function mobileActivateShield(){if(roomMode==='clash'&&alive&&shields>0&&performance.now()>shieldUntil&&ws&&ws.readyState===1)ws.send(JSON.stringify({t:'shield'}));else if(roomMode!=='clash')toast('Shield is only available in Clash Squad')}
function updateMobileStick(e){if(!mobileStickEl||mobileStickPointer!==e.pointerId)return;const r=mobileStickEl.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=Math.max(12,r.width*.34),len=Math.hypot(dx,dy),k=len>max?max/len:1,x=dx*k,y=dy*k;mobileInput.yaw=T.MathUtils.clamp(x/max,-1,1);mobileInput.roll=mobileInput.yaw;mobileInput.pitch=T.MathUtils.clamp(y/max,-1,1);if(mobileStickNub)mobileStickNub.style.transform=`translate(${x}px,${y}px)`}
if(mobileStickEl){mobileStickEl.addEventListener('pointerdown',e=>{if(!inGame||spectatorMode||!alive)return;e.stopPropagation();mobileStickPointer=e.pointerId;mobileStickEl.setPointerCapture?.(e.pointerId);initAudio();updateMobileStick(e);e.preventDefault()});mobileStickEl.addEventListener('pointermove',e=>{if(mobileStickPointer===e.pointerId){updateMobileStick(e);e.preventDefault()}});const stopStick=e=>{if(mobileStickPointer===e.pointerId)resetMobileStick()};mobileStickEl.addEventListener('pointerup',stopStick);mobileStickEl.addEventListener('pointercancel',stopStick);mobileStickEl.addEventListener('lostpointercapture',resetMobileStick)}
if(mobileControlsEl){mobileControlsEl.querySelectorAll('[data-mobile-hold]').forEach(btn=>{const action=btn.dataset.mobileHold;const start=e=>{if(!inGame||spectatorMode)return;e.preventDefault();e.stopPropagation();btn.setPointerCapture?.(e.pointerId);initAudio();btn.classList.add('active');if(action==='mayday'){mobileInput.mayday=true;toast('HOLD TO SEND MAYDAY');clearMaydayHold();maydayHoldTimer=setTimeout(()=>{maydayHoldTimer=0;if(inGame&&roomMode==='clash'&&!spectatorMode&&ws&&ws.readyState===1)ws.send(JSON.stringify({t:'quickalert'}))},1100);return}const map={throttle:'KeyW',brake:'KeyS',boost:'ShiftLeft',fire:'Space',missile:'KeyF',rear:'KeyX'};if(map[action]){keys[map[action]]=true;mobileInput[action]=true}};const stop=e=>{btn.classList.remove('active');if(action==='mayday'){mobileInput.mayday=false;clearMaydayHold();return}const map={throttle:'KeyW',brake:'KeyS',boost:'ShiftLeft',fire:'Space',missile:'KeyF',rear:'KeyX'};if(map[action])keys[map[action]]=false;mobileInput[action]=false;e?.preventDefault?.()};btn.addEventListener('pointerdown',start);btn.addEventListener('pointerup',stop);btn.addEventListener('pointercancel',stop);btn.addEventListener('lostpointercapture',stop);btn.addEventListener('contextmenu',e=>e.preventDefault())});mobileControlsEl.querySelectorAll('[data-mobile-tap]').forEach(btn=>{btn.addEventListener('pointerdown',e=>{if(!inGame||spectatorMode)return;e.preventDefault();e.stopPropagation();initAudio();btn.classList.add('active');const action=btn.dataset.mobileTap;if(action==='flare')mobileDeployFlares();else if(action==='shield')mobileActivateShield();else if(action==='camera'){camMode=(camMode+1)%3;mobileCameraYaw=0;mobileCameraPitch=0;}setTimeout(()=>btn.classList.remove('active'),130)})})}

const TEAM_SPAWN_IDS=['blue','red','green','yellow','purple','orange'];
// Six well-separated Clash Squad spawn zones. The zone assigned to a team is
// pseudo-randomized every round (from the room code + round number), so no team
// is permanently tied to one side of the map. Every client derives the same
// assignment, keeping all players synchronized without an extra network message.
const CLASH_SPAWN_ZONES=[
  {x:-5200,z:-500},{x:5200,z:500},{x:-3600,z:3900},
  {x:3600,z:-3900},{x:-1200,z:-5200},{x:1200,z:5200}
];
function hashText(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function seededRand(seed){seed=((seed>>>0)^0x9e3779b9)>>>0;seed=Math.imul(seed^(seed>>>16),0x45d9f3b);seed=Math.imul(seed^(seed>>>16),0x45d9f3b);seed=(seed^(seed>>>16))>>>0;return seed/4294967296}
function clashSpawn(team,round=roundNo,playerId=myId){
  const active=TEAM_SPAWN_IDS.slice(0,Math.max(2,teamCount));
  const baseSeed=hashText(`${roomCode}|CS|${round}`);
  const zones=CLASH_SPAWN_ZONES.map((z,i)=>({...z,i}));
  // Deterministic Fisher-Yates shuffle: same room/round => same assignment for everyone.
  for(let i=zones.length-1;i>0;i--){const j=Math.floor(seededRand(baseSeed+i*7919)*(i+1));[zones[i],zones[j]]=[zones[j],zones[i]]}
  const ti=Math.max(0,active.indexOf(team));
  const zone=zones[ti%zones.length];
  const seed=hashText(`${roomCode}|CS|${round}|${team}|${playerId||0}`);
  const a=seededRand(seed)*Math.PI*2;
  const rad=seededRand(seed^0x7f4a7c15)*380+150;
  // Give members of the same team a compact formation around their team's randomized zone.
  let x=zone.x+Math.cos(a)*rad,z=zone.z+Math.sin(a)*rad;
  // Avoid runways/cities/buildings if a randomized point lands too close to a structure.
  for(let attempt=0;attempt<12&&tooCloseToStructures(x,z);attempt++){
    const aa=seededRand(seed+attempt*31337)*Math.PI*2,rr=seededRand(seed+attempt*27183)*360+180;
    x=zone.x+Math.cos(aa)*rr;z=zone.z+Math.sin(aa)*rr;
  }
  const h=Math.max(height(x,z),0);
  // Face toward the center of the battlefield rather than using a fixed runway direction.
  const heading=Math.atan2(-x,z);
  return {x,z,y:h,heading};
}
function reset(){let x,z,y,hd;
 if(roomMode==='practice'){x=0;z=0;y=Math.max(height(x,z),0)+900;hd=0}
 else if(roomMode==='ffa'||roomMode==='survivor'){x=(Math.random()-.5)*2400;z=(Math.random()-.5)*2400;y=Math.max(height(x,z),0)+450;hd=Math.random()*6.283}
 else{const b=clashSpawn(myTeam,roundNo,myId);x=b.x;z=b.z;y=b.y+520;hd=b.heading}
 plane.position.set(x,y,z);plane.quaternion.setFromAxisAngle(new T.Vector3(0,1,0),hd);speed=75;throttle=.6;boost=100;lockId=null;lockT=0;flares=3;flareCooldown=0;landed=false;landingStrip=null;spawnGrace=performance.now()+4000;plane.visible=true;deathCamActive=false;deathCamUntil=0;killCamActive=false;killCamAttackerId=null}
const PRACTICE_BOT_DEFS=[
 {id:'practice-1',c:'#FF6B00',r:1100,a:850,turn:.28,phase:0},
 {id:'practice-2',c:'#2F80ED',r:1450,a:1080,turn:.22,phase:1.1},
 {id:'practice-3',c:'#A8E063',r:1750,a:1320,turn:.18,phase:2.2},
 {id:'practice-4',c:'#D946EF',r:2100,a:960,turn:.14,phase:3.15},
 {id:'practice-5',c:'#F2C94C',r:2500,a:1500,turn:.11,phase:4.0},
 {id:'practice-6',c:'#00C2FF',r:3000,a:1180,turn:.09,phase:5.1}
];
const PRACTICE_DIFFICULTIES={
 easy:{cone:0.95,range:2500,fireMin:1.55,fireMax:2.2,spread:.09,lead:.18,gunDamage:5,missileCooldown:15,missileLock:2.8,missileRange:2200,missileChance:.18,missileDamage:26},
 normal:{cone:1.0,range:3400,fireMin:1.0,fireMax:1.45,spread:.045,lead:.42,gunDamage:7,missileCooldown:10,missileLock:2.0,missileRange:3000,missileChance:.38,missileDamage:34},
 hard:{cone:1.08,range:4300,fireMin:.52,fireMax:.92,spread:.018,lead:.72,gunDamage:9,missileCooldown:7,missileLock:1.35,missileRange:3900,missileChance:.62,missileDamage:42}
};
function practiceCfg(){return PRACTICE_DIFFICULTIES[practiceDifficulty]||PRACTICE_DIFFICULTIES.normal}
function practiceAimDirection(from,target,spread){
 const d=target.clone().sub(from);if(d.lengthSq()<1)return d.set(0,0,-1);
 d.normalize();
 if(spread>0){const side=new T.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize();d.addScaledVector(side,spread).normalize()}
 return d;
}
function makePracticeArena(){
 clearPracticeTargets();
 practiceClock=performance.now();
 PRACTICE_BOT_DEFS.forEach((d,i)=>{
   const mesh=makePlane(d.c,'fighter');
   const r={mesh,p:[0,900,0],q:[0,0,0,1],hp:100,mh:100,alive:true,team:'practice-bot',colorId:d.id,c:d.c,practice:true,r:d.r,a:d.a,turn:d.turn,phase:d.phase,respawnAt:0,sc:0,protEnd:0,shieldUntil:0,nextFire:performance.now()+700+i*180,nextMissile:performance.now()+5000+i*1100,botLock:0};
   mesh.userData.team='practice-bot';mesh.userData.col=d.c;mesh.position.set(Math.cos(d.phase)*d.r,d.a,Math.sin(d.phase)*d.r*.72);mesh.lookAt(new T.Vector3(mesh.position.x-Math.sin(d.phase)*500,mesh.position.y+25,mesh.position.z+Math.cos(d.phase)*500));
   r.p=mesh.position.toArray();r.q=mesh.quaternion.toArray();remotes[d.id]=r;
   snapPlayers[d.id]={n:`DRONE ${i+1}`,c:d.c,team:'practice-bot',alive:true,hp:100,mh:100,sc:0};
 });
}
function updatePracticeBots(now,dt){
 if(!practiceMode)return;
 const cfg=practiceCfg();
 const t=(now-practiceClock)/1000;
 for(const d of PRACTICE_BOT_DEFS){
   const r=remotes[d.id];if(!r)continue;
   if(!r.alive){r.mesh.visible=false;if(now>=r.respawnAt){r.alive=true;r.hp=r.mh;r.nextFire=now+700+Math.random()*800;r.nextMissile=now+6500+Math.random()*4000;r.botLock=0;const ang=d.phase+t*d.turn*0.25;r.mesh.position.set(Math.cos(ang)*d.r,d.a,Math.sin(ang)*d.r*.72);r.mesh.lookAt(new T.Vector3(r.mesh.position.x-Math.sin(ang)*500,r.mesh.position.y+25,r.mesh.position.z+Math.cos(ang)*500));r.p=r.mesh.position.toArray();r.q=r.mesh.quaternion.toArray();snapPlayers[d.id].alive=true;snapPlayers[d.id].hp=r.hp}continue}
   const ang=d.phase+t*d.turn+Math.sin(t*.35+d.phase)*.12;
   const rad=d.r+Math.sin(t*.33+d.phase)*150;
   const x=Math.cos(ang)*rad,z=Math.sin(ang)*rad*.72,y=d.a+Math.sin(t*.65+d.phase)*120+Math.cos(t*.27+d.phase)*55;
   const vx=-Math.sin(ang)*d.turn*rad, vz=Math.cos(ang)*d.turn*rad*.72;
   r.mesh.position.set(x,y,z);r.mesh.lookAt(new T.Vector3(x+vx*8,y+18+Math.sin(t+d.phase)*18,z+vz*8));r.p=r.mesh.position.toArray();r.q=r.mesh.quaternion.toArray();r.mesh.visible=true;
   snapPlayers[d.id].alive=true;snapPlayers[d.id].hp=r.hp;snapPlayers[d.id].sc=r.sc;

   // Defensive AI: target the player, lead the target, and vary accuracy by difficulty.
   if(!alive||now<spawnGrace+900)continue;
   const toPlayer=plane.position.clone().sub(r.mesh.position),dist=toPlayer.length();
   if(dist>cfg.range) { r.botLock=Math.max(0,r.botLock-dt*.8); continue; }
   const botFw=new T.Vector3(0,0,-1).applyQuaternion(r.mesh.quaternion);
   const direct=toPlayer.clone().normalize();
   const facing=botFw.angleTo(direct);
   if(facing<cfg.cone){r.botLock+=dt}else r.botLock=Math.max(0,r.botLock-dt*.9);

   if(facing<cfg.cone && now>=r.nextFire){
      const predicted=plane.position.clone().add(fw.clone().multiplyScalar(Math.min(1.2,cfg.lead)*speed*1.6));
      const dir=practiceAimDirection(r.mesh.position,predicted,cfg.spread);
      const origin=new T.Vector3(0,0,-26).applyQuaternion(r.mesh.quaternion).add(r.mesh.position);
      const b=spawnBullet(origin.toArray(),dir.clone().multiplyScalar(760).toArray(),false);b.practiceBot=true;b.damage=cfg.gunDamage;b.from=d.id;
      gunSound();
      r.nextFire=now+(cfg.fireMin+Math.random()*(cfg.fireMax-cfg.fireMin))*1000;
   }
   if(facing<cfg.cone && r.botLock>=cfg.missileLock && dist<=cfg.missileRange && now>=r.nextMissile && Math.random()<cfg.missileChance*dt*3){
      const predicted=plane.position.clone().add(fw.clone().multiplyScalar(Math.min(1.4,cfg.lead+.25)*speed*1.6));
      const dir=practiceAimDirection(r.mesh.position,predicted,cfg.spread*.6).multiplyScalar(Math.max(330,speed*1.35+150));
      const origin=new T.Vector3(0,0,-34).applyQuaternion(r.mesh.quaternion).add(r.mesh.position);
      spawnMissile(origin.toArray(),dir.toArray(),myId,false,d.id);const ms=missiles[missiles.length-1];if(ms){ms.practiceBot=true;ms.damage=cfg.missileDamage}
      missileLaunchSound();missileFlySound(true);r.nextMissile=now+cfg.missileCooldown*1000;r.botLock=0;toast(`⚠ ${i18nBotName(d.id)} launched a missile`);
   }
 }
}
function i18nBotName(id){return 'DRONE '+String(id).split('-')[1]}
function practicePlayerHit(amount,source){
 if(!practiceMode||!alive||performance.now()<spawnGrace)return;
 hp=Math.max(0,hp-amount);vibrateOnHit(amount);shake=Math.max(shake,.12+(amount>20?.22:0));
 const sourceLabel=i18nBotName(source);if(hp>0){toast(`HIT BY ${sourceLabel} • ${Math.round(hp)} HP`);return}
 const cp=plane.position.clone();const gy=Math.max(height(cp.x,cp.z),0);cp.y=Math.max(cp.y,gy+3);
 explode(cp,true);createCrashFire(cp,2800);alive=false;plane.visible=false;practiceRespawnAt=performance.now()+2200;toast(`${sourceLabel} SHOT YOU DOWN • RESPAWNING`);
}
function practiceBotHit(id,amount){
 if(!practiceMode)return;const r=remotes[id];if(!r||!r.practice||!r.alive)return;
 r.hp-=amount;snapPlayers[id].hp=Math.max(0,r.hp);
 if(r.hp<=0){r.hp=0;r.alive=false;r.respawnAt=performance.now()+1800;r.sc=(r.sc||0)+1;snapPlayers[id].alive=false;snapPlayers[id].hp=0;snapPlayers[id].sc=r.sc;practiceKills++;const cp=r.mesh.position.clone();explode(cp,true);createCrashFire(cp,2800);r.mesh.visible=false;showKillConfirm(`DRONE ${id.split('-')[1]}`);toast(`TARGET DRONE ${id.split('-')[1]} DESTROYED • ${practiceKills} hits`)}
 else if(r.hp<70){toast(`DRONE ${id.split('-')[1]} HIT • ${Math.round(r.hp)} HP`)}
}
function sendPlaneState(){if(ws&&plane&&alive&&ws.readyState===1)ws.send(JSON.stringify({t:'s',p:plane.position.toArray(),q:plane.quaternion.toArray()}))}
const toastEl=document.getElementById('toast');let toastT=0;
function toast(s){toastEl.textContent=s;clearTimeout(toastT);toastT=setTimeout(()=>toastEl.textContent='',2500)}
const replayBtnText='↻ KILL REPLAY  (P)';
const killerReplayBtnText='↻ KILL REPLAY • KILLER POV  (P)';
function recordKillReplayFrame(now){
  if(!inGame||practiceMode||!alive||spectatorMode||!plane||killReplayActive)return;
  // Keep the victim's flight and every nearby pilot's transform so the killer camera can be reconstructed.
  const rem={};for(const id in remotes){const r=remotes[id];if(!r||!r.mesh)continue;rem[String(id)]={p:r.mesh.position.toArray(),q:r.mesh.quaternion.toArray(),v:!!r.mesh.visible}}
  killReplayHistory.push({t:now,p:plane.position.toArray(),q:plane.quaternion.toArray(),pv:!!plane.visible,cp:cam.position.toArray(),cq:cam.quaternion.toArray(),up:cam.up.toArray(),fov:cam.fov,rem});
  while(killReplayHistory.length&&killReplayHistory[0].t<now-KILL_REPLAY_HISTORY_MS)killReplayHistory.shift();
}
function prepareKillReplay(attackerId=null){
 if(practiceMode){killReplayHistory.length=0;killReplayClip=[];killReplayAvailableUntil=0;killReplayAttackerId=null;if(killReplayBtn)killReplayBtn.style.display='none';return}
 if(!inGame||spectatorMode)return;
 const now=performance.now(),requestedId=attackerId!==null&&attackerId!==undefined&&String(attackerId)!==''?String(attackerId):null;
 if(killReplayActive)finishKillReplay();
 // A kill broadcast and its follow-up dead event may arrive together; preserve the first valid attacker.
 if(now-killReplayPreparedAt<900){if(requestedId&&killReplayClip.some(s=>(s.rem&&s.rem[requestedId]))){killReplayAttackerId=requestedId;if(killReplayBtn)killReplayBtn.textContent=killerReplayBtnText}return}
 unlockMaydayPointer();
 const clip=killReplayHistory.filter(s=>s.t<=now+80&&s.t>=now-KILL_REPLAY_WINDOW);
 if(clip.length<4){killReplayAttackerId=null;killReplayClip=[];killReplayAvailableUntil=0;if(killReplayBtn)killReplayBtn.style.display='none';return}
 const actorFrames=requestedId?clip.reduce((n,s)=>n+((s.rem&&s.rem[requestedId])?1:0),0):0;
 killReplayAttackerId=actorFrames>=Math.max(3,Math.floor(clip.length*.15))?requestedId:null;
 killReplayPreparedAt=now;killReplayClip=clip;killReplayAvailableUntil=now+KILL_REPLAY_AVAILABLE_MS;
 if(killReplayBtn){killReplayBtn.textContent=killReplayAttackerId?killerReplayBtnText:replayBtnText;killReplayBtn.style.display='block';killReplayBtn.disabled=false;}
}
function startKillReplay(){
  if(killReplayActive){finishKillReplay();return}
  if(!inGame||practiceMode||spectatorMode||!plane||killReplayClip.length<2||performance.now()>=killReplayAvailableUntil){if(killReplayBtn)killReplayBtn.style.display='none';return}
  const first=killReplayClip[0],last=killReplayClip[killReplayClip.length-1];
  killReplayResume={p:plane.position.clone(),q:plane.quaternion.clone(),visible:plane.visible,cp:cam.position.clone(),cq:cam.quaternion.clone(),up:cam.up.clone(),fov:cam.fov,speed,throttle,boost,winDisplay:winEl.style.display,bannerDisplay:bannerEl.style.display};
  winEl.style.display='none';bannerEl.style.display='none';
  killReplayStartedAt=performance.now();killReplayDuration=Math.max(900,last.t-first.t);killReplayActive=true;
  Object.keys(keys).forEach(k=>keys[k]=false);mouseDX=0;mouseDY=0;lockId=null;lockT=0;lastLockSync=performance.now();unlockMaydayPointer();
  if(killReplayBtn){killReplayBtn.textContent=killReplayAttackerId?'✕ EXIT REPLAY • KILLER POV  (P)':'✕ EXIT REPLAY  (P)';killReplayBtn.style.display='block';}
  toast(killReplayAttackerId?'KILL REPLAY • KILLER POV • PRESS P TO EXIT':'KILL REPLAY • PRESS P TO EXIT');
}
function finishKillReplay(){
  if(!killReplayActive)return;
  killReplayActive=false;
  if(killReplayResume&&plane){plane.position.copy(killReplayResume.p);plane.quaternion.copy(killReplayResume.q);plane.visible=!!alive&&camMode!==1;speed=killReplayResume.speed;throttle=killReplayResume.throttle;boost=killReplayResume.boost;cam.position.copy(killReplayResume.cp);cam.quaternion.copy(killReplayResume.cq);cam.up.copy(killReplayResume.up);cam.fov=killReplayResume.fov;cam.updateProjectionMatrix();cam.updateMatrixWorld();winEl.style.display=killReplayResume.winDisplay;bannerEl.style.display=killReplayResume.bannerDisplay;}
  for(const id in remotes){const r=remotes[id];if(!r||!r.mesh||!r.p||!r.q)continue;r.mesh.position.fromArray(r.p);r.mesh.quaternion.fromArray(r.q);r.mesh.visible=r.alive!==false;}
  killReplayResume=null;if(killReplayBtn){if(performance.now()<killReplayAvailableUntil&&killReplayClip.length>1){killReplayBtn.textContent=killReplayAttackerId?killerReplayBtnText:replayBtnText;killReplayBtn.style.display='block'}else killReplayBtn.style.display='none'}
}
function advanceKillReplay(now){
  if(!killReplayActive||!killReplayClip.length||!plane)return;
  const first=killReplayClip[0],last=killReplayClip[killReplayClip.length-1],progress=Math.min(1,(now-killReplayStartedAt)/killReplayDuration);
  const target=first.t+(last.t-first.t)*progress;let i=0;while(i<killReplayClip.length-2&&killReplayClip[i+1].t<target)i++;
  const a=killReplayClip[i],b=killReplayClip[Math.min(i+1,killReplayClip.length-1)],span=Math.max(1,b.t-a.t),f=T.MathUtils.clamp((target-a.t)/span,0,1);
  plane.position.lerpVectors(new T.Vector3().fromArray(a.p),new T.Vector3().fromArray(b.p),f);plane.quaternion.slerpQuaternions(new T.Quaternion().fromArray(a.q),new T.Quaternion().fromArray(b.q),f);plane.visible=progress<.985&&(f<.5?a.pv:b.pv);
  for(const id in remotes){const r=remotes[id],sa=a.rem&&a.rem[id],sb=b.rem&&b.rem[id];if(!r||!r.mesh||!sa&&!sb)continue;const ra=sa||sb,rb=sb||sa;r.mesh.position.lerpVectors(new T.Vector3().fromArray(ra.p),new T.Vector3().fromArray(rb.p),f);r.mesh.quaternion.slerpQuaternions(new T.Quaternion().fromArray(ra.q),new T.Quaternion().fromArray(rb.q),f);r.mesh.visible=f<.5?ra.v:rb.v;}
  // Follow the killer's recorded point of view.
  const actorA=killReplayAttackerId&&a.rem&&a.rem[killReplayAttackerId],actorB=killReplayAttackerId&&b.rem&&b.rem[killReplayAttackerId];
  if(actorA||actorB){const ra=actorA||actorB,rb=actorB||actorA,kp=new T.Vector3().lerpVectors(new T.Vector3().fromArray(ra.p),new T.Vector3().fromArray(rb.p),f),kq=new T.Quaternion().slerpQuaternions(new T.Quaternion().fromArray(ra.q),new T.Quaternion().fromArray(rb.q),f);cam.position.copy(new T.Vector3(0,12,86).applyQuaternion(kq).add(kp));const forward=new T.Vector3(0,0,-60).applyQuaternion(kq);cam.up.set(0,1,0);cam.lookAt(kp.clone().add(forward));cam.fov=65;cam.updateProjectionMatrix();cam.updateMatrixWorld();water.position.set(kp.x,0,kp.z);
  }else{cam.position.lerpVectors(new T.Vector3().fromArray(a.cp),new T.Vector3().fromArray(b.cp),f);cam.quaternion.slerpQuaternions(new T.Quaternion().fromArray(a.cq),new T.Quaternion().fromArray(b.cq),f);cam.up.lerpVectors(new T.Vector3().fromArray(a.up),new T.Vector3().fromArray(b.up),f).normalize();cam.fov=a.fov+(b.fov-a.fov)*f;cam.updateProjectionMatrix();cam.updateMatrixWorld();}
  if(progress>=1)finishKillReplay();
}
function clearKillReplay(){if(killReplayActive)finishKillReplay();killReplayHistory.length=0;killReplayClip=[];killReplayAvailableUntil=0;killReplayPreparedAt=-Infinity;killReplayAttackerId=null;if(killReplayBtn)killReplayBtn.style.display='none'}
killReplayBtn?.addEventListener('click',()=>{if(killReplayActive)finishKillReplay();else startKillReplay()});
let maydayHoldTimer=0;
function clearMaydayHold(){if(maydayHoldTimer){clearTimeout(maydayHoldTimer);maydayHoldTimer=0}}
addEventListener('blur',clearMaydayHold);
const quickAlertEl=document.getElementById('quickAlert');let quickAlertT=0;
function showQuickAlert(){if(!quickAlertEl)return;quickAlertEl.textContent='MAYDAY';quickAlertEl.classList.remove('show');void quickAlertEl.offsetWidth;quickAlertEl.classList.add('show');clearTimeout(quickAlertT);quickAlertT=setTimeout(()=>quickAlertEl.classList.remove('show'),3200)}
const killConfirmEl=document.getElementById('killConfirm');let killConfirmT=0;
function showKillConfirm(target=''){if(!killConfirmEl)return;const kt=killConfirmEl.querySelector('.killTarget');if(kt)kt.textContent=target?String(target).toUpperCase():'';killConfirmEl.classList.remove('show');void killConfirmEl.offsetWidth;killConfirmEl.classList.add('show');clearTimeout(killConfirmT);killConfirmT=setTimeout(()=>killConfirmEl.classList.remove('show'),820);tone(760,.11,'square',.08);setTimeout(()=>tone(980,.12,'square',.07),70)}
function showConfirm(title,text,okText,onOk,onCancel){const dlg=document.getElementById('confirmDialog');document.getElementById('confirmTitle').textContent=title;document.getElementById('confirmText').textContent=text;document.getElementById('confirmOk').textContent=okText||'LEAVE';dlg.style.display='flex';const cancel=()=>{dlg.style.display='none';if(onCancel)onCancel()};document.getElementById('confirmCancel').onclick=cancel;document.getElementById('confirmOk').onclick=()=>{dlg.style.display='none';onOk()}}
function hideGameplayUi(){
  if(killReplayActive)finishKillReplay();
  ['roomCodeHud','hud','landingHint','score','cross','killConfirm','lock','warn','win','banner','shieldHud','spectatorHud','radar','gameSettingsBtn','set','killReplayBtn'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none'});
  unlockMaydayPointer();
  setMobileVisible(false);
  setHudEditMode(false);
  if(hudEditBtn)hudEditBtn.style.display='none';
  if(landscapeGateEl)landscapeGateEl.style.display='none';
  const toast=document.getElementById('toast');if(toast){toast.textContent='';toast.style.display='none'}
  clearTimeout(toastT);toastT=0;
}
function showGameplayUi(){
  setMobileVisible(true);
  applyMobileHudLayout(true);
  updateLandscapeGate();
  const codeHud=document.getElementById('roomCodeHud');if(codeHud){codeHud.textContent=roomCode?`GAME CODE  ${roomCode}`:'';codeHud.style.display=roomCode?'block':'none'}
  ['hud','score','cross','killConfirm','warn','banner','gameSettingsBtn','set'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='block'});
  if(inGame&&mouseControls&&!spectatorMode&&!mobileTouchEnabled)setTimeout(requestMaydayPointerLock,60);
  const toast=document.getElementById('toast');if(toast)toast.style.display='block';
}
function closeConfirmDialog(){
  const dlg=document.getElementById('confirmDialog');
  if(dlg)dlg.style.display='none';
  const ok=document.getElementById('confirmOk');
  const cancel=document.getElementById('confirmCancel');
  if(ok)ok.blur();
  if(cancel)cancel.blur();
}
function goMainMenu(){
  reportSocialStatus('lobby','');
  // Always dismiss modal overlays first so an accidental leave can never leave the UI blocked.
  closeConfirmDialog();
  const settingsPanel=document.getElementById('settingsPanel');
  if(settingsPanel)settingsPanel.style.display='none';
  inGame=false;over=false;alive=false;spectatorMode=false;roundHiddenUntil=0;practiceMode=false;practiceKills=0;practiceRespawnAt=0;roomMode='clash';roomInfo=null;roomCode='';isHost=false;specIdx=0;specId=null;snapPlayers={};clearWorld();
  if(plane){scene.remove(plane);plane=null}
  landed=false;landingStrip=null;shieldUntil=0;protEnd=0;lockId=null;lockT=0;warns={};
  setMusic(true);resetModeSelection();hideGameplayUi();
  document.getElementById('lobby').style.display='flex';document.getElementById('menu').style.display='block';document.getElementById('room').style.display='none';document.getElementById('joinBox').style.display='none';
  document.getElementById('modeHelp').textContent='Select a mode to continue.';
  document.getElementById('err').textContent='';
  const forceLobby=()=>{if(roomExitInProgress&&!inGame&&!roomCode){const lobby=document.getElementById('lobby'),menu=document.getElementById('menu'),room=document.getElementById('room'),joinBox=document.getElementById('joinBox');if(lobby)lobby.style.display='flex';if(menu)menu.style.display='block';if(room)room.style.display='none';if(joinBox)joinBox.style.display='none';}};
  requestAnimationFrame(forceLobby);
}
function leaveRoom(reason='menu',confirmHost=true){
  let handled=false;
  const doLeave=()=>{
    if(handled)return;
    handled=true;
    closeConfirmDialog();
    roomExitInProgress=true;
    intentionalDisconnect=true;
    clearRecoverySession();
    const leavingSocket=ws;
    if(leavingSocket===socialSocket&&socialSocket?.readyState===WebSocket.OPEN){
      sendSocial({t:'socialLeaveGame'});
      ws=null;
    }else{
      try{if(leavingSocket&&leavingSocket.readyState===WebSocket.OPEN){leavingSocket.send(JSON.stringify({t:'leave'}));leavingSocket.close(1000,'left room');}else if(leavingSocket&&leavingSocket.readyState===WebSocket.CONNECTING)leavingSocket.close();}catch(e){}
      ws=null;
    }
    goMainMenu();
    intentionalDisconnect=false;
  };
  if(confirmHost&&isHost&&roomInfo&&roomInfo.state==='lobby')showConfirm('LEAVE HOST ROOM?','You are the host. Leaving will close your connection and the host role will pass to another player when possible.','LEAVE ROOM',doLeave);
  else doLeave();
}
function exitActiveMatch(){if(!inGame)return;if(practiceMode){goMainMenu()}else leaveRoom('game',false)}
const TC={blue:'#2a6fe0',red:'#e03030',green:'#20b85a',yellow:'#f1c40f',purple:'#9b59b6',orange:'#f39c12'};
const COLOR_PALETTE=[
 {id:'electric-red',name:'Electric Red',color:'#FF3B30'},{id:'vermilion',name:'Vermilion',color:'#FF6B00'},
 {id:'orange',name:'Orange',color:'#FF9500'},{id:'gold',name:'Gold',color:'#F2C94C'},{id:'yellow',name:'Yellow',color:'#FFD60A'},
 {id:'lime',name:'Lime',color:'#A8E063'},{id:'green',name:'Green',color:'#34C759'},{id:'emerald',name:'Emerald',color:'#00A878'},
 {id:'teal',name:'Teal',color:'#00A6A6'},{id:'cyan',name:'Cyan',color:'#00C2FF'},{id:'sky',name:'Sky',color:'#4DABF7'},
 {id:'blue',name:'Blue',color:'#2F80ED'},{id:'royal',name:'Royal Blue',color:'#5B5FEF'},{id:'indigo',name:'Indigo',color:'#3F51B5'},
 {id:'violet',name:'Violet',color:'#7A5AF8'},{id:'purple',name:'Purple',color:'#9B51E0'},{id:'magenta',name:'Magenta',color:'#D946EF'},
 {id:'pink',name:'Pink',color:'#FF5E9A'},{id:'rose',name:'Rose',color:'#E83E8C'},{id:'brown',name:'Earth',color:'#A15C38'}
];
const COLOR_BY_ID=Object.fromEntries(COLOR_PALETTE.map(c=>[c.id,c]));
const TN={blue:'Blue',red:'Red',green:'Green',yellow:'Yellow',purple:'Purple',orange:'Orange'};
const TIDS=['blue','red','green','yellow','purple','orange'];
const myCol=()=>isPersonalMode()?(COLOR_BY_ID[selectedColorId]?.color||pickedColor||'#ffffff'):(TC[myTeam]||'#ffffff');
const isPersonalMode=()=>roomMode==='ffa'||roomMode==='survivor'||roomMode==='practice';
const esc=x=>String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const bannerEl=document.getElementById('banner'),errEl=document.getElementById('err');
const bad=id=>{const r=remotes[id],now=performance.now();return !r||r.team===myTeam||r.alive===false||r.protEnd>now||r.roundHiddenUntil>now};
function breakLock(reason){if(lockId){lockId=null;lockT=0;lastLockSync=0;if(reason&&performance.now()-lastNoLock>900){lastNoLock=performance.now();toast(reason)}}}

function clearTransientEffects(){
 for(const b of bullets)scene.remove(b.m);bullets.length=0;
 for(const m of missiles)scene.remove(m.m);missiles.length=0;
 missileFlySound(false);
 for(const f of crashSites){scene.remove(f.g);if(f.fireAudio){f.fireAudio.pause();f.fireAudio.currentTime=0}}crashSites.length=0;
 for(const q of parts){scene.remove(q.m);if(q.m.material)q.m.material.dispose()}parts.length=0;
} 
function clearPracticeTargets(){
 for(const id of Object.keys(remotes)){if(String(id).startsWith('practice-')){scene.remove(remotes[id].mesh);delete remotes[id];delete snapPlayers[id]}}
}
function clearWorld(){for(const id in remotes){scene.remove(remotes[id].mesh);delete remotes[id]}clearPracticeTargets();clearTransientEffects();lockId=null;lockT=0;landed=false;landingStrip=null;deathCamActive=false;deathCamUntil=0}
function renderRoom(m){
 roomMode=m.mode||'ffa';teamCount=m.teamCount||2;const roomCodeBig=document.getElementById('roomCodeBig');if(roomCodeBig)roomCodeBig.textContent=m.code||roomCode||'----';const meRoom=m.players.find(p=>p.id===myId)||{};selectedColorId=meRoom.colorId||selectedColorId;if(meRoom.ty&&PT[meRoom.ty]){ptype=meRoom.ty;maxhp=PT[ptype].hp;hp=maxhp;const mainType=document.getElementById('ptype');if(mainType)mainType.value=ptype;}document.getElementById('rcode').textContent=m.code;
 document.getElementById('rmode').textContent=roomMode==='ffa'?'Classic Dogfight - first to 10 kills':roomMode==='survivor'?`Survivor - ${m.lives||1} lives per pilot`:`Clash Squad - ${teamCount} teams, first to 6 rounds`;
 const tc=document.getElementById('teamcols'),setup=document.getElementById('teamSetup'),palette=document.getElementById('colorPalette');
 tc.style.display=roomMode==='clash'?'grid':'none';document.getElementById('ffacol').style.display=roomMode==='clash'?'none':'block';
 const row=p=>`<div class="roomPilotRow"><div class="roomPilotIdentity"><span style="color:${p.c}">&#9632;</span> ${esc(p.n)}${p.id===m.host?' ★':''}${p.id===myId?' (you)':''} <small style="opacity:.7">${esc(p.ty||'balanced')}</small>${roomMode==='survivor'?` <small style="opacity:.65">· ${p.lives??m.lives??1} lives</small>`:''}</div><span class="roomSocialSlot" data-room-social-slot="${esc(p.gameUid||'')}">${roomSocialActionMarkup(p.gameUid)}</span></div>`;
 if(roomMode==='clash'){
  setup.style.display='block';palette.style.display='none';
  setup.innerHTML=(m.host===myId?`<b>Host settings</b><br><label>Teams <select id="roomTeamCount" style="padding:7px;border-radius:7px;border:0"><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option><option value="6">6</option></select></label> <button id="applyTeams" style="margin-top:6px;padding:8px 14px">Apply</button><br><small style="opacity:.72">Choose 2–6 teams here. Team selection happens below, inside the room.</small>`:`<b>Clash Squad</b><br><small style="opacity:.72">Choose or change your team below. No team selection is shown on the main menu.</small>`);
  const sel=document.getElementById('roomTeamCount');if(sel){sel.value=String(teamCount);document.getElementById('applyTeams').onclick=()=>ws.send(JSON.stringify({t:'setteams',teamCount:+sel.value}));}
  setup.insertAdjacentHTML('beforeend',`<div style="margin-top:12px"><label><b>Aircraft</b> <select id="roomAircraft" style="padding:7px;border-radius:7px;border:0"><option value="fighter">Fighter · 75 HP · fast & agile</option><option value="balanced">Balanced · 100 HP · all-round</option><option value="heavy">Heavy · 150 HP · tough, slow turns</option><option value="interceptor">Interceptor · 90 HP · very fast · sharp turns</option><option value="striker">Strike Fighter · 175 HP · heavy assault · broad wings</option></select></label><br><small style="opacity:.72">Change your aircraft before the host starts.</small></div>`);
  const roomAircraft=document.getElementById('roomAircraft');if(roomAircraft){roomAircraft.value=ptype;roomAircraft.onchange=()=>{ptype=roomAircraft.value;maxhp=PT[ptype].hp;hp=maxhp;saveSet();if(ws&&ws.readyState===1)ws.send(JSON.stringify({t:'type',ty:ptype}));};}
  tc.innerHTML=TIDS.slice(0,teamCount).map(t=>{const members=m.players.filter(p=>p.team===t).map(row).join('')||'<i style="opacity:.6">empty</i>';return `<div class="teamcard"><h3 style="color:${TC[t]}">${TN[t].toUpperCase()} TEAM</h3><div class="members">${members}</div><button data-team="${t}">Join ${TN[t]}</button></div>`}).join('');
  tc.querySelectorAll('button[data-team]').forEach(b=>b.onclick=()=>ws.send(JSON.stringify({t:'team',team:b.dataset.team})));
 }else if(isPersonalMode()){
  tc.innerHTML='';setup.style.display='block';palette.style.display='flex';
  const used=new Set(m.players.map(p=>p.colorId).filter(Boolean));
  setup.innerHTML=roomMode==='survivor'&&m.host===myId?`<b>Host settings</b><br><label>Lives per pilot <select id="survivorLives" style="padding:7px;border-radius:7px;border:0"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label> <button id="applyLives" style="margin-top:6px;padding:8px 14px">Apply</button><br><small style="opacity:.72">Last pilot with lives remaining wins. 1 life is default.</small>`:`<b>${roomMode==='survivor'?'Survivor':'Dogfight'}</b><br><small style="opacity:.72">Choose a pilot color. A color already taken in this room cannot be selected.</small>`;
  if(roomMode==='survivor'){const ls=document.getElementById('survivorLives');if(ls){ls.value=String(m.lives||1);document.getElementById('applyLives').onclick=()=>ws.send(JSON.stringify({t:'setlives',lives:+ls.value}));}}
  setup.insertAdjacentHTML('beforeend',`<div style="margin-top:12px"><label><b>Aircraft</b> <select id="roomAircraft" style="padding:7px;border-radius:7px;border:0"><option value="fighter">Fighter · 75 HP · fast & agile</option><option value="balanced">Balanced · 100 HP · all-round</option><option value="heavy">Heavy · 150 HP · tough, slow turns</option><option value="interceptor">Interceptor · 90 HP · very fast · sharp turns</option><option value="striker">Strike Fighter · 175 HP · heavy assault · broad wings</option></select></label><br><small style="opacity:.72">Change your aircraft before the host starts.</small></div>`);
  const roomAircraft=document.getElementById('roomAircraft');if(roomAircraft){roomAircraft.value=ptype;roomAircraft.onchange=()=>{ptype=roomAircraft.value;maxhp=PT[ptype].hp;hp=maxhp;saveSet();if(ws&&ws.readyState===1)ws.send(JSON.stringify({t:'type',ty:ptype}));};}
  palette.innerHTML=COLOR_PALETTE.map(col=>{const taken=used.has(col.id)&&selectedColorId!==col.id;const sel=selectedColorId===col.id;return `<button class="colorChoice${sel?' selected':''}${taken?' taken':''}" title="${esc(col.name)}${taken?' — taken':''}" aria-label="${esc(col.name)}" data-color="${col.id}" ${taken?'disabled':''} style="background:${col.color}"></button>`}).join('');
  palette.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{selectedColorId=b.dataset.color;ws.send(JSON.stringify({t:'color',colorId:selectedColorId}));});
 }else{setup.style.display='none';palette.style.display='none';tc.innerHTML='';}
 document.getElementById('fl').innerHTML=m.players.map(row).join('');
 const startBtn=document.getElementById('start');const enoughPlayers=m.players.length>=2;startBtn.style.display=m.host===myId?'inline-block':'none';startBtn.disabled=m.host===myId&&!enoughPlayers;startBtn.textContent=enoughPlayers?'START GAME':'NEED 2 PILOTS';startBtn.title=enoughPlayers?'':'At least 2 pilots are required to start.';
 document.getElementById('rstat').textContent=m.host===myId?(roomMode==='clash'?(enoughPlayers?`You are the host. Set the team count, assign players to teams, then start. All ${teamCount} teams need at least one player.`:'Waiting for another pilot. Clash Squad needs at least 2 pilots to start.'):roomMode==='survivor'?(enoughPlayers?`You are the host. Set lives (1–5), choose colors, then start.`:'Waiting for another pilot. Survivor needs at least 2 pilots to start.'):(enoughPlayers?`You are the host. Choose colors, then start.`:'Waiting for another pilot. Dogfight needs at least 2 pilots to start.')):'Waiting for the host to start...';
 setMusic(true);hideGameplayUi();document.getElementById('lobby').style.display='flex';document.getElementById('menu').style.display='none';document.getElementById('room').style.display='block';paintAllSocialPanels()}
function startSpectatorView(state='playing'){
  setFriendsSidebarOpen(false);
  spectatorMode=true;alive=false;inGame=true;over=state==='between';roundHiddenUntil=0;landed=false;lockId=null;lockT=0;lastLockSync=0;deathCamActive=false;killCamActive=false;
  if(!plane){plane=makePlane('#ffffff',ptype);plane.userData.team='spectator';plane.userData.col='#ffffff';}
  plane.visible=false;
  unlockMaydayPointer();
  document.getElementById('lobby').style.display='none';document.getElementById('menu').style.display='none';document.getElementById('room').style.display='none';
  showGameplayUi();document.getElementById('radar').style.display='block';winEl.style.display='none';shieldHud.style.display='none';
  if(roomMode==='clash')RANGE=9000;else RANGE=3500;
  updateSpectatorHud();
}

function startRound(m){
 setFriendsSidebarOpen(false);
 clearKillReplay();
 if(spectatorMode||m.spectator){spectatorMode=true;alive=false;inGame=true;over=false;roundHiddenUntil=performance.now()+(m.hidden||0);setMusic(false);document.getElementById('lobby').style.display='none';document.getElementById('menu').style.display='none';document.getElementById('room').style.display='none';showGameplayUi();document.getElementById('radar').style.display='block';winEl.style.display='none';bannerEl.textContent='';roomMode=m.mode||roomMode;teamCount=Object.keys(m.score||{}).length||teamCount;if(!plane){plane=makePlane('#ffffff',ptype);plane.userData.team='spectator';plane.userData.col='#ffffff'}plane.visible=false;lockId=null;lockT=0;lastLockSync=0;specIdx=0;specId=null;RANGE=roomMode==='clash'?9000:3500;updateSpectatorHud();toast(`Round ${m.n} in progress • SPECTATING`);return;}
 inGame=true;over=false;roundHiddenUntil=performance.now()+(m.hidden||0);setMusic(false);document.getElementById('lobby').style.display='none';showGameplayUi();document.getElementById('radar').style.display='block';winEl.style.display='none';bannerEl.textContent='';
 roomMode=m.mode||roomMode;shieldHud.style.display=roomMode==='clash'?'block':'none';score=m.score||{};roundNo=m.n;teamCount=Object.keys(score||{}).length||teamCount;myColor=myCol();if(roomMode==='clash')RANGE=9000;else RANGE=3500;
 if(plane&&(plane.userData.team!==myTeam||plane.userData.col!==myCol())){scene.remove(plane);plane=null}
 if(!plane){plane=makePlane(myCol(),ptype);plane.userData.team=myTeam;plane.userData.col=myCol();ensureShield()}
 for(const b of bullets)scene.remove(b.m);bullets.length=0;for(const x of missiles)scene.remove(x.m);missiles.length=0;for(const f of flareSites)scene.remove(f.g);flareSites.length=0;lockId=null;lockT=0;lastLockSync=0;flares=3;flareCooldown=0;killCamActive=false;killCamAttackerId=null;
 if(m.late){alive=false;shieldUntil=0}else{alive=true;shields=3;shieldUntil=0;clearTransientEffects();hp=maxhp;reset();sendPlaneState()}
toast(m.late?'Round '+m.n+' in progress - spectating':(roomMode==='ffa'?'Classic Dogfight - first to 10 kills!':'Round '+m.n+' - fight!'))}
const RECOVERY_KEY='mayday_last_session_v1';
function readRecovery(){try{const x=JSON.parse(localStorage.getItem(RECOVERY_KEY)||'null');if(!x||!x.code||!x.session)return null;if(Date.now()-(Number(x.savedAt)||0)>12*60*1000){localStorage.removeItem(RECOVERY_KEY);return null}return x}catch(e){return null}}
function saveRecoverySession(){if(!roomCode||!ws?.sessionToken)return;try{localStorage.setItem(RECOVERY_KEY,JSON.stringify({code:roomCode,session:ws.sessionToken,name:document.getElementById('name').value||'Pilot',savedAt:Date.now()}));}catch(e){}}
function clearRecoverySession(){try{localStorage.removeItem(RECOVERY_KEY)}catch(e){}}
function renderRecoveryPanel(){const x=readRecovery(),panel=document.getElementById('recoveryPanel'),txt=document.getElementById('recoveryText');if(!panel)return;if(!x){panel.style.display='none';return}panel.style.display='block';if(txt)txt.textContent=`Room ${x.code} · MAYDAY will try to restore your pilot session. Reconnect is available for about 10 minutes after an accidental disconnect.`;const b=document.getElementById('resumeLastGame');if(b)b.onclick=()=>{const cur=readRecovery();if(!cur)return renderRecoveryPanel();connect({t:'reconnect',code:cur.code,session:cur.session})};const d=document.getElementById('forgetLastGame');if(d)d.onclick=()=>{clearRecoverySession();renderRecoveryPanel()}}

function connect(first){
 roomExitInProgress=false;intentionalDisconnect=false;
 if(!socialProfile){pendingRoomConnect=first;connectSocial();errEl.textContent='Connecting to MAYDAY social...';return}
 initAudio();errEl.textContent='Connecting...';roomCode='';
 setTimeout(()=>{if(!roomCode&&!joiningSocialInviteId)errEl.textContent='No answer from the game server. Make sure you replaced server.js with the NEW one, stopped the old server (Ctrl+C), ran node server.js again, and opened the page from the server address (not as a file).'},3000);
 pickedColor=COLOR_BY_ID[selectedColorId]?.color||'#ffffff';invert=document.getElementById('inv').checked?1:-1;ptype=document.getElementById('ptype').value;maxhp=(PT[ptype]||PT.balanced).hp;hp=maxhp;saveSet();
 const socket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);ws=socket;
 socket.onopen=()=>{if(ws!==socket){try{socket.close(1000,'superseded')}catch{}return}const outgoing=Object.assign({n:document.getElementById('name').value||'Pilot',ty:ptype,colorId:selectedColorId,profileId:socialIdentity?.id,profileToken:socialIdentity?.token},first);if(outgoing.inviteId)inviteDebug('game socket open; sending join',`id=${String(outgoing.inviteId).slice(0,8)} room=${outgoing.roomId||outgoing.code} profile=${outgoing.profileId||'MISSING'} token=${outgoing.profileToken?'present':'MISSING'}`);socket.send(JSON.stringify(outgoing))};
 socket.onerror=()=>{if(ws!==socket)return;inviteDebug('game socket error',`host=${location.host} invite=${String(first?.inviteId||'').slice(0,8)||'-'}`);errEl.textContent='Could not reach the server.';if(joiningSocialInviteId)finishSocialInviteJoin(false,'','Could not connect to the game server.')};
 socket.onclose=()=>{if(ws!==socket)return;if(joiningSocialInviteId&&!roomCode)finishSocialInviteJoin(false,'','The game connection closed before joining the room.');if(!intentionalDisconnect){toast('Disconnected from server');reportSocialStatus('lobby')}intentionalDisconnect=false};
 socket.onmessage=e=>handleGameMessage(socket,first,e.data);
}
function handleGameMessage(socket,first,rawData){if(ws!==socket)return;let m;try{m=JSON.parse(rawData)}catch{return}const isReconnect=first?.t==='reconnect';
  if(first?.inviteId&&(m.t==='welcome'||m.t==='err'))inviteDebug(`game server ${m.t}`,`id=${String(first.inviteId).slice(0,8)} room=${m.code||m.roomId||roomCode||'-'} inviteEcho=${m.inviteId||'-'} message=${m.m||'-'}`);
  if(m.t==='serverRestarting'){toast('MAYDAY server is restarting. Please reconnect in a moment.');return}
  if(m.t==='err'){
   errEl.textContent=m.m;
   if(joiningSocialInviteId&&(!m.inviteId||m.inviteId===joiningSocialInviteId)){finishSocialInviteJoin(false,roomCode,m.m);toast(`INVITE FAILED • ${m.m}`)}
   if(isReconnect){if(/no longer available|session is no longer|match is no longer/i.test(m.m)){clearRecoverySession();renderRecoveryPanel()}else if(/already connected/i.test(m.m)){setTimeout(()=>{const cur=readRecovery();if(cur&&!ws?.sessionToken)connect({t:'reconnect',code:cur.code,session:cur.session})},1200)}}
   if(!roomCode){if(socket!==socialSocket){try{socket.close()}catch(x){}}}else{toast(m.m);if(roomInfo&&roomInfo.state==='lobby')renderRoom(roomInfo)}
  }
  else if(m.t==='welcome'){
   myId=m.id;roomCode=m.code||m.roomId;roomMode=m.mode||'clash';spectatorMode=!!m.spectator;reportSocialStatus(m.spectator?'spectating':'room',roomCode);if(m.session){socket.sessionToken=m.session;saveRecoverySession()}errEl.textContent='';if(m.resumed)toast('SESSION RESTORED • rejoining Room '+roomCode);
   if(joiningSocialInviteId&&(!m.inviteId||m.inviteId===joiningSocialInviteId)){finishSocialInviteJoin(true,roomCode,'',spectatorMode);toast(spectatorMode?`Joined room ${roomCode} • spectating`:`Joined room ${roomCode}`)}
  }
  else if(m.t==='spectate'){roomMode=m.mode||roomMode;score=m.score||score;roundNo=m.round||roundNo;spectatorMode=true;reportSocialStatus('spectating',roomCode);startSpectatorView(m.state||'playing');}
  else if(m.t==='resume'){
    roomMode=m.mode||roomMode;teamCount=teamCount||2;score=m.score||{};roundNo=m.round||0;inGame=(m.state==='playing'||m.state==='between');over=m.state==='between';alive=m.state==='playing'&&!!m.alive;reportSocialStatus(alive?'playing':(m.state==='between'?'between':'spectating'),roomCode);
    document.getElementById('lobby').style.display='none';document.getElementById('menu').style.display='none';document.getElementById('room').style.display='none';showGameplayUi();document.getElementById('radar').style.display='block';winEl.style.display='none';
    myColor=myCol();if(plane&&(plane.userData.team!==myTeam||plane.userData.col!==myCol())){scene.remove(plane);plane=null}if(!plane){plane=makePlane(myCol(),ptype);plane.userData.team=myTeam;plane.userData.col=myCol();ensureShield()}
    if(roomMode==='clash')shieldHud.style.display='block';else shieldHud.style.display='none';
    if(alive){clearTransientEffects();hp=maxhp;reset()}else{plane.visible=false}
    toast(m.state==='between'?'SESSION RESTORED • waiting for the next round':(alive?'SESSION RESTORED • back in the fight':'SESSION RESTORED • spectating until you return to the fight'));renderRecoveryPanel();
  }
  else if(m.t==='room'){if(roomExitInProgress)return;roomInfo=m;isHost=m.host===myId;teamCount=m.teamCount||2;reportSocialStatus(m.state==='playing'?(spectatorMode?'spectating':'playing'):m.state==='between'?(spectatorMode?'spectating':'between'):m.state==='over'?'results':'room',m.code||roomCode);const me=m.players.find(p=>p.id===myId);if(me){myTeam=me.team;if(me.colorId){selectedColorId=me.colorId;pickedColor=me.c||pickedColor;}if(me.ty&&PT[me.ty]){ptype=me.ty;maxhp=PT[ptype].hp;hp=Math.min(hp,maxhp);const sel=document.getElementById('ptype');if(sel)sel.value=ptype;}if(inGame&&!practiceMode&&plane&&plane.userData.aircraftType!==ptype){scene.remove(plane);plane=makePlane(myCol(),ptype);plane.userData.team=myTeam;plane.userData.col=myCol();plane.visible=alive;ensureShield();}}
   if(m.state==='lobby'){if(inGame&&!spectatorMode){inGame=false;clearWorld();setMusic(true);hideGameplayUi();if(plane)plane.visible=false;alive=false}renderRoom(m)}else if(spectatorMode&&(m.state==='playing'||m.state==='between')){startSpectatorView(m.state)}}
  else if(m.t==='round'){reportSocialStatus(spectatorMode?'spectating':'playing',roomCode);startRound(m)}
  else if(m.t==='roundend'){reportSocialStatus(spectatorMode?'spectating':'between',roomCode);over=true;roundHiddenUntil=0;score=m.score||{};shieldUntil=0;clearTransientEffects();updateShieldVisual();for(const id in remotes){if(remotes[id])remotes[id].mesh.visible=false}if(plane&&!alive)plane.visible=false;const w=m.win;const wc=w?TC[w]:'#ffd166';const wn=w?(TN[w]||w).toUpperCase()+' TEAM':'DRAW';bannerEl.innerHTML=w?`<span style="color:${wc}">${wn}</span> wins round ${m.round}!<br><small style="font-size:20px">Next round in 5s</small>`:`Round ${m.round}: draw<br><small style="font-size:20px">Next round in 5s</small>`}
  else if(m.t==='matchend'){reportSocialStatus('results',roomCode);over=true;bannerEl.textContent='';renderMatchResults(m);[0,1,2,3].forEach(i2=>setTimeout(()=>tone(420+i2*170,.3,'triangle',.15),i2*180))}
  else if(m.t==='snap'){snapPlayers=m.players;score=m.score;roundNo=m.round;if(spectatorMode){alive=false;over=m.state==='between';if(roomMode==='clash'){const hidden=Math.max(...Object.values(snapPlayers).map(s=>s.rh||0),0);roundHiddenUntil=Math.max(roundHiddenUntil,performance.now()+hidden)} }else{const firstStealth=(m.players[myId]?.rh||0);if(roomMode==='clash'&&firstStealth)roundHiddenUntil=Math.max(roundHiddenUntil,performance.now()+firstStealth);const sp0=snapPlayers[myId];
   if(sp0){maxhp=sp0.mh||maxhp;protEnd=performance.now()+(sp0.pr||0);const nh=sp0.hp;shields=sp0.sh===undefined?shields:sp0.sh;shieldUntil=performance.now()+(sp0.su||0);if(nh<hp){const hitAmount=hp-nh;tone(180,.2,'sawtooth',.18,70);vibrateOnHit(hitAmount)}hp=nh;if(sp0.alive===false)alive=false;myColor=sp0.c||myColor}}
   for(const id in m.players){if(id==myId)continue;const s=m.players[id];let r=remotes[id];
    if(!r){r={mesh:makePlane(s.c||TC[s.team],s.ty)};r.mesh.position.fromArray(s.p);remotes[id]=r}
    const wasAlive=r.alive===true;r.p=s.p;r.q=s.q;r.hp=s.hp;r.mh=s.mh||100;r.alive=s.alive;r.team=s.team;r.colorId=s.colorId;r.lives=s.lives;r.sc=s.sc||0;r.protEnd=performance.now()+(s.pr||0);r.roundHiddenUntil=performance.now()+(s.rh||0);r.shieldUntil=performance.now()+(s.su||0);
    if(!wasAlive&&s.alive===true){r.mesh.position.fromArray(s.p);r.mesh.quaternion.fromArray(s.q);r.mesh.visible=true}}
   for(const id in remotes)if(!m.players[id]){scene.remove(remotes[id].mesh);delete remotes[id]}
   if(spectatorMode){const liveIds=Object.keys(remotes).filter(id=>remotes[id]&&remotes[id].alive!==false);if(!liveIds.length){specId=null}else if(!specId||!remotes[specId]||remotes[specId].alive===false){specId=liveIds[((specIdx%liveIds.length)+liveIds.length)%liveIds.length];}updateSpectatorHud();}}
  else if(m.t==='shot'){spawnBullet(m.p,m.d,false);gunSound()}
  else if(m.t==='mfire'){spawnMissile(m.p,m.d,m.tid,false,m.by);missileLaunchSound();missileFlySound(true)}
  else if(m.t==='kill'){const kp=new T.Vector3().fromArray(m.x);const mine=m.victim===myId;const iGotKill=!!m.by&&String(m.by)===String(myId);if(!mine){explode(kp,true);createCrashFire(kp,4300);if(iGotKill)showKillConfirm(m.vn)}else{prepareKillReplay(m.by!==null&&m.by!==undefined?m.by:null);createCrashFire(kp,4300);if(m.by)beginKillCam(kp,m.by);else beginDeathCam(kp)}toast(m.bn?`${m.bn} shot down ${m.vn}`:`${m.vn} crashed`)}
  else if(m.t==='respawn'){alive=true;shieldUntil=0;clearTransientEffects();lastLockSync=0;reset();plane.visible=true;plane.userData.team=myTeam;plane.userData.col=myCol();if(killReplayActive&&killReplayResume){killReplayResume.p=plane.position.clone();killReplayResume.q=plane.quaternion.clone();killReplayResume.visible=true;killReplayResume.speed=speed;killReplayResume.throttle=throttle;killReplayResume.boost=boost}deathCamActive=false;killCamActive=false;killCamAttackerId=null;toast(m.mode==='survivor'?`Back in the air! • ${m.lives} lives left`:(m.crash?'Back in the air!':'Shot down by '+m.by+'!'))}
  else if(m.t==='flare'){const fp=new T.Vector3().fromArray(m.p);createFlare(fp,m.id)}
  else if(m.t==='shield'){if(m.id===myId){shields=Math.max(0,m.n===undefined?shields-1:m.n);shieldUntil=performance.now()+7000;shieldSound();toast(`SHIELD ACTIVE • ${shields} left`)}else if(remotes[m.id]){remotes[m.id].shieldUntil=performance.now()+7000;shieldSound()}}
  else if(m.t==='dead'){prepareKillReplay();alive=false;if(roomMode==='ffa'){if(plane)beginDeathCam(plane.position);document.getElementById('landingHint').style.display='none'}else if(roomMode==='survivor'&&m.eliminated){toast(m.by?'Eliminated by '+m.by+'! Spectating...':'You are out! Spectating...')}else toast(m.by?'Shot down by '+m.by+'! Spectating...':'You crashed!')}
  else if(m.t==='quickalert'){showQuickAlert()}
  else if(m.t==='quickalertsent'){if(!m.ok)toast(m.message||'Could not send MAYDAY alert')}
  else if(m.t==='locked'){warns[m.by]={n:m.n,c:m.c,until:performance.now()+1500};if(performance.now()-lastWarnBeep>450){lastWarnBeep=performance.now();tone(1500,.09,'square',.07)}}
  else if(m.t==='locklost'){delete warns[m.by];}
}

// Persistent MAYDAY Game UID + live presence connection. Invitations reuse this socket for the room handoff.
const SOCIAL_IDENTITY_KEY='maydaySocialIdentityV1';
let socialSocket=null,socialSocketConnecting=false,socialProfile=null,socialIdentity=null,socialSnapshot={friends:[],incomingRequests:[],outgoingRequests:[]},pendingRoomConnect=null;
let incomingSocialInvites=[],activeSocialInvite=null,socialReconnectTimer=0,joiningSocialInviteId='',inviteJoinWatchdog=0;
function readSocialIdentity(){try{return JSON.parse(localStorage.getItem(SOCIAL_IDENTITY_KEY)||'null')}catch{return null}}
function sendSocial(message){if(socialSocket&&socialSocket.readyState===WebSocket.OPEN)socialSocket.send(JSON.stringify(message));else{connectSocial();return false}return true}
function statusLabel(f){const mode=String(f.mode||'').toUpperCase().replace('FFA','DOGFIGHT');if(!f.online)return 'Offline';switch(f.status){case'lobby':return 'Online · Lobby';case'room':return `In room ${f.roomCode||''}`.trim();case'playing':return `In game · ${mode||'MAYDAY'}`;case'spectating':return `In game · Spectating ${mode||'MAYDAY'}`;case'between':return `In game · Between rounds`;case'results':return 'In game · Results';default:return 'Online'}}
function roomSocialActionMarkup(uid){
 const code=String(uid||'');
 if(!/^\d{6}$/.test(code)||!socialProfile)return '';
 if(code===String(socialProfile.code||''))return '<span class="roomFriendState self">YOU</span>';
 const friends=socialSnapshot.friends||[],incoming=socialSnapshot.incomingRequests||[],outgoing=socialSnapshot.outgoingRequests||[];
 if(friends.some(f=>String(f.code)===code))return '<span class="roomFriendState friend">FRIEND</span>';
 if(outgoing.some(f=>String(f.code)===code))return '<button type="button" class="roomFriendBtn sent" disabled>REQUEST SENT</button>';
 const request=incoming.find(f=>String(f.code)===code);
 if(request)return `<button type="button" class="roomFriendBtn accept" data-room-social-action="accept" data-profile-id="${esc(request.id)}">ACCEPT</button>`;
 return `<button type="button" class="roomFriendBtn" data-room-social-action="add" data-game-uid="${esc(code)}">ADD FRIEND</button>`;
}
function refreshRoomSocialActions(){
 document.querySelectorAll('[data-room-social-slot]').forEach(slot=>{slot.innerHTML=roomSocialActionMarkup(slot.dataset.roomSocialSlot||'')});
}
function sendRoomSocialAction(button){
 const action=button?.dataset.roomSocialAction;if(!action)return;
 if(action==='add'){
  const code=String(button.dataset.gameUid||'');if(!/^\d{6}$/.test(code))return;
  button.disabled=true;button.textContent='SENDING...';
  if(!sendSocial({t:'socialAddFriend',code})){button.disabled=false;button.textContent='ADD FRIEND';toast('Friends connection unavailable. Try again.')}else toast('Friend request sent');
 }else if(action==='accept'){
  const profileId=button.dataset.profileId;if(!profileId)return;
  button.disabled=true;button.textContent='ACCEPTING...';
  if(!sendSocial({t:'socialFriendResponse',profileId,accept:true})){button.disabled=false;button.textContent='ACCEPT';toast('Friends connection unavailable. Try again.')}
 }
}
function paintSocialPanel(){
 const root=document.getElementById('friendsSidebarPanel');if(!root)return;
 const count=document.getElementById('friendsSidebarOnlineCount'),toggleCount=document.getElementById('friendsToggleOnline');
 if(!socialProfile){root.innerHTML='<div class="socialHead"><span>Connecting to MAYDAY social...</span></div><div class="socialEmpty">Your Game UID will appear here. Keep the server running and reload if this takes more than a few seconds.</div>';if(count)count.textContent='CONNECTING';if(toggleCount)toggleCount.textContent='CONNECTING';return}
 const friends=socialSnapshot.friends||[],incoming=socialSnapshot.incomingRequests||[],outgoing=socialSnapshot.outgoingRequests||[];
 const onlineFriends=friends.filter(f=>f.online),offlineFriends=friends.filter(f=>!f.online);
 const canInvite=!!(roomCode&&!practiceMode&&ws&&ws.readyState===WebSocket.OPEN);
 const makeFriendRows=rows=>rows.map(f=>{const st=String(f.status||'online'),busyRoom=f.online&&st==='room',busyGame=f.online&&['playing','spectating','between','results'].includes(st);let action='';if(busyRoom)action='<span class="friendPresenceBadge inRoom">IN ROOM</span>';else if(busyGame)action='<span class="friendPresenceBadge inGame">IN GAME</span>';else if(canInvite&&f.online&&['lobby','online'].includes(st))action=`<button type="button" data-social-action="invite" data-friend-id="${esc(f.id)}">INVITE</button>`;return `<div class="socialRow"><div class="socialRowMain"><span class="socialDot ${f.online?'online':''}"></span><div><b>${esc(f.name)}</b><small class="socialFriendMeta">${esc(statusLabel(f))} · UID ${esc(f.code)}</small></div></div><div class="socialRowActions">${action}</div></div>`}).join('');
 const friendRows=friends.length?`${onlineFriends.length?`<div class="socialSectionTitle">ONLINE NOW · ${onlineFriends.length}</div>${makeFriendRows(onlineFriends)}`:''}${offlineFriends.length?`<div class="socialSectionTitle">OFFLINE · ${offlineFriends.length}</div>${makeFriendRows(offlineFriends)}`:''}`:'<div class="socialEmpty">No friends yet. Add a friend using their six-digit Game UID.</div>';
 const requestRows=incoming.length?`<div class="socialSectionTitle">FRIEND REQUESTS · ${incoming.length}</div>`+incoming.map(f=>`<div class="socialRow"><div class="socialRowMain"><span class="socialDot online"></span><div><b>${esc(f.name)}</b><small class="socialFriendMeta">GAME UID ${esc(f.code)} sent a request</small></div></div><div class="socialRowActions"><button type="button" data-social-action="accept" data-profile-id="${esc(f.id)}">ACCEPT</button><button type="button" class="secondaryBtn" data-social-action="decline" data-profile-id="${esc(f.id)}">DECLINE</button></div></div>`).join(''):'<div class="socialEmpty">No pending friend requests.</div>';
 const outgoingLine=outgoing.length?`<div class="socialEmpty">Pending: ${outgoing.map(f=>`${esc(f.name)} (UID ${esc(f.code)})`).join(' · ')}</div>`:'';
 root.innerHTML=`<div class="socialIdentity"><span>YOUR GAME UID<br><b class="socialCode">${esc(socialProfile.code)}</b><small style="display:block;opacity:.56;margin-top:3px">Share this UID with friends</small></span><button type="button" class="socialSmallBtn secondaryBtn" data-social-action="copy">COPY</button></div><div class="socialSectionTitle">ADD A FRIEND</div><div class="socialAddRow"><input class="friendCodeEntry" type="text" maxlength="6" autocomplete="off" inputmode="numeric" pattern="[0-9]*" placeholder="ENTER 6-DIGIT GAME UID" aria-label="Game UID"><button type="button" data-social-action="add">ADD</button></div><div class="socialFeedback" aria-live="polite"></div>${requestRows}${outgoingLine}<div class="socialSectionTitle">YOUR FRIENDS · ${friends.length}</div><div>${friendRows}</div>${canInvite?'<div class="socialEmpty">Invite any online friend directly from here, whether or not you are the host.</div>':''}`;
}
function paintAllSocialPanels(){paintSocialPanel();const online=(socialSnapshot.friends||[]).filter(f=>f.online).length;const count=document.getElementById('friendsSidebarOnlineCount'),toggleCount=document.getElementById('friendsToggleOnline');if(count)count.textContent=`${online} ONLINE`;if(toggleCount)toggleCount.textContent=`${online} ONLINE`;refreshRoomSocialActions()}
function socialFeedback(root,msg){const el=root?.querySelector('.socialFeedback');if(el)el.textContent=msg||''}
function bindSocialPanel(id){const root=document.getElementById(id);if(!root)return;root.addEventListener('click',async ev=>{const b=ev.target.closest('[data-social-action]');if(!b)return;const act=b.dataset.socialAction;if(act==='add'){const input=root.querySelector('.friendCodeEntry'),code=(input?.value||'').trim().toUpperCase();if(!/^\d{6}$/.test(code)){socialFeedback(root,'Enter the 6-digit Game UID.');input?.focus();return}if(sendSocial({t:'socialAddFriend',code})){socialFeedback(root,'Sending friend request...')}return}if(act==='copy'){try{await navigator.clipboard.writeText(socialProfile?.code||'');socialFeedback(root,'Game UID copied.')}catch{window.prompt('Copy your MAYDAY Game UID:',socialProfile?.code||'')}return}if(act==='accept'||act==='decline'){sendSocial({t:'socialFriendResponse',profileId:b.dataset.profileId,accept:act==='accept'});return}if(act==='invite'){if(!roomCode)return;sendSocial({t:'socialInviteFriend',friendId:b.dataset.friendId,roomCode});socialFeedback(root,'Sending invitation...');return}});root.addEventListener('input',ev=>{if(ev.target.classList.contains('friendCodeEntry'))ev.target.value=ev.target.value.replace(/\D/g,'').slice(0,6)});root.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&ev.target.classList.contains('friendCodeEntry')){ev.preventDefault();root.querySelector('[data-social-action="add"]')?.click()}})}
function setFriendsSidebarOpen(open,persist=true){const sidebar=document.getElementById('friendsSidebar'),toggle=document.getElementById('friendsToggle'),lobby=document.getElementById('lobby');if(!sidebar||!toggle)return;sidebar.classList.toggle('open',!!open);sidebar.setAttribute('aria-hidden',String(!open));toggle.hidden=!!open;toggle.setAttribute('aria-expanded',String(!!open));lobby?.classList.toggle('withFriendsSidebar',!!open);if(persist){try{localStorage.setItem('maydayFriendsSidebarOpen',open?'1':'0')}catch{}}}
function finishSocialInviteJoin(ok,code='',message='',spectator=false){if(!joiningSocialInviteId)return;const inviteId=joiningSocialInviteId;joiningSocialInviteId='';clearTimeout(inviteJoinWatchdog);inviteJoinWatchdog=0;inviteDebug('finish',`id=${inviteId.slice(0,8)} ok=${!!ok} code=${code||'-'} spectator=${!!spectator} message=${message||'-'}`);sendSocial({t:'socialJoinComplete',inviteId,ok:!!ok,code:String(code||'').toUpperCase(),message:String(message||''),spectator:!!spectator})}
function connectSocial(){if(socialSocketConnecting||socialSocket?.readyState===WebSocket.OPEN||socialSocket?.readyState===WebSocket.CONNECTING)return;socialSocketConnecting=true;try{socialSocket=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host)}catch{socialSocketConnecting=false;return}
 socialSocket.onopen=()=>{socialSocketConnecting=false;socialIdentity=readSocialIdentity();socialSocket.send(JSON.stringify({t:'socialHello',name:document.getElementById('name')?.value||'Pilot',profileId:socialIdentity?.id,profileToken:socialIdentity?.token}))};
 socialSocket.onmessage=ev=>{let m;try{m=JSON.parse(ev.data)}catch{return}
  if(m.t==='socialAuthError'){try{localStorage.removeItem(SOCIAL_IDENTITY_KEY)}catch{}socialIdentity=null;socialSocket.send(JSON.stringify({t:'socialHello',name:document.getElementById('name')?.value||'Pilot'}));return}
  if(m.t==='socialWelcome'){socialProfile=m.profile;socialIdentity={id:m.profile.id,token:m.profileToken};try{localStorage.setItem(SOCIAL_IDENTITY_KEY,JSON.stringify(socialIdentity))}catch{}const nameInput=document.getElementById('name');if(m.profile.name&&(!nameInput.value||nameInput.value==='Pilot'))nameInput.value=m.profile.name;else if(nameInput.value&&nameInput.value!==m.profile.name)setTimeout(()=>sendSocial({t:'socialRename',name:nameInput.value}),0);paintAllSocialPanels();if(pendingRoomConnect){const next=pendingRoomConnect;pendingRoomConnect=null;setTimeout(()=>connect(next),0)}return}
  if(m.t==='socialState'){const previous=new Map((socialSnapshot.friends||[]).map(f=>[f.id,f.online]));socialProfile=m.profile||socialProfile;socialSnapshot={friends:m.friends||[],incomingRequests:m.incomingRequests||[],outgoingRequests:m.outgoingRequests||[]};paintAllSocialPanels();for(const f of socialSnapshot.friends){if(f.online&&!previous.get(f.id)&&previous.has(f.id))toast(`${f.name} is online`)}return}
  if(m.t==='socialActionResult'){if(m.message)toast(m.message);const root=document.getElementById('friendsSidebarPanel');socialFeedback(root,m.message);return}
  if(m.t==='socialInvite'){incomingSocialInvites.push(m);showNextSocialInvite();return}
  if(m.t==='socialInviteResult'){if(m.message)toast(m.message);return}
  if(m.t==='socialJoinRoom'){inviteDebug('socialJoinRoom received',`id=${String(m.inviteId||'').slice(0,8)} room=${m.roomCode||'-'} state=${m.state||'-'}`);joinInvitedRoom(m.roomCode,m.inviteId);return}
  if(ws===socialSocket&&!String(m.t||'').startsWith('social')){handleGameMessage(socialSocket,{t:'join',inviteId:joiningSocialInviteId},ev.data);return}
 };
 socialSocket.onerror=()=>{socialSocketConnecting=false};
 socialSocket.onclose=ev=>{socialSocketConnecting=false;if(ev.code===4001)return;const wasGame=ws===socialSocket;if(wasGame){ws=null;if(roomCode){toast('Connection lost. Use CONTINUE LAST GAME after MAYDAY reconnects.');renderRecoveryPanel()}if(joiningSocialInviteId)finishSocialInviteJoin(false,'','The friends/game connection closed during the room handoff.')}socialSocket=null;setTimeout(()=>{if(!socialSocket||socialSocket.readyState===WebSocket.CLOSED)connectSocial()},2200)};
}
function reportSocialStatus(status,code=roomCode){sendSocial({t:'socialStatus',status,roomCode:status==='lobby'?'':code});paintAllSocialPanels()}
function showNextSocialInvite(){const dlg=document.getElementById('socialInviteDialog');if(!dlg)return;if(!incomingSocialInvites.length){activeSocialInvite=null;dlg.style.display='none';return}activeSocialInvite=incomingSocialInvites[0];const m=activeSocialInvite,mode=String(m.room?.mode||'MAYDAY').toUpperCase().replace('FFA','DOGFIGHT');document.getElementById('socialInviteText').textContent=`${m.from?.name||'A friend'} invited you to ${mode} room ${m.room?.code||'----'}. ${m.room?.state==='lobby'?'Join as a pilot.':'The match has started, so you will spectate.'}`;dlg.style.display='flex'}
function respondSocialInvite(accept){const inv=activeSocialInvite;if(!inv)return;incomingSocialInvites=incomingSocialInvites.filter(x=>x.inviteId!==inv.inviteId);document.getElementById('socialInviteDialog').style.display='none';activeSocialInvite=null;const showNext=()=>showNextSocialInvite();if(!accept){sendSocial({t:'socialDeclineInvite',inviteId:inv.inviteId});showNext();return}const decline=()=>{sendSocial({t:'socialDeclineInvite',inviteId:inv.inviteId});showNext()};const doAccept=()=>{sendSocial({t:'socialAcceptInvite',inviteId:inv.inviteId});showNext()};if(ws&&ws.readyState===WebSocket.OPEN&&roomCode&&roomCode!==inv.room?.code)showConfirm('JOIN FRIEND’S ROOM?',`You are currently in room ${roomCode}. Leave it and join ${inv.room?.code||'your friend’s room'}?`,'JOIN ROOM',doAccept,decline);else doAccept()}
function joinInvitedRoom(code,inviteId=''){
 roomExitInProgress=false;
 const c=String(code||'').toUpperCase().trim();
 inviteDebug('begin',`id=${String(inviteId||'').slice(0,8)||'-'} room=${c||'-'} host=${location.host} socialState=${socialSocket?.readyState??'none'} gameState=${ws?ws.readyState:'none'} oldRoom=${roomCode||'-'}`);
 if(!/^[A-Z0-9]{4}$/.test(c)){
   if(inviteId)sendSocial({t:'socialJoinComplete',inviteId,ok:false,code:c,message:'The invitation contains an invalid room code.'});
   toast('Could not join: invalid room code.');return;
 }
 if(!socialSocket||socialSocket.readyState!==WebSocket.OPEN){
   if(inviteId)sendSocial({t:'socialJoinComplete',inviteId,ok:false,code:c,message:'Your friends connection is offline. Reconnect to MAYDAY and accept a new invitation.'});
   toast('Friends connection is offline. Reconnect and ask for a new invitation.');return;
 }
 if(joiningSocialInviteId&&joiningSocialInviteId!==inviteId){toast('Another invitation is already being joined. Please wait.');return}
 if(ws===socialSocket&&socialSocket.readyState===WebSocket.OPEN&&roomCode===c){if(inviteId)finishSocialInviteJoin(true,c,'',spectatorMode);toast(`Already in room ${c}.`);return}
 if(inviteId){
   joiningSocialInviteId=inviteId;clearTimeout(inviteJoinWatchdog);
   toast(`Connecting to room ${c}…`);
   inviteJoinWatchdog=setTimeout(()=>{
     inviteDebug('timeout',`id=${String(inviteId).slice(0,8)} room=${c} host=${location.host} socket=${ws?.readyState??'none'} code=${roomCode||'-'}`);
     finishSocialInviteJoin(false,roomCode,`The existing MAYDAY connection did not confirm the room handoff to ${c}. Check the server log for social-game-join.`);
     errEl.textContent=`INVITE TIMEOUT • ${MAYDAY_BUILD} • ${location.host}`;toast('Invitation timed out. Please try once more.');
   },20000);
 }
 const previous=ws&&ws!==socialSocket?ws:null;
 if(previous&&previous.readyState!==WebSocket.CLOSED){intentionalDisconnect=true;try{previous.close(1000,'left room')}catch(e){inviteDebug('old socket close failed',e?.message||String(e))}}
 clearRecoverySession();
 try{goMainMenu()}catch(e){inviteDebug('menu reset warning',e?.stack||e?.message||String(e));document.getElementById('lobby').style.display='flex';document.getElementById('menu').style.display='block';document.getElementById('room').style.display='none'}
 ws=socialSocket;intentionalDisconnect=false;
 const outgoing={t:'socialGameJoin',inviteId,roomCode:c,n:document.getElementById('name')?.value||socialProfile?.name||'Pilot',ty:document.getElementById('ptype')?.value||'balanced',colorId:selectedColorId,team:myTeam};
 inviteDebug('sending same-socket room handoff',`id=${String(inviteId).slice(0,8)} room=${c} socket=${socialSocket.readyState} identity=${socialIdentity?.id?'present':'missing'}`);
 if(!sendSocial(outgoing)){finishSocialInviteJoin(false,'','Could not send the room handoff because the friends connection closed.');errEl.textContent='Friends connection dropped. Reconnect and request a new invite.'}
}
fetch('/api/version',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(v=>{const badge=document.getElementById('buildVersionBadge'),serverVersion=v?.version||'UNREACHABLE';if(badge)badge.textContent=`CLIENT ${MAYDAY_BUILD.split('-')[0]} · SERVER ${serverVersion.split('-')[0]}`;if(v?.version&&v.version!==MAYDAY_BUILD)console.error('[MAYDAY build mismatch]',{client:MAYDAY_BUILD,server:v.version,host:location.host})}).catch(()=>{const badge=document.getElementById('buildVersionBadge');if(badge)badge.textContent=`CLIENT ${MAYDAY_BUILD.split('-')[0]} · SERVER UNREACHABLE`});
document.getElementById('acceptSocialInvite')?.addEventListener('click',()=>respondSocialInvite(true));document.getElementById('declineSocialInvite')?.addEventListener('click',()=>respondSocialInvite(false));bindSocialPanel('friendsSidebarPanel');
document.getElementById('room')?.addEventListener('click',ev=>{const b=ev.target.closest('[data-room-social-action]');if(b)sendRoomSocialAction(b)});
document.getElementById('friendsToggle')?.addEventListener('click',()=>setFriendsSidebarOpen(true));document.getElementById('closeFriendsSidebar')?.addEventListener('click',()=>setFriendsSidebarOpen(false));
try{const savedSidebar=localStorage.getItem('maydayFriendsSidebarOpen');setFriendsSidebarOpen(savedSidebar===null?true:savedSidebar==='1',false)}catch{setFriendsSidebarOpen(true,false)}

let selectedMode='';
const MODE_META={ffa:{name:'DOGFIGHT',help:'Everyone against everyone · minimum 2 pilots · respawn after each kill · first to 10 kills.'},clash:{name:'CLASH SQUAD',help:'2–6 teams inside the room · minimum 2 pilots · one life per round · last team alive wins the round · 3 shields per round, 7s each.'},survivor:{name:'SURVIVOR',help:'Everyone fights everyone · minimum 2 pilots · host chooses 1–5 lives · last pilot remaining wins.'},practice:{name:'PRACTICE',help:'Solo training arena · moving AI target aircraft · unlimited practice · no room code.'}};
function renderMatchResults(m){
 const modeName=m.mode==='clash'?'CLASH SQUAD':m.mode==='survivor'?'SURVIVOR':'DOGFIGHT';
 const players=(m.players||[]).slice();
 const mvp=m.mvp||players.slice().sort((a,b)=>(b.kills||0)*120+(b.damage||0)+(b.survivalBonus||0)-((a.kills||0)*120+(a.damage||0)+(a.survivalBonus||0)))[0]||{n:'MVP',c:'#ffd166'};
 const ranking=players.slice().sort((a,b)=>(b.kills||0)-(a.kills||0)||(b.damage||0)-(a.damage||0)||(a.deaths||0)-(b.deaths||0));
 const title=m.mode==='clash'?`${esc((TN[m.win]||m.win||'Winning').toUpperCase())} TEAM WINS`:(m.mode==='survivor'?`${esc(m.win||'SURVIVOR')} WINS`:`${esc(m.win||'DOGFIGHT')} WINS`);
 const rankRows=m.mode==='clash'?(m.teams||[]).map((t,i)=>`<div class="rankRow"><span class="rankNo">${i+1}</span><span class="pilotName" style="color:${t.color}">${esc(t.name).toUpperCase()} TEAM</span><span>${t.score||0} RDS</span><span>${t.kills||0} K</span></div>`).join(''):
  ranking.map((p,i)=>`<div class="rankRow"><span class="rankNo">${i+1}</span><span class="pilotName" style="color:${p.c}">${esc(p.n)}</span><span>${p.kills||0} K</span><span>${p.damage||0}</span></div>`).join('');
 const rows=ranking.map((p,i)=>`<div class="playerRow"><span class="rankNo">${i+1}</span><span class="pilotName" style="color:${p.c}">${esc(p.n)}${m.mode==='clash'&&p.team?` <small style="opacity:.5">· ${esc(TN[p.team]||p.team)}</small>`:''}</span><span>${p.kills||0}</span><span>${p.deaths||0}</span><span>${p.damage||0}</span><span>${p.shields||0}</span><span>${p.missiles||0}</span><span>${p.flares||0}</span></div>`).join('');
 winEl.className='resultsScreen';
 winEl.innerHTML=`<div class="resultsWrap"><div class="mvpStage"><div class="mvpTitle">${modeName} · MATCH COMPLETE</div><div class="mvpBadge">★ MVP</div><div class="mvpPlane" style="color:${mvp.c||'#ffd166'}"></div><div class="mvpName" style="color:${mvp.c||'#fff'}">${esc(mvp.n||'MVP')}</div></div>
 <div class="resultsCard"><div class="resultsHeadline">🏆 ${title}</div><div class="resultsSub">Match MVP · <span style="color:${mvp.c||'#ffd166'}">${esc(mvp.n||'MVP')}</span></div></div>
 <div class="resultsGrid"><div class="resultsCard"><h2>${m.mode==='clash'?'SQUAD RANKINGS':'PILOT RANKING'}</h2><div class="rankRow"><span class="statHead">#</span><span class="statHead">${m.mode==='clash'?'SQUAD':'PILOT'}</span><span class="statHead">${m.mode==='clash'?'RDS':'K'}</span><span class="statHead">${m.mode==='clash'?'K':'DMG'}</span></div>${rankRows||'<div style="opacity:.6">No ranking data.</div>'}</div>
 <div class="resultsCard"><h2>PLAYER STATS</h2><div class="playerRow"><span class="statHead">#</span><span class="statHead">PILOT</span><span class="statHead">K</span><span class="statHead">D</span><span class="statHead">DMG</span><span class="statHead">SHD</span><span class="statHead">MSL</span><span class="statHead">FLR</span></div>${rows||'<div style="opacity:.6">No player data.</div>'}</div></div>
 <div class="resultActions">${isHost?'<button id="again">PLAY AGAIN</button>':'<div style="opacity:.65;margin-bottom:8px">Waiting for the host to start another game...</div>'}<br><button id="matchExit" class="navBtn">EXIT TO MAIN MENU</button></div></div>`;
 winEl.style.display='flex';
 const ab=document.getElementById('again');if(ab)ab.onclick=()=>ws.send(JSON.stringify({t:'again'}));const meb=document.getElementById('matchExit');if(meb)meb.onclick=()=>leaveRoom('game');
}
function startPractice(){
  clearKillReplay();initAudio();saveSet();roomMode='practice';practiceDifficulty=document.getElementById('practiceDifficulty').value||'normal';practiceMode=true;inGame=true;over=false;alive=true;spectatorMode=false;isHost=false;roomInfo=null;roomCode='';ws=null;myId='practice-player';myTeam='practice-player';practiceKills=0;snapPlayers={};
  clearWorld();if(plane){scene.remove(plane);plane=null}practiceRespawnAt=0;myColor=COLOR_BY_ID[selectedColorId]?.color||'#ffffff';maxhp=(PT[ptype]||PT.balanced).hp;hp=maxhp;
  plane=makePlane(myColor,ptype);plane.userData.team=myTeam;plane.userData.col=myColor;ensureShield();shields=0;shieldUntil=0;RANGE=4000;reset();makePracticeArena();
  document.getElementById('lobby').style.display='none';showGameplayUi();document.getElementById('radar').style.display='block';winEl.style.display='none';bannerEl.textContent='';shieldHud.style.display='none';spectatorHud.style.display='none';setMusic(false);toast(`PRACTICE ARENA • ${practiceDifficulty.toUpperCase()} BOTS • ESC disabled`);
}
function resetModeSelection(){selectedMode='';document.querySelectorAll('.modeCard').forEach(c=>c.classList.remove('selected'));document.querySelector('.modeGrid').style.display='grid';document.getElementById('selectedModePanel').style.display='none';document.getElementById('actionRow').style.display='none';document.getElementById('hostMode').style.display='inline-block';document.getElementById('joinMode').style.display='inline-block';document.getElementById('practiceMode').style.display='none';document.getElementById('practiceSettings').style.display='none';document.getElementById('joinBox').style.display='none';document.getElementById('modeHelp').textContent='Select a mode to continue.';document.getElementById('code').value='';errEl.textContent=''}document.querySelectorAll('.modeCard').forEach(card=>card.onclick=()=>{selectedMode=card.dataset.mode;document.querySelectorAll('.modeCard').forEach(c=>c.classList.toggle('selected',c===card));const info=MODE_META[selectedMode];document.querySelector('.modeGrid').style.display='none';document.getElementById('selectedModePanel').style.display='block';document.getElementById('selectedModeTitle').textContent=info.name;document.getElementById('selectedModeMeta').textContent=info.help;document.getElementById('practiceSettings').style.display=selectedMode==='practice'?'block':'none';document.getElementById('actionRow').style.display='flex';document.getElementById('hostMode').style.display=selectedMode==='practice'?'none':'inline-block';document.getElementById('joinMode').style.display=selectedMode==='practice'?'none':'inline-block';document.getElementById('practiceMode').style.display=selectedMode==='practice'?'inline-block':'none';document.getElementById('joinBox').style.display='none';errEl.textContent='';document.getElementById('modeHelp').textContent=info.help});
document.getElementById('backToModes').onclick=()=>resetModeSelection();
document.getElementById('hostMode').onclick=()=>{if(!selectedMode)return;document.getElementById('joinBox').style.display='none';errEl.textContent='';connect({t:'host',mode:selectedMode})};
document.getElementById('practiceMode').onclick=()=>{if(selectedMode==='practice')startPractice()};
document.getElementById('joinMode').onclick=()=>{document.getElementById('joinBox').style.display='block';document.getElementById('code').focus();errEl.textContent=''};
document.getElementById('backFromJoin').onclick=()=>{document.getElementById('joinBox').style.display='none';document.getElementById('code').value='';errEl.textContent=''};
document.getElementById('join').onclick=()=>{const c=document.getElementById('code').value.trim().toUpperCase();if(!/^[A-Z0-9]{4}$/.test(c)){errEl.textContent='Enter the 4-character Game Code.';document.getElementById('code').focus();return}connect({t:'join',roomId:c,code:c})};
renderRecoveryPanel();setInterval(()=>{if(ws?.sessionToken&&ws.readyState===1&&!intentionalDisconnect)saveRecoverySession()},30000);
document.getElementById('leaveRoom').onclick=()=>leaveRoom('room');
document.getElementById('start').onclick=()=>ws.send(JSON.stringify({t:'start'}));
document.getElementById('name')?.addEventListener('change',()=>{saveSet();if(socialSocket&&socialSocket.readyState===WebSocket.OPEN)sendSocial({t:'socialRename',name:document.getElementById('name').value||'Pilot'})});
document.getElementById('openSettings')?.addEventListener('click',openSettings);
document.getElementById('gameSettingsBtn')?.addEventListener('click',openSettings);
document.getElementById('closeSettings')?.addEventListener('click',closeSettings);
document.getElementById('settingsPanel')?.addEventListener('click',e=>{if(e.target.id==='settingsPanel')closeSettings()});
document.getElementById('mouseControls')?.addEventListener('change',e=>{mouseControls=e.target.checked;saveMaydaySettings();if(inGame){if(mouseControls&&!mobileTouchEnabled)requestMaydayPointerLock();else unlockMaydayPointer()}});
document.getElementById('mouseSensitivity')?.addEventListener('input',e=>{mouseSensitivity=Math.max(1,Math.min(200,Number(e.target.value)||100));const v=document.getElementById('mouseSensitivityValue');if(v)v.textContent=Math.round(mouseSensitivity)+'%';saveMaydaySettings()});
addEventListener('pointerdown',e=>{initAudio();if(!inGame)setMusic(true);else if(!mobileTouchEnabled&&mouseControls&&!pointerLocked&&!e.target.closest('#settingsPanel,#gameSettingsBtn,#killReplayBtn,#friendsSidebar,#friendsToggle,#socialInviteDialog,#confirmDialog,#mobileControls'))requestMaydayPointerLock()},{once:false});
setMusic(true);connectSocial();
setInterval(()=>{if(ws&&plane&&alive&&!killReplayActive&&ws.readyState===1)ws.send(JSON.stringify({t:'s',p:plane.position.toArray(),q:plane.quaternion.toArray()}))},50);
let specId=null;
function beginDeathCam(pos){const p=pos.clone();const gy=Math.max(height(p.x,p.z),0);p.y=Math.max(p.y,gy+8);deathCamPos.copy(p);deathCamLook.set(p.x,gy+16,p.z);deathCamActive=true;deathCamUntil=performance.now()+3900;killCamActive=false;killCamAttackerId=null;plane.position.copy(p);plane.position.y=Math.max(plane.position.y,gy+8);plane.visible=false}
function beginKillCam(pos,attackerId){const p=pos.clone();const gy=Math.max(height(p.x,p.z),0);p.y=Math.max(p.y,gy+8);deathCamPos.copy(p);deathCamLook.set(p.x,gy+18,p.z);deathCamActive=false;killCamActive=!!attackerId;killCamAttackerId=attackerId?String(attackerId):null;killCamUntil=performance.now()+3200;plane.position.copy(p);plane.position.y=Math.max(p.y,gy+8);plane.visible=false}
function specFollow(){const now=performance.now();const ids=Object.keys(remotes).filter(id=>remotes[id].alive!==false&&remotes[id].roundHiddenUntil<=now);let l=spectatorMode?ids:(roomMode==='clash'?ids.filter(id=>remotes[id].team===myTeam):ids);if(!l.length)l=ids;
 if(l.length){const wanted=specId&&l.includes(String(specId));if(!wanted)specId=l[((specIdx%l.length)+l.length)%l.length];const r=remotes[String(specId)];if(!r)return;spectatorName=(snapPlayers[specId]&&snapPlayers[specId].n)||'';plane.position.copy(r.mesh.position);plane.position.y=Math.max(plane.position.y,Math.max(height(plane.position.x,plane.position.z),0)+30);plane.quaternion.copy(r.mesh.quaternion)}
 else{specId=null;spectatorName='';const gy=Math.max(height(plane.position.x,plane.position.z),0);plane.position.y=Math.max(plane.position.y,gy+180);plane.quaternion.setFromAxisAngle(new T.Vector3(0,1,0),0)}updateSpectatorHud();}
const hud=document.getElementById('hud'),scoreEl=document.getElementById('score');
const fw=new T.Vector3(),rt=new T.Vector3(),q=new T.Quaternion(),ax=new T.Vector3(),camPos=new T.Vector3(),look=new T.Vector3();
const rc=document.getElementById('radar').getContext('2d');let RANGE=3500;
// Rotating minimap by default; M toggles to North-up. No mode/status dialog is shown on the map.
let mapStyle='rotate';
function drawRadar(now){const W=240,C=120,Rr=108;rc.clearRect(0,0,W,W);
 rc.strokeStyle='rgba(120,255,180,.3)';rc.lineWidth=1;
 for(const k of [.25,.5,.75,1]){rc.beginPath();rc.arc(C,C,Rr*k,0,7);rc.stroke()}rc.strokeStyle='rgba(255,210,100,.16)';rc.beginPath();rc.arc(C,C,Rr*Math.min(1,LOCK_RANGE/RANGE),0,7);rc.stroke();rc.strokeStyle='rgba(120,255,180,.3)';
 rc.beginPath();rc.moveTo(C,C-Rr);rc.lineTo(C,C+Rr);rc.moveTo(C-Rr,C);rc.lineTo(C+Rr,C);rc.stroke();
 fw.set(0,0,-1).applyQuaternion(plane.quaternion);let fx=fw.x,fz=fw.z;const fl=Math.hypot(fx,fz)||1;fx/=fl;fz/=fl;
 const toS=mapStyle==='north'?((dx,dz)=>[dx,dz]):((dx,dz)=>[-fz*dx+fx*dz,-(fx*dx+fz*dz)]);
 rc.textAlign='center';rc.textBaseline='middle';rc.font='bold 13px monospace';
 if(mapStyle==='north'){rc.fillStyle='#ff6b6b';rc.fillText('N',C,C-(Rr-9));rc.fillStyle='#cfe';rc.fillText('E',C+(Rr-9),C);rc.fillText('S',C,C+(Rr-9));rc.fillText('W',C-(Rr-9),C)}else{for(const [t,dx,dz,col] of [['N',0,-1,'#ff6b6b'],['E',1,0,'#cfe'],['S',0,1,'#cfe'],['W',-1,0,'#cfe']]){const [sx,sy]=toS(dx,dz);rc.fillStyle=col;rc.fillText(t,C+sx*(Rr-9),C+sy*(Rr-9))}}
 const hdg=(Math.round(Math.atan2(fw.x,-fw.z)*180/Math.PI)+360)%360;
 for(const id in remotes){const r=remotes[id];if(!r.p||r.alive===false||r.roundHiddenUntil>now)continue;
  const dx=r.mesh.position.x-plane.position.x,dz=r.mesh.position.z-plane.position.z,dy=r.mesh.position.y-plane.position.y;
  let [sx,sy]=toS(dx,dz);const d=Math.hypot(sx,sy),out=d>RANGE;
  const k=(out?Rr-4:Math.min(d/RANGE*Rr,Rr-4))/(d||1);sx*=k;sy*=k;
  const px=C+sx,py=C+sy,col=(snapPlayers[id]&&snapPlayers[id].c)||'#f00';
  const ef=new T.Vector3(0,0,-1).applyQuaternion(r.mesh.quaternion),[hx,hy]=toS(ef.x,ef.z);
  rc.save();rc.translate(px,py);rc.rotate(mapStyle==='north'?Math.atan2(ef.x,-ef.z):(out?Math.atan2(sx,-sy):Math.atan2(hx,-hy)));
  const s=out?8:12;rc.fillStyle=col;rc.strokeStyle='rgba(0,0,0,.85)';rc.lineWidth=1.5;rc.beginPath();rc.moveTo(0,-s);rc.lineTo(s*.7,s*.7);rc.lineTo(0,s*.3);rc.lineTo(-s*.7,s*.7);rc.closePath();rc.fill();rc.stroke();rc.restore();
  if(lockId&&lockId===id){const ok=lockT>=3;rc.strokeStyle=ok?'#ff2b2b':'#ffd400';rc.lineWidth=2;rc.beginPath();rc.arc(px,py,15+(ok?Math.sin(now/100)*2:0),0,7);rc.stroke()}
  const dist=Math.hypot(dx,dz,dy);rc.textAlign='left';rc.font='bold 11px monospace';rc.fillStyle='#fff';
  rc.fillText((dy>50?'\u25b2':dy<-50?'\u25bc':'\u25cf')+(dist>=1000?(dist/1000).toFixed(1)+'km':Math.round(dist/10)*10+'m'),px+13,py+1);rc.textAlign='center'}
 for(const s of landingStrips){const dx=s.x-plane.position.x,dz=s.z-plane.position.z;let [sx,sy]=toS(dx,dz);const d=Math.hypot(sx,sy);if(d<=RANGE){const k=Math.min(d/RANGE*Rr,Rr-8)/(d||1);sx*=k;sy*=k;rc.fillStyle='#50ff9a';rc.fillRect(C+sx-3,C+sy-3,6,6)}}
 rc.save();rc.translate(C,C);if(mapStyle==='north')rc.rotate(Math.atan2(fw.x,-fw.z));rc.fillStyle=myColor;rc.strokeStyle='rgba(0,0,0,.85)';rc.lineWidth=1.5;rc.beginPath();rc.moveTo(0,-10);rc.lineTo(8,9);rc.lineTo(0,5);rc.lineTo(-8,9);rc.closePath();rc.fill();rc.stroke();rc.restore()}
const clock=new T.Clock();updateTerrain(0,0);cam.position.set(0,600,0);
const sunOff=new T.Vector3(-3200,5600,-2200);
function loop(){requestAnimationFrame(loop);if(!killReplayActive&&killReplayAvailableUntil&&performance.now()>=killReplayAvailableUntil){killReplayAvailableUntil=0;killReplayClip=[];if(killReplayBtn)killReplayBtn.style.display='none'}if(plane){if(killReplayActive&&killReplayResume){plane.position.copy(killReplayResume.p);plane.quaternion.copy(killReplayResume.q)}sun.position.copy(plane.position).add(sunOff);sun.target.position.copy(plane.position);sun.target.updateMatrixWorld()}const dt=Math.min(clock.getDelta(),.05);updateFpsMeter(dt);
 if(plane){
  const PTY=PT[ptype]||PT.balanced;
  throttle=T.MathUtils.clamp(throttle+((keys.KeyW?1:0)-(keys.KeyS?1:0)+mobileInput.throttle-mobileInput.brake)*dt*1.5,0,1);
  const mouseScale=mouseSensitivity/100;
  const stickScale=mobileTouchEnabled?mobilePrefs.joystickSensitivity:1;
  const pitchStick=(keys.ArrowDown?1:0)-(keys.ArrowUp?1:0)+mobileInput.pitch*stickScale;
  const rollStick=(keys.KeyD?1:0)-(keys.KeyA?1:0)+mobileInput.roll*stickScale;
  const realistic=mobileTouchEnabled&&mobilePrefs.flightModel==='realistic';
  const handlingScale=realistic?T.MathUtils.clamp(118/Math.max(65,speed),.62,1.16):1;
  const mousePitch=mouseControls?T.MathUtils.clamp(mouseDY*.015*mouseScale,-1.5,1.5)*invert:0;
  const mouseYaw=mouseControls?T.MathUtils.clamp(mouseDX*.015*mouseScale,-1.5,1.5):0;
  const pitch=pitchStick*invert+mousePitch,roll=rollStick;
  let yaw=((keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0))+mobileInput.yaw*stickScale+mouseYaw;
  if(realistic){const euForBank=new T.Euler().setFromQuaternion(plane.quaternion,'YXZ');yaw+=Math.sin(euForBank.z)*.18;}
  mouseDX*=Math.max(0,1-dt*18);mouseDY*=Math.max(0,1-dt*18);
  if(!landed){
   rt.set(1,0,0).applyQuaternion(plane.quaternion);
   q.setFromAxisAngle(ax.set(1,0,0),pitch*dt*sP.value*PTY.turn*handlingScale);plane.quaternion.multiply(q);
   q.setFromAxisAngle(ax.set(0,0,-1),roll*dt*1.9*sR.value*PTY.turn*handlingScale);plane.quaternion.multiply(q);
   q.setFromAxisAngle(ax.set(0,1,0),-yaw*dt*.6*sY.value*PTY.turn*handlingScale);plane.quaternion.multiply(q);
   q.setFromAxisAngle(ax.set(0,1,0),-rt.y*dt*.9);plane.quaternion.premultiply(q);
   if(speed<38){q.setFromAxisAngle(ax.set(1,0,0),-dt*(38-speed)*.03);plane.quaternion.multiply(q)}
   if(mobileTouchEnabled&&mobilePrefs.autoLevel&&Math.abs(pitchStick)<.05&&Math.abs(rollStick)<.05&&!landed){const le=new T.Euler().setFromQuaternion(plane.quaternion,'YXZ');le.x*=Math.exp(-2.4*dt);le.z*=Math.exp(-2.7*dt);const leveledQ=new T.Quaternion().setFromEuler(le);plane.quaternion.slerp(leveledQ,Math.min(1,dt*2.3))}
   plane.quaternion.normalize();
  }else if(landingStrip){
   // On the runway the aircraft stays level; pitch/roll input cannot drive the nose into the runway.
   plane.quaternion.setFromAxisAngle(new T.Vector3(0,1,0),landingStrip.heading);
  }
  fw.set(0,0,-1).applyQuaternion(plane.quaternion);
  const boosting=(keys.ShiftLeft||keys.ShiftRight||mobileInput.boost)&&boost>3&&!keys.KeyS&&!mobileInput.brake;boost=boosting?Math.max(0,boost-dt*30):Math.min(100,boost+dt*10);
  if(boosting&&!wasBoost)noise(.6,.2,2500);wasBoost=boosting;if(boosting){puff(tailPos(plane),0x66b0ff,2.5,.2,new T.Vector3(),.9,{add:true,grow:.5});puff(tailPos(plane),0xffa030,4.5,.35,new T.Vector3(),.8,{add:true,grow:1});shake=Math.max(shake,.06)}
  const speedResponse=realistic?(boosting?1.22:.48):(boosting?1.6:.8);speed+=((25+throttle*200*PTY.spd+(boosting?140:0))-speed)*dt*speedResponse-fw.y*dt*28-((keys.KeyS||mobileInput.brake)?dt*80:0);speed=Math.max(speed,0);
  cam.fov+=((boosting?80:65)-cam.fov)*Math.min(1,dt*4);cam.updateProjectionMatrix();
  const prevX=plane.position.x,prevY=plane.position.y,prevZ=plane.position.z;
  plane.position.addScaledVector(fw,speed*dt*1.6);if(!landed&&speed<45)plane.position.y-=(45-speed)*.6*dt;
  // Landing guidance + forgiving touchdown detection. The aircraft can land from either runway direction.
  let nearestRunway=null,nearestRunwayDist=Infinity;
  for(const s of landingStrips){const d=Math.hypot(plane.position.x-s.x,plane.position.z-s.z);if(d<nearestRunwayDist){nearestRunway=s;nearestRunwayDist=d}}
  const landHint=document.getElementById('landingHint');
  if(alive&&!landed&&nearestRunway&&nearestRunwayDist<2400){
   const runwayDir=new T.Vector3(0,0,-1).applyAxisAngle(new T.Vector3(0,1,0),nearestRunway.heading).normalize();
   const flatFw=new T.Vector3(fw.x,0,fw.z);if(flatFw.lengthSq()<1e-6)flatFw.set(runwayDir.x,0,runwayDir.z);else flatFw.normalize();
   const dvec=new T.Vector3(plane.position.x-nearestRunway.x,0,plane.position.z-nearestRunway.z);
   const along=dvec.dot(runwayDir),lateral=Math.abs(dvec.x*runwayDir.z-dvec.z*runwayDir.x);
   const sameWay=flatFw.dot(runwayDir),alignment=Math.acos(Math.max(-1,Math.min(1,Math.abs(sameWay))))*180/Math.PI;
   const vertical=Math.max(0,plane.position.y-nearestRunway.surfaceY);
   const speedKmh=Math.round(speed*3.6);
   const inside= Math.abs(along)<nearestRunway.length*.56 && lateral<nearestRunway.width*.78;
   landHint.style.display='block';
   let guide='FOLLOW THE GREEN LIGHTS';
   if(inside&&alignment<38&&vertical<90&&speed<=115) guide=vertical>38?'DESCEND GENTLY — KEEP THE GREEN LIGHTS BETWEEN YOUR WINGS':'TOUCHDOWN ZONE — KEEP NOSE ALIGNED WITH RUNWAY';
   else if(alignment<38&&speed>115) guide='SLOW DOWN BELOW 115 m/s (~414 km/h)';
   landHint.innerHTML=`🟢 <b>${esc(nearestRunway.name)}</b> · ${Math.round(nearestRunwayDist)}m<br>${guide} · ${speedKmh} km/h · ALT ${Math.round(vertical)}m`;
  }else if(!landed)landHint.style.display='none';
  if(alive&&!landed){
   for(const s of landingStrips){
    const runwayDir=new T.Vector3(0,0,-1).applyAxisAngle(new T.Vector3(0,1,0),s.heading).normalize();
    const dvec=new T.Vector3(plane.position.x-s.x,0,plane.position.z-s.z);
    const along=dvec.dot(runwayDir),lateral=Math.abs(dvec.x*runwayDir.z-dvec.z*runwayDir.x);
    const flatFw=new T.Vector3(fw.x,0,fw.z);if(flatFw.lengthSq()<1e-6)flatFw.set(runwayDir.x,0,runwayDir.z);else flatFw.normalize();
    const alignment=Math.acos(Math.max(-1,Math.min(1,Math.abs(flatFw.dot(new T.Vector3(runwayDir.x,0,runwayDir.z))))))*180/Math.PI;
    const above=plane.position.y-s.surfaceY;
    const descending=fw.y<-0.015 || plane.position.y<prevY-.2;
    const crossedTouchdown = prevY>s.surfaceY+8 && plane.position.y<=s.surfaceY+32 && descending;
    const inside=Math.abs(along)<s.length*.56&&lateral<s.width*.82;
    const safeSpeed=speed<115;
    if(inside&&above>-1&&above<90&&alignment<38&&safeSpeed&&descending&&crossedTouchdown){
      landed=true;landingStrip=s;plane.position.y=s.surfaceY+9;plane.quaternion.setFromAxisAngle(new T.Vector3(0,1,0),s.heading);speed=26;throttle=.08;landHint.style.display='block';landHint.innerHTML=`🛬 <b>LANDED SAFELY</b> · ${esc(s.name)} · 🟢 runway lights`;toast('🛬 Landed at '+s.name);break;
    }
   }
  }
  if(landed){if(keys.KeyW||mobileInput.throttle||speed>56){landed=false;landingStrip=null;toast('Takeoff run')}else{plane.position.y=landingStrip.surfaceY+8;speed=Math.max(18,speed);throttle=Math.min(throttle,.18)}}
  if(alive&&!killReplayActive&&!landed&&performance.now()>spawnGrace){
   const gyNow=Math.max(height(plane.position.x,plane.position.z),0);
   const groundHit=plane.position.y<gyNow+3;
   const obstacle=solidHit(plane.position.x,plane.position.z,plane.position.y,prevX,prevZ,prevY);
   if(groundHit||obstacle){
    const cp=plane.position.clone();const gy=Math.max(height(cp.x,cp.z),0);cp.y=Math.max(cp.y,gy+3);
    if(roomMode==='ffa'){prepareKillReplay();explode(cp,true);createCrashFire(cp,4300);beginDeathCam(cp);alive=false;plane.visible=false;toast(obstacle?'💥 Building impact!':'💥 Crash! Fire remains for a few seconds.')}
    else if(roomMode==='practice'){explode(cp,true);createCrashFire(cp,2800);alive=false;plane.visible=false;practiceRespawnAt=performance.now()+1800;toast(obstacle?'💥 Training crash — respawning':'💥 Training crash — respawning')}
    else{explode(cp,true);alive=false;toast(obstacle?'💥 Building impact!':'💥 Crashed! Fire remains for a few seconds.')}
    if(!practiceMode&&ws&&ws.readyState===1)ws.send(JSON.stringify({t:'crash'}))
   }
  }
  if(practiceMode&&!alive&&practiceRespawnAt&&performance.now()>=practiceRespawnAt){alive=true;practiceRespawnAt=0;hp=maxhp;shieldUntil=0;clearTransientEffects();reset();toast('Back in the air!')}
  if(!killReplayActive){updatePracticeBots(performance.now(),dt);}
  // Lock-on is limited by range, line-of-sight and cloud cover.
  let tgt=null;
  const lockNow=performance.now();
  if(!killReplayActive&&lockId&&remotes[lockId]){const r=remotes[lockId],v=r.mesh.position.clone().sub(plane.position),dist=v.length(),blocked=cloudBlocksSight(plane.position,r.mesh.position);if(dist<=LOCK_RANGE&&fw.angleTo(v)<(lockT>=3?.62:.22)&&!bad(lockId)&&!blocked)tgt=lockId;else breakLock(blocked?'LOCK LOST • CLOUD COVER':'LOCK LOST • OUT OF RANGE')}
  if(!killReplayActive&&tgt===null){let bestA=.22;for(const id in remotes){const r=remotes[id];if(!r||bad(id))continue;const v=r.mesh.position.clone().sub(plane.position),dist=v.length(),a=fw.angleTo(v);if(dist<=LOCK_RANGE&&a<bestA&&!cloudBlocksSight(plane.position,r.mesh.position)){bestA=a;lockId=id}}}
  if(!alive||killReplayActive){lockId=null;lockT=0;lastLockSync=0}
  if(lockId)lockT+=dt;
  const now=lockNow;
  if(lockId&&!over&&now-lastBeep>(lockT>=3?160:450)){lastBeep=now;tone(lockT>=3?1200:700,.07,'square',.05)}
  if(!killReplayActive&&inGame&&!spectatorMode&&now-lastLockSync>300){lastLockSync=now;if(!practiceMode&&ws&&ws.readyState===1)ws.send(JSON.stringify({t:'lock',id:alive&&lockId?Number(lockId):null}))}
  const wa=Object.values(warns).filter(w=>w.until>now);warnEl.textContent=wa.length?'⚠ locked by '+wa.map(w=>w.n).join(', '):'';if(wa.length)warnEl.style.color=wa[0].c||'#ff4040';
  if(!killReplayActive&&!over&&alive&&(keys.Space||mobileInput.fire)&&now-lastShot>120&&(practiceMode||(ws&&ws.readyState===1))){lastShot=now;gunSound();
   const o=fw.clone().multiplyScalar(28).add(plane.position),d=fw.clone().multiplyScalar(700).addScaledVector(fw,0);
   const dir=fw.clone().multiplyScalar(speed*1.6+600);
   const bb=spawnBullet(o.toArray(),dir.toArray(),true);if(lockT>=3&&lockId)bb.tid=lockId;if(!practiceMode)ws.send(JSON.stringify({t:'shoot',p:o.toArray(),d:dir.toArray()}))}
  if(!killReplayActive&&!over&&alive&&(keys.KeyF||mobileInput.missile)&&now-lastMissile>5000&&(practiceMode||(ws&&ws.readyState===1))){
   if(lockT>=3&&lockId){lastMissile=now;const o=fw.clone().multiplyScalar(30).add(plane.position),sp=Math.max(330,speed*1.6+80),dir=fw.clone().multiplyScalar(sp);
    spawnMissile(o.toArray(),dir.toArray(),lockId,true,myId);if(!practiceMode)ws.send(JSON.stringify({t:'mfire',p:o.toArray(),d:dir.toArray(),tid:+lockId}));missileLaunchSound();toast('Missile away!')}
   else if(now-lastNoLock>800){lastNoLock=now;toast('Need a full lock first (hold target 3s)')}}
  const mcd=Math.max(0,5-(now-lastMissile)/1000);
  plane.userData.prop.rotation.z+=dt*(10+throttle*60);if(killCamActive&&performance.now()>=killCamUntil)killCamActive=false;if(!alive){if(spectatorMode||roomMode==='clash'||roomMode==='survivor'){specFollow()}else if(deathCamActive&&performance.now()<deathCamUntil){plane.position.copy(deathCamPos);plane.position.y=Math.max(plane.position.y,Math.max(height(plane.position.x,plane.position.z),0)+8)}else{const gy=Math.max(height(plane.position.x,plane.position.z),0);plane.position.y=Math.max(plane.position.y,gy+8)}landHint.style.display='none'}plane.visible=alive&&camMode!==1&&(!(protEnd>now)||(Math.floor(now/110)%2===0));
  updateTerrain(plane.position.x,plane.position.z);water.position.set(plane.position.x,0,plane.position.z);
  const wp=water.geometry.attributes.position,wt=performance.now()*.00045;if(wp){for(let i=0;i<wp.count;i++){const wx=wp.getX(i),wz=wp.getZ(i);wp.setY(i,Math.sin(wx*.0017+wt*2.0)*1.3+Math.cos(wz*.0013-wt*1.5)*.9)}wp.needsUpdate=true}
  for(const c of clouds){const u=c.userData;u.x+=u.drift*dt*10;const w=(v,p)=>p+(((v-p+R/2)%R)+R)%R-R/2;c.position.set(w(u.x,plane.position.x),u.y,w(u.z,plane.position.z));c.rotation.y+=dt*.003}
  const back=camMode===0?[0,12,46]:camMode===1?[0,4,-1]:[0,80,120];
  const mobileCameraQ=plane.quaternion.clone();if(mobileTouchEnabled&&inGame){const orbitQ=new T.Quaternion().setFromEuler(new T.Euler(mobileCameraPitch,mobileCameraYaw,0,'YXZ'));mobileCameraQ.multiply(orbitQ)}
  if(!alive&&killCamActive&&performance.now()<killCamUntil&&remotes[killCamAttackerId]){
   const kr=remotes[killCamAttackerId];camPos.set(58,28,86).applyQuaternion(kr.mesh.quaternion).add(kr.mesh.position);cam.position.lerp(camPos,Math.min(1,dt*4.5));look.copy(deathCamPos);cam.up.set(0,1,0);
  }else if(!alive&&roomMode==='ffa'&&deathCamActive&&performance.now()<deathCamUntil){
   camPos.set(52,44,72).add(deathCamPos);cam.position.lerp(camPos,Math.min(1,dt*5));look.copy(deathCamLook);cam.up.set(0,1,0);
  }else if((keys.KeyX||mobileInput.rear)&&alive){
   // Rear view: place the camera just ahead of the aircraft and look backwards,
   // so the aircraft itself does not block the view behind it.
   camPos.set(0,7,-16).applyQuaternion(plane.quaternion).add(plane.position);
   cam.position.lerp(camPos,Math.min(1,dt*8));
   look.set(0,4,85).applyQuaternion(plane.quaternion).add(plane.position);
   cam.up.set(0,1,0);
  }else{
   camPos.set(...back).applyQuaternion(mobileCameraQ).add(plane.position);
   if(camMode===1)cam.position.copy(camPos);else cam.position.lerp(camPos,Math.min(1,dt*6));
   look.set(0,0,-60).applyQuaternion(mobileCameraQ).add(plane.position);
   cam.up.set(0,1,0);if(camMode!==2)cam.up.applyQuaternion(plane.quaternion);
  }
  if(shake>.01){cam.position.add(new T.Vector3((Math.random()-.5)*shake*8,(Math.random()-.5)*shake*8,(Math.random()-.5)*shake*8));shake*=Math.pow(.03,dt)}
  cam.lookAt(look);
  cam.updateMatrixWorld();if(!killReplayActive)recordKillReplayFrame(performance.now());scene.fog.near=graphicsFogNear;scene.fog.far=graphicsFogFar;const le=document.getElementById('lock');
  if(lockId&&remotes[lockId]){const v=remotes[lockId].mesh.position.clone().project(cam);
   if(v.z<1){const ok=lockT>=3;le.style.display='block';le.style.left=((v.x*.5+.5)*innerWidth)+'px';le.style.top=((-v.y*.5+.5)*innerHeight)+'px';
    const lp=snapPlayers[lockId]||{};le.style.color=lp.c||'#ffd400';le.style.borderStyle=ok?'double':'solid';le.style.borderWidth=ok?'6px':'2px';le.dataset.t=(lp.n||'?')+(ok?' - LOCKED [F] missile':' - locking '+Math.max(0,3-lockT).toFixed(1)+'s')}else le.style.display='none'}else le.style.display='none';
  hud.innerHTML=`${roomMode==='clash'?`<span style="color:#79d8ff">🛡 SHIELDS ${shields}</span><br>`:''}<span style="opacity:.8">FLARES ${flares}</span><br>${roomMode==='survivor'?`<span style="color:${myColor}">♥ LIVES ${snapPlayers[myId]?.lives??1}</span><br>`:''}${landed?'<span style="color:#7dffb2">🛬 LANDED '+esc(landingStrip.name)+'</span><br>':''}HP ${'█'.repeat(Math.ceil(hp/maxhp*10))}${hp}<br>SPEED ${Math.round(speed*3.6)} km/h<br>ALT ${Math.round(plane.position.y)} m<br>THROTTLE ${Math.round(throttle*100)}%<br>BOOST ${'█'.repeat(Math.ceil(boost/10))} ${Math.round(boost)}<br>MISSILE ${mcd>0?mcd.toFixed(1)+'s':'READY'}${protEnd>now?'<br>PROTECTED '+((protEnd-now)/1000).toFixed(1)+'s':''}${alive?'':`<br>${spectatorMode?'SPECTATING MODE':'YOU ARE OUT — '+(roomMode==='clash'?'SPECTATING':'RESPAWNING')}`}`;updateShieldVisual();updateSpectatorHud();shieldHud.innerHTML=roomMode==='clash'?`🛡 SHIELDS ${'◈'.repeat(shields)}${shieldUntil>now?`<br><span style="color:#7de0ff">ACTIVE ${(Math.max(0,shieldUntil-now)/1000).toFixed(1)}s</span>`:`<br><span style="opacity:.7">Q = 7s shield</span>`}`:'';
const mw=document.getElementById('missileWarning');if(mw){mw.style.display=(missileWarningUntil>now)?'block':'none';if(missileWarningUntil>now)mw.textContent='⚠ MISSILE INBOUND';}
  drawRadar(performance.now());
  if(AC)engOsc.frequency.value=55+speed*.9;
  if(plane&&plane.userData.glow){const blink=.55+.45*Math.sin(now*.006);plane.userData.glow.left.material.opacity=.35+.45*blink;plane.userData.glow.right.material.opacity=.35+.45*blink;if(plane.userData.engGlow){const pulse=.72+.28*Math.sin(now*.012+speed*.01);plane.userData.engGlow[0].scale.y=.65+pulse*.7;plane.userData.engGlow[1].scale.y=.65+pulse*.7;plane.userData.engGlow[0].material.opacity=.28+pulse*.42;plane.userData.engGlow[1].material.opacity=.28+pulse*.42}}
  sky.position.copy(cam.position);skyDust.position.copy(cam.position);skyDust.rotation.y+=dt*.0007;water.material.opacity=.69+.03*Math.sin(now*.0007);
  smokeT-=dt;if(smokeT<=0){smokeT=.06;if(alive&&!spectatorMode)emitSmoke(plane,hp/maxhp*100);for(const id in remotes)if(remotes[id].alive!==false)emitSmoke(remotes[id].mesh,remotes[id].hp/(remotes[id].mh||100)*100)}
  scoreEl.innerHTML=roomMode==='practice'?'<b>PRACTICE ARENA</b><br>DIFFICULTY: '+practiceDifficulty.toUpperCase()+'<br>DRONES DESTROYED: '+practiceKills+'<br><small>6 AI target flights · armed bots · Esc to exit</small>':roomMode==='ffa'?'<b>FIRST TO 10 KILLS</b><br>'+Object.values(snapPlayers).sort((a,b)=>(b.sc||0)-(a.sc||0)).map(p=>`<span style="color:${p.c}">&#9632;</span> ${esc(p.n)}: ${p.sc||0}`).join('<br>'):roomMode==='survivor'?'<b>SURVIVOR</b><br>'+Object.values(snapPlayers).sort((a,b)=>(b.lives||0)-(a.lives||0)).map(p=>`<span style="color:${p.c}">&#9632;</span> ${esc(p.n)}: ${p.lives||0} ${p.alive?'':'✕'}`).join('<br>'):`<span style="font-size:22px">${TIDS.slice(0,teamCount).map(t=>`<b style="color:${TC[t]}">${TN[t].toUpperCase()} ${score[t]||0}</b>`).join(' &nbsp;·&nbsp; ')}</span><br>Round ${roundNo} - first to 6<br>`+Object.values(snapPlayers).sort((a,b)=>(TIDS.indexOf(a.team)-TIDS.indexOf(b.team))||a.n.localeCompare(b.n)).map(p=>`<span style="color:${p.c}">&#9632;</span> ${esc(p.n)}${p.alive?'':' &#10006;'}`).join('<br>');
 }
 for(const id in remotes){const r=remotes[id];if(!r.p)continue;r.mesh.position.lerp(new T.Vector3().fromArray(r.p),.3);r.mesh.quaternion.slerp(new T.Quaternion().fromArray(r.q),.3);r.mesh.userData.prop.rotation.z+=dt*40;const nw=performance.now();r.mesh.visible=r.alive!==false&&r.roundHiddenUntil<=nw&&(!(r.protEnd>nw)||(Math.floor(nw/110)%2===0));if(r.mesh.userData.shield){r.mesh.userData.shield.visible=roomMode==='clash'&&r.alive!==false&&r.shieldUntil>nw;r.mesh.userData.shield.scale.setScalar(.95+.08*Math.sin(nw*.02))}}
 if(killReplayActive){advanceKillReplay(performance.now());sky.position.copy(cam.position);skyDust.position.copy(cam.position);if(!killReplayAttackerId)water.position.set(plane.position.x,0,plane.position.z)}
 for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];
  if(b.tid&&remotes[b.tid]){const sp=b.d.length(),want=remotes[b.tid].mesh.position.clone().sub(b.m.position).normalize();b.d.normalize().lerp(want,Math.min(1,dt*4)).normalize();b.m.quaternion.setFromUnitVectors(MZ,b.d);b.d.multiplyScalar(sp)}
  b.m.position.addScaledVector(b.d,dt);b.life-=dt;let dead=b.life<=0;
  if(b.mine&&!dead&&alive&&!killReplayActive){for(const id in remotes)if(remotes[id].team!==myTeam&&remotes[id].alive!==false&&b.m.position.distanceTo(remotes[id].mesh.position)<30){if(practiceMode)practiceBotHit(id,25);else if(ws&&ws.readyState===1)ws.send(JSON.stringify({t:'hit',id:+id}));dead=true;break}}
  if(!b.mine&&!dead&&practiceMode&&b.practiceBot&&alive&&!killReplayActive&&performance.now()>spawnGrace&&b.m.position.distanceTo(plane.position)<30){practicePlayerHit(b.damage||7,b.from||'practice-1');dead=true}
  if(dead){scene.remove(b.m);bullets.splice(i,1)}}

 if(over){const c=document.getElementById('wcount');if(c)c.textContent='New match in '+Math.max(0,Math.ceil((winEnd-performance.now())/1000))+'s'}
 for(let i=missiles.length-1;i>=0;i--){const ms=missiles[i];ms.life-=dt;let boom=ms.life<=0;let targetPos=null;let tg=tgtObj(ms.tid);
  if(ms.flareTarget&&ms.flareTarget.g){targetPos=ms.flareTarget.g.position.clone()}else if(tg&&tg.visible){targetPos=tg.position.clone()}
  if(targetPos&&!boom){const dist=targetPos.distanceTo(ms.m.position),blocked=cloudBlocksSight(ms.m.position,targetPos),seekerOk=dist<=MISSILE_SEEKER_RANGE;
   const wantVec=targetPos.clone().sub(ms.m.position);const seekerAngle=wantVec.lengthSq()>1?ms.dir.angleTo(wantVec.normalize()):0;
   if(ms.homing!==false&&seekerOk&&!blocked&&seekerAngle<=MISSILE_SEEKER_CONE){ms.lostAt=0;const want=targetPos.clone().sub(ms.m.position);if(want.lengthSq()>1)want.normalize();const maxTurn=(ms.turnRate||2.2)*dt;const ang=ms.dir.angleTo(want);if(ang>1e-4)ms.dir.lerp(want,Math.min(1,maxTurn/ang)).normalize();}
   else if(ms.homing!==false){ms.lostAt=(ms.lostAt||0)+dt;if(ms.lostAt>MISSILE_BREAK_TIME)ms.homing=false}
   if(!practiceMode&&String(ms.tid)===String(myId)&&flareSites.length){for(const f of flareSites){if(f.owner===String(myId))continue;const fd=f.g.position.distanceTo(ms.m.position);if(fd<620&&Math.random()<dt*.85){ms.flareTarget=f;ms.homing=true;ms.lostAt=0;break}}}
   if(dist<MISSILE_PROXIMITY){boom=true;if(practiceMode&&ms.mine&&tg)practiceBotHit(ms.tid,50);else if(practiceMode&&!ms.mine&&ms.tid===String(myId))practicePlayerHit(ms.damage||34,ms.by||'practice-1');else if(!killReplayActive&&!ms.mine&&ms.tid===String(myId)&&ws&&ws.readyState===1)ws.send(JSON.stringify({t:'mhit',by:ms.by}))}}
  ms.m.position.addScaledVector(ms.dir,ms.sp*dt);ms.m.quaternion.setFromUnitVectors(MZ,ms.dir);
  puff(ms.m.position.clone().addScaledVector(ms.dir,-7),0xffb050,2.8,.12,new T.Vector3(),.95,{add:true,grow:.5});
  puff(ms.m.position.clone().addScaledVector(ms.dir,-10),0xdddddd,3.5,2.2,new T.Vector3(0,2,0),.5,{grow:3.5});
  const mgy=Math.max(height(ms.m.position.x,ms.m.position.z),0)+3;if(ms.m.position.y<mgy){ms.m.position.y=mgy;boom=true}
  if(String(ms.tid)===String(myId)){missileWarningUntil=Math.max(missileWarningUntil,performance.now()+500)}
  if(boom){const ep=ms.m.position.clone();ep.y=Math.max(ep.y,Math.max(height(ep.x,ep.z),0)+3);explode(ep,false);scene.remove(ms.m);missiles.splice(i,1)}}
 if(!missiles.length)missileFlySound(false);
 for(let i=flareSites.length-1;i>=0;i--){const f=flareSites[i];f.life-=dt;f.g.position.addScaledVector(f.vel,dt);const s=.75+.25*Math.sin(performance.now()*.03+i);f.g.scale.setScalar(s);if(f.life<=0){scene.remove(f.g);flareSites.splice(i,1)}}
 for(let i=crashSites.length-1;i>=0;i--){const f=crashSites[i];f.life-=dt;if(f.life<=0){scene.remove(f.g);if(f.fireAudio){f.fireAudio.pause();f.fireAudio.currentTime=0}crashSites.splice(i,1);continue}const k=f.life/f.max,pulse=.85+.25*Math.sin(performance.now()*.018+i);f.rings.forEach((m,j)=>{m.rotation.y+=dt*(1.5+j*.4);m.scale.y=(.72+.35*pulse)*(0.55+.45*k);m.material.opacity=.18+.7*k});f.smoke.position.y=35+(1-k)*30;f.smoke.scale.setScalar(1+(1-k)*2.2);f.smoke.material.opacity=.08+.3*k;if(f.life<f.max&&performance.now()>f.nextAudio){noise(.12,.035,1700);f.nextAudio=performance.now()+160+Math.random()*420}}
 for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.life-=dt;if(p.life<=0){scene.remove(p.m);p.m.material.dispose();parts.splice(i,1);continue}
  p.vel.y-=p.grav*dt;p.m.position.addScaledVector(p.vel,dt);const gy=Math.max(height(p.m.position.x,p.m.position.z),0)+1;if(p.m.position.y<gy){p.m.position.y=gy;p.vel.y=Math.max(0,p.vel.y);p.grav=0}const k=1-p.life/p.max;p.m.scale.setScalar(p.size*(1+k*p.grow));p.m.material.opacity=p.op*(1-k)}
 const bp=.65+.35*Math.sin(performance.now()*.008);for(const l of runwayLights){if(l.material&&l.material.opacity!==undefined)l.material.opacity=.55+.45*bp;l.rotation.y+=dt*.5}
 ren.render(scene,cam)}
loop();
addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();const cap=graphicsPreset==='low'?(TOUCH_DEVICE ? .82 : 1):graphicsPreset==='medium'?(TOUCH_DEVICE?1.05:1.35):(TOUCH_DEVICE?1.3:1.75);ren.setPixelRatio(Math.min(devicePixelRatio,cap));ren.setSize(innerWidth,innerHeight)});
addEventListener('resize',()=>{if(mobileTouchEnabled){applyMobileHudLayout(true);updateLandscapeGate()}});