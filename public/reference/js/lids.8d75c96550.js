/* Shared lids for drawer bins and the box maker (GPLids).
 * Proportions follow popular printed storage designs:
 *  - friction lid: a 1.6 mm lip, 4 mm deep, 0.25 mm clear of the walls on every side (0.2 snug \u2026 0.4 loose);
 *  - magnetic lid: 6 \u00d7 2 or 8 \u00d7 3 mm discs in corner posts and the lid; pockets +0.1 mm (press fit) or +0.3 mm
 *    (glue) wide and 0.2 mm deeper than the magnet; at least 1.2 mm of plastic around each pocket;
 *  - label: a 0.6 mm recessed panel; raised letters stop flush with the lid top, engraved letters go 0.6 mm deeper;
 *  - grab: a 20 mm finger hole through the lid (the default), a 14 mm knob (8 mm tall, 45\u00b0 flared base), a 24 \u00d7 7 mm
 *    finger tab, or a U-shaped notch in the bin's front rim.
 * Every lid is built "worn" (z = 0 on the rim, top facing up) and also in the face-down or face-up print orientation
 * that needs no supports: magnetic lids print top up (pockets open on the bed), friction lids print top down (lip up). */
(function(G){'use strict';
const C=G.SplitCore||require('./core'),T=G.StudioTools||require('./tools'),DECO=()=>G.GPLidDeco||(typeof require==='function'?require('./lid-deco'):null);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),poly=outer=>({outer,holes:[]});
const MAGNETS={'6x2':{d:6,h:2,label:'6 \u00d7 2 mm'},'8x3':{d:8,h:3,label:'8 \u00d7 3 mm'}};
const LID={lipH:4,lipW:1.6,clear:.25,panelDepth:.6,engravePanel:.4,engrave:.6,knobD:14,knobH:8,flare:3,pegD:6,pegClear:.15,tabW:24,tabOut:7,holeD:20,notchW:20,notchD:5,skin:1,postMargin:1.2,gridSock:2.6,gridSockW:37.6};
const GRIDP=42,GRIDC=.25;
function magnet(size,fit){const key=MAGNETS[size]?size:'6x2',m=MAGNETS[key],glue=fit==='glue',pd=m.d+(glue?.3:.1);return {size:key,d:m.d,h:m.h,label:m.label,pocketD:pd,r:pd/2,depth:m.h+.2,fit:glue?'glue':'press'};}
// Corner pockets: centre on the corner diagonal with postMargin of plastic to the outside (also on rounded corners).
function magnetLayout(w,d,radius,wall,mag){
 const pr=mag.r,m=LID.postMargin,R=Math.max(0,Math.min(radius,w/2-.01,d/2-.01));
 const k=Math.max(pr+m,R>0?R-(R-pr-m)/Math.SQRT2:0,wall/2+pr+.01),e=k+pr+m;
 if(w<2*e+6||d<2*e+6)return null;
 const centres=[[k,k],[w-k,k],[w-k,d-k],[k,d-k]],O=[poly(T.roundRect(0,0,w,d,R,32))],Oin=T.offset(O,-Math.min(wall/2,.6),true);
 const sq=(x0,y0,x1,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
 const posts=T.interPolys([sq(0,0,e,e),sq(w-e,0,w,e),sq(w-e,d-e,w,d),sq(0,d-e,e,d)],Oin);
 return {k,e,centres,posts,holes:centres.map(([x,y])=>poly(T.circle(x,y,pr,40))),needsPosts:wall<mag.pocketD+2*m};
}
function kind(lid){return lid==='magnet'?'magnet':lid==='lip'||lid==='friction'?'friction':null;}
function plateThickness(st,mag){const k=kind(st.lid),lab=st.lidLabel?(st.lidTextStyle==='engraved'?LID.engravePanel+LID.engrave:LID.panelDepth)+.8:0;let t=Math.max(+st.lidT||2,1.6,lab);if(k==='magnet')t=Math.max(t,mag.depth+LID.skin);if(st.lidDeco&&DECO())t=Math.max(t,DECO().thickNeed(st.lidDeco,k));return Math.round(t*100)/100;}
// Height the lid adds above the bin rim when closed (for drawer headroom).
function stackHeight(st,grid){const k=kind(st.lid);if(!k)return 0;const mag=magnet(st.lidMag,st.lidMagFit),t=plateThickness(st,mag),gridTop=k==='magnet'&&st.lidGridTop&&grid;const dec=!gridTop&&st.lidDeco&&DECO()?DECO().above(st.lidDeco,k):0;return t+(gridTop?LID.gridSock:0)+Math.max(dec,!gridTop&&st.lidGrab==='knob'?LID.knobH:0);}
function splitAt(layers,z){const out=[];for(const L of layers){if(L.z0<z-1e-6&&L.z1>z+1e-6){out.push({...L,z1:z},{...L,z0:z});}else out.push(L);}layers.length=0;layers.push(...out);}
// Bin side: magnet posts + pockets at the rim, and the optional finger notch in the front rim. Mutates layers.
function applyToBin(layers,o){
 const st=o.style,k=kind(st.lid),info={};if(!k)return info;
 const {w,d,radius,wall,floorZ,rimZ}=o;
 if(k==='magnet'){
  const mag=magnet(st.lidMag,st.lidMagFit),ml=magnetLayout(w,d,radius,wall,mag);
  if(!ml)throw Error(`This bin is too small for ${mag.label} lid magnets. Use a larger bin or the friction lid.`);
  if(rimZ-floorZ<mag.depth+2)throw Error('This bin is too short for lid magnet pockets.');
  for(const L of layers)if(L.z0>=floorZ-1e-6&&L.z1<=rimZ+1e-6)L.polys=T.unionPolys(L.polys.concat(ml.posts));
  const pz=rimZ-mag.depth;splitAt(layers,pz);
  for(const L of layers)if(L.z0>=pz-1e-6&&L.z1<=rimZ+1e-6)L.polys=T.diffPolys(L.polys,ml.holes);
  info.magnet={...mag,centres:ml.centres,posts:ml.needsPosts,postSize:ml.e};info.posts=ml.posts;
 }
 if(st.lidGrab==='notch'&&w>=LID.notchW+2*Math.max(radius,wall)+4&&rimZ-floorZ>LID.notchD+4){
  const z0=rimZ-LID.notchD,cuts=[[0,.45,10],[.45,.75,15],[.75,1,LID.notchW]];
  for(const [a] of cuts)splitAt(layers,z0+a*LID.notchD);
  for(const L of layers){if(L.z0<z0-1e-6||L.z1>rimZ+1e-6)continue;const t=((L.z0+L.z1)/2-z0)/LID.notchD,c=cuts.find(q=>t>=q[0]&&t<=q[1]);if(!c)continue;const hw=c[2]/2;L.polys=T.diffPolys(L.polys,[poly([[w/2-hw,-1],[w/2+hw,-1],[w/2+hw,wall+.4],[w/2-hw,wall+.4]])]);}
  info.notch={w:LID.notchW,d:LID.notchD};
 }
 return info;
}
function textPolys(text,cx,cy,height,maxW){
 const s=String(text||'').toUpperCase().replace(/[^A-Z0-9 ./-]/g,'').trim().slice(0,20);if(!s)return [];
 const tl=C.textLoops(s),sc=Math.min(height/5,maxW/Math.max(1,tl.W)),pos=[],neg=[];
 for(const L of tl.loops){let a=0;L.forEach((p,i)=>{const q=L[(i+1)%L.length];a+=p[0]*q[1]-q[0]*p[1];});(a>0?pos:neg).push(poly(L.map(p=>[cx+(p[0]-tl.W/2)*sc,cy+(p[1]-2.5)*sc])));}
 return neg.length?T.diffPolys(T.unionPolys(pos),neg):T.unionPolys(pos);
}
const circ=(x,y,r)=>[poly(T.circle(x,y,r,48))];
// Bands between every feature edge: base minus the cuts active there, plus the adds.
function bands(base,z0,z1,cuts=[],adds=[]){
 const zs=[...new Set([z0,z1,...cuts.flatMap(c=>[c.z0,c.z1]),...adds.flatMap(c=>[c.z0,c.z1])].filter(z=>z>=z0-1e-9&&z<=z1+1e-9).map(z=>Math.round(z*1e5)/1e5))].sort((a,b)=>a-b),out=[];
 for(let i=0;i+1<zs.length;i++){const a=zs[i],b=zs[i+1],m=(a+b)/2;if(b-a<1e-6)continue;let p=base;const cs=cuts.filter(c=>c.z0<m&&c.z1>m).flatMap(c=>c.polys);if(cs.length)p=T.diffPolys(p,cs);const as=adds.filter(c=>c.z0<m&&c.z1>m).flatMap(c=>c.polys);if(as.length)p=T.unionPolys(p.concat(as));out.push({z0:a,z1:b,polys:p});}
 return out;
}
function knobLayers(cx,cy,z0){
 const r=LID.knobD/2,L=[],n=6,f=LID.flare;
 for(let i=0;i<n;i++)L.push({z0:z0+f*i/n,z1:z0+f*(i+1)/n,polys:circ(cx,cy,r+f*(1-(i+.5)/n))});
 L.push({z0:z0+f,z1:z0+LID.knobH-.8,polys:circ(cx,cy,r)});
 L.push({z0:z0+LID.knobH-.8,z1:z0+LID.knobH-.4,polys:circ(cx,cy,r-.4)},{z0:z0+LID.knobH-.4,z1:z0+LID.knobH,polys:circ(cx,cy,r-.8)});
 return L;
}
// Layers that may overlap in z (knob and raised decoration above the lid top) merged into one band per z step.
function mergeLayers(list){if(!list.length)return list;const zs=[...new Set(list.flatMap(l=>[l.z0,l.z1]).map(z=>Math.round(z*1e5)/1e5))].sort((a,b)=>a-b),out=[];
 for(let i=0;i+1<zs.length;i++){const a=zs[i],b=zs[i+1],m=(a+b)/2;if(b-a<1e-6)continue;const ps=list.filter(l=>l.z0<m&&l.z1>m).flatMap(l=>l.polys);if(ps.length)out.push({z0:a,z1:b,polys:T.unionPolys(ps)});}return out;}
function closed(m,what){for(let i=0;i<m.length;i++)m[i]=Math.round(m[i]*1e5)/1e5;if(!C.checkClosed(m).closed&&C.fixTJunctions){for(const tol of[1e-4,1e-3,5e-3,2e-2]){m=Float64Array.from(C.fixTJunctions(m,new Array(m.length/9).fill(0),tol).p);if(C.checkClosed(m).closed)break;}}const MD=G.MeshDoctor||(typeof require==='function'?require('./repair'):null);if(!C.checkClosed(m).closed&&MD&&MD.repair&&!(T.clipActive&&T.clipActive()))m=MD.repair(m,{}).p;return m;}
// Rotate 180\u00b0 about X (keeps winding), then drop onto z = 0: worn top-up \u2192 printed top-down.
function flip(m,d){let top=-Infinity;for(let i=2;i<m.length;i+=3)top=Math.max(top,m[i]);const q=new Float64Array(m.length);for(let i=0;i<m.length;i+=3){q[i]=m[i];q[i+1]=d-m[i+1];q[i+2]=top-m[i+2];}return q;}
function lift(m){let lo=Infinity;for(let i=2;i<m.length;i+=3)lo=Math.min(lo,m[i]);if(Math.abs(lo)<1e-9)return m;const q=Float64Array.from(m);for(let i=2;i<q.length;i+=3)q[i]-=lo;return q;}
/* o = {w,d,radius,wall,innerRadius,binH,style,grid:{nx,ny}|null}
 * Returns {name,kind,local (print orientation),worn,w,d,h,t,knob,notes,info} or null. */
// Centre of a finger hole (20 mm, down to 16 mm on small lids) kept `margin` from the lid edge and below the label panel.
function fingerHole(w,d,margin,panel){
 for(const D of [LID.holeD,18,16]){const r=D/2,yLo=(panel?panel.y1+2:margin)+r,yHi=d-margin-r,xOk=w-2*(margin+r)>=0;if(!xOk||yHi<yLo-1e-6)continue;let cy=panel?(panel.y1+d)/2:d/2;cy=Math.min(Math.max(cy,yLo),yHi);return [w/2,cy,r];}
 return null;
}
function buildLid(o){
 const st=o.style,k=kind(st.lid);if(!k)return null;
 const {w,d,wall}=o,R=Math.max(0,Math.min(o.radius,w/2-.01,d/2-.01)),c=clamp(st.lidClear??LID.clear,.05,.8),mag=magnet(st.lidMag,st.lidMagFit),t=plateThickness(st,mag),notes=[];
 const ml=k==='magnet'?magnetLayout(w,d,R,wall,mag):null;if(k==='magnet'&&!ml)throw Error(`This bin is too small for ${mag.label} lid magnets.`);
 let gridTop=k==='magnet'&&!!st.lidGridTop&&!!o.grid;if(st.lidGridTop&&!gridTop)notes.push(k==='magnet'?'The 42 mm grid top needs bins with the 42 mm grid base.':'The 42 mm grid top needs the magnetic lid (it prints top up).');
 let plate=[poly(T.roundRect(0,0,w,d,R,32))];
 let grab=st.lidGrab||'none';if(grab==='tab'){if(w<LID.tabW+8)grab='none';else plate=T.unionPolys(plate.concat([poly(T.roundRect(w/2-LID.tabW/2,-LID.tabOut,w/2+LID.tabW/2,Math.max(R,3)+1,3,12))]));}
 if(gridTop&&(grab==='knob'||st.lidLabel)){notes.push('Knob and label are left off the 42 mm grid top so bins sit flat on it.');}
 // Layout: label strip along the front, knob centred in what is left.
 const margin=k==='magnet'?ml.e+1:wall+c+LID.lipW+1.5,cuts=[],adds=[],extra=[];let panel=null,knobAt=null,label=null,knob=null;
 if(st.lidLabel&&!gridTop){
  const ph=clamp(d*.26,8,16),y0=Math.max(wall+3,R*.3+3),inX=k==='magnet'&&y0<ml.e+1?ml.e+1:Math.max(wall+3,R*.35+3),x0=inX,x1=w-inX;
  if(x1-x0>=20&&y0+ph<d-wall-3){panel={x0,y0,x1,y1:y0+ph};const P=[poly(T.roundRect(x0,y0,x1,y0+ph,Math.min(2,ph/3),12))],text=String(st.lidText||'').trim(),letters=text?T.interPolys(textPolys(text,(x0+x1)/2,y0+ph/2,Math.min(ph*.62,9),x1-x0-4),P):[];
   if(st.lidTextStyle==='engraved'){cuts.push({z0:t-LID.engravePanel,z1:t,polys:P});if(letters.length)cuts.push({z0:t-LID.engravePanel-LID.engrave,z1:t-LID.engravePanel,polys:letters});}
   else{cuts.push({z0:t-LID.panelDepth,z1:t,polys:P});if(letters.length)adds.push({z0:t-LID.panelDepth,z1:t,polys:letters});}
   label={text:letters.length?text.toUpperCase():'',style:st.lidTextStyle==='engraved'?'engraved':'raised',panel};
  }else notes.push('This lid is too small for a label area.');
 }
 if(grab==='knob'&&!gridTop){
  const rr=LID.knobD/2+LID.flare+1,yLo=panel?panel.y1+rr:rr+margin*.5,yHi=d-rr-2;let cy=panel?(panel.y1+d)/2:d/2;cy=Math.min(Math.max(cy,yLo),yHi);
  if(w>=2*rr+4&&yHi>=yLo-1e-6){knobAt=[w/2,cy];}else{notes.push('This lid is too small for a knob.');grab='none';}
 }
 let holeAt=null;
 if(grab==='hole'){
  // Finger hole: straight through the plate, clear of the lip, the magnet posts and the label strip.
  const hr=fingerHole(w,d,margin,panel);if(hr){holeAt=hr;cuts.push({z0:-1,z1:t+1,polys:circ(hr[0],hr[1],hr[2])});}else{notes.push('This lid is too small for a finger hole.');grab='none';}
 }
 const L=[];
 if(k==='friction'){
  const lipH=Math.min(LID.lipH,Math.max(2,(o.binH||40)/4)),ri=Math.max(0,(o.innerRadius??Math.max(0,R-wall))-c);
  const lo=T.roundRect(wall+c,wall+c,w-wall-c,d-wall-c,ri,24),li=T.roundRect(wall+c+LID.lipW,wall+c+LID.lipW,w-wall-c-LID.lipW,d-wall-c-LID.lipW,Math.max(0,ri-LID.lipW),24);
  if(w-2*(wall+c+LID.lipW)<4||d-2*(wall+c+LID.lipW)<4)throw Error('This bin is too small for a friction lid lip.');
  L.push({z0:-lipH,z1:0,polys:[{outer:lo,holes:[li.slice().reverse()]}]});
  if(knobAt)cuts.push({z0:0,z1:t,polys:circ(knobAt[0],knobAt[1],LID.pegD/2+LID.pegClear)});

 }else{
  cuts.push({z0:0,z1:mag.depth,polys:ml.holes});
 }
 // Decoration (text, logo or photo) on the top, clear of the edge, magnets, knob, finger hole and label.
 let deco=null,colorWorn=null;
 if(st.lidDeco&&DECO()){
  if(gridTop)notes.push('Lid decoration is left off the 42 mm grid top so bins sit flat on it.');
  else{
   const keep=[];if(panel)keep.push(poly(T.roundRect(panel.x0-1,panel.y0-1,panel.x1+1,panel.y1+1,2,12)));
   if(knobAt)keep.push(...circ(knobAt[0],knobAt[1],k==='magnet'?LID.knobD/2+LID.flare+1:LID.pegD/2+LID.pegClear+1.5));
   if(holeAt)keep.push(...circ(holeAt[0],holeAt[1],holeAt[2]+1.5));if(ml)for(const [x,y] of ml.centres)keep.push(...circ(x,y,mag.r+1.2));
   let region=T.offset([poly(T.roundRect(0,0,w,d,R,32))],-2,true);if(keep.length)region=T.diffPolys(region,T.unionPolys(keep));
   deco=DECO().apply({deco:st.lidDeco,kind:k,w,d,t,region});
   if(deco){cuts.push(...deco.cuts);adds.push(...deco.adds);notes.push(...deco.notes);if(deco.color)colorWorn=closed(T.steppedExtrude(deco.color),'lid color');}
  }
 }
 L.push(...bands(plate,0,t,cuts,adds));
 const over=[...(k==='magnet'&&knobAt?knobLayers(knobAt[0],knobAt[1],t):[]),...(deco?deco.top:[])];
 if(over.length)L.push(...mergeLayers(over));
 let gridInfo=null;
 if(gridTop){const socks=[],{nx,ny}=o.grid,h=LID.gridSockW/2;for(let iy=0;iy<ny;iy++)for(let ix=0;ix<nx;ix++){const cx=GRIDP*(ix+.5)-GRIDC,cy=GRIDP*(iy+.5)-GRIDC;socks.push(poly(T.roundRect(cx-h,cy-h,cx+h,cy+h,1.8,16)));}if(holeAt)socks.push(...circ(holeAt[0],holeAt[1],holeAt[2]));L.push({z0:t,z1:t+LID.gridSock,polys:T.diffPolys(plate,socks)});gridInfo={nx,ny,depth:LID.gridSock};}
 let worn=closed(T.steppedExtrude(L),'lid');
 // The color part rides through the same print-orientation moves as the lid (concatenated, then split again).
 const nW=worn.length,both=colorWorn?T.concat([worn,colorWorn]):worn;
 let local=k==='friction'?lift(flip(both,d)):lift(both);
 if(k==='friction'){let lo=Infinity;for(let i=1;i<nW;i+=3)lo=Math.min(lo,local[i]);if(lo<-1e-9||lo>1e-9){local=Float64Array.from(local);for(let i=1;i<local.length;i+=3)local[i]-=lo;}}
 else if(grab==='tab'){local=Float64Array.from(local);for(let i=1;i<local.length;i+=3)local[i]+=LID.tabOut;}
 let colors=[];if(colorWorn){colors=[{name:'lid_color',local:local.slice(nW),worn:colorWorn,color:deco.info.color}];local=local.slice(0,nW);}
 if(k==='friction'&&knobAt){
  // Separate push-in knob: printed top down, peg up; the peg goes through the lid and takes a drop of glue.
  const kx=knobAt[0],ky=knobAt[1],KL=[{z0:.2,z1:t,polys:circ(kx,ky,LID.pegD/2)},{z0:t,z1:t+LID.knobH-.6,polys:circ(kx,ky,LID.knobD/2)},{z0:t+LID.knobH-.6,z1:t+LID.knobH,polys:circ(kx,ky,LID.knobD/2-.6)}];
  const kw=closed(T.steppedExtrude(KL),'knob'),kp=lift(flip(kw,d));let bx=Infinity,by=Infinity;for(let i=0;i<kp.length;i+=3){bx=Math.min(bx,kp[i]);by=Math.min(by,kp[i+1]);}for(let i=0;i<kp.length;i+=3){kp[i]-=bx;kp[i+1]-=by;}
  knob={name:'lid_knob',local:kp,worn:kw,w:LID.knobD,d:LID.knobD,h:t-.2+LID.knobH};
 }
 const name=`lid_${k==='magnet'?'magnetic_'+mag.size:'friction'}${label?'_label':''}${grab!=='none'?'_'+grab:''}${gridTop?'_grid_top':''}${deco&&deco.info?'_decorated':''}`;
 let bb=C.bbox(local);
 if(colors.length){const cb=C.bbox(T.concat([local,colors[0].local]));bb={min:cb.min,max:cb.max};}
 return {name,kind:k,local,worn,colors,w:bb.max[0]-bb.min[0],d:bb.max[1]-bb.min[1],h:bb.max[2]-bb.min[2],t,knob,notes,printFace:k==='friction'?'top down':'top up',
  info:{kind:k,thickness:t,clearance:k==='friction'?c:null,lipH:k==='friction'?Math.min(LID.lipH,Math.max(2,(o.binH||40)/4)):null,magnet:k==='magnet'?{...mag,centres:ml.centres}:null,label,deco:deco&&deco.info?deco.info:null,grab,hole:holeAt?{x:holeAt[0],y:holeAt[1],d:holeAt[2]*2}:null,knob:knobAt?{x:knobAt[0],y:knobAt[1],d:LID.knobD,h:LID.knobH,separate:k==='friction'}:null,gridTop:gridInfo}};
}
const api={mergeLayers,fingerHole,MAGNETS,LID,magnet,magnetLayout,kind,plateThickness,stackHeight,applyToBin,buildLid,textPolys,bands,flip,splitAt};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else G.GPLids=api;
})(typeof globalThis!=='undefined'?globalThis:this);
