// Bathroom drawer preview items: realistic, display-only stand-ins for what each bathroom cell holds (electric and
// manual toothbrushes shaped per model, toothpaste tubes, an upright cotton swab bundle, cotton rounds, floss,
// combs, hair ties, nail tools, lip balm, deodorant, a contact lens case and razors). No brand names or logos.
// layout(r) turns the drawer result's placement data (r.props) into item placements (pure data, testable in Node);
// build(r,THREE,renderer) draws them with one InstancedMesh per shape and material. Nothing here is ever exported:
// the items are not drawer parts, so they never reach the STL / 3MF files, the plate packer or the estimates.
(function(G){'use strict';
const I=G.GPInserts||(typeof require==='function'?require('./organizer-inserts'):null);
const BATH=new Set(['swabs','swabTray','pads','toothbrush','toothpaste','toothpasteTravel','floss','flossPicks','comb','hairties','clippers','balm','deodorant','lens','razor']);
// Tube and accent colors vary per instance so a drawer looks lived in.
const TUBE=['#2f7fd8','#d64545','#2fa37a','#7a5cc7'],COMB=['#202226','#6b3e26','#2b2f36'],TIES=['#1b1b1d','#5a3b2a','#c97b98','#2f3a55','#1b1b1d','#3a3a3e'],BALM=['#e66f9c','#f0b33c','#6fbf73','#7aa7e0'];
// Electric toothbrush looks by model (generic, no logos): handle, accent, button and brush-head style.
const LOOK={io:{body:'#24262b',accent:'#c9a48c',button:'#f2f2f2',head:'round',ring:true},geniusx:{body:'#2a2c31',accent:'#9aa4b1',button:'#e9edf2',head:'round'},pro:{body:'#f4f6f8',accent:'#2d6fd2',button:'#2d6fd2',head:'round'},
 vitality:{body:'#f4f6f8',accent:'#57a6e6',button:'#3b82d6',head:'round'},sonicare4100:{body:'#f5f7f7',accent:'#7fc8c0',button:'#e3eceb',head:'oval',bar:true},protectiveclean:{body:'#f5f6f8',accent:'#9fb3c8',button:'#d7dee6',head:'oval',bar:true},
 diamondclean:{body:'#e9c7bd',accent:'#d9b2a6',button:'#f5e9e4',head:'oval',bar:true},quip:{body:'#c9ccd1',accent:'#a3a8af',button:'#a3a8af',head:'slim',metal:true},manual:{body:'#3c8fd9',accent:'#f2f4f6',button:'#f2f4f6',head:'manual',manual:true}};
const rnd=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
/* layout(r): [{type, x, y, z, rot, w, d, h, model, n, color, seed, cell}] in the drawer preview's coordinates
 * (x, y center on the drawer, z up from the drawer bottom; rot about z, item length along +x before rot). */
function layout(r){
 const out=[],list=r&&r.props||[];
 for(const pr of list){if(!BATH.has(pr.id))continue;const at=(pl,rot,extra)=>Object.assign({x:pr.ox+pl.x,y:pr.oy+pl.y,z:pr.oz+(pl.z||0),rot,cell:pr.cell,item:pr.id},extra);
  const along=pl=>pl.w>=pl.d?0:Math.PI/2,len=pl=>Math.max(pl.w,pl.d),wid=pl=>Math.min(pl.w,pl.d),places=pr.places||[];
  if(pr.id==='toothbrush'&&pr.ghost&&I){const g=pr.ghost,B=I.BRUSHES[g.model];for(const off of g.offs){const pl=g.long?{x:g.x0+B.length/2,y:(pr.innerD||0)/2+off,z:g.z0}:{x:(pr.innerW||0)/2+off,y:g.x0+B.length/2,z:g.z0};out.push(at(pl,g.long?0:Math.PI/2,{type:'brush',model:B.id,w:B.length,d:B.width,h:B.thick}));}continue;}
  places.forEach((pl,k)=>{const seed=1000*(pr.cell+1)+k;
   switch(pr.id){
    case 'swabs':out.push(at(pl,0,{type:'swabBundle',w:pl.w,d:pl.d,h:76,round:!!pl.round,seed}));break;
    case 'swabTray':out.push(at(pl,along(pl),{type:'swabsFlat',w:len(pl),d:wid(pl),seed}));break;
    case 'pads':out.push(at(pl,0,{type:'cottonRounds',w:Math.min(57,pl.w-2),h:Math.min(34,(pl.h||40)-4),seed}));break;
    case 'toothpaste':case 'toothpasteTravel':{const L=len(pl),full=pr.id==='toothpaste';if(full&&k%2===1&&L>=200&&wid(pl)>=22){out.push(at(pl,along(pl)+Math.PI,{type:'brush',model:'manual',manual:true,w:190,d:20,h:20}));break;}out.push(at(pl,along(pl)+(k%2?Math.PI:0),{type:'tube',w:Math.min(L-8,full?186:112),d:Math.min(wid(pl)-3,full?48:28),color:TUBE[(k+(full?0:2))%TUBE.length],seed}));break;}
    case 'floss':out.push(at(pl,along(pl),{type:'floss',w:Math.min(46,len(pl)),d:Math.min(16,wid(pl)),h:44,seed}));break;
    case 'flossPicks':out.push(at(pl,along(pl),{type:'flossPicks',w:len(pl),d:wid(pl),seed}));break;
    case 'comb':{const L=len(pl);if(k%2===1&&L>=200)out.push(at(pl,along(pl)+Math.PI,{type:'brush',model:'manual',manual:true,w:190,d:20,h:20}));else out.push(at(pl,along(pl),{type:'comb',w:Math.min(L-10,180),d:Math.min(wid(pl)-4,30),color:COMB[k%COMB.length],seed}));break;}
    case 'hairties':out.push(at(pl,0,{type:'hairties',w:Math.min(pl.w,pl.d),seed}));break;
    case 'clippers':{const kind=['clippers','tweezers','nailFile'][k%3];out.push(at(pl,along(pl),{type:kind,w:len(pl),d:wid(pl),seed}));break;}
    case 'balm':out.push(at(pl,0,{type:'balm',w:Math.min(15.4,pl.w-.6),h:68,color:BALM[k%BALM.length],seed}));break;
    case 'deodorant':out.push(at(pl,along(pl),{type:'deodorant',w:Math.min(118,len(pl)-4),d:Math.min(44,wid(pl)-2),seed}));break;
    case 'lens':out.push(at(pl,along(pl),{type:'lensCase',w:Math.min(52,len(pl)),d:Math.min(23,wid(pl)),seed}));break;
    case 'razor':out.push(at(pl,along(pl)+(k%2?Math.PI:0),{type:'razor',w:Math.min(len(pl)-2,118),d:Math.min(wid(pl),24),color:k%2?'#3f6f8f':'#4c5560',seed}));break;
   }});
 }
 const DP=G.GPDrawerProps||(typeof require==='function'?(()=>{try{return require('./drawer-props');}catch(_){return null;}})():null);
 if(DP)for(const it of DP.layout(r))out.push(it);
 return out;
}
const api={layout,BATH,LOOK};
/* ---------------- browser rendering (THREE) ---------------- */
let MATS=null,ENV=null;const GEO=new Map();
function mats(THREE,renderer){if(MATS)return MATS;
 if(!ENV&&THREE.RoomEnvironment&&renderer){const pm=new THREE.PMREMGenerator(renderer),room=new THREE.RoomEnvironment();ENV=pm.fromScene(room,.04).texture;pm.dispose();room.dispose&&room.dispose();}
 const P=THREE.MeshPhysicalMaterial||THREE.MeshStandardMaterial,M=(o)=>new P(Object.assign({envMap:ENV,envMapIntensity:.38,roughness:.5,metalness:0},o));
 MATS={
  plastic:M({color:'#ffffff',roughness:.32,clearcoat:.5,clearcoatRoughness:.25}),        // instance-colored glossy plastic
  satin:M({color:'#ffffff',roughness:.55,clearcoat:.15}),                                  // instance-colored satin plastic
  rubber:M({color:'#ffffff',roughness:.88,envMapIntensity:.25}),                           // soft-touch grips, hair ties
  chrome:M({color:'#dfe3e8',metalness:1,roughness:.16,envMapIntensity:1.2}),
  steel:M({color:'#b8bec6',metalness:.95,roughness:.34,envMapIntensity:1}),
  darkMetal:M({color:'#3a3632',metalness:.8,roughness:.4,envMapIntensity:.8}),
  bristle:M({color:'#ffffff',roughness:.62,sheen:.4}),
  cotton:M({color:'#fdfdfb',roughness:1,envMapIntensity:.2,sheen:1,sheenRoughness:.9,sheenColor:new THREE.Color('#ffffff')}),
  stick:M({color:'#f7f7f4',roughness:.55,envMapIntensity:.3}),
  clear:M({color:'#ffffff',roughness:.08,transparent:true,opacity:.62,clearcoat:1,depthWrite:false}),
  floss:M({color:'#ffffff',roughness:.7,envMapIntensity:.2}),
  emery:M({color:'#e8b7a8',roughness:.95,envMapIntensity:.15}),
  light:M({color:'#ffffff',roughness:.3,emissive:new THREE.Color('#ffffff'),emissiveIntensity:.35}),
  wood:M({color:'#ffffff',roughness:.72,envMapIntensity:.25}),                              // instance-colored raw wood
  wax:M({color:'#ffffff',roughness:.42,clearcoat:.12,clearcoatRoughness:.5,sheen:.25}),     // crayon and lipstick wax
  paper:M({color:'#ffffff',roughness:.86,envMapIntensity:.18}),                             // wrappers, labels, boxes
  gold:M({color:'#e2bd6b',metalness:1,roughness:.24,envMapIntensity:1.15}),
  glass:M({color:'#ffffff',roughness:.04,transparent:true,opacity:.32,clearcoat:1,depthWrite:false,envMapIntensity:1.1}),
  gem:M({color:'#ffffff',roughness:.08,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:1.2}),       // liquids, beads, gems
  screen:M({color:'#0b0d11',roughness:.06,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:.9}),
  steelD:M({color:'#9ea6af',metalness:1,roughness:.24,envMapIntensity:1,side:THREE.DoubleSide}),
  flat:M({color:'#8a929b',metalness:1,roughness:.42,envMapIntensity:.4})                 // brushed flatware and blades
 };for(const m of Object.values(MATS))m.userData.preview=true;return MATS;}
// Loft along +x through elliptical (superellipse) rings: rows of [x, halfWidth, halfHeight, centerZ].
function loft(THREE,rows,seg=28,ex=2){const pos=[],idx=[];const sp=(t,p)=>Math.sign(t)*Math.pow(Math.abs(t),2/p);
 for(const [x,a,b,zc]of rows)for(let j=0;j<seg;j++){const t=2*Math.PI*j/seg;pos.push(x,a*sp(Math.cos(t),ex),zc+b*sp(Math.sin(t),ex));}
 const n=rows.length;for(let i=0;i<n-1;i++)for(let j=0;j<seg;j++){const a=i*seg+j,b=i*seg+(j+1)%seg,c=(i+1)*seg+(j+1)%seg,d=(i+1)*seg+j;idx.push(a,b,c,a,c,d);}
 const c0=pos.length/3;pos.push(rows[0][0],0,rows[0][3]);const c1=pos.length/3;pos.push(rows[n-1][0],0,rows[n-1][3]);
 for(let j=0;j<seg;j++){idx.push(c0,(j+1)%seg,j);idx.push(c1,(n-1)*seg+j,(n-1)*seg+(j+1)%seg);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;}
// Rounded rectangle (or stadium) outline in xy, extruded up z with a soft bevel.
function slab(THREE,w,d,h,r,bevel){const s=new THREE.Shape(),x=w/2,y=d/2;r=Math.min(r,x-.01,y-.01);s.moveTo(-x+r,-y);s.lineTo(x-r,-y);s.quadraticCurveTo(x,-y,x,-y+r);s.lineTo(x,y-r);s.quadraticCurveTo(x,y,x-r,y);s.lineTo(-x+r,y);s.quadraticCurveTo(-x,y,-x,y-r);s.lineTo(-x,-y+r);s.quadraticCurveTo(-x,-y,-x+r,-y);
 const b=Math.min(bevel??Math.min(h*.3,1.2),h/2-.01,r||1);const g=new THREE.ExtrudeGeometry(s,{depth:Math.max(.01,h-2*b),bevelEnabled:b>0,bevelThickness:b,bevelSize:b*.9,bevelSegments:3,curveSegments:10});g.translate(0,0,b);g.computeVertexNormals();return g;}
const geo=(key,make)=>{if(!GEO.has(key))GEO.set(key,make());return GEO.get(key);};
const k1=v=>(+v).toFixed(1);
/* Recipes: item -> parts [{g: geometry key, make, mat, m: local matrix (THREE.Matrix4), color}]. Local frame: item
 * centered on x/y, resting on z=0, length along +x. */
function recipes(THREE){const V=(x,y,z)=>new THREE.Vector3(x,y,z),Q=new THREE.Quaternion(),E=new THREE.Euler();
 const mtx=(x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=sx,sz=sx)=>new THREE.Matrix4().compose(V(x,y,z),Q.clone().setFromEuler(E.set(rx,ry,rz)),V(sx,sy,sz));
 const cyl=(r,h,s=20)=>geo(`cyl${s}`,()=>{const g=new THREE.CylinderGeometry(1,1,1,s,1);g.rotateX(Math.PI/2);g.translate(0,0,.5);return g;}),sphere=()=>geo('sph',()=>new THREE.SphereGeometry(1,20,14)),box=()=>geo('box',()=>new THREE.BoxGeometry(1,1,1)),torus=()=>geo('torus',()=>new THREE.TorusGeometry(1,.17,10,36));
 const C=(r,h,s)=>({g:`cyl${s||20}`,make:()=>cyl(r,h,s)}); // unit cylinder along z, base at z=0 (scale r,r,h)
 return {
  // Electric (or manual) toothbrush lying on its back, bristles up; shape from the cradle's own outline data.
  brush(it,out){const B=I.BRUSHES.find(b=>b.id===it.model)||I.BRUSHES[0],L=LOOK[B.id]||LOOK.manual,len=B.length,x0=-len/2,th=B.thick,zc=th/2,manual=!!L.manual;
   const half=x=>Math.max(1.2,B.at(x)/2*.96),endR=x=>x<5?Math.sqrt(Math.max(.04,x/5)):1;
   if(manual){const hb=4.6,zc2=hb;const rows=[];for(let x=.0;x<=B.handle;x+=2){const s=endR(Math.max(.1,x)*1.2);rows.push([x0+x,half(x)*s*.92,hb*s,zc2]);}
    const neck=[];for(let x=B.handle;x<=len-B.profile.at(-1)[0]+len-.1&&x<=len;x+=2.5){const hs=len-30;const hh=x<hs?2.4:3.2,hw=x<hs?half(x)*.9:half(x)*.95,taper=x>len-4?Math.max(.3,(len-x)/4):1;neck.push([x0+x,hw*taper,hh*taper,zc2-1]);}
    out.push({g:`mb:${B.id}:h`,make:()=>loft(THREE,rows,26,2.2),mat:'plastic',color:it.color||L.body});out.push({g:`mb:${B.id}:n`,make:()=>loft(THREE,neck,22,2.4),mat:'plastic',color:it.color||L.body});
    out.push({g:`mb:${B.id}:grip`,make:()=>{const r2=[];for(let x=12;x<=B.handle*.62;x+=2)r2.push([x0+x,half(x)*.95,hb*1.04,zc2]);return loft(THREE,r2,26,2.2);},mat:'rubber',color:'#f1f4f6'});
    const hx=x0+len-17;for(let i=0;i<6;i++)for(let j=-1;j<=1;j++)out.push({g:'tuft',make:()=>geo('tuft',()=>{const g=new THREE.CylinderGeometry(1,1,1,8);g.rotateX(Math.PI/2);g.translate(0,0,.5);return g;}),mat:'bristle',m:mtx(hx-11+i*4.3,j*3.6,zc2+1.6,0,0,0,1.25,1.25,9+(i%2?0:1)),color:(i===1||i===4)?'#3d8fe0':'#ffffff'});
    return;}
   // Handle: rounded base, body following the cradle outline, then the tapered top.
   const rows=[];const step=3;for(let x=0;x<=B.handle+.01;x+=x<6?1:step){const s=endR(Math.max(.15,x));rows.push([x0+x,half(x)*s,th/2*s*(x>B.handle-14?1-.18*((x-(B.handle-14))/14):1),zc]);}
   out.push({g:`eb:${B.id}:body`,make:()=>loft(THREE,rows,32,L.bar?2.5:2.15),mat:L.metal?'steel':'plastic',color:L.metal?null:L.body});
   // Base ring (charging end) and a front accent strip under the button.
   out.push({g:`eb:${B.id}:base`,make:()=>loft(THREE,[[x0+.4,half(1)*.7,th/2*.7,zc],[x0+1.2,half(2)*1.01,th/2*1.01,zc],[x0+6,half(6)*1.01,th/2*1.01,zc],[x0+6.6,half(6)*.9,th/2*.9,zc]],32,L.bar?2.5:2.15),mat:L.metal?'chrome':'satin',color:L.metal?null:L.accent});
   const bx=x0+B.handle*.62,bt=zc+th/2*.96;
   if(L.bar){out.push({g:'slabBtn',make:()=>geo('slabBtn',()=>slab(THREE,16,9,2.2,4.4,.8)),mat:'satin',m:mtx(bx,0,bt-1),color:L.button});out.push({g:'slabBtn2',make:()=>geo('slabBtn2',()=>slab(THREE,7,7,1.6,3.4,.6)),mat:'satin',m:mtx(bx-19,0,bt-.9),color:L.button});
    out.push({g:'led',make:()=>geo('led',()=>slab(THREE,3,1.2,.6,.5,.2)),mat:'light',m:mtx(bx-30,0,bt-.3),color:'#9ff0d6'});}
   else{out.push({g:'sph',make:sphere,mat:'satin',m:mtx(bx,0,bt-.6,0,0,0,5,5,1.6),color:L.button});out.push({g:'sph',make:sphere,mat:'satin',m:mtx(bx-17,0,bt-.6,0,0,0,3,3,1.1),color:L.button});
    if(L.ring)out.push({g:'torus',make:torus,mat:'light',m:mtx(bx+18,0,bt-.2,0,0,0,4.4,4.4,1.2),color:'#cfe6ff'});}
   // Accent side band, then the brush head attachment: white neck and head with bristle tufts.
   out.push({g:`eb:${B.id}:band`,make:()=>{const r2=[];for(let x=B.handle-10;x<=B.handle+.01;x+=2)r2.push([x0+x,half(x)*1.006,th/2*(1-.18*Math.max(0,(x-(B.handle-14))/14))*1.006,zc]);return loft(THREE,r2,32,L.bar?2.5:2.15);},mat:L.metal?'chrome':'satin',color:L.metal?null:L.accent});
   const headLen=L.head==='round'?18:L.head==='slim'?28:26,hs=len-headLen,nz=zc+(L.head==='round'?1:0);
   const neck=[];const nT=x=>x<B.handle+10?th/2*.42*(1-(x-B.handle)/10)+3.6*((x-B.handle)/10):3.6;for(let x=B.handle;x<=hs+.01;x+=2.5)neck.push([x0+x,Math.max(3.4,half(x)*.92),Math.max(3.2,x<B.handle+10?nT(x)+2:nT(x)),nz]);
   out.push({g:`eb:${B.id}:neck`,make:()=>loft(THREE,neck,24,2.2),mat:L.metal?'steel':'plastic',color:L.metal?null:'#f7f8fa'});
   const hc=x0+hs+headLen/2-1,headZ=nz-2.2;
   if(L.head==='round'){out.push({g:'cyl32',make:()=>cyl(1,1,32),mat:'plastic',m:mtx(hc,0,headZ,0,0,0,8,8,4.4),color:'#f7f8fa'});
    const tufts=[[0,0]];for(let i=0;i<8;i++)tufts.push([Math.cos(i*Math.PI/4)*3.6,Math.sin(i*Math.PI/4)*3.6]);for(let i=0;i<14;i++)tufts.push([Math.cos(i*Math.PI/7)*6.4,Math.sin(i*Math.PI/7)*6.4]);
    tufts.forEach(([u,v],q)=>out.push({g:'tuft',make:()=>geo('tuft',()=>{const g=new THREE.CylinderGeometry(1,1,1,8);g.rotateX(Math.PI/2);g.translate(0,0,.5);return g;}),mat:'bristle',m:mtx(hc+u,v,headZ+4.2,0,0,0,1.05,1.05,q>8?8.2:7.4),color:q>8&&q%3===0?'#5aa9e6':'#ffffff'}));}
   else{const hw=L.head==='slim'?5.5:6.8;out.push({g:`hd:${headLen}:${hw}`,make:()=>geo(`hd:${headLen}:${hw}`,()=>slab(THREE,headLen,2*hw,4.2,hw-.3,1)),mat:'plastic',m:mtx(hc,0,headZ),color:'#f7f8fa'});
    const nx=Math.floor((headLen-4)/3.2),ny=L.head==='slim'?2:3;for(let i=0;i<nx;i++)for(let j=0;j<ny;j++)out.push({g:'tuft',make:()=>geo('tuft',()=>{const g=new THREE.CylinderGeometry(1,1,1,8);g.rotateX(Math.PI/2);g.translate(0,0,.5);return g;}),mat:'bristle',m:mtx(hc-(nx-1)*1.6+i*3.2,(j-(ny-1)/2)*3.6,headZ+4,0,0,0,1.15,1.15,7+((i+j)%2)*1.2),color:(j===0&&ny===3)||i%4===0?'#3fa0d0':'#ffffff'});}
  },
  // Upright bundle of 3 in cotton swabs: white paper sticks, cotton tips, packed inside the cubby.
  swabBundle(it,out){const R=rnd(it.seed||7),ri=Math.min(it.w,it.d)/2-1.6,pitch=2.9,H=it.h;const pts=[];for(let y=-ri;y<=ri;y+=pitch*.866)for(let x=-ri;x<=ri;x+=pitch){const xx=x+((Math.round((y+ri)/(pitch*.866))%2)?pitch/2:0);const inside=it.round?Math.hypot(xx,y)<=ri:Math.pow(Math.abs(xx)/ri,4)+Math.pow(Math.abs(y)/ri,4)<=1;if(inside&&R()>.12)pts.push([xx,y]);}
   for(const [x,y]of pts){const tx=(R()-.5)*.08,ty=(R()-.5)*.08,dz=(R()-.5)*3,top=H-1+dz;out.push({g:'cyl12',make:()=>cyl(1,1,12),mat:'stick',m:mtx(x,y,.6,tx,ty,0,.62,.62,top-6),color:null});
    out.push({g:'sph',make:sphere,mat:'cotton',m:mtx(x+ty*top*.5*-1+tx*0,y+tx*top*.5,top-3.2+.6,tx,ty,0,1.45,1.45,3.6)});}},
  // Swabs lying flat in the tray, two loose layers.
  swabsFlat(it,out){const R=rnd(it.seed||9),L=76,n=Math.max(4,Math.floor((it.d-4)/2.6));for(let layer=0;layer<2;layer++)for(let i=0;i<n-layer;i++){const y=-(it.d-6)/2+i*2.6+(layer?1.3:0)+(R()-.5)*.6,z=1.3+layer*2.1,a=(R()-.5)*.05,dx=(R()-.5)*3;
   out.push({g:'cyl12',make:()=>cyl(1,1,12),mat:'stick',m:mtx(dx-L/2+4,y,z,0,Math.PI/2,a,.62,.62,L-8)});for(const e of [-1,1])out.push({g:'sph',make:sphere,mat:'cotton',m:mtx(dx+e*(L/2-3.4),y,z,0,0,a,3.6,1.45,1.45)});}},
  // Stack of cotton rounds with soft edges.
  cottonRounds(it,out){const R=rnd(it.seed||5),n=Math.max(6,Math.floor(it.h/2.1)),r=it.w/2;for(let i=0;i<n;i++)out.push({g:'pad',make:()=>geo('pad',()=>{const pts=[];for(let k=0;k<=8;k++){const t=-Math.PI/2+Math.PI*k/8;pts.push(new THREE.Vector2(.94+.06*Math.cos(t),.5+.5*Math.sin(t)));}pts.unshift(new THREE.Vector2(0,0));pts.push(new THREE.Vector2(0,1));return new THREE.LatheGeometry(pts,40).rotateX(Math.PI/2);}),mat:'cotton',m:mtx((R()-.5)*1.6,(R()-.5)*1.6,.4+i*2.05,(R()-.5)*.03,(R()-.5)*.03,R()*6,r,r,2.2)});},
  // Toothpaste tube: crimped flat end, body rounding toward the shoulder, ribbed screw cap.
  tube(it,out){const L=it.w,W=it.d,capL=Math.min(16,L*.1),body=L-capL,x0=-L/2,thick=W*.56,rows=[],band=[];
   const prof=t=>{const s=t<.06?.0:t<.92?Math.pow(Math.min(1,(t-.06)/.7),.55):1;return s;};
   for(let i=0;i<=40;i++){const t=i/40,x=x0+8+t*(body-8-9),s=prof(t),a=W/2*(.985-.05*s),b=.7+(thick/2-.7)*s;(t>.3&&t<.78?band:rows).push([x,a,b,b]);if(t>.29&&t<.31||t>.77&&t<.79){band.push([x,a,b,b]);rows.push([x,a,b,b]);}}
   const sh=[],xs=x0+body-9;for(let i=0;i<=8;i++){const t=i/8,a=W/2*.935*(1-t)+6.2*t,b=thick/2*(1-t)+6.2*t;sh.push([xs+t*9,a*Math.sqrt(1-.6*t*t)+(t>.9?0:0),b*Math.sqrt(1-.4*t*t),thick/2]);}
   const key=`tube:${k1(L)}:${k1(W)}`;const lo=rows.filter(q=>q[0]<x0+8+.3*(body-17)+.5),hi=rows.filter(q=>q[0]>x0+8+.78*(body-17)-.5);
   out.push({g:key+':a',make:()=>loft(THREE,lo,30,2.6),mat:'plastic',color:'#f7f8f9'},{g:key+':b',make:()=>loft(THREE,band,30,2.6),mat:'plastic',color:it.color},{g:key+':c',make:()=>loft(THREE,hi,30,2.6),mat:'plastic',color:'#f7f8f9'},{g:key+':s',make:()=>loft(THREE,sh,30,2.2),mat:'plastic',color:'#f7f8f9'});
   // Crimp: a flat sealed strip with fine ridges.
   out.push({g:`crimp:${k1(W)}`,make:()=>geo(`crimp:${k1(W)}`,()=>slab(THREE,9,W,1.4,.6,.3)),mat:'plastic',m:mtx(x0+4.5,0,.7),color:'#eef0f2'});for(let i=0;i<4;i++)out.push({g:'box',make:box,mat:'plastic',m:mtx(x0+1.6+i*1.9,0,2.2,0,0,0,.5,W*.96,.35),color:'#e2e5e8'});
   out.push({g:'cyl28',make:()=>cyl(1,1,28),mat:'satin',m:mtx(x0+body-.5,0,thick/2,0,Math.PI/2,0,7.2,7.2,capL),color:it.color});
   for(let i=0;i<14;i++){const t=i*Math.PI/7;out.push({g:'box',make:box,mat:'satin',m:mtx(x0+body+capL/2,7.2*Math.cos(t),thick/2+7.2*Math.sin(t),t,0,0,capL*.8,.8,.8),color:it.color});}},
  // Floss container standing on edge: tinted body, white flip lid with the metal cutter.
  floss(it,out){const w=it.w,t=it.d,h=it.h;out.push({g:`fl:${k1(w)}:${k1(t)}`,make:()=>geo(`fl:${k1(w)}:${k1(t)}`,()=>slab(THREE,w,t,h*.7,4,1.4)),mat:'clear',m:mtx(0,0,0),color:'#8fd3c7'});
   out.push({g:`fl:${k1(w)}:${k1(t)}:lid`,make:()=>geo(`fl:${k1(w)}:${k1(t)}:lid`,()=>slab(THREE,w+.4,t+.4,h*.3,4,1.4)),mat:'plastic',m:mtx(0,0,h*.7),color:'#f6f7f8'});
   out.push({g:'cyl32',make:()=>cyl(1,1,32),mat:'floss',m:mtx(0,0,h*.18,Math.PI/2,0,0,w*.3,w*.3,t*.6),color:'#ffffff'});out.push({g:'cyl32',make:()=>cyl(1,1,32),mat:'satin',m:mtx(0,0,h*.18,Math.PI/2,0,0,w*.12,w*.12,t*.64),color:'#d9dde2'});
   out.push({g:'box',make:box,mat:'steel',m:mtx(w*.18,0,h-.2,0,0,0,9,t*.5,.5)});},
  // Floss picks: flat handles with the floss line strung across a Y head.
  flossPicks(it,out){const R=rnd(it.seed||3),n=Math.max(3,Math.min(7,Math.floor(it.d/4)));for(let i=0;i<n;i++){const y=-it.d/2+5+i*(it.d-10)/Math.max(1,n-1),a=(R()-.5)*.35,z=.4+(i%2)*1.6,cx=(R()-.5)*6,Lp=Math.min(60,it.w-6),c=i%2?'#7cc7e8':'#ffffff';
   const T=(x,y2,z2,rz,sx,sy,sz,mat,color,g='box')=>{const p=new THREE.Vector3(x,y2,0).applyAxisAngle(new THREE.Vector3(0,0,1),a);out.push({g,make:g==='box'?box:()=>cyl(1,1,12),mat,m:mtx(cx+p.x,y+p.y,z+z2,0,g==='box'?0:Math.PI/2,a+rz,sx,sy,sz),color});};
   T(-6,0,.75,0,Lp-14,2.6,1.5,'plastic',c);T(Lp/2-9,1.8,.75,.5,8,1.6,1.5,'plastic',c);T(Lp/2-9,-1.8,.75,-.5,8,1.6,1.5,'plastic',c);T(Lp/2-4.6,0,1.3,Math.PI/2,.35,7.6,.35,'floss','#ffffff');}},
  // Comb: spine plus fine and coarse teeth.
  comb(it,out){const L=it.w,W=it.d,spine=Math.max(6,W*.28),toothL=W-spine,n=Math.floor((L-6)/1.9),key=`comb:${k1(L)}:${k1(spine)}`;out.push({g:key,make:()=>geo(key,()=>slab(THREE,L,spine,3.2,2.5,.8)),mat:'plastic',m:mtx(0,W/2-spine/2,0),color:it.color});
   for(let i=0;i<n;i++){const x=-L/2+3+i*((L-6)/(n-1)),fine=i>n*.45,tw=fine?.8:1.3;out.push({g:'box',make:box,mat:'plastic',m:mtx(x,W/2-spine-toothL/2+.4,1.2,0,0,0,tw,toothL,fine?2:2.4),color:it.color});}},
  // Hair ties piled in the cup, with two bobby pins on top.
  hairties(it,out){const R=rnd(it.seed||11),r=Math.min(12.5,it.w/2-3);for(let i=0;i<6;i++){const ang=R()*6.3,off=R()*Math.max(0,it.w/2-r-2.5);out.push({g:'torus',make:torus,mat:'rubber',m:mtx(Math.cos(ang)*off,Math.sin(ang)*off,1.4+i*1.5,(R()-.5)*.3,(R()-.5)*.3,0,r*(.85+R()*.15),r*(.85+R()*.15),7),color:TIES[i%TIES.length]});}
   for(let j=0;j<2;j++){const a=R()*3,z=9;for(const s of [-1,1])out.push({g:'cyl12',make:()=>cyl(1,1,12),mat:'darkMetal',m:mtx(Math.cos(a)*-11+Math.sin(a)*s*.9,Math.sin(a)*-11-Math.cos(a)*s*.9,z+j*1.2,0,Math.PI/2,a,.45,.45,Math.min(22,it.w-6))});}},
  // Nail clippers: chrome jaw body, lever and pin.
  clippers(it,out){const L=Math.min(58,it.w-4),W=Math.min(14,it.d-2),x=-it.w/2+2+L/2;out.push({g:`clp:${k1(L)}:${k1(W)}`,make:()=>geo(`clp:${k1(L)}:${k1(W)}`,()=>slab(THREE,L,W,6,W/2-.3,1)),mat:'chrome',m:mtx(x,0,0)});
   out.push({g:`clpl:${k1(L)}:${k1(W)}`,make:()=>geo(`clpl:${k1(L)}:${k1(W)}`,()=>slab(THREE,L*.95,W*.82,1.4,W*.4,.4)),mat:'chrome',m:mtx(x+1.4,0,7.4,0,-.07,0)});
   out.push({g:'cyl16',make:()=>cyl(1,1,16),mat:'steel',m:mtx(x+L/2-12,0,4,0,0,0,1.4,1.4,5)});out.push({g:'box',make:box,mat:'darkMetal',m:mtx(x+L/2-1.2,0,3,0,0,0,1.4,W*.8,.4)});},
  // Tweezers: two slim chrome arms meeting at the back.
  tweezers(it,out){const L=Math.min(92,it.w-4);for(const s of [-1,1])out.push({g:'box',make:box,mat:'chrome',m:mtx(0,s*2.2,1+(s>0?.0:0),0,0,-s*.035,L,4.2,1.1)});out.push({g:'box',make:box,mat:'steel',m:mtx(-L/2+5,0,1,0,0,0,10,6,2)});},
  // Emery nail file.
  nailFile(it,out){const L=Math.min(90,it.w-4),W=Math.min(12,it.d-2);out.push({g:`nf:${k1(L)}:${k1(W)}`,make:()=>geo(`nf:${k1(L)}:${k1(W)}`,()=>slab(THREE,L,W,1.6,W/2-.2,.4)),mat:'emery',m:mtx(0,0,0)});},
  // Lip balm standing in its well: body with a colored cap.
  balm(it,out){const r=it.w/2;out.push({g:'cyl28',make:()=>cyl(1,1,28),mat:'plastic',m:mtx(0,0,0,0,0,0,r,r,it.h*.66),color:'#f6f7f8'});out.push({g:'cyl28',make:()=>cyl(1,1,28),mat:'plastic',m:mtx(0,0,it.h*.66+.3,0,0,0,r*1.02,r*1.02,it.h*.34-1.2),color:it.color});out.push({g:'sph',make:sphere,mat:'plastic',m:mtx(0,0,it.h-1.2,0,0,0,r*1.02,r*1.02,1.4),color:it.color});},
  // Deodorant stick lying flat: oval barrel, colored cap and the twist dial at the base.
  deodorant(it,out){const L=it.w,a=it.d/2,b=Math.min(14,a*.62),x0=-L/2,capL=L*.3,body=[],cap=[];for(let i=0;i<=24;i++){const x=x0+3+i*(L-capL-3)/24;body.push([x,a*(i?1:.9),b*(i?1:.9),b]);}
   for(let i=0;i<=10;i++){const t=i/10,x=x0+L-capL+t*capL,s=t>.85?Math.sqrt(Math.max(.05,1-((t-.85)/.15)**2)):1;cap.push([x,a*1.015*Math.max(.25,s),b*1.015*Math.max(.25,s),b]);}
   const key=`deo:${k1(L)}:${k1(a)}`;out.push({g:key+':b',make:()=>loft(THREE,body,36,2.6),mat:'plastic',color:'#eef2f6'},{g:key+':c',make:()=>loft(THREE,cap,36,2.6),mat:'plastic',color:'#3a66b5'});
   out.push({g:'cyl28',make:()=>cyl(1,1,28),mat:'satin',m:mtx(x0+3.2,0,b,0,-Math.PI/2,0,b*.7,b*.7,3),color:'#3a66b5'});},
  // Contact lens case: two screw-cap cups on a bridge; one cap tinted to mark the right lens.
  lensCase(it,out){const r=Math.min(11,it.d/2-.5),cx=Math.min(it.w/2-r,13.5);out.push({g:`lb:${k1(it.w)}`,make:()=>geo(`lb:${k1(it.w)}`,()=>slab(THREE,2*cx,r,4,1.5,.6)),mat:'plastic',m:mtx(0,0,.5),color:'#f4f6f8'});
   for(const s of [-1,1]){out.push({g:'cyl32',make:()=>cyl(1,1,32),mat:'clear',m:mtx(s*cx,0,0,0,0,0,r*.92,r*.92,8.5),color:'#cfe7f5'});out.push({g:'cyl32',make:()=>cyl(1,1,32),mat:'satin',m:mtx(s*cx,0,8.2,0,0,0,r,r,4.4),color:s<0?'#f6f7f8':'#4caf50'});
    for(let i=0;i<16;i++){const t=i*Math.PI/8;out.push({g:'box',make:box,mat:'satin',m:mtx(s*cx+r*Math.cos(t),r*Math.sin(t),10.4,0,0,t,.7,.7,4),color:s<0?'#f6f7f8':'#4caf50'});}}},
  // Cartridge razor lying flat: grippy handle and a chrome head with blades and a moisture strip.
  razor(it,out){const L=it.w,x0=-L/2,hx=L-14,rows=[];for(let x=0;x<=hx;x+=3){const t=x/hx,w=(5.2+3.2*Math.sin(Math.PI*Math.min(1,t*1.15)))*(x<3?.8:1),h=(4.2+1.6*Math.sin(Math.PI*t))*(x<3?.8:1);rows.push([x0+x,w,h,6]);}
   const key=`rz:${k1(L)}`;out.push({g:key,make:()=>loft(THREE,rows,26,2.4),mat:'plastic',color:it.color});out.push({g:key+':g',make:()=>{const r2=rows.filter(q=>q[0]>x0+hx*.25&&q[0]<x0+hx*.7).map(q=>[q[0],q[1]*1.03,q[2]*1.04,q[3]]);return loft(THREE,r2,26,2.4);},mat:'rubber',color:'#2a2d31'});
   out.push({g:'box',make:box,mat:'chrome',m:mtx(x0+hx*.42,0,10.6,0,0,0,hx*.22,3,.6)});const W=Math.min(it.d-1,24);out.push({g:`rzh:${k1(W)}`,make:()=>geo(`rzh:${k1(W)}`,()=>slab(THREE,12,W,6,2.5,1)),mat:'plastic',m:mtx(x0+L-7,0,3.5),color:'#2a2d31'});
   for(let i=0;i<3;i++)out.push({g:'box',make:box,mat:'chrome',m:mtx(x0+L-9.2+i*2.2,0,9.6,0,0,0,.7,W-2.4,.4)});out.push({g:'box',make:box,mat:'satin',m:mtx(x0+L-3,0,9.7,0,0,0,2.4,W-2,.6),color:'#7fd3d0'});}
 };}
/* build(r, THREE, renderer): a Group of InstancedMeshes (one per shape + material), marked preview-only. */
function build(r,THREE,renderer){GEO.clear();const items=layout(r),g=new THREE.Group();g.name='Bathroom items \u00b7 preview only';g.userData.preview=true;g.userData.bathroomItems=items.length;if(!items.length)return g;
 const DP=G.GPDrawerProps,M=mats(THREE,renderer),R=Object.assign({},DP?DP.recipes(THREE,{loft,slab,geo,k1}):{},recipes(THREE)),buckets=new Map(),place=new THREE.Matrix4(),q=new THREE.Quaternion(),z=new THREE.Vector3(0,0,1),one=new THREE.Vector3(1,1,1),tmp=new THREE.Color();
 for(const it of items){const parts=[];try{(R[it.type]||(()=>{}))(it,parts);}catch(e){console.warn('Preview item',it.type,e);continue;}place.compose(new THREE.Vector3(it.x,it.y,it.z),q.setFromAxisAngle(z,it.rot||0),one);const X=DP&&DP.xform?DP.xform(THREE,it):null;if(X)place.multiply(X);
  for(const p of parts){const k=p.g+'|'+p.mat;let b=buckets.get(k);if(!b){b={geo:GEO.has(p.g)?GEO.get(p.g):geo(p.g,p.make),mat:M[p.mat]||M.plastic,list:[]};buckets.set(k,b);}b.list.push({m:p.m?place.clone().multiply(p.m):place.clone(),color:p.color});}}
 let instances=0;for(const [k,b]of buckets){const mesh=new THREE.InstancedMesh(b.geo,b.mat,b.list.length);mesh.name=k;mesh.userData.preview=true;mesh.userData.sharedGeo=true;mesh.castShadow=mesh.receiveShadow=false;
  const tint=b.list.some(e=>e.color);b.list.forEach((e,i)=>{mesh.setMatrixAt(i,e.m);if(tint)mesh.setColorAt(i,tmp.set(e.color||'#ffffff'));});mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.raycast=()=>{};g.add(mesh);instances+=b.list.length;}
 g.userData.meshes=buckets.size;g.userData.instances=instances;g.userData.types=[...new Set(items.map(i=>i.type))];return g;}
api.build=build;
if(typeof module!=='undefined'&&module.exports)module.exports=api;else G.GPBathProps=api;
})(typeof globalThis!=='undefined'?globalThis:this);
