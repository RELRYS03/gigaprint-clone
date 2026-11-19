/* Box generator (GPBox): one storage box with optional divider walls and a lid that is
 * none, friction fit, magnetic (shared with the drawer bins through GPLids) or hinged.
 * Hinged lids are a shallow tray printed open side up behind the box. The hinge is either
 * print-in-place (knuckles turn on 45\u00b0 cones with 0.35 mm play and 0.4 mm gaps between knuckles)
 * or a pin hinge (2.1 mm holes for a length of 1.75 mm filament). An optional snap latch is a
 * flexible tab on the lid front with a 0.8 mm bump that clicks under a ridge on the box front.
 * Proportions follow popular printed box designs: 1.6 mm dividers, \u00d87 mm knuckles, 0.3 mm latch clearance. */
(function(G){'use strict';
const C=G.SplitCore||require('./core'),T=G.StudioTools||require('./tools'),L=G.GPLids||require('./lid-features');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),poly=outer=>({outer,holes:[]}),rect=(x0,y0,x1,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
const HINGE={r:3.5,play:.35,axial:.4,tip:.6,pinHole:2.1,pinD:1.75,clearWall:.6};
const LATCH={w:14,t:1.6,len:7.5,bump:.8,clear:.3,ridgeTop:3,ridgeH:1.6};
const DIV={t:1.6,clear:.3,railT:1.2,railOut:1.6};
const GASKET={cord:2,squeeze:20,fill:.85,bank:.9};
function weights(str,n){const v=String(str||'').split(/[\s,;]+/).map(Number).filter(x=>Number.isFinite(x)&&x>0).slice(0,12);return v.length>=2?v:Array(clamp(Math.round(+n||1),1,12)).fill(1);}
// Divider centre lines across the inside; compartments come out (inside \u2212 t\u00b7(n\u22121)) \u00d7 weight / sum.
function dividerLines(a0,a1,ws,t){const n=ws.length,sum=ws.reduce((s,x)=>s+x,0),use=a1-a0-t*(n-1),out=[],sizes=ws.map(x=>use*x/sum);let p=a0;for(let i=0;i<n-1;i++){p+=sizes[i];out.push(p+t/2);p+=t;}return {lines:out,sizes};}
function closed(m){for(let i=0;i<m.length;i++)m[i]=Math.round(m[i]*1e5)/1e5;if(!C.checkClosed(m).closed&&C.fixTJunctions){for(const tol of[1e-4,1e-3,5e-3,2e-2]){m=Float64Array.from(C.fixTJunctions(m,new Array(m.length/9).fill(0),tol).p);if(C.checkClosed(m).closed)break;}}return m;}
// (u,v,w) \u2192 (x=w, y=u, z=v): a cyclic swap, so triangle winding stays outward.
function alongX(m){const q=new Float64Array(m.length);for(let i=0;i<m.length;i+=3){q[i]=m[i+2];q[i+1]=m[i];q[i+2]=m[i+1];}return q;}
function rotX(m,y0,z0,a){const c=Math.cos(a),s=Math.sin(a),q=new Float64Array(m.length);for(let i=0;i<m.length;i+=3){const y=m[i+1]-y0,z=m[i+2]-z0;q[i]=m[i];q[i+1]=y0+y*c-z*s;q[i+2]=z0+y*s+z*c;}return q;}
function move(m,x,y,z){const q=new Float64Array(m.length);for(let i=0;i<m.length;i+=3){q[i]=m[i]+x;q[i+1]=m[i+1]+y;q[i+2]=m[i+2]+z;}return q;}
function toM(M,p){const {V,F}=C.weld(p),mesh=new M.Mesh({numProp:3,vertProperties:Float32Array.from(V),triVerts:Uint32Array.from(F)});mesh.merge();return new M.Manifold(mesh);}
function fromM(m){const mesh=m.getMesh(),V=mesh.vertProperties,F=mesh.triVerts,np=mesh.numProp||3,out=[];for(let t=0;t<F.length;t+=3)for(const v of[F[t],F[t+1],F[t+2]])out.push(V[v*np],V[v*np+1],V[v*np+2]);return Float64Array.from(out);}
// Join overlapping closed solids into one manifold shell (Manifold when available, else stacked shells).
function join(list,M){if(list.length===1)return list[0];if(M){try{const ms=list.map(p=>toM(M,p)),u=M.Manifold.union(ms),out=fromM(u);ms.forEach(m=>m.delete());u.delete();if(C.checkClosed(out).closed)return out;}catch(e){}}return T.concat(list);}
function opts(o){
 const w=clamp(+o.w||80,20,1000),d=clamp(+o.d||60,20,1000),h=clamp(+o.h||40,8,400),wall=clamp(+o.wall||2,.8,10),floor=clamp(+o.floor||2,.6,10),radius=clamp(+o.radius||0,0,100);
 const lid=['lip','magnet','hinge'].includes(o.lid)?o.lid:'none',hinge=o.hinge==='pin'?'pin':'pip';
 return {...o,w,d,h,wall,floor,radius:Math.min(radius,w/2-.01,d/2-.01),lid,hinge,lidT:clamp(+o.lidT||2,1.2,6),clearance:clamp(o.clearance==null?.25:+o.clearance,.05,.8),play:clamp(o.play==null?HINGE.play:+o.play,.2,.6),lidDepth:clamp(+o.lidDepth||10,4,200),
  magnet:o.magnet==='8x3'?'8x3':'6x2',magFit:o.magFit==='glue'?'glue':'press',label:!!o.label,labelText:String(o.labelText||'').slice(0,20),textStyle:o.textStyle==='engraved'?'engraved':'raised',grab:['knob','tab','notch','hole'].includes(o.grab)?o.grab:'none',latch:lid==='hinge'&&!!o.latch,
  cols:clamp(Math.round(+o.cols||1),1,12),rows:clamp(Math.round(+o.rows||1),1,12),colWeights:o.colWeights||'',rowWeights:o.rowWeights||'',divHeight:clamp(o.divHeight==null?100:+o.divHeight,20,100),
  divT:clamp(o.divT==null?DIV.t:+o.divT||DIV.t,.8,5),divMode:o.divMode==='removable'?'removable':'fixed',divClear:clamp(o.divClear==null?DIV.clear:+o.divClear,.1,.6),
  gasket:!!o.gasket,cord:clamp(+o.cord||GASKET.cord,1.2,5),squeeze:clamp(o.squeeze==null?GASKET.squeeze:+o.squeeze,10,40)};
}
/* Gasket gland in the box rim (the lid's flat underside presses on it). Square TPU cord s \u00d7 s; the groove is
 * s\u00b7(1 \u2212 squeeze) deep and wide enough that the squeezed cord fills ~85% of it, so the TPU has room to spread. */
function gland(o){
 const why=o.lid==='none'?'The gasket needs a lid. Pick the friction or hinged lid.':o.lid==='magnet'?'The magnetic lid can\u2019t take a gasket groove because its magnets sit in the rim. Use the friction or hinged lid for a gasket.':null;
 if(why)return {ok:false,why};
 const s=o.cord,q=o.squeeze/100,depth=s*(1-q),width=s/(GASKET.fill*(1-q)),wall=Math.max(o.wall,width+2*GASKET.bank);
 return {ok:true,cord:s,squeeze:o.squeeze,depth,width,wall,proud:s-depth};
}
function applyGasket(o){
 const g=gland(o);if(!g.ok)return {o,g};
 return {o:{...o,wall:Math.round(g.wall*100)/100,radius:o.radius},g:{...g,wall:Math.round(g.wall*100)/100,thickened:g.wall>o.wall+1e-6}};
}
// Rounded annulus between inset a and inset b from the outside of a w \u00d7 d box with corner radius R.
function annulus(w,d,R,a,b){const out=T.roundRect(a,a,w-a,d-a,Math.max(0,R-a),32),inn=T.roundRect(b,b,w-b,d-b,Math.max(0,R-b),32);return [{outer:out,holes:[inn.slice().reverse()]}];}
function gasketPart(o,g){const a=(o.wall-g.cord)/2;return closed(T.steppedExtrude([{z0:0,z1:g.cord,polys:annulus(o.w,o.d,o.radius,a,a+g.cord)}]));}
// Inside face of a rounded inner contour: lowest y of the wall at x (and by symmetry the other sides).
function insideLo(x,lo,hi,ri){if(ri<=0)return lo;const c0=lo+ri,c1=hi-ri;if(x>=c0&&x<=c1)return lo;const dx=x<c0?c0-x:x-c1;if(dx>=ri)return lo+ri;return lo+ri-Math.sqrt(ri*ri-dx*dx);}
function spanAt(x0,x1,lo,hi,ri){let m=lo;for(const x of [x0,(x0+x1)/2,x1])m=Math.max(m,insideLo(x,lo,hi,ri));return m;}
function lidStyle(o){return {lid:o.lid==='hinge'?'none':o.lid,lidT:o.lidT,lidClear:o.clearance,lidMag:o.magnet,lidMagFit:o.magFit,lidLabel:o.label,lidText:o.labelText,lidTextStyle:o.textStyle,lidGrab:o.grab};}
function body(o){
 const {w,d,h,wall,floor,radius:R}=o,outer=T.roundRect(0,0,w,d,R,32),inner=T.roundRect(wall,wall,w-wall,d-wall,Math.max(0,R-wall),32),O=[poly(outer)],ring=[{outer,holes:[inner.slice().reverse()]}],layers=[{z0:0,z1:floor,polys:O}],info={};
 const cw=weights(o.colWeights,o.cols),rw=weights(o.rowWeights,o.rows),divs=[];let dividers=null;const t=o.divT;
 if(cw.length>1||rw.length>1){
  const X=dividerLines(wall,w-wall,cw,t),Y=dividerLines(wall,d-wall,rw,t),rem=o.divMode==='removable';
  if([...X.sizes,...Y.sizes].some(s=>s<6))throw Error('The compartments would be under 6 mm. Use fewer dividers or a bigger box.');
  const lipH=o.lid==='lip'?Math.min(L.LID.lipH,Math.max(2,h/4))+.5:.5,top=h-lipH,dz=floor+(top-floor)*o.divHeight/100;
  if(dz<floor+3)throw Error('The box is too short for dividers under this lid.');
  const ri=Math.max(0,R-wall),c=o.divClear,rt=DIV.railT,ro=DIV.railOut,cut=[];
  if(!rem){for(const x of X.lines)divs.push(rect(x-t/2,wall-.4,x+t/2,d-wall+.4));for(const y of Y.lines)divs.push(rect(wall-.4,y-t/2,w-wall+.4,y+t/2));}
  else{
   // Slide-in dividers: pairs of rails on the walls make a slot t + 2c wide; the dividers sit on the floor and cross
   // with egg-crate notches (column dividers notched from the top, row dividers from the bottom).
   if(rem&&Math.min(...X.sizes,...Y.sizes)<2*(c+rt)+4)throw Error('The compartments are too small for slide-in dividers. Use fixed dividers or fewer compartments.');
   for(const x of X.lines){const a=x-t/2-c,b=x+t/2+c,y0=spanAt(a-rt,b+rt,wall,w-wall,ri),y1=d-y0;
    for(const [p,q] of [[a-rt,a],[b,b+rt]]){divs.push(rect(p,Math.max(.3,y0-3),q,y0+ro),rect(p,y1-ro,q,Math.min(d-.3,y1+3)));}
    cut.push({axis:'x',at:x,from:y0+c,to:y1-c});}
   for(const y of Y.lines){const a=y-t/2-c,b=y+t/2+c,x0=spanAt(a-rt,b+rt,wall,d-wall,ri),x1=w-x0;
    for(const [p,q] of [[a-rt,a],[b,b+rt]]){divs.push(rect(Math.max(.3,x0-3),p,x0+ro,q),rect(x1-ro,p,Math.min(w-.3,x1+3),q));}
    cut.push({axis:'y',at:y,from:x0+c,to:x1-c});}
  }
  dividers={cols:cw.length,rows:rw.length,xs:X.lines,ys:Y.lines,widths:X.sizes,depths:Y.sizes,height:dz-floor,thickness:t,mode:rem?'removable':'fixed',clearance:rem?c:null,slide:rem?cut:null,floorZ:floor,topZ:dz};
  const O1=[poly(outer)],P=rem?T.interPolys(T.unionPolys(ring.concat(divs)),O1):T.unionPolys(ring.concat(divs));
  layers.push({z0:floor,z1:dz,polys:P});if(dz<h-1e-6)layers.push({z0:dz,z1:h,polys:ring});
 }else layers.push({z0:floor,z1:h,polys:ring});
 info.dividers=dividers;
 // Magnet posts / finger notch come from the shared lid code.
 const st=lidStyle(o);if(o.lid==='hinge'&&o.grab==='notch')st.lid='lip';
 const lb=L.applyToBin(layers,{w,d,radius:R,wall,floorZ:floor,rimZ:h,style:st});if(lb.magnet)info.magnet=lb.magnet;if(lb.notch)info.notch=lb.notch;
 if(o.latch){
  // Catch ridge on the outside of the front wall: flat top, 45\u00b0 underside, so it prints standing up without supports.
  const zt=h-LATCH.ridgeTop,zb=zt-LATCH.ridgeH,x0=w/2-LATCH.w/2-1,x1=w/2+LATCH.w/2+1,n=4;
  for(const z of [zb-LATCH.bump,zb,zt])L.splitAt(layers,z);
  for(const Ly of layers){const m=(Ly.z0+Ly.z1)/2;let out=0;if(m>zb&&m<zt)out=LATCH.bump;else if(m>zb-LATCH.bump&&m<zb)out=LATCH.bump*(1-(zb-m)/LATCH.bump);if(out>0)Ly.polys=T.unionPolys(Ly.polys.concat([rect(x0,-out,x1,.6)]));}
  // finer 45\u00b0 steps under the ridge
  const fine=[];for(const Ly of layers){if(Ly.z0>=zb-LATCH.bump-1e-6&&Ly.z1<=zb+1e-6){for(let i=0;i<n;i++){const a=Ly.z0+(Ly.z1-Ly.z0)*i/n,b=Ly.z0+(Ly.z1-Ly.z0)*(i+1)/n,out=LATCH.bump*(1-(zb-(a+b)/2)/LATCH.bump);fine.push({z0:a,z1:b,polys:T.unionPolys(T.diffPolys(Ly.polys,[rect(x0-.1,-2,x1+.1,0)]).concat([rect(x0,-out,x1,.6)]))});}}else fine.push(Ly);}
  layers.length=0;layers.push(...fine);info.latchRidge={z0:zb,z1:zt,out:LATCH.bump};
 }
 if(o._gland){
  // Gasket groove in the rim top, centred in the wall.
  const g=o._gland,a=(wall-g.width)/2,zg=h-g.depth;L.splitAt(layers,zg);
  for(const Ly of layers)if(Ly.z0>=zg-1e-6)Ly.polys=T.diffPolys(Ly.polys,annulus(w,d,R,a,a+g.width));
  info.groove={depth:g.depth,width:g.width,inset:a};
 }
 return {mesh:closed(T.steppedExtrude(layers)),info,ring};
}
// Separate slide-in dividers, built flat for printing (length \u00d7 height, thickness up) and placed in the box for the preview.
function slideDividers(o,D){
 const out=[],t=o.divT,c=D.clearance,H=D.topZ-D.floorZ-c,half=H/2;
 const xs=D.slide.filter(s=>s.axis==='x'),ys=D.slide.filter(s=>s.axis==='y');
 xs.forEach((s,i)=>{const len=s.to-s.from;let P=[rect(0,0,len,H)];const n=ys.map(r=>{const u=r.at-s.from;return rect(u-t/2-c,half-c/2,u+t/2+c,H+1);});if(n.length)P=T.diffPolys(P,n);
  const m=closed(T.steppedExtrude([{z0:0,z1:t,polys:P}]));out.push({axis:'x',index:i,len,H,local:m,preview:move(alongX(m),s.at-t/2,s.from,D.floorZ)});});
 ys.forEach((s,i)=>{const len=s.to-s.from;let P=[rect(0,0,len,H)];const n=xs.map(r=>{const u=r.at-s.from;return rect(u-t/2-c,-1,u+t/2+c,half+c/2);});if(n.length)P=T.diffPolys(P,n);
  const m=closed(T.steppedExtrude([{z0:0,z1:t,polys:P}])),q=new Float64Array(m.length);for(let k=0;k<m.length;k+=3){q[k]=m[k]+s.from;q[k+1]=s.at+t/2-m[k+2];q[k+2]=m[k+1]+D.floorZ;}
  out.push({axis:'y',index:i,len,H,local:m,preview:q});});
 return out;
}
function hingedLid(o){
 // Built closed ("worn": z = 0 on the box rim, top facing up), then turned onto the bed behind the box.
 const {w,d,wall,radius:R}=o,hl=o.lidDepth,mag=L.magnet('6x2'),st={lid:'lip',lidT:o.lidT,lidLabel:o.label,lidTextStyle:o.textStyle},t=L.plateThickness(st,mag),notes=[];
 if(hl<t+2)throw Error(`The hinged lid needs at least ${(t+2).toFixed(1)} mm of depth.`);
 const outer=T.roundRect(0,0,w,d,R,32),inner=T.roundRect(wall,wall,w-wall,d-wall,Math.max(0,R-wall),32),ring=[{outer,holes:[inner.slice().reverse()]}];
 let plate=[poly(outer)],grab=o.grab;
 if(grab==='tab'&&o.latch){grab='none';notes.push('The snap latch doubles as the finger tab.');}
 if(grab==='tab')plate=T.unionPolys(plate.concat([poly(T.roundRect(w/2-L.LID.tabW/2,-L.LID.tabOut,w/2+L.LID.tabW/2,Math.max(R,3)+1,3,12))]));
 const cuts=[],adds=[];let label=null,knobAt=null;
 if(o.label){const ph=clamp(d*.26,8,16),y0=Math.max(wall+3,R*.3+3),x0=Math.max(wall+3,R*.35+3),x1=w-x0;
  if(x1-x0>=20){const P=[poly(T.roundRect(x0,y0,x1,y0+ph,Math.min(2,ph/3),12))],text=o.labelText.trim(),letters=text?T.interPolys(L.textPolys(text,(x0+x1)/2,y0+ph/2,Math.min(ph*.62,9),x1-x0-4),P):[];
   if(o.textStyle==='engraved'){cuts.push({z0:hl-L.LID.engravePanel,z1:hl,polys:P});if(letters.length)cuts.push({z0:hl-L.LID.engravePanel-L.LID.engrave,z1:hl-L.LID.engravePanel,polys:letters});}
   else{cuts.push({z0:hl-L.LID.panelDepth,z1:hl,polys:P});if(letters.length)adds.push({z0:hl-L.LID.panelDepth,z1:hl,polys:letters});}
   label={text:letters.length?text.toUpperCase():'',style:o.textStyle,panel:{x0,y0,x1,y1:y0+ph}};}else notes.push('This lid is too small for a label area.');}
 if(grab==='knob'){const rr=L.LID.knobD/2+1,cy=label?Math.min((label.panel.y1+d)/2,d-rr-wall-HINGE.r):d/2;if(cy-rr>(label?label.panel.y1:wall)){knobAt=[w/2,cy];cuts.push({z0:hl-t,z1:hl,polys:[poly(T.circle(w/2,cy,L.LID.pegD/2+L.LID.pegClear,48))]});}else{notes.push('This lid is too small for a knob.');grab='none';}}
 let holeAt=null;if(grab==='hole'){const hr=L.fingerHole(w,d,wall+3,label?label.panel:null);if(hr&&hr[1]+hr[2]<d-wall-HINGE.r){holeAt=hr;cuts.push({z0:hl-t-1,z1:hl+1,polys:[poly(T.circle(hr[0],hr[1],hr[2],48))]});}else{notes.push('This lid is too small for a finger hole.');grab='none';}}
 const latch=o.latch?{x0:w/2-LATCH.w/2,x1:w/2+LATCH.w/2}:null,layers=[];
 if(latch){
  // Tab below the rim: inner face 1.1 mm out from the box wall, bump tip 0.3 mm from it, 0.5 mm snap overlap with the ridge.
  const yi=-(LATCH.clear+LATCH.bump),yo=yi-LATCH.t,zr0=-LATCH.ridgeTop,zr1=zr0-LATCH.ridgeH,zbTop=zr1-.2,zbBot=zbTop-1.6,bot=-LATCH.len-1;
  const tab=[rect(latch.x0,yo,latch.x1,yi)],bump=k=>[rect(latch.x0,yo,latch.x1,yi+k)];
  layers.push({z0:bot,z1:zbBot,polys:tab},{z0:zbBot,z1:zbBot+.4,polys:bump(.4)},{z0:zbBot+.4,z1:zbTop-.4,polys:bump(LATCH.bump)},{z0:zbTop-.4,z1:zbTop,polys:bump(.4)},{z0:zbTop,z1:0,polys:tab});
 }
 const up=latch?[rect(latch.x0,-(LATCH.clear+LATCH.bump+LATCH.t),latch.x1,wall*.6)]:[];
 layers.push({z0:0,z1:hl-t,polys:up.length?T.unionPolys(ring.concat(up)):ring});
 layers.push(...L.bands(up.length?T.unionPolys(plate.concat(up)):plate,hl-t,hl,cuts,adds));
 let worn=closed(T.steppedExtrude(layers));
 let knob=null;if(knobAt){const kx=knobAt[0],ky=knobAt[1],KL=[{z0:hl-t+.2,z1:hl,polys:[poly(T.circle(kx,ky,L.LID.pegD/2,48))]},{z0:hl,z1:hl+L.LID.knobH-.6,polys:[poly(T.circle(kx,ky,L.LID.knobD/2,48))]},{z0:hl+L.LID.knobH-.6,z1:hl+L.LID.knobH,polys:[poly(T.circle(kx,ky,L.LID.knobD/2-.6,48))]}];knob=closed(T.steppedExtrude(KL));}
 return {worn,t,hl,label,grab,knobAt,holeAt,knob,notes,latch:!!latch};
}
function hingeSolids(o,M){
 const {w,d,h,wall,radius:R}=o,hl=o.lidDepth,r=HINGE.r,g=2*(r+HINGE.clearWall),y0=d+g/2,z0=(h+hl)/2,play=o.play,ag=HINGE.axial,rc=r*.55,hc=rc-HINGE.tip;
 // The lid sweeps past the box knuckle arms only if the axis sits far enough above the lid depth.
 if(h-hl<9)throw Error(`A hinged lid ${hl} mm deep needs a box at least ${(hl+9).toFixed(0)} mm tall. Make the box taller or the lid shallower.`);
 const xs=Math.max(R,wall)+2,xe=w-xs,len=xe-xs;let n=len>=110?7:len>=70?5:3;
 const minSeg=o.hinge==='pip'?2*(hc+play*1.5)+4:HINGE.minSeg;while(n>3&&(len-(n-1)*ag)/n<minSeg)n-=2;const seg=(len-(n-1)*ag)/n;
 if(seg<minSeg)throw Error('The box is too narrow for a hinge. Make it wider.');
 const s2=Math.SQRT2,circ=(rr,k=40)=>[poly(T.circle(y0,z0,rr,k))],tear=poly([[y0-r/s2,z0-r/s2],[y0,z0-r*s2],[y0+r/s2,z0-r/s2]]);
 const zb=z0-r*s2-(y0-(d-HINGE.clearWall)),clipZ=ps=>T.interPolys(ps,[rect(-1e3,0,1e4,1e4)]);
 let boxP=clipZ(T.unionPolys(circ(r).concat([tear,poly([[d-HINGE.clearWall,zb],[y0,z0-r*s2],[y0,z0+r*.7],[d-HINGE.clearWall,z0+r*.7]])])));
 let lidP=T.unionPolys(circ(r).concat([tear,rect(y0,0,d+g+.6,hl),rect(y0,0,d+g-.4,z0)]));
 if(o.hinge==='pin'){const hole=circ(HINGE.pinHole/2,24);boxP=T.diffPolys(boxP,hole);lidP=T.diffPolys(lidP,hole);}
 const boxK=[],lidK=[],steps=Math.max(3,Math.ceil(hc/.2));
 for(let i=0;i<n;i++){const a=xs+i*(seg+ag),b=a+seg,isBox=i%2===0,Ls=[];
  if(isBox){Ls.push({z0:a,z1:b,polys:boxP});
   if(o.hinge==='pip'){if(i<n-1)for(let k=0;k<steps;k++)Ls.push({z0:b+hc*k/steps,z1:b+hc*(k+1)/steps,polys:circ(rc-hc*(k+.5)/steps,32)});
    if(i>0)for(let k=steps-1;k>=0;k--)Ls.unshift({z0:a-hc*(k+1)/steps,z1:a-hc*k/steps,polys:circ(rc-hc*(k+.5)/steps,32)});}
   boxK.push(alongX(closed(T.steppedExtrude(Ls.sort((p,q)=>p.z0-q.z0)))));
  }else{
   if(o.hinge==='pip'){
    // Sockets: the neighbour's 45\u00b0 cone plus the play, measured square to the cone face.
    const extra=play*s2,depth=hc-ag+play*1.5,sock=[];
    for(let k=0;k<steps;k++){const u0=depth*k/steps,u1=depth*(k+1)/steps,rr=rc-(ag+(u0+u1)/2)+extra;sock.push([u0,u1,rr]);}
    const mid0=a+depth,mid1=b-depth;
    for(const [u0,u1,rr] of sock)Ls.push({z0:a+u0,z1:a+u1,polys:T.diffPolys(lidP,circ(Math.max(.3,rr),32))});
    Ls.push({z0:mid0,z1:mid1,polys:lidP});
    for(const [u0,u1,rr] of sock)Ls.push({z0:b-u1,z1:b-u0,polys:T.diffPolys(lidP,circ(Math.max(.3,rr),32))});
   }else Ls.push({z0:a,z1:b,polys:lidP});
   lidK.push(alongX(closed(T.steppedExtrude(Ls.sort((p,q)=>p.z0-q.z0)))));
  }}
 return {boxK,lidK,axis:{y:y0,z:z0},gap:g,segments:n,seg,r,play,len,cone:o.hinge==='pip'?{r:rc,h:hc}:null,pin:o.hinge==='pin'?{hole:HINGE.pinHole,d:HINGE.pinD,length:len}:null};
}
/* Returns {parts:[{name,label,local,preview,color}], info, notes}. local = print position for export, preview = scene. */
function build(raw,M){
 let o=opts(raw);const notes=[],parts=[];let gl=null;
 if(o.gasket){const A=applyGasket(o);gl=A.g;if(gl.ok){o={...A.o,_gland:gl};if(gl.thickened)notes.push(`Walls are ${(Math.round(gl.wall*10)/10)} mm thick so the gasket groove fits.`);if(o.grab==='notch'){o.grab='none';notes.push('The finger notch is left off so the gasket groove stays unbroken.');}}else notes.push(gl.why);}
 const B=body(o),info={w:o.w,d:o.d,h:o.h,wall:o.wall,floor:o.floor,lid:o.lid,dividers:B.info.dividers,magnet:B.info.magnet||null,notch:B.info.notch||null};
 const f1=v=>(Math.round(v*10)/10).toString(),base=`box_${f1(o.w)}x${f1(o.d)}x${f1(o.h)}`;
 if(o.lid==='lip'||o.lid==='magnet'){
  const lid=L.buildLid({w:o.w,d:o.d,radius:o.radius,wall:o.wall,innerRadius:Math.max(0,o.radius-o.wall),binH:o.h,style:lidStyle(o)});notes.push(...lid.notes);
  parts.push({name:base,label:'Box',local:B.mesh,preview:B.mesh});
  const gap=8,bbW=C.bbox(lid.worn);parts.push({name:`${base}_${lid.name}`,label:'Lid',local:lid.local,preview:move(lid.worn,o.w+gap-bbW.min[0],-bbW.min[1],-bbW.min[2]),color:'#9ad7cf',lid:true});
  if(lid.knob){const kb=C.bbox(lid.knob.worn);parts.push({name:`${base}_lid_knob`,label:'Knob',local:lid.knob.local,preview:move(lid.knob.worn,o.w+gap-bbW.min[0],-bbW.min[1],-kb.min[2]+lid.t+.01-(lid.t-.2)),color:'#e0a96d',knob:true});}
  info.lidInfo=lid.info;
 }else if(o.lid==='hinge'){
  const HL=hingedLid(o),HS=hingeSolids(o,M);notes.push(...HL.notes);
  const lidPrint=rotX(move(HL.worn,0,0,o.h),HS.axis.y,HS.axis.z,Math.PI),boxAll=join([B.mesh,...HS.boxK],M),lidAll=join([closed(lidPrint),...HS.lidK],M);
  const open=a=>m=>rotX(m,HS.axis.y,HS.axis.z,a); // lid standing up in the preview
  if(o.hinge==='pip'){parts.push({name:`${base}_hinged_print_in_place`,label:'Box with hinged lid (print in place)',local:T.concat([boxAll,lidAll]),preview:null,group:[{p:boxAll},{p:open(Math.PI/2)(lidAll),color:'#9ad7cf'}]});}
  else{parts.push({name:`${base}_hinged_body`,label:'Box',local:boxAll,preview:boxAll});parts.push({name:`${base}_hinged_lid`,label:'Hinged lid',local:lidAll,preview:open(Math.PI/2)(lidAll),color:'#9ad7cf',lid:true});}
  if(HL.knob){const kp=rotX(move(HL.knob,0,0,o.h),HS.axis.y,HS.axis.z,Math.PI);parts.push({name:`${base}_lid_knob`,label:'Knob',local:L.flip(HL.knob,o.d),preview:open(Math.PI/2)(kp),color:'#e0a96d',knob:true});}
  info.hinge={type:o.hinge,axis:HS.axis,segments:HS.segments,knuckle:HS.r*2,play:o.play,axialGap:HINGE.axial,cone:HS.cone,pin:HS.pin,lidDepth:o.lidDepth,length:HS.len};
  info.latch=HL.latch?{width:LATCH.w,bump:LATCH.bump,clearance:LATCH.clear}:null;info.lidInfo={label:HL.label,grab:HL.grab,thickness:HL.t,knob:!!HL.knobAt};
 }else parts.push({name:base,label:'Box',local:B.mesh,preview:B.mesh});
 const D=B.info.dividers;
 if(D&&D.mode==='removable'){const sd=slideDividers(o,D);sd.forEach(p=>parts.push({name:`${base}_divider_${p.axis==='x'?'column':'row'}_${p.index+1}`,label:`Divider ${p.axis==='x'?'(column)':'(row)'} ${p.index+1}`,local:p.local,preview:p.preview,color:'#e0a96d',divider:true}));info.slideDividers=sd.map(p=>({axis:p.axis,length:p.len,height:p.H}));}
 if(gl&&gl.ok){const gm=gasketPart(o,gl);parts.push({name:`${base}_gasket_tpu`,label:'Gasket \u2014 print in TPU',local:gm,preview:move(gm,0,-o.d-12,0),color:'#4a4f57',gasket:true,tpu:true});
  info.gasket={cord:gl.cord,squeeze:gl.squeeze,depth:gl.depth,width:gl.width,wall:o.wall,proud:gl.proud};}
 else if(gl)info.gasket={blocked:gl.why};
 info.wall=o.wall;
 return {parts,info,notes,opts:o};
}
const api={GASKET,gland,slideDividers,HINGE,LATCH,DIV,weights,dividerLines,opts,body,hingedLid,hingeSolids,build,rotX,join};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else G.GPBox=api;
})(typeof globalThis!=='undefined'?globalThis:this);
