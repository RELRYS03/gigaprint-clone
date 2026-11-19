/* Bin extras: scoops, magnet pockets, label tabs (Batch A); stacking + floor fillet (B); lids + honeycomb (C).
 * Each feature is applied to a plain or insert bin mesh, or layered into steppedExtrude before export.
 * All geometry prints open-side-up without supports when defaults are used. */
(function(G){'use strict';
const C=G.SplitCore||require('./core'),T=G.StudioTools||require('./tools'),LIDS=G.GPLids||require('./lid-features'),DX=G.GPDrawerX||require('./drawer-extras'),MD=G.MeshDoctor||(typeof require==='function'?require('./repair'):null),DECO=()=>G.GPLidDeco||(typeof require==='function'?require('./lid-deco'):null);
const footMode=v=>v==='sharp'?'sharp':v==='seamless'?'seamless':'smooth'; // grid foot transition: smooth (45\u00b0 above the feet, default), seamless (smooth with a deck thick enough that no flat patch is left) or sharp (flat bridge)
// Seamless: the 45\u00b0 rise between four feet tops out 6.66 mm up (corner pocket, 4\u221a2 mm from the foot corners); a 2.6 mm deck
// keeps the 0.6 mm solid above it, so the whole underside prints as slopes: no flat ceiling over air to sag or string.
const SEAMLESS_DECK=2.6,deckFor=(floor,foot)=>Math.max(+floor||1.6,1.2,footMode(foot)==='seamless'?SEAMLESS_DECK:0);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),poly=outer=>({outer,holes:[]});

/* Open 42 mm grid baseplate standard (generic name only \u2014 never ship a brand name).
 * Pitch 42, bin outer 42\u00d7n \u2212 0.5, foot 0.8/1.8/2.15 stepped chamfer (4.75 tall), height unit 7. */
const GRID={pitch:42,clear:.25,outerPad:.5,baseH:4.75,hUnit:7,
 footTop:41.5,footMid:37.2,footBot:35.6,rTop:3.75,rMid:1.6,rBot:.8,
 zBot:0,zMid0:.8,zMid1:2.6,zTop:4.75};
function gridUnitsFor(span){
 const p=GRID.pitch;let n=Math.max(1,Math.floor((+span+GRID.outerPad)/p));
 while(n>1&&p*n-GRID.outerPad>span+.05)n--;
 return n;
}
function gridOuter(nx,ny){return {w:GRID.pitch*nx-GRID.outerPad,d:GRID.pitch*ny-GRID.outerPad,nx,ny};}
function gridSnapSize(w,d){
 const nx=gridUnitsFor(w),ny=gridUnitsFor(d),o=gridOuter(nx,ny);
 if(o.w>w+.05||o.d>d+.05)throw Error(`This slot is too small for a 42 mm grid unit (needs at least ${GRID.footTop.toFixed(1)} mm). Enlarge the bin or turn off the 42 mm grid base.`);
 return o;
}
function gridSnapHeight(h,useUnits){
 if(!useUnits)return Math.max(GRID.baseH+6,+h||GRID.hUnit*3);
 const u=Math.max(1,Math.round((+h||GRID.hUnit*3)/GRID.hUnit));
 return {h:u*GRID.hUnit,u};
}
function gridFootPolys(nx,ny){
 // One foot per cell, centred in its 42 mm cell inside the 42\u00d7n\u22120.5 outer.
 const feet={bot:[],mid:[],top:[]};
 for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){
  const cx=GRID.pitch*(ix+.5)-GRID.clear,cy=GRID.pitch*(iy+.5)-GRID.clear;
  const sq=(s,r)=>{const h=s/2;return poly(T.roundRect(cx-h,cy-h,cx+h,cy+h,r,24));};
  feet.bot.push(sq(GRID.footBot,GRID.rBot));
  feet.mid.push(sq(GRID.footMid,GRID.rMid));
  feet.top.push(sq(GRID.footTop,GRID.rTop));
 }
 return feet;
}
function gridChamferLayers(z0,z1,fromPolys,toPolys,steps){
 const n=Math.max(2,steps|0),out=[];
 // Approximate a 45\u00b0 loft with thin stepped bands (steppedExtrude is vertical per band).
 for(let i=0;i<n;i++){
  const t0=i/n,t1=(i+1)/n,za=z0+(z1-z0)*t0,zb=z0+(z1-z0)*t1;
  // Prefer the larger outline for each band so the staircase stays outside the true chamfer.
  const useTo=t1>.5;
  out.push({z0:za,z1:zb,polys:useTo?toPolys:fromPolys});
 }
 return out;
}
function gridBaseLayers(nx,ny,bodyOuter){
 const feet=gridFootPolys(nx,ny),layers=[];
 // Bottom chamfer 0 \u2192 0.8 (bot \u2192 mid), vertical 0.8 \u2192 2.6, top chamfer 2.6 \u2192 4.75 (mid \u2192 top).
 layers.push(...gridChamferLayers(GRID.zBot,GRID.zMid0,feet.bot,feet.mid,4));
 layers.push({z0:GRID.zMid0,z1:GRID.zMid1,polys:feet.mid});
 layers.push(...gridChamferLayers(GRID.zMid1,GRID.zTop,feet.mid,feet.top,6));
 // Bridge the tops of the feet into one solid floor under the bin body.
 layers.push({z0:GRID.zTop,z1:GRID.zTop,polys:bodyOuter}); // marker; real bridge added by caller
 return {feet,layers,baseH:GRID.baseH};
}
/* Grid foot + transition solid (z 0 \u2192 zTop), built as one surface so every chamfer is a true 45\u00b0 slope.
 * Each foot is the 34 mm core square of its cell offset outward: 0.8 at z 0, 1.6 from z 0.8 to 2.6, 3.75 at z 4.75
 * (the standard 0.8 / 1.8 / 2.15 profile, 35.6 \u2192 37.2 \u2192 41.5 mm). Above 4.75 the 'smooth' transition keeps rising
 * at 45\u00b0 into the 0.5 mm gaps and corner pockets between neighbouring feet, so nothing prints as a flat ceiling over
 * air; 'sharp' closes them with the classic flat bridge at 4.75. Below 4.75 the two are identical, so baseplate fit
 * does not change. Rays run outward from the core square: four corners \u00d7 33 normals, profile points per ray. */
const GRID_FOOT_PROFILE=[[.8,0],[1.6,.8],[1.6,2.6],[3.75,4.75]];
function gridBaseSurface(nx,ny,zTop,opts={}){
 const smooth=opts.foot!=='sharp',M=32,core=GRID.footTop/2-GRID.rTop,P=GRID_FOOT_PROFILE,last=P[P.length-1];
 // Keep at least 0.6 mm of solid over the highest point of a pocket. With thin floors the very tip of a pocket where
 // feet meet is cut flat there: a patch about 3 mm across, bridged from the slopes around it.
 const capZ=Math.max(last[1],zTop-.6),q3=v=>Math.round(v*1e3)/1e3,tris=[],walls=[];
 const pt=(x,y,z)=>[q3(x),q3(y),Math.round(z*1e5)/1e5];
 const push=(a,b,c)=>{const k=v=>v.join();if(k(a)===k(b)||k(b)===k(c)||k(a)===k(c))return;tris.push(a,b,c);};
 const cells=[];
 for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){
  const cx=GRID.pitch*(ix+.5)-GRID.clear,cy=GRID.pitch*(iy+.5)-GRID.clear,half=GRID.pitch/2-core;
  // Distance from the core edge to the cell border (ridge with the neighbour) or to the bin's outer wall.
  const lim={px:ix<nx-1?half:last[0],nx:ix>0?half:last[0],py:iy<ny-1?half:last[0],ny:iy>0?half:last[0]};
  const rays=[];
  for(const [sx,sy,a0] of [[1,-1,-Math.PI/2],[1,1,0],[-1,1,Math.PI/2],[-1,-1,Math.PI]]){
   const lx=sx>0?lim.px:lim.nx,ly=sy>0?lim.py:lim.ny,outX=lx===last[0],outY=ly===last[0],angles=[];
   for(let i=0;i<=M;i++)angles.push(a0+Math.PI/2*i/M);
   // Where a ridge meets the outer wall, add the ray through that exact point so the wall stays straight.
   if(outX!==outY){let tc=Math.atan2(sy*ly,sx*lx);while(tc<a0-1e-9)tc+=2*Math.PI;if(!angles.some(a=>Math.abs(a-tc)<1e-6)){angles.push(tc);angles.sort((a,b)=>a-b);}}
   for(const t of angles){
   const n=[Math.cos(t),Math.sin(t)],qx=cx+sx*core,qy=cy+sy*core;
   const Lx=n[0]>1e-9?lim.px/n[0]:n[0]<-1e-9?lim.nx/-n[0]:Infinity,Ly=n[1]>1e-9?lim.py/n[1]:n[1]<-1e-9?lim.ny/-n[1]:Infinity;
   // A bin's own outer corner follows the rounded outline (3.75 mm from the core corner).
   const dmax=outX&&outY?last[0]:Math.min(Lx,Ly),prof=P.slice();
   if(dmax>last[0]+1e-9){
    if(!smooth)prof.push([dmax,last[1]],[dmax,last[1]]);
    else{const zEnd=last[1]+(dmax-last[0]);if(zEnd>capZ+1e-9){const dc=last[0]+(capZ-last[1]);prof.push([dc,capZ],[dmax,capZ]);}else prof.push([dmax,zEnd],[dmax,zEnd]);}
   }else prof.push(last,last);
   rays.push(prof.map(([dd,z])=>pt(qx+dd*n[0],qy+dd*n[1],z)));
  }}
  const R=rays.length,K=rays[0].length;
  for(let j=0;j<R;j++){const A=rays[j],B=rays[(j+1)%R];
   for(let k=0;k+1<K;k++){push(A[k],B[k],B[k+1]);push(A[k],B[k+1],A[k+1]);}}
  for(let j=1;j+1<R;j++)push(rays[0][0],rays[j+1][0],rays[j][0]);
  cells.push(rays);
 }
 // Open rim edges (border of the outer footprint): every ridge edge shared with a neighbour cancels out.
 const key=v=>v.join(),cnt=new Map();
 for(let i=0;i<tris.length;i+=3)for(let e=0;e<3;e++){const a=tris[i+e],b=tris[i+(e+1)%3],f=key(a)+'|'+key(b),r=key(b)+'|'+key(a);if(cnt.get(r)){cnt.set(r,cnt.get(r)-1);if(!cnt.get(r))cnt.delete(r);}else cnt.set(f,(cnt.get(f)||0)+1);}
 const V=new Map();for(const v of tris)V.set(key(v),v);
 const rim=[];for(const [f] of cnt){const [a,b]=f.split('|');rim.push([V.get(a),V.get(b)]);}
 // Vertical outer wall from each rim edge up to zTop. Rim edges run b\u2192a (clockwise), so the wall uses a\u2192b.
 for(const [b,a] of rim){const a2=[a[0],a[1],zTop],b2=[b[0],b[1],zTop];push(a,b,b2);push(a,b2,a2);walls.push([a2,b2]);}
 return {tris,top:walls,capZ,smooth};
}
function flatTris(tris){const out=new Float64Array(tris.length*3);tris.forEach((v,i)=>{out[i*3]=v[0];out[i*3+1]=v[1];out[i*3+2]=v[2];});return out;}
function capLoop(edges){ // chain a'\u2192b' edges into closed loops
 const nxt=new Map(),k=v=>v[0]+','+v[1];for(const [a,b] of edges)nxt.set(k(a),[a,b]);
 const loops=[],seen=new Set();
 for(const [a] of edges){if(seen.has(k(a)))continue;const L=[];let cur=a;for(let g=0;g<=edges.length&&!seen.has(k(cur));g++){seen.add(k(cur));L.push(cur);const e=nxt.get(k(cur));if(!e)break;cur=e[1];}if(L.length>2)loops.push(L);}
 return loops;
}
function triangulateLoop(loop,z,up,out){
 const ear=C.earcutRef(),flat=[];for(const v of loop)flat.push(v[0],v[1]);
 const t=ear(flat,null,2);
 for(let i=0;i<t.length;i+=3){let [a,b,c]=[t[i],t[i+1],t[i+2]];const ar=(flat[b*2]-flat[a*2])*(flat[c*2+1]-flat[a*2+1])-(flat[c*2]-flat[a*2])*(flat[b*2+1]-flat[a*2+1]);if(!ar)continue;if((ar>0)!==up){const s=b;b=c;c=s;}
  for(const id of [a,b,c])out.push([flat[id*2],flat[id*2+1],z]);}
}
// Closed base solid (feet + transition + deck) with a flat top at zTop, for parts that sit on it as a separate body.
function gridBaseSolid(nx,ny,zTop,opts={}){
 const s=gridBaseSurface(nx,ny,zTop,opts),tris=s.tris.slice();
 for(const L of capLoop(s.top.map(([a2,b2])=>[b2,a2])))triangulateLoop(L,zTop,true,tris);
 return flatTris(tris);
}
// Join the base under a bin body whose lowest layer is the wall ring at zTop: the body's ring underside is dropped and
// the interior floor is capped from the ring's hole, so the result is a single watertight shell.
function joinGridBase(body,nx,ny,zTop,ring,opts={}){
 const s=gridBaseSurface(nx,ny,zTop,opts),tris=s.tris.slice();
 const U=T.unionPolys(ring);for(const P of U)for(const h of P.holes)triangulateLoop(h.map(p=>[p[0],p[1]]),zTop,true,tris);
 const base=flatTris(tris),keep=[];
 for(let i=0;i<body.length;i+=9){
  const z0=body[i+2],z1=body[i+5],z2=body[i+8];
  if(Math.abs(z0-zTop)<1e-6&&Math.abs(z1-zTop)<1e-6&&Math.abs(z2-zTop)<1e-6){
   const nz=(body[i+3]-body[i])*(body[i+7]-body[i+1])-(body[i+6]-body[i])*(body[i+4]-body[i+1]);if(nz<0)continue;}
  for(let k=0;k<9;k++)keep.push(body[i+k]);
 }
 let out=new Float64Array(base.length+keep.length);out.set(base,0);out.set(keep,base.length);
 if(!C.checkClosed(out).closed&&C.fixTJunctions){for(const tol of[1e-4,1e-3,5e-3]){out=Float64Array.from(C.fixTJunctions(out,new Array(out.length/9).fill(0),tol).p);if(C.checkClosed(out).closed)break;}}
 return out;
}
// Layered version of the same base for bins built in pieces (the piece cut only applies to layered solids). Thin
// ~0.15 mm bands follow the 45\u00b0 profile, so each band steps out no more than its own height (prints as a 45\u00b0 slope).
function gridBaseFineLayers(nx,ny,w,d,zTop,opts={}){
 const smooth=opts.foot!=='sharp',core=GRID.footTop/2-GRID.rTop,P=GRID_FOOT_PROFILE,last=P[P.length-1];
 const O=[poly(T.roundRect(0,0,w,d,GRID.rTop,32))],capZ=Math.max(last[1],zTop-.6),layers=[];
 const cores=rho=>{const out=[];for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){const cx=GRID.pitch*(ix+.5)-GRID.clear,cy=GRID.pitch*(iy+.5)-GRID.clear,h=core+rho;out.push(poly(T.roundRect(cx-h,cy-h,cx+h,cy+h,rho,24)));}return out;};
 const rhoAt=z=>z<=P[1][1]?P[0][0]+(z-P[0][1]):z<=P[2][1]?P[1][0]:z<=last[1]?P[2][0]+(z-P[2][1]):last[0]+(z-last[1]);
 const band=(z0,z1,n)=>{for(let i=0;i<n;i++){const a=z0+(z1-z0)*i/n,b=z0+(z1-z0)*(i+1)/n,r=rhoAt((a+b)/2);
  layers.push({z0:a,z1:b,polys:r>last[0]+1e-9?T.interPolys(T.unionPolys(cores(r)),O):cores(r)});}};
 band(P[0][1],P[1][1],6);layers.push({z0:P[1][1],z1:P[2][1],polys:cores(P[1][0])});band(P[2][1],last[1],15);
 if(smooth&&capZ>last[1]+1e-6)band(last[1],capZ,Math.max(1,Math.ceil((capZ-last[1])/.15)));
 layers.push({z0:smooth?capZ:last[1],z1:zTop,polys:O});
 return layers.filter(l=>l.z1>l.z0+1e-9);
}
function buildGridBaseplate(nx,ny,floorTh=1.2){
 // Matching baseplate: solid floor + one socket per cell (female of the foot profile). Opt-in download.
 nx=clamp(Math.round(nx),1,30);ny=clamp(Math.round(ny),1,30);
 const W=GRID.pitch*nx,D=GRID.pitch*ny,th=clamp(floorTh,0.8,4),H=th+4.65;
 const outer=[poly(T.roundRect(0,0,W,D,1,8))],layers=[{z0:0,z1:th,polys:outer}];
 // Socket cavities from the top: open at H, step down to th.
 for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){
  const cx=GRID.pitch*(ix+.5),cy=GRID.pitch*(iy+.5);
  const sq=(s,r)=>{const h=s/2;return poly(T.roundRect(cx-h,cy-h,cx+h,cy+h,r,24));};
  // Female: slightly larger than the male foot (bin already has 0.25 clear to the 42 cell).
  const top=sq(42-0.1,4),mid=sq(37.4,1.7),bot=sq(35.8,.85);
  // Carve socket as layered ring differences from the solid \u2014 build as wall rings above the floor.
  void top;void mid;void bot;
 }
 // Build as: solid slab, then for each z band a slab with holes.
 const holeAt=(s,r,ix,iy)=>{const cx=GRID.pitch*(ix+.5),cy=GRID.pitch*(iy+.5),h=s/2;return poly(T.roundRect(cx-h,cy-h,cx+h,cy+h,r,24));};
 const allHoles=(s,r)=>{const hs=[];for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++)hs.push(holeAt(s,r,ix,iy));return hs;};
 // Profile from top of plate down (female): 0.35 lip + 0.7 chamfer + 1.8 straight + 2.15 chamfer \u2248 5 above floor option; we use 4.65 socket depth.
 const z0=th,z1=th+.35,z2=th+.35+.7,z3=th+.35+.7+1.8,z4=th+4.65;
 layers.push({z0:z0,z1:z1,polys:T.diffPolys(outer,allHoles(42.0,4))});
 layers.push({z0:z1,z1:z2,polys:T.diffPolys(outer,allHoles(37.4,1.7))}); // chamfer band approximated
 layers.push({z0:z2,z1:z3,polys:T.diffPolys(outer,allHoles(37.4,1.7))});
 layers.push({z0:z3,z1:z4,polys:T.diffPolys(outer,allHoles(35.8,.85))});
 let mesh=T.steppedExtrude(layers);
 for(let i=0;i<mesh.length;i++)mesh[i]=Math.round(mesh[i]*1e5)/1e5;
 if(!C.checkClosed(mesh).closed&&C.fixTJunctions){for(const tol of[1e-4,1e-3,5e-3]){mesh=Float64Array.from(C.fixTJunctions(mesh,new Array(mesh.length/9).fill(0),tol).p);if(C.checkClosed(mesh).closed)break;}}
 if(!C.checkClosed(mesh).closed)throw Error('Could not form a closed 42 mm grid baseplate. Try a smaller plate.');
 return {mesh,w:W,d:D,h:z4,nx,ny,name:`grid_baseplate_${nx}x${ny}_${W.toFixed(0)}x${D.toFixed(0)}mm`};
}

// Furniture drawer interior presets. Generic names only; sizes from measured / published interiors.
// Heights are clear inside height to the underside of the drawer above when closed.
const DRAWER_PRESETS=[
 {id:'custom',name:'Custom (keep my measurements)',width:null,depth:null,height:null},
 {id:'narrow6_shallow',name:'Narrow 6-drawer unit (shallow)',width:296,depth:522,height:86,note:'~11.7 \u00d7 20.6 \u00d7 3.4 in inside'},
 {id:'narrow6_deep',name:'Narrow 6-drawer unit (deep)',width:296,depth:522,height:132,note:'~11.7 \u00d7 20.6 \u00d7 5.2 in inside'},
 {id:'narrow9',name:'Tall narrow 9-drawer unit',width:296,depth:423,height:86,note:'~11.7 \u00d7 16.7 \u00d7 3.4 in inside'},
 {id:'wide_casters_shallow',name:'Wide 6-drawer unit on casters (shallow)',width:600,depth:423,height:66,note:'~23.6 \u00d7 16.7 \u00d7 2.6 in inside'},
 {id:'wide_casters_deep',name:'Wide 6-drawer unit on casters (deep)',width:600,depth:423,height:87,note:'~23.6 \u00d7 16.7 \u00d7 3.4 in inside'},
 {id:'desk_common',name:'Common desk drawer',width:350,depth:450,height:70,note:'~13.8 \u00d7 17.7 \u00d7 2.8 in inside'},
 {id:'desk_shallow',name:'Shallow desk / vanity drawer',width:380,depth:320,height:55,note:'~15.0 \u00d7 12.6 \u00d7 2.2 in inside'},
 {id:'kitchen_base',name:'Kitchen base-cabinet drawer',width:540,depth:500,height:100,note:'~21.3 \u00d7 19.7 \u00d7 3.9 in inside'},
 {id:'kitchen_wide',name:'Wide kitchen drawer',width:760,depth:500,height:100,note:'~29.9 \u00d7 19.7 \u00d7 3.9 in inside'},
 {id:'nightstand',name:'Nightstand drawer',width:340,depth:300,height:80,note:'~13.4 \u00d7 11.8 \u00d7 3.1 in inside'},
 {id:'filing',name:'File / lateral drawer',width:380,depth:550,height:260,note:'~15.0 \u00d7 21.7 \u00d7 10.2 in inside'}
];

const STYLE_KEYS=['wall','radius','height','scoop','scoopDepth','scoopWidth','magnets','magD','magH','magClear','labelTab','labelAngle','labelStyle','labelText','stack','stackClear','floorFillet','lid','lidT','lidClear','lidMag','lidMagFit','lidLabel','lidText','lidTextStyle','lidGrab','lidGridTop','lidDeco','honeycomb','honeyCell','noFloor','footFlange','binType','gridBase','gridHeightUnits','frontLabel','frontText','slots','slotCount','slotClear','slotCountY','slotT','slotH','slotPos','slotPosY','slotTab','cups','cupNx','cupNy','cupClear'];

// Removable dividers: plates left to right, front to back, or both interlocking (egg-crate grid).
const SLOT_DIRS=['across','along','grid'];
// Custom divider positions: plate centers in mm from the inside left / front wall, as text "30, 62.5, 95" (empty = even).
const posText=v=>{const a=Array.isArray(v)?v:String(v??'').split(/[,;\s]+/);return a.map(Number).filter(x=>Number.isFinite(x)&&x>0).slice(0,8).map(x=>+x.toFixed(2)).join(', ');};
/* Drop-in cups for small parts: one per compartment (or an even grid when there are no dividers). Each cup is a
 * separate closed part that prints open side up: 1.2 mm walls and floor, and a rounded bowl floor (0.3 mm steps) so
 * small screws and jets slide to the middle and pick out easily. o: {cells, floorZ, height, clear, railsX, railsY,
 * wall, innerRadius}. Cells are bin-inside rectangles; rails mean ribs stand 1.4 mm proud on those walls. */
const CUP={wall:1.2,floor:1.2,step:.3,bowl:9,minInside:8};
function dropCups(o){
 const DXm=DX,cups=[],skipped=[],{w,d,wall}=o,c=o.clear,proud=DXm.SLOT.proud,H=Math.max(8,o.height);
 o.cells.forEach((q,k)=>{
  const atL=Math.abs(q.x0-wall)<1e-6,atR=Math.abs(q.x1-(w-wall))<1e-6,atF=Math.abs(q.y0-wall)<1e-6,atB=Math.abs(q.y1-(d-wall))<1e-6;
  const iL=c+(atL&&o.railsX?proud:0),iR=c+(atR&&o.railsX?proud:0),iF=c+(atF&&o.railsY?proud:0),iB=c+(atB&&o.railsY?proud:0);
  const x0=q.x0+iL,x1=q.x1-iR,y0=q.y0+iF,y1=q.y1-iB,cw=x1-x0,cd=y1-y0;
  if(cw-2*CUP.wall<CUP.minInside||cd-2*CUP.wall<CUP.minInside){skipped.push(k);return;}
  const r=Math.min(Math.max(3,o.innerRadius||0),cw/2-.3,cd/2-.3),ir=Math.max(.5,r-CUP.wall),iw=cw-2*CUP.wall,id=cd-2*CUP.wall;
  const Rb=Math.max(1,Math.min(CUP.bowl,(Math.min(iw,id)-3)/2,H-CUP.floor-2)),outer=T.roundRect(0,0,cw,cd,r,24),layers=[{z0:0,z1:CUP.floor,polys:[poly(outer)]}];
  const ring=e=>[{outer,holes:[T.roundRect(CUP.wall+e,CUP.wall+e,cw-CUP.wall-e,cd-CUP.wall-e,Math.max(.5,ir-Math.min(e,ir-.5)),24).slice().reverse()]}];
  const n=Math.max(1,Math.ceil(Rb/CUP.step));for(let i=0;i<n;i++){const za=CUP.floor+Rb*i/n,zb=CUP.floor+Rb*(i+1)/n,u=Rb*(i+.5)/n,e=Rb-Math.sqrt(Math.max(0,Rb*Rb-(Rb-u)*(Rb-u)));layers.push({z0:za,z1:zb,polys:ring(e)});}
  layers.push({z0:CUP.floor+Rb,z1:H,polys:ring(0)});
  let m=T.steppedExtrude(layers);for(let i=0;i<m.length;i++)m[i]=Math.round(m[i]*1e5)/1e5;
  if(!C.checkClosed(m).closed&&C.fixTJunctions){for(const tol of [1e-4,1e-3,5e-3]){m=Float64Array.from(C.fixTJunctions(m,new Array(m.length/9).fill(0),tol).p);if(C.checkClosed(m).closed)break;}}
  const worn=new Float64Array(m.length);for(let i=0;i<m.length;i+=3){worn[i]=m[i]+x0;worn[i+1]=m[i+1]+y0;worn[i+2]=m[i+2]+o.floorZ;}
  cups.push({local:m,worn,w:cw,d:cd,h:H,index:k,bowl:+Rb.toFixed(1),inside:[+iw.toFixed(1),+id.toFixed(1)]});});
 return {cups,skipped};
}
function evenCells(w,d,wall,nx,ny){const iw=w-2*wall,id=d-2*wall,out=[];for(let j=0;j<ny;j++)for(let i=0;i<nx;i++)out.push({x0:wall+iw*i/nx,x1:wall+iw*(i+1)/nx,y0:wall+id*j/ny,y1:wall+id*(j+1)/ny});return out;}

const BIN_TYPES=['bin','bottomless','divider'];
function styleDefaults(o={}){
 // Bin type: 'bin' (floor), 'bottomless' (walls only, whole floor removed) or 'divider' (walls-only separator frame).
 const binType=BIN_TYPES.includes(o.binType)?o.binType:null,openType=binType==='bottomless'||binType==='divider';
 const gridBase=openType?false:!!o.gridBase;
 // Grid base needs a solid floor; walls-only is incompatible.
 const noFloor=openType?true:binType==='bin'?false:gridBase?false:!!o.noFloor;
 return {
  scoop:noFloor?false:!!o.scoop,scoopDepth:clamp(o.scoopDepth??16,4,60),scoopWidth:clamp(o.scoopWidth??46,16,120),
  magnets:!!o.magnets,magD:clamp(o.magD??6,3,12),magH:clamp(o.magH??2,1,5),magClear:clamp(o.magClear??.15,0,.6),
  labelTab:['front','back'].includes(o.labelTab)?o.labelTab:'none',
  labelAngle:o.labelAngle===0?0:45,labelStyle:o.labelStyle==='embossed'?'embossed':'raised',
  labelText:String(o.labelText||'').slice(0,24),
  stack:noFloor?false:!!o.stack,stackClear:clamp(o.stackClear??.3,.1,.8),
  frontLabel:['engraved','raised'].includes(o.frontLabel)?o.frontLabel:'none',frontText:String(o.frontText||'').slice(0,16),
  slots:noFloor?'none':SLOT_DIRS.includes(o.slots)?o.slots:'none',slotCount:clamp(Math.round(o.slotCount??2),1,8),slotClear:clamp(o.slotClear??.3,.15,.6),
  slotCountY:clamp(Math.round(o.slotCountY??2),1,8),slotT:clamp(+(o.slotT??1.6)||1.6,1.2,3),slotH:clamp(+(o.slotH??1)||1,.2,1),slotPos:posText(o.slotPos),slotPosY:posText(o.slotPosY),slotTab:!!o.slotTab,
  cups:noFloor?false:!!o.cups,cupNx:clamp(Math.round(o.cupNx??3),1,12),cupNy:clamp(Math.round(o.cupNy??2),1,12),cupClear:clamp(+(o.cupClear??.5),.2,1.5),
  floorFillet:noFloor?0:clamp(o.floorFillet??0,0,8),
  lid:['flat','lip','magnet','slide'].includes(o.lid)?o.lid:'none',
  lidT:clamp(o.lidT??2,1.2,6),lidClear:clamp(o.lidClear??.25,.05,.8),
  lidMag:o.lidMag==='8x3'?'8x3':'6x2',lidMagFit:o.lidMagFit==='glue'?'glue':'press',lidLabel:!!o.lidLabel,lidText:String(o.lidText||'').slice(0,20),
  lidTextStyle:o.lidTextStyle==='engraved'?'engraved':'raised',lidGrab:['knob','tab','notch','hole'].includes(o.lidGrab)?o.lidGrab:'none',lidGridTop:!!o.lidGridTop,lidDeco:DECO()?DECO().norm(o.lidDeco):null,
  honeycomb:!!o.honeycomb,honeyCell:clamp(o.honeyCell??10,6,30),
  noFloor,footFlange:noFloor&&!!o.footFlange,binType:binType||(noFloor?'bottomless':'bin'),
  gridBase,gridHeightUnits:!!o.gridHeightUnits,gridFoot:footMode(o.gridFoot),
  gridNx:o.gridNx!=null?clamp(Math.round(+o.gridNx),1,30):null,
  gridNy:o.gridNy!=null?clamp(Math.round(+o.gridNy),1,30):null
 };
}

function resolveStyle(bin,globals={}){
 const g=styleDefaults(globals),b=bin||{};
 const pick=(k,bool)=>Object.hasOwn(b,k)?(bool?!!b[k]:b[k]):g[k];
 const binType=BIN_TYPES.includes(b.binType)?b.binType:null,openType=binType==='bottomless'||binType==='divider';
 const gridBase=openType?false:!!pick('gridBase',true);
 const noFloor=openType?true:binType==='bin'?false:gridBase?false:!!pick('noFloor',true);
 // Walls-only bins: no floor, so scoops / floor fillet / stacking foot do not apply.
 // Grid base implies a floor and replaces the simple stacking foot.
 return styleDefaults({
  scoop:noFloor?false:pick('scoop',true),scoopDepth:pick('scoopDepth'),scoopWidth:pick('scoopWidth'),
  magnets:false,magD:pick('magD'),magH:pick('magH'),magClear:pick('magClear'),  // floor magnet pockets removed; ignore saved magnets=1
  labelTab:pick('labelTab'),labelAngle:pick('labelAngle'),labelStyle:pick('labelStyle'),labelText:pick('labelText'),
  stack:noFloor?false:pick('stack',true),stackClear:pick('stackClear'),
  frontLabel:pick('frontLabel'),frontText:pick('frontText'),slots:noFloor?'none':pick('slots'),slotCount:pick('slotCount'),slotClear:pick('slotClear'),slotCountY:pick('slotCountY'),slotT:pick('slotT'),slotH:pick('slotH'),slotPos:pick('slotPos'),slotPosY:pick('slotPosY'),slotTab:pick('slotTab',true),cups:noFloor?false:pick('cups',true),cupNx:pick('cupNx'),cupNy:pick('cupNy'),cupClear:pick('cupClear'),floorFillet:noFloor?0:pick('floorFillet'),
  lid:pick('lid'),lidT:pick('lidT'),lidClear:pick('lidClear'),lidMag:pick('lidMag'),lidMagFit:pick('lidMagFit'),lidLabel:pick('lidLabel',true),lidText:pick('lidText'),lidTextStyle:pick('lidTextStyle'),lidGrab:pick('lidGrab'),lidGridTop:pick('lidGridTop',true),lidDeco:pick('lidDeco'),
  honeycomb:pick('honeycomb',true),honeyCell:pick('honeyCell'),
  noFloor,binType:binType||(noFloor?'bottomless':'bin'),footFlange:Object.hasOwn(b,'footFlange')?!!b.footFlange:!!g.footFlange,
  gridBase,gridHeightUnits:!!pick('gridHeightUnits',true),gridFoot:pick('gridFoot'),
  gridNx:Object.hasOwn(b,'gridNx')?b.gridNx:g.gridNx,gridNy:Object.hasOwn(b,'gridNy')?b.gridNy:g.gridNy
 });
}

function clampStyleChanges(changes){
 const out={};for(const [k,v]of Object.entries(changes||{})){
  if(v==null){out[k]=null;continue;}
  if(k==='lidMag'){out[k]=v==='8x3'?'8x3':'6x2';continue;}
  if(k==='lidMagFit'){out[k]=v==='glue'?'glue':'press';continue;}
  if(k==='lidTextStyle'){out[k]=v==='engraved'?'engraved':'raised';continue;}
  if(k==='lidGrab'){out[k]=['knob','tab','notch','hole','none'].includes(v)?v:'none';continue;}
  if(k==='lidText'){out[k]=String(v).slice(0,20);continue;}
  if(k==='lidDeco'){out[k]=DECO()?DECO().norm(v):null;continue;}
  if(k==='frontLabel'){out[k]=['engraved','raised'].includes(v)?v:'none';continue;}
  if(k==='frontText'){out[k]=String(v).slice(0,16);continue;}
  if(k==='slots'){out[k]=SLOT_DIRS.includes(v)?v:'none';continue;}
  if(k==='slotCountY'||k==='cupNx'||k==='cupNy'){out[k]=clamp(Math.round(+v)||1,1,k==='slotCountY'?8:12);continue;}
  if(k==='slotT'){out[k]=clamp(+v||1.6,1.2,3);continue;}
  if(k==='slotH'){out[k]=clamp(+v||1,.2,1);continue;}
  if(k==='cupClear'){out[k]=clamp(+v||.5,.2,1.5);continue;}
  if(k==='slotPos'||k==='slotPosY'){out[k]=posText(v);continue;}
  if(k==='slotTab'||k==='cups'){out[k]=v?1:0;continue;}
  if(k==='slotCount'){out[k]=clamp(Math.round(+v)||1,1,8);continue;}
  if(k==='slotClear'){out[k]=clamp(+v||.3,.15,.6);continue;}
  if(k==='scoop'||k==='magnets'||k==='stack'||k==='honeycomb'||k==='lidLabel'||k==='lidGridTop'||k==='noFloor'||k==='footFlange'||k==='gridBase'||k==='gridHeightUnits'){out[k]=v?1:0;continue;}
  if(k==='binType'){out[k]=BIN_TYPES.includes(v)?v:'bin';continue;}
  if(k==='labelTab'){out[k]=['front','back','none'].includes(v)?v:'none';continue;}
  if(k==='labelAngle'){out[k]=+v===0?0:45;continue;}
  if(k==='labelStyle'){out[k]=v==='embossed'?'embossed':'raised';continue;}
  if(k==='labelText'){out[k]=String(v).slice(0,24);continue;}
  if(k==='lid'){out[k]=['none','flat','lip','magnet','slide'].includes(v)?v:'none';continue;}
  if(k==='gridNx'||k==='gridNy'){out[k]=clamp(Math.round(+v),1,30);continue;}
  if(['wall','radius','height','scoopDepth','scoopWidth','magD','magH','magClear','stackClear','floorFillet','lidT','lidClear','honeyCell'].includes(k)&&Number.isFinite(+v)){
   const lim={wall:[.8,6],radius:[0,150],height:[6,298],scoopDepth:[4,60],scoopWidth:[16,120],magD:[3,12],magH:[1,5],magClear:[0,.6],stackClear:[.1,.8],floorFillet:[0,8],lidT:[1.2,6],lidClear:[.05,.8],honeyCell:[6,30]}[k];
   out[k]=clamp(+v,lim[0],lim[1]);
  }
 }return out;
}

// Plan-view inside corner radius. Unset (null/undefined) keeps the old look: max(0, outside - wall).
function clampInnerRadius(requested,w,d,wall,outerRadius){
 wall=+wall;outerRadius=+outerRadius;
 const iw=Math.max(0,w-2*wall),id=Math.max(0,d-2*wall),cap=Math.max(0,Math.min(iw,id)/2-.01);
 const raw=requested==null||requested===''?Math.max(0,outerRadius-wall):+requested;
 return Math.min(clamp(Number.isFinite(raw)?raw:0,0,150),cap);
}
function magnetCentres(w,d,radius,magD,wall){
 const r=magD/2,m=Math.max(wall+r+1.2,radius>0?radius*.55+r:.0,r+2.5);
 if(w<2*m+2||d<2*m+2)return [];
 return [[m,m],[w-m,m],[w-m,d-m],[m,d-m]];
}

function kitchenSlices(mesh,cuts,minZ=-Infinity){const result=[],clip=(vs,x,keep)=>{const out=[];for(let i=0;i<vs.length;i++){const a=vs[i],b=vs[(i+1)%vs.length],A=keep*(a[0]-x)>=-1e-10,B=keep*(b[0]-x)>=-1e-10;if(A)out.push(a);if(A!==B){const t=(x-a[0])/(b[0]-a[0]);out.push([x,a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])]);}}return out;};
 for(let i=0;i<mesh.length;i+=9){const tri=[Array.from(mesh.slice(i,i+3)),Array.from(mesh.slice(i+3,i+6)),Array.from(mesh.slice(i+6,i+9))];if(Math.max(...tri.map(p=>p[2]))<minZ){result.push(...tri.flat());continue;}const lo=Math.min(...tri.map(p=>p[0])),hi=Math.max(...tri.map(p=>p[0])),xs=[lo,...cuts.filter(x=>x>lo+1e-8&&x<hi-1e-8),hi];if(hi-lo<1e-8){result.push(...tri.flat());continue;}for(let j=0;j<xs.length-1;j++){const p=clip(clip(tri,xs[j],1),xs[j+1],-1);for(let k=1;k<p.length-1;k++){const a=p[0],b=p[k],c=p[k+1],u=b.map((v,n)=>v-a[n]),v=c.map((v,n)=>v-a[n]);if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-9)result.push(...a,...b,...c);}}}return Float64Array.from(result);
}

function applyScoop(mesh,w,d,h,wall,floor,radius,style){
 if(!style.scoop)return mesh;
 const sw=Math.min(style.scoopWidth,w-2*Math.max(radius,wall)-4),depth=Math.min(style.scoopDepth,(h-floor)*.75);
 if(sw<10||depth<2)return mesh;
 const cuts=Array.from({length:65},(_,i)=>w/2-sw/2+sw*i/64);
 let out=kitchenSlices(mesh,cuts,h-1e-6);
 for(let i=0;i<out.length;i+=3)if(Math.abs(out[i+2]-h)<1e-7&&out[i+1]<=wall+1e-6){const x=Math.abs(out[i]-w/2);if(x<sw/2)out[i+2]-=depth*(1+Math.cos(2*Math.PI*x/sw))/2;}
 return out;
}

// Printable label text: accents folded (Spanish too), upper case, only glyphs the label font has, 16 characters at most.
function cleanLabel(text,max=16){return String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ./-]/g,'').replace(/\s+/g,' ').trim().slice(0,max);}
// Fit check for label lettering: the letters are scaled down to the space, never past it. ok=false when they would
// end up too small to print and read (strokes under 0.5 mm, letters under 2.5 mm tall).
const LABEL_MIN_H=2.5;
function labelFit(text,height,maxWidth){const t=cleanLabel(text);if(!t)return {text:t,ok:true,letterH:0,width:0,maxChars:0};const tl=C.textLoops(t),scale=Math.min(height/5,maxWidth/Math.max(1,tl.W)),per=tl.W/Math.max(1,t.length);
 return {text:t,ok:scale*5>=LABEL_MIN_H-1e-9,letterH:scale*5,width:tl.W*scale,maxChars:Math.max(1,Math.floor(maxWidth/((LABEL_MIN_H/5)*per)))};}
// The label tab's lettering space (same numbers the tab geometry uses), for fit checks in the UI and tests.
function labelTabBox(w,d,wall,radius,labelAngle=45,back=false){const depth=Math.min(labelAngle===0?10:12,Math.max(8,(d-2*wall)*.28)),x0=Math.max(wall+2,radius>0?radius+.5:wall+2),x1=Math.min(w-wall-2,radius>0?w-radius-.5:w-wall-2),tabY0=back?d-wall-depth:wall,tabY1=back?d-wall:wall+depth;
 return {x0,x1,tabY0,tabY1,depth,cx:(x0+x1)/2,cy:(tabY0+tabY1)/2,height:Math.min(3.8,depth*.5),maxWidth:x1-x0-4,ok:x1-x0>=24};}
function labelLoops(text,cx,cy,height,maxWidth){
 const tl=C.textLoops(cleanLabel(text)||'LABEL');
 const scale=Math.min(height/5,maxWidth/Math.max(1,tl.W)),positive=[],negative=[];
 for(const L of tl.loops){let area=0;L.forEach((p,i)=>{const q=L[(i+1)%L.length];area+=p[0]*q[1]-q[0]*p[1];});(area>0?positive:negative).push(poly(L.map(p=>[cx+(p[0]-tl.W/2)*scale,cy+p[1]*scale])));}
 return negative.length?T.diffPolys(T.unionPolys(positive),negative):T.unionPolys(positive);
}


function attachGridFeet(mesh,w,d,nx,ny,floor,opts={}){
 // Shift an existing bin mesh up and place the standard grid feet + bridge under it.
 nx=nx||gridUnitsFor(w);ny=ny||gridUnitsFor(d);
 const outerSz=gridOuter(nx,ny);w=outerSz.w;d=outerSz.d;
 const deck=deckFor(floor,opts.foot),floorEff=GRID.baseH+deck;
 let base=T.clipActive&&T.clipActive()?T.steppedExtrude(gridBaseFineLayers(nx,ny,w,d,floorEff,{foot:footMode(opts.foot)})):gridBaseSolid(nx,ny,floorEff,{foot:footMode(opts.foot)});for(let i=0;i<base.length;i++)base[i]=Math.round(base[i]*1e5)/1e5;
 const lifted=new Float64Array(mesh.length);for(let i=0;i<mesh.length;i++)lifted[i]=i%3===2?mesh[i]+floorEff:mesh[i];
 let out=new Float64Array(base.length+lifted.length);out.set(base,0);out.set(lifted,base.length);
 if(!C.checkClosed(out).closed&&C.fixTJunctions){for(const tol of[1e-4,1e-3,5e-3]){out=Float64Array.from(C.fixTJunctions(out,new Array(out.length/9).fill(0),tol).p);if(C.checkClosed(out).closed)break;}}
 let zmax=0;for(let i=2;i<out.length;i+=3)zmax=Math.max(zmax,out[i]);
 return {mesh:out,w,d,floor:floorEff,height:zmax,grid:{nx,ny,label:nx+'\u00d7'+ny,foot:footMode(opts.foot)}};
}

// Build a bin with Batch A/B features. Returns {mesh, lids:[], floor, info}.
// Rib tops sit 1 mm under the rim, or under a friction lid's 4 mm lip.
const SLOTTOP=style=>LIDS.kind(style.lid)==='friction'?4.5:1;
function buildBin(w,d,h,wall,floor,radius,style={},opts={}){
 style=styleDefaults(style);if(LIDS.kind(style.lid))style.stack=false; // a lid replaces the stacking lip
 if(style.slots!=='none'||style.cups)style.floorFillet=0; // plates and cups stand square on the floor
 w=+w;d=+d;h=+h;wall=+wall;radius=Math.min(+radius,w/2-.01,d/2-.01);
 let innerRadius=clampInnerRadius(opts.innerRadius,w,d,wall,radius);
 // Walls-only lattices need a stiffer minimum wall so junctions stay rigid on the bed.
 if(style.noFloor)wall=Math.max(wall,1.8);
 let floorEff=+floor;
 let gridInfo=null;
 if(style.gridBase){
  const nx=style.gridNx||gridUnitsFor(w),ny=style.gridNy||gridUnitsFor(d);
  const outerSz=gridOuter(nx,ny);w=outerSz.w;d=outerSz.d;
  // Spec outer corner radius for the 42 mm grid body.
  radius=Math.min(GRID.rTop,w/2-.01,d/2-.01);
  innerRadius=clampInnerRadius(opts.innerRadius,w,d,wall,radius);
  if(style.gridHeightUnits){const sn=gridSnapHeight(h,true);h=sn.h;gridInfo={nx,ny,u:sn.u,label:`${nx}\u00d7${ny} \u00b7 ${sn.u}u`};}
  else gridInfo={nx,ny,u:null,label:`${nx}\u00d7${ny}`};
  gridInfo.foot=style.gridFoot;
  // Interior floor sits on top of the 4.75 mm foot, with at least the requested floor thickness as a solid bridge.
  const deck=deckFor(floor,style.gridFoot);
  floorEff=GRID.baseH+deck;
  if(style.gridHeightUnits){/* height already snapped to 7 mm units; keep deck inside it */}
  if(h<floorEff+6)h=floorEff+6;
 }
 const outer=T.roundRect(0,0,w,d,radius,32),inner=T.roundRect(wall,wall,w-wall,d-wall,innerRadius,32);
 const O=[poly(outer)],ring=[{outer,holes:[inner.slice().reverse()]}],layers=[],info={magnets:false,scoop:!!style.scoop,label:null,stack:!!style.stack,floorFillet:style.floorFillet,lid:style.lid,honeycomb:!!style.honeycomb,noFloor:!!style.noFloor,footFlange:!!style.footFlange&&!!style.noFloor,gridBase:!!style.gridBase,grid:gridInfo,innerRadius};

 const lipH=style.stack&&!style.noFloor&&!style.gridBase?2.2:0,footH=style.stack&&!style.noFloor&&!style.gridBase?1.8:0,clear=style.stackClear;
 let wallTop=h,wallBottom=floorEff;

 if(style.gridBase){
  // Grid feet (one per 42 mm cell, true 45\u00b0 chamfers) + transition into the bin floor are joined after the body is
  // built (joinGridBase); the body starts with the wall ring at the interior floor. Pieces of a split bin use the
  // layered version so the piece cut and dovetails apply to it. No magnet holes.
  if(T.clipActive&&T.clipActive())layers.push(...gridBaseFineLayers(gridInfo.nx,gridInfo.ny,w,d,floorEff,{foot:style.gridFoot}));
  wallBottom=floorEff;wallTop=h-(style.stack?DX.LIP.h:0);
  if(style.stack&&wallTop<floorEff+8)throw Error('This bin is too short for a stacking lip. Make it taller or turn stacking off.');
 }else if(style.noFloor){
  // Open wall lattice: no solid floor. Optional foot flange for bed adhesion and tip resistance.
  floorEff=0;wallBottom=0;wallTop=h;
  if(style.footFlange){
   // Thin perimeter lip on the inside of the walls (never past the footprint, so neighboring bins still fit).
   const lipW=Math.min(3.2,Math.max(0,Math.min(w,d)/2-wall-4)),flangeH=.9,fi=T.roundRect(wall+lipW,wall+lipW,w-wall-lipW,d-wall-lipW,Math.max(0,innerRadius-lipW),32);
   layers.push({z0:0,z1:flangeH,polys:[{outer,holes:[fi.slice().reverse()]}]});
   layers.push({z0:flangeH,z1:h,polys:ring});
   wallBottom=flangeH;
  }else layers.push({z0:0,z1:h,polys:ring});
 }else{
  // Solid floor (floor magnet pockets removed). Magnet lids still use magnetCentres below.
  layers.push({z0:0,z1:floorEff,polys:O});
  // Stacking: lip on top rim + recessed foot under the floor (Batch B).
  if(style.stack){
   const footOuter=T.roundRect(wall+clear,wall+clear,w-wall-clear,d-wall-clear,Math.max(0,innerRadius-clear),24);
   layers.length=0;
   layers.push({z0:0,z1:footH,polys:[{outer,holes:[footOuter.slice().reverse()]}]});
   layers.push({z0:footH,z1:floorEff+footH,polys:O});
   wallBottom=floorEff+footH;wallTop=h+footH;floorEff=wallBottom;
  }
 }

 // Honeycomb walls (Batch C): hex holes in the wall ring, solid floor and solid top rim.
 // Walls-only (noFloor) already pushed its wall layers above; skip re-adding a solid wall band.
 if(style.noFloor){ /* wall lattice already in layers */ }
 else if(style.honeycomb&&!opts.skipHoney){
  const cell=style.honeyCell,hexR=cell/Math.sqrt(3),web=1.6,rim=Math.max(4,wall*2),holes=[];
  const ix0=wall+rim,ix1=w-wall-rim,iy0=wall+rim,iy1=d-wall-rim;
  const pitchX=cell+web,pitchY=hexR*1.5+web;
  for(let row=0,y=iy0+hexR;y<=iy1-hexR;row++,y+=pitchY){
   const xOff=(row%2)*(pitchX/2);
   for(let x=ix0+hexR+xOff;x<=ix1-hexR;x+=pitchX){
    const hx=T.circle?null:null; // hex
    const hex=Array.from({length:6},(_,j)=>[x+hexR*Math.cos(j*Math.PI/3+Math.PI/6),y+hexR*Math.sin(j*Math.PI/3+Math.PI/6)]);
    // Keep holes away from rounded corners.
    if(hex.every(([px,py])=>{if(innerRadius<=0)return true;const cx=px<wall+innerRadius?wall+innerRadius:px>w-wall-innerRadius?w-wall-innerRadius:px,cy=py<wall+innerRadius?wall+innerRadius:py>d-wall-innerRadius?d-wall-innerRadius:py;return Math.hypot(px-cx,py-cy)<=innerRadius-wall*.25;}))holes.push(poly(hex));
   }
  }
  const midTop=wallTop-rim;
  if(holes.length&&midTop>wallBottom+2){
   layers.push({z0:wallBottom,z1:wallBottom+1.2,polys:ring});
   layers.push({z0:wallBottom+1.2,z1:midTop,polys:T.diffPolys(ring,holes)});
   layers.push({z0:midTop,z1:wallTop,polys:ring});
  }else layers.push({z0:wallBottom,z1:wallTop,polys:ring});
 }else layers.push({z0:wallBottom,z1:wallTop,polys:ring});

 // Stacking lip on the outside top edge.
 if(style.stack){
  const lipOut=T.roundRect(-.01,-.01,w+.01,d+.01,radius,24),lipIn=T.roundRect(clear,clear,w-clear,d-clear,Math.max(0,radius-clear),24);
  layers.push({z0:wallTop,z1:wallTop+lipH,polys:[{outer:lipOut,holes:[lipIn.slice().reverse()]}]});
 }

 // Label tab: union a support-free shelf into the upper wall band (45\u00b0 stepped or flat).
 let pendingLabel=null;
 if(style.labelTab!=='none'){
  const back=style.labelTab==='back',depth=Math.min(style.labelAngle===0?10:12,Math.max(8,(d-2*wall)*.28));
  const x0=Math.max(wall+2,radius>0?radius+.5:wall+2),x1=Math.min(w-wall-2,radius>0?w-radius-.5:w-wall-2);
  if(x1-x0>=24&&wallTop-wallBottom>8){
   const steps=style.labelAngle===0?1:6,band=Math.min(depth,wallTop-wallBottom-2);
   const wallLayer=layers.pop();
   const splitZ=wallTop-band;
   if(wallLayer&&wallLayer.z0<splitZ-1e-6)layers.push({z0:wallLayer.z0,z1:splitZ,polys:wallLayer.polys});
   for(let s=0;s<steps;s++){
    const t0=s/steps,t1=(s+1)/steps,z0=splitZ+band*t0,z1=splitZ+band*t1;
    const reach=style.labelAngle===0?depth:depth*t1;
    const tabY0=back?d-wall-reach:wall,tabY1=back?d-wall:wall+reach;
    const shelf=poly(T.roundRect(x0,tabY0,x1,tabY1,.5,10));
    layers.push({z0,z1,polys:T.unionPolys(ring.concat([shelf]))});
   }
   const text=style.labelText.trim(),tabY0=back?d-wall-depth:wall,tabY1=back?d-wall:wall+depth;
   if(text){
    const loops=labelLoops(text,(x0+x1)/2,(tabY0+tabY1)/2,Math.min(3.8,depth*.5),x1-x0-4);
    if(loops.length){
     if(style.labelStyle==='embossed'){const last=layers[layers.length-1];last.polys=T.diffPolys(last.polys,loops);}
     else pendingLabel={loops,z0:wallTop,z1:wallTop+.55,text,side:style.labelTab,angle:style.labelAngle,style:style.labelStyle};
     info.label={text,side:style.labelTab,angle:style.labelAngle,style:style.labelStyle};
    }
   }else info.label={text:'',side:style.labelTab,angle:style.labelAngle,style:style.labelStyle};
  }
 }

 // 42 mm grid stacking lip: the next bin's feet key into it.
 if(style.stack&&style.gridBase){info.stackLip=DX.gridLip(layers,{w,d,radius,wall,wallTop});}
 const lipTop=wallTop+(info.stackLip?info.stackLip.height:0);
 // Lid magnets (corner posts with pockets at the rim) and the finger notch in the front rim.
 const lidBin=LIDS.applyToBin(layers,{w,d,radius,wall,floorZ:wallBottom,rimZ:wallTop,style});
 if(lidBin.magnet)info.lidMagnets=lidBin.magnet;if(lidBin.notch)info.lidNotch=lidBin.notch;
 // Removable dividers: rib pairs on two walls plus separate slide-in plates.
 let slotRibs=null,plates=[],slotGeo=null;
 if(style.slots!=='none'&&!style.noFloor){
  const top=wallTop-SLOTTOP(style);
  const r=DX.slots(layers,{dir:style.slots,count:style.slotCount,countY:style.slotCountY,clear:style.slotClear,t:style.slotT,hFrac:style.slotH,pos:style.slotPos,posY:style.slotPosY,tab:style.slotTab,w,d,wall,innerRadius,floorZ:wallBottom,topZ:top,chamfer:0});
  plates=r.plates;info.slots=r.info;slotRibs=layers.filter(L=>Math.abs(L.z0-wallBottom)<1e-6).flatMap(L=>L.polys);slotGeo=r;
 }
 // Drop-in cups: one per compartment between the plates, or an even grid in a bin without dividers.
 let cups=[];
 if(style.cups&&!style.noFloor&&!(T.clipActive&&T.clipActive())){ // pieces of a split bin only need the bin itself
  const top=wallTop-SLOTTOP(style),cellsIn=slotGeo?slotGeo.cells:evenCells(w,d,wall,style.cupNx,style.cupNy);
  const H=slotGeo?slotGeo.height-.5:Math.max(8,style.slotH*(top-wallBottom));
  const r=dropCups({cells:cellsIn,floorZ:wallBottom,height:H,clear:style.cupClear,railsX:!!slotGeo?.railsX,railsY:!!slotGeo?.railsY,w,d,wall,innerRadius});
  cups=r.cups;info.cups={count:cups.length,skipped:r.skipped.length,clear:style.cupClear,height:+H.toFixed(1),bowl:cups[0]?.bowl??0,size:cups[0]?[+cups[0].w.toFixed(1),+cups[0].d.toFixed(1)]:null};
  if(!cups.length)info.cups.note='The compartments are too small for drop-in cups; use fewer dividers or a bigger bin.';
 }
 // Compartments for the display-only small parts in the preview (bin coordinates, z above the bin floor).
 if(cups.length)info.smallCells=cups.map(cp=>{const b=C.bbox(cp.worn);return {x0:b.min[0]+CUP.wall,x1:b.max[0]-CUP.wall,y0:b.min[1]+CUP.wall,y1:b.max[1]-CUP.wall,z:b.min[2]+CUP.floor,bowl:cp.bowl};});
 else if(slotGeo)info.smallCells=slotGeo.cells.map(q=>({x0:q.x0+(slotGeo.railsX&&Math.abs(q.x0-wall)<1e-6?DX.SLOT.proud:0),x1:q.x1-(slotGeo.railsX&&Math.abs(q.x1-(w-wall))<1e-6?DX.SLOT.proud:0),y0:q.y0+(slotGeo.railsY&&Math.abs(q.y0-wall)<1e-6?DX.SLOT.proud:0),y1:q.y1-(slotGeo.railsY&&Math.abs(q.y1-(d-wall))<1e-6?DX.SLOT.proud:0),z:wallBottom,bowl:0}));
 // Label text on the outside of the front wall.
 if(style.frontLabel!=='none'){const f=DX.frontLabel(layers,{w,d,radius,wall,zLow:wallBottom+1.5,zHigh:wallTop-2,text:style.frontText,style:style.frontLabel});if(f)info.front=f;}
 const joinRing=slotRibs?T.unionPolys(slotRibs):lidBin.posts?T.unionPolys(ring.concat(lidBin.posts)):ring;

 let mesh=T.steppedExtrude(layers);
 for(let i=0;i<mesh.length;i++)mesh[i]=Math.round(mesh[i]*1e5)/1e5;
 if(style.gridBase&&!(T.clipActive&&T.clipActive())){mesh=joinGridBase(mesh,gridInfo.nx,gridInfo.ny,floorEff,joinRing,{foot:style.gridFoot});for(let i=0;i<mesh.length;i++)mesh[i]=Math.round(mesh[i]*1e5)/1e5;}

 // Floor fillet (Batch B): raise interior floor-edge vertices along a quarter-circle.
 if(style.floorFillet>0&&!style.noFloor){
  const R=Math.min(style.floorFillet,wall*2,(h-floorEff)*.8),f=floorEff;
  for(let i=0;i<mesh.length;i+=3){
   if(Math.abs(mesh[i+2]-f)>1e-6)continue;
   const x=mesh[i],y=mesh[i+1];
   // Distance to nearest interior wall.
   const dx=Math.min(x-wall,(w-wall)-x),dy=Math.min(y-wall,(d-wall)-y);
   if(dx>=0&&dy>=0&&(dx<R||dy<R)){
    // Only fillet near the wall/floor joint: points within R of a wall on the floor plane.
    const dist=Math.min(dx,dy);
    if(dist<R)mesh[i+2]=f+(R-Math.sqrt(Math.max(0,R*R-(R-dist)*(R-dist))));
   }
  }
 }

 // Scoop after solid build (same cosine profile as kitchen trays). Raised labels are added after so scoop slicing cannot open them.
 const rimZ=info.stackLip?lipTop:wallTop+(style.stack?lipH:0);
 mesh=style.noFloor?mesh:applyScoop(mesh,w,d,rimZ,wall,floorEff,radius,style);
 if(pendingLabel){
  const letter=T.steppedExtrude([{z0:pendingLabel.z0,z1:pendingLabel.z1,polys:pendingLabel.loops}]);
  const joined=new Float64Array(mesh.length+letter.length);joined.set(mesh,0);joined.set(letter,mesh.length);mesh=joined;
  wallTop=Math.max(wallTop,pendingLabel.z1);
 }

 if(!C.checkClosed(mesh).closed&&C.fixTJunctions){
  for(const tol of [1e-4,1e-3,5e-3,2e-2]){mesh=Float64Array.from(C.fixTJunctions(mesh,new Array(mesh.length/9).fill(0),tol).p);if(C.checkClosed(mesh).closed)break;}
 }
 // Independent inside/outside radii can leave T-junction cracks; MeshDoctor seals them without changing the profile.
 if(!C.checkClosed(mesh).closed&&MD&&MD.repair){mesh=MD.repair(mesh,{}).p;}
 if(!C.checkClosed(mesh).closed)throw Error('Bin extras could not form a closed solid. Adjust scoop, label tab, stacking or corner roundness and try again.');

 // Lids (Batch C) as separate parts.
 const lids=[];
 if(style.lid!=='none'){
  const clear=style.lidClear,lidT=style.lidT;
  if(style.lid==='flat'){
   lids.push({name:'lid_flat',local:T.steppedExtrude([{z0:0,z1:lidT,polys:O}]),w,d,h:lidT});
  }else if(LIDS.kind(style.lid)){
   const lid=LIDS.buildLid({w,d,radius,wall,innerRadius,binH:h,style,grid:gridInfo?{nx:gridInfo.nx,ny:gridInfo.ny}:null});
   if(lid){lids.push(lid);info.lidInfo=lid.info;info.lidNotes=lid.notes;}
  }else if(style.lid==='slide'){
   // Slide-over: lid larger by clear, with inner recess that slips over outside walls.
   const OW=w+2*clear,OD=d+2*clear,OR=radius+clear,outerL=T.roundRect(0,0,OW,OD,OR,32);
   const recess=T.roundRect(clear,clear,OW-clear,OD-clear,Math.max(0,OR-clear),24);
   const lipW=wall*.9,inner=T.roundRect(clear+lipW,clear+lipW,OW-clear-lipW,OD-clear-lipW,Math.max(0,OR-clear-lipW),24);
   lids.push({name:'lid_slide_over',local:T.steppedExtrude([{z0:0,z1:lidT,polys:[poly(outerL)]},{z0:lidT,z1:lidT+Math.min(5,h/3),polys:[{outer:recess,holes:[inner.slice().reverse()]}]}]),w:OW,d:OD,h:lidT+Math.min(5,h/3)});
  }
 }

 return {mesh,lids,plates,cups,floor:floorEff,height:info.stackLip?lipTop:wallTop+(style.stack&&!style.gridBase?lipH:0),info,style,w,d,radius,innerRadius};
}

function floorSavings(w,d,h,wall,floor,radius,style={}){
 const Est=G.PrintEstimate||(typeof require==='function'?require('./estimate'):null);
 const base={...styleDefaults(style),scoop:false,stack:false,lid:'none',honeycomb:false,labelTab:'none',floorFillet:0};
 const withF=buildBin(w,d,h,wall,floor,radius,{...base,binType:'bin',noFloor:false,footFlange:false});
 const noF=buildBin(w,d,h,wall,floor,radius,{...base,binType:'bottomless',noFloor:true,footFlange:!!style.footFlange});
 const vol=m=>Math.abs(C.signedVolume(m));
 const v1=vol(withF.mesh),v2=vol(noF.mesh);
 let gramsSaved=null,hoursSaved=null,fmt=null;
 if(Est){const e1=Est.estimate(Est.geometry(withF.mesh)),e2=Est.estimate(Est.geometry(noF.mesh));gramsSaved=e1.grams-e2.grams;hoursSaved=e1.hours-e2.hours;fmt={withFloor:Est.describe(e1),noFloor:Est.describe(e2)};}
 return {volumeWith:v1,volumeWithout:v2,volumeSaved:v1-v2,gramsSaved,hoursSaved,format:fmt,pct:v1>0?100*(v1-v2)/v1:0};
}
const api={labelTabBox,cleanLabel,labelFit,LABEL_MIN_H,BIN_TYPES,SLOT_DIRS,CUP,dropCups,evenCells,posText,SEAMLESS_DECK,deckFor,DRAWER_PRESETS,STYLE_KEYS,GRID,GRID_FOOT_PROFILE,gridBaseSurface,gridBaseSolid,joinGridBase,gridBaseFineLayers,footMode,gridUnitsFor,gridOuter,gridSnapSize,gridSnapHeight,gridFootPolys,buildGridBaseplate,attachGridFeet,styleDefaults,resolveStyle,clampStyleChanges,clampInnerRadius,magnetCentres,applyScoop,buildBin,kitchenSlices,labelLoops,floorSavings};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else G.GPBinFeatures=api;
})(typeof globalThis!=='undefined'?globalThis:this);
