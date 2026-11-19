// Small parts bins (drawer organizer): the one-click "Small parts tray" layout, and realistic display-only preview
// items for divider and cup compartments (screws, hex nuts, washers, tiny brass jets, springs and O-rings).
// preset(o, nid) is pure layout data (Node and browser). layout(r) turns the drawer result's placement data
// (r.props entries with id 'smallparts') into item placements; build(r, THREE, renderer) draws them with one
// InstancedMesh per shape and material. Nothing here is ever exported: the items are not drawer parts, so they
// never reach the STL / 3MF files, the plate packer or the estimates. No brand names.
(function(G){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/* ---------------- Small parts tray layout ---------------- */
// Bins are sized to fit the printer plate (so every divider plate fits it too) and cycle through four kinds:
// an interlocking divider grid with label tabs, a grid with drop-in scoop cups, larger cups, and long lanes.
const KINDS=[
 {label:'Screws and bolts',id:'smallPartsDividers',cell:30,tab:1,cups:0},
 {label:'Tiny jets and springs',id:'smallPartsCups',cell:34,tab:0,cups:1},
 {label:'Nuts and washers',id:'smallPartsCups',cell:44,tab:0,cups:1},
 {label:'Long parts',id:'smallPartsDividers',cell:34,tab:1,cups:0,lanes:true}
];
function preset(o,nid){
 const cl=o.clearance??1,W=+o.width-2*cl,D=+o.depth-2*cl,gap=+o.gap||.8,height=+o.height||60,wall=+o.wall||1.6;
 if(!(W>=90&&D>=90))throw Error('The small parts tray needs at least about 90 \u00d7 90 mm inside. Enter your drawer size and try again.');
 if(height<24)throw Error('The small parts tray needs a drawer at least 24 mm tall inside.');
 const bedX=+o.bed||256,bedY=+o.bedY||bedX,maxSide=Math.max(90,Math.min(200,Math.min(bedX,bedY)-12));
 const nx=Math.max(W>=170?2:1,Math.ceil(W/maxSide)),ny=Math.max(D>=170?2:1,Math.ceil(D/maxSide));
 const binH=Math.min(o.binHeight??(height-2),height-2,48),cells=[];
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const K=KINDS[(j*nx+i)%KINDS.length],bw=W/nx-gap,bd=D/ny-gap,iw=bw-2*wall,id=bd-2*wall;
  // Plates at even spacing so each compartment is about K.cell mm (12 mm minimum per space).
  const cnt=(len,cell)=>clamp(Math.round(len/cell)-1,0,6);
  let pnx=cnt(iw,K.cell),pny=K.lanes?Math.max(1,Math.min(3,Math.round(id/60)-1)):cnt(id,K.cell);
  if(K.lanes)pnx=0;if(!pnx&&!pny)pny=1;
  const ins={id:K.id,nx:pnx,ny:pny,t:1.6,hFrac:K.lanes?.7:1};if(K.tab)ins.tab=1;
  cells.push({id:nid(),x0:i/nx,x1:(i+1)/nx,y0:j/ny,y1:(j+1)/ny,bin:{height:binH,radius:Math.min(4,o.radius??4),innerRadius:1.5},label:K.label,insert:ins});
 }
 return {id:nid(),layout:cells,room:'smallparts',smallParts:{bins:cells.length,cols:nx,rows:ny,height:binH}};
}

/* ---------------- preview items (display only) ---------------- */
const TYPES=['screws','jets','nuts','mixed','springs','orings'];
const rnd=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
/* layout(r): [{type, x, y, z, rot, size, seed, cell}] in the drawer preview's coordinates. */
function layout(r){
 const out=[];for(const pr of (r&&r.props)||[]){if(pr.id!=='smallparts')continue;
  pr.cells.forEach((q,k)=>{const cw=q.x1-q.x0,cd=q.y1-q.y0;if(cw<9||cd<9)return;const R=rnd(7919*(pr.cell+1)+101*k+3),kind=TYPES[(pr.cell*3+k)%TYPES.length];
   const pick=()=>kind==='mixed'?['screw','nut','washer','jet','spring','oring'][Math.floor(R()*6)]:kind==='screws'?(R()<.8?'screw':'washer'):kind==='nuts'?(R()<.6?'nut':'washer'):kind==='jets'?(R()<.75?'jet':'spring'):kind==='springs'?(R()<.7?'spring':'jet'):(R()<.7?'oring':'nut');
   const sp=kind==='screws'?9:7.5,n=clamp(Math.floor(cw*cd/(sp*sp)*.55),2,22),m=2.2,Rb=q.bowl||0;
   for(let i=0;i<n;i++){const t=pick(),x=q.x0+m+R()*(cw-2*m),y=q.y0+m+R()*(cd-2*m),e=Math.min(x-q.x0,q.x1-x,y-q.y0,q.y1-y),lift=Rb&&e<Rb?Rb-Math.sqrt(Math.max(0,Rb*Rb-(Rb-e)*(Rb-e))):0;
    const size=t==='screw'?Math.min(10+R()*12,Math.max(cw,cd)-6):t==='nut'?2.6+R()*1.6:t==='washer'?3.2+R()*1.6:t==='jet'?6+R()*3:t==='spring'?Math.min(9+R()*8,Math.max(cw,cd)-5):3+R()*2.5;
    out.push({type:t,x:pr.ox+x,y:pr.oy+y,z:pr.oz+(q.z||0)+lift+i*.02,rot:R()*Math.PI*2,size,seed:Math.floor(R()*1e6),cell:pr.cell,tilt:lift>0?Math.min(.5,lift/6):0});}});}
 return out;
}
let MATS=null,ENV=null;const GEO=new Map();
function mats(THREE,renderer){if(MATS)return MATS;
 if(!ENV&&THREE.RoomEnvironment&&renderer){const pm=new THREE.PMREMGenerator(renderer),room=new THREE.RoomEnvironment();ENV=pm.fromScene(room,.04).texture;pm.dispose();room.dispose&&room.dispose();}
 const P=THREE.MeshPhysicalMaterial||THREE.MeshStandardMaterial,M=o=>new P(Object.assign({envMap:ENV,envMapIntensity:.9,roughness:.4,metalness:0},o));
 MATS={zinc:M({color:'#c9cdd2',metalness:1,roughness:.32}),steel:M({color:'#a9b0b8',metalness:.95,roughness:.38}),black:M({color:'#2c2e31',metalness:.7,roughness:.45}),
  brass:M({color:'#d2a64a',metalness:1,roughness:.3,envMapIntensity:1.1}),copper:M({color:'#c47a4a',metalness:1,roughness:.35}),rubber:M({color:'#1b1c1e',roughness:.85,envMapIntensity:.2}),hole:M({color:'#0d0e10',roughness:1,envMapIntensity:0})};
 for(const m of Object.values(MATS))m.userData.preview=true;return MATS;}
function geos(THREE){if(GEO.size)return GEO;
 const cyl=(r,h,seg)=>{const g=new THREE.CylinderGeometry(r,r,h,seg);g.rotateX(Math.PI/2);return g;}; // axis along z
 GEO.set('hex',cyl(1,1,6));GEO.set('cyl',cyl(1,1,20));GEO.set('cyl8',cyl(1,1,10));
 const tor=new THREE.TorusGeometry(1,.3,10,28);GEO.set('ring',tor);const thin=new THREE.TorusGeometry(1,.12,6,20);GEO.set('thread',thin);
 // Coil spring: a helix along x.
 class Helix extends THREE.Curve{getPoint(t,v=new THREE.Vector3()){const turns=7,a=t*turns*2*Math.PI;return v.set(t-.5,.5*Math.cos(a),.5*Math.sin(a));}}
 GEO.set('helix',new THREE.TubeGeometry(new Helix(),140,.045,6,false));
 return GEO;}
function build(r,THREE,renderer){const items=layout(r),g=new THREE.Group();g.name='Small parts \u00b7 preview only';g.userData.preview=true;g.userData.smallItems=items.length;if(!items.length)return g;
 const M=mats(THREE,renderer),Gs=geos(THREE),buckets=new Map(),Z=new THREE.Vector3(0,0,1),X=new THREE.Vector3(1,0,0);
 const add=(geo,mat,m)=>{const k=geo+'|'+mat;let b=buckets.get(k);if(!b){b={geo:Gs.get(geo),mat:M[mat],list:[]};buckets.set(k,b);}b.list.push(m);};
 const base=it=>new THREE.Matrix4().compose(new THREE.Vector3(it.x,it.y,it.z),new THREE.Quaternion().setFromAxisAngle(Z,it.rot).multiply(new THREE.Quaternion().setFromAxisAngle(X,it.tilt||0)),new THREE.Vector3(1,1,1));
 // local helper: T(position, rotation about y to lay along x, scale)
 const part=(B,geo,mat,px,py,pz,sx,sy,sz,layX)=>{const q=layX?new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2):new THREE.Quaternion();add(geo,mat,B.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(px,py,pz),q,new THREE.Vector3(sx,sy,sz))));};
 for(const it of items){const B=base(it),s=it.size;
  switch(it.type){
   case 'screw':{const d=s<14?1.5:2,hr=d*1.75,mat=it.seed%3===0?'black':'zinc';part(B,'cyl',mat,0,0,hr,d,d,s,true);part(B,'hex',mat,-s/2-1.2,0,hr,hr,hr,2.4,true);
    for(let k=0;k<Math.floor(s/1.6);k++)part(B,'thread',mat,-s/2+1.4+k*1.6,0,hr,d*1.02,d*1.02,d*1.02*1.2,true);break;}
   case 'nut':part(B,'hex','zinc',0,0,s*.45,s,s,s*.9,false);part(B,'cyl','hole',0,0,s*.45+.02,s*.52,s*.52,s*.92,false);break;
   case 'washer':part(B,'ring',it.seed%2?'zinc':'steel',0,0,.4,s,s,1.1,false);break;
   case 'jet':{const r0=s*.24;part(B,'hex','brass',-s*.32,0,r0*1.25,r0*1.25,r0*1.25,s*.28,true);part(B,'cyl','brass',s*.12,0,r0*1.25,r0*.85,r0*.85,s*.62,true);part(B,'cyl8','brass',s*.47,0,r0*1.25,r0*.45,r0*.45,s*.12,true);
    for(let k=0;k<4;k++)part(B,'thread','brass',s*(-.08+k*.1),0,r0*1.25,r0*.86,r0*.86,r0*1.1,true);part(B,'cyl8','hole',-s*.47,0,r0*1.25,r0*.35,r0*.35,.05,true);break;}
   case 'spring':{const r0=Math.min(3,s*.18);part(B,'helix',it.seed%2?'steel':'copper',0,0,r0,s,r0*2,r0*2,false);break;}
   case 'oring':part(B,'ring','rubber',0,0,.6,s,s,1.6,false);break;
  }}
 let n=0;for(const [k,b]of buckets){if(!b.geo||!b.list.length)continue;const mesh=new THREE.InstancedMesh(b.geo,b.mat,b.list.length);mesh.name=k;mesh.userData.preview=true;mesh.userData.sharedGeo=true;mesh.castShadow=mesh.receiveShadow=false;
  b.list.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.raycast=()=>{};g.add(mesh);n+=b.list.length;}
 g.userData.instances=n;g.userData.types=[...new Set(items.map(i=>i.type))];return g;}
const api={KINDS,TYPES,preset,layout,build};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else G.GPSmallParts=api;
})(typeof globalThis!=='undefined'?globalThis:this);
