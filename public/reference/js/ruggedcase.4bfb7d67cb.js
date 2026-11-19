/* Rugged case (GPRugged): a sealed hard case built on the box generator.
 *  - Base and lid meet on a flat rim. A drafted tongue on the lid drops into a groove in the base rim and squeezes
 *    a hollow TPU gasket. The rims touch (hard stop) exactly when the gasket is squeezed by the chosen %, so the
 *    squeeze comes from the geometry, not from how hard the latches pull.
 *  - Toggle draw latches: a lever turns on a pivot pin on the lid, and a bail hangs from the lever on a second pin.
 *    Its crossbar hooks under a keeper on the base. Closing the lever lifts the bail pivot past the line from the
 *    lid pivot to the keeper (over center), so the bail stays in tension and the lever stays shut.
 *    bail length = |B - C| - preload, snap = (|A - C| + a) - |B - C|, where B is the bail pin, A the lever pivot and C the keeper.
 *  - Full-width multi-knuckle pin hinge with stop lugs that are cut by the swept lid, so it opens to the stop angle.
 *  - Hardware: printed pins, 1.75 mm filament, or M3 metal (3 mm rod or M3 bolts, nut traps, heat-set inserts in the handle).
 * World frame: x = width, y = depth (front face y = 0, back face y = d), z up. The base is 0..hb and the lid is hb..h.
 * Front profiles use u = -y (distance out from the front face). */
(function(G){'use strict';
const C=G.SplitCore||require('./core'),T=G.StudioTools||require('./tools'),BX=()=>G.GPBox||require('./box-maker');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),DEG=Math.PI/180;
const RG={wall:3.2,radius:8,bandMin:7,bandL:6,tongue:2,draft:12,side:.25,bank:1.4,fill:.85,cord:3,squeeze:20,tube:.8,
 knuckle:5,axial:.5,hingeClr:.4,stopDeg:100,boss:3.85,lugW:5.5,leverW:12,armW:5,bar:2.5,keeperH:5,lever:10,grip:6,lugOut:1.5,
 pre:.25,snap:.15,lidTop:3,rib:2,ribW:4,ribGap:30,clr:.3,padHole:7,ventD:12.2,E:2000};
const HOLE={printed:3.4,filament:2.0,m3:3.3};
const HW_LABEL={printed:'Printed pins',filament:'1.75 mm filament',m3:'M3 metal'};
function opts(o){
 const w=clamp(+o.w||200,100,600),d=clamp(+o.d||140,70,600),h=clamp(+o.h||100,64,400),wall=clamp(+o.wall||RG.wall,2.4,8),floor=clamp(+o.floor||3,2.4,8);
 const radius=clamp(+o.radius||RG.radius,wall+3,40),hw=['printed','filament','m3'].includes(o.hardware)?o.hardware:'printed';
 const lidMin=28,lidDepth=clamp(o.lidDepth?+o.lidDepth:Math.round(h*.32),lidMin,Math.max(lidMin,h-34));
 return {w,d,h,wall,floor,radius,hardware:hw,lidDepth,cord:clamp(+o.cord||RG.cord,2,4),squeeze:clamp(o.squeeze==null?RG.squeeze:+o.squeeze,10,35),
  handle:['fold','fixed','none'].includes(o.handle)?o.handle:'fold',padlock:o.padlock!==false,vent:!!o.vent,foam:!!o.foam,latches:[2,4].includes(+o.latches)?+o.latches:'auto',
  cols:o.cols||1,rows:o.rows||1,colWeights:o.colWeights||'',rowWeights:o.rowWeights||'',divHeight:o.divHeight==null?100:o.divHeight,divT:o.divT,divMode:o.divMode,divClear:o.divClear};
}
/* Seal: groove in the base rim, drafted tongue on the lid, hollow square TPU cord s x s in the slot at the groove bottom. */
function seal(o){
 const s=o.cord,q=o.squeeze/100,th=RG.tongue,ta=Math.tan(RG.draft*DEG),gw=s/(RG.fill*(1-q)),slot=s*(1-q),gd=th+slot,gT=gw+2*th*ta;
 const F=gT+2*RG.bank,pr=Math.max(2.5,F-o.wall),c=(pr-o.wall)/2,tw=gw-2*RG.side;
 return {cord:s,squeeze:o.squeeze,q,th,ta,gw,slot,gd,gT,tw,twTop:tw+2*th*ta,pr,c,proud:s*q,bandB:Math.max(RG.bandMin,gd+2.5,RG.keeperH+2)};
}
/* Latch geometry in the (u, z) side profile at the latch centre, lid seated. */
function latchGeom(o,S){
 const hb=o.h-o.lidDepth,pr=S.pr,rl=RG.boss,a=RG.lever,rc=RG.bar;
 const uA=pr+.5+rl+RG.lugOut,zA=hb+.6+rl,kTop=hb-.4,kBot=kTop-RG.keeperH,uC=uA-1,zC=kBot-rc,L=Math.hypot(uA-uC,zA-zC);
 // Over-center angle for the chosen snap: |B-C| at closed = L + a - snap.
 const Dc=L+a-RG.snap,cosE=clamp((Dc*Dc-L*L-a*a)/(2*a*L),-1,1),eps=Math.acos(cosE);
 const nu=(uA-uC)/L,nz=(zA-zC)/L,bu=nu*Math.cos(eps)-nz*Math.sin(eps),bz=nu*Math.sin(eps)+nz*Math.cos(eps),B=[uA+a*bu,zA+a*bz];
 const Lb=Dc-RG.pre,dir=[(uC-B[0])/Dc,(zC-B[1])/Dc],C2=[B[0]+dir[0]*Lb,B[1]+dir[1]*Lb];
 // Lid proud by the gasket's free height before the squeeze: the bail must still reach, and the lever has to draw it down.
 const Lp=Math.hypot(uA-uC,zA+S.proud-zC),reach=[Math.max(0,L-a),L+a];
 const lw=RG.leverW,lg=RG.lugW,cl=RG.clr,SA=lw+2*cl+2*lg,gap=SA+.8,SB=gap+2*RG.armW,zTop=zA+a+rl+RG.grip;
 // Crossbar spring: simply supported over the keeper, uniform load. k = 384 E I / (5 L^3).
 const span=gap-1,I=Math.PI*rc**4/4,k=384*RG.E*I/(5*span**3);
 return {hb,A:[uA,zA],B,C:[uC,zC],C2,L,a,eps,epsDeg:eps/DEG,Dc,Lb,snap:RG.snap,pre:RG.pre,draw:S.proud,Lp,reach,ok:Lb>=Lp-a+.5&&Lb<=L+a,
  rl,rc,kTop,kBot,uK:C2[0]+rc+.3,lw,lg,SA,gap,SB,zTop,span,k,force:k*RG.pre,peak:k*(RG.pre+RG.snap)};
}
function latchXs(o,S,LG){
 const n=o.latches==='auto'?(o.w>=260?4:2):o.latches,edge=o.radius+S.pr+LG.SB/2+4,span=o.w-2*edge;
 if(span<LG.SB+6)throw Error('This case is too narrow for two latches. Make it at least 110 mm wide.');
 if(n===2)return [edge+span*.06,o.w-edge-span*.06];
 const f=[0,.3,.7,1];return f.map(t=>edge+span*t);
}
function hardwareList(o,R){
 const n=R.latchXs.length,LG=R.latch,hw=o.hardware,f1=v=>(Math.round(v*10)/10).toString(),list=[];
 const hingeL=R.hinge.len;
 if(hw==='m3'){
  list.push({item:`M3 threaded rod or 3 mm steel rod, ${f1(hingeL-.6)} mm`,qty:1,use:'hinge pin'});
  list.push({item:'M3\u00d720 bolt',qty:n,use:'latch lever pivots'});
  list.push({item:'M3\u00d735 bolt',qty:n,use:'latch bail pins'});
  let nuts=2+2*n,ins=0,b10=0;
  if(o.handle==='fold'){ins=2;b10=2;}else if(o.handle==='fixed'){ins=4;b10=4;}
  if(b10)list.push({item:'M3\u00d710 bolt',qty:b10,use:'handle'});
  if(ins)list.push({item:'M3 heat-set insert (\u00d84.0 \u00d7 5.7 mm)',qty:ins,use:'handle bosses'});
  list.push({item:'M3 nut',qty:nuts,use:'hinge ends and latch nut traps'});
 }else if(hw==='filament'){
  list.push({item:`1.75 mm filament, ${f1(hingeL)} mm`,qty:1,use:'hinge pin'});
  list.push({item:`1.75 mm filament, ${f1(LG.SA)} mm`,qty:n,use:'latch lever pivots'});
  list.push({item:`1.75 mm filament, ${f1(LG.SB)} mm`,qty:n,use:'latch bail pins'});
  if(o.handle!=='none')list.push({item:`1.75 mm filament, ${f1(R.handle?R.handle.pin:13.4)} mm`,qty:o.handle==='fixed'?4:2,use:'handle pivots'});
 }else list.push({item:`${R.pinCount} printed pins (in the files). Print them solid in PETG or PLA`,qty:1,use:'hinge, latches and handle'});
 if(o.vent)list.push({item:'M12 breather vent plug (optional)',qty:1,use:'vent hole in the lid'});
 list.push({item:'TPU filament (85A\u201395A)',qty:1,use:'gasket'});
 return list;
}
function build(raw,M){
 if(!M)throw Error('The rugged case needs the 3D engine.');
 const o=opts(raw),S=seal(o),LG=latchGeom(o,S),{w,d,h,wall:t,radius:R}=o,hb=LG.hb,hl=o.lidDepth,pr=S.pr,notes=[];
 const all=[],k=x=>{all.push(x);return x;},free=()=>{for(const x of all){try{x.delete();}catch(e){}}all.length=0;};
 const area=L=>{let s=0;for(let i=0;i<L.length;i++){const p=L[i],q=L[(i+1)%L.length];s+=p[0]*q[1]-q[0]*p[1];}return s/2;},ccw=L=>area(L)<0?L.slice().reverse():L;
 const cs=rings=>k(new M.CrossSection(rings.map(ccw),'EvenOdd'));
 const ext=(c,z0,z1)=>k(k(M.Manifold.extrude(c,z1-z0)).translate([0,0,z0]));
 const prism=(rings,z0,z1)=>ext(cs(rings),z0,z1);
 const X=[0,1,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,1];// column-major: (p,q,s) -> (x=s, y=p, z=q)
 const profX=(c,x0,x1)=>k(k(k(M.Manifold.extrude(c,x1-x0)).transform(X)).translate([x0,0,0]));
 const front=pts=>pts.map(([u,z])=>[-u,z]);// side profile (u,z) to (y,z) on the front face
 const union=a=>{a=a.filter(Boolean);return a.length===1?a[0]:k(M.Manifold.union(a));},sub=(a,b)=>{b=b.filter(Boolean);return b.length?k(a.subtract(union(b))):a;};
 const hull=a=>k(M.Manifold.hull(a)),circ=(cx,cy,r,n=48)=>T.circle(cx,cy,r,n),rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
 const rr=off=>T.roundRect(-off,-off,w+off,d+off,Math.max(.6,R+off),24);
 const ring=(a,b,z0,z1)=>prism([rr(a),rr(b)],z0,z1);// band between outward offsets a > b
 const soup=m=>{const g=m.getMesh(),V=g.vertProperties,F=g.triVerts,np=g.numProp,p=new Float64Array(F.length*3);for(let i=0;i<F.length;i++){const v=F[i]*np;p[i*3]=V[v];p[i*3+1]=V[v+1];p[i*3+2]=V[v+2];}return p;};
 const hole=HOLE[o.hardware],m3=o.hardware==='m3',printed=o.hardware==='printed';
 const hex=(cy,cz,af,x0,x1)=>{const r=af/Math.sqrt(3),P=[];for(let i=0;i<6;i++){const a=Math.PI/6+i*Math.PI/3;P.push([cy+r*Math.cos(a),cz+r*Math.sin(a)]);}return profX(cs([P]),x0,x1);};
 if(hl+hb>h+1e-6||hb<34)throw Error('The case is too short for a rugged lid. Make it at least 64 mm tall.');
 try{
 // ------------------------------------------------ base shell (and compartments) from the box generator
 const B0=BX().build({w,d,h:hb,wall:t,floor:o.floor,radius:R,lid:'none',cols:o.cols,rows:o.rows,colWeights:o.colWeights,rowWeights:o.rowWeights,divHeight:o.divHeight,divT:o.divT,divMode:o.divMode,divClear:o.divClear},M);
 const shellMesh=B0.parts[0].local,{V,F}=C.weld(shellMesh),mm=new M.Mesh({numProp:3,vertProperties:Float32Array.from(V),triVerts:Uint32Array.from(F)});mm.merge();
 const shell=k(new M.Manifold(mm)),inner=z0=>prism([rr(-t)],z0,hb+50);
 const bandB=S.bandB,xs=latchXs(o,S,LG),cx=w/2;
 // zones on the front (x ranges) so ribs keep clear
 const busyF=[],busyL=[];
 xs.forEach(x=>{busyF.push([x-LG.SB/2-1,x+LG.SB/2+1]);busyL.push([x-LG.SB/2-1,x+LG.SB/2+1]);});
 // padlock tab pairs beside the two outer latches (inner side)
 const pads=[];
 if(o.padlock){const pw=4,pg=.6,tot=2*pw+pg;for(const [x,sgn] of [[xs[0],1],[xs[xs.length-1],-1]]){const x0=sgn>0?x+LG.SB/2+2:x-LG.SB/2-2-tot,x1=x0+tot;
   if(busyF.some(([a,b])=>x1>a-1&&x0<b+1)&&xs.length>2){const alt=sgn>0?x-LG.SB/2-2-tot:x+LG.SB/2+2;if(alt>R+pr+4&&alt+tot<w-R-pr-4)pads.push(alt);continue;}pads.push(x0);}
  for(let i=pads.length-1;i>0;i--)if(Math.abs(pads[i]-pads[0])<10)pads.splice(i,1);
  pads.forEach(x0=>{busyF.push([x0-1,x0+8.6+1]);busyL.push([x0-1,x0+8.6+1]);});}
 // handle
 let HD=null;
 if(o.handle!=='none'){
  const zH=hb-bandB-pr-7,La=Math.min(32,zH-8),fixed=o.handle==='fixed';
  const inG=xs.length>2?(xs[2]-xs[1])-LG.SB:w-2*R-20,hs=clamp(Math.min(w*.4,110,inG-10),40,110);
  if(La<16&&!fixed)notes.push('The base is too short for a fold-down handle, so it is left off.');
  else if(zH-14<6)notes.push('The base is too short for a handle, so it is left off.');
  else {HD={zH,La:fixed?24:La,hs,fixed,uH:8,bw:7};busyF.push([cx-hs/2-HD.bw/2-6,cx+hs/2+HD.bw/2+6]);}
 }
 const free1=(zones,lo,hi)=>{const out=[];let x=lo;const zs=zones.slice().sort((a,b)=>a[0]-b[0]);for(const [a,b] of zs){if(a>x)out.push([x,Math.min(a,hi)]);x=Math.max(x,b);}if(x<hi)out.push([x,hi]);return out.filter(([a,b])=>b-a>RG.ribW+2);};
 const ribXs=(zones,lo,hi)=>{const X=[];for(const [a,b] of free1(zones,lo,hi)){const n=Math.max(1,Math.floor((b-a)/RG.ribGap));for(let i=0;i<n;i++)X.push(a+(b-a)*(i+.5)/n);}return X;};
 const cornerX=R+pr+2;
 // ------------------------------------------------ base solids
 const adds=[shell];
 // rim band with a 45\u00b0 chamfer under it (prints without supports)
 adds.push(sub(union([prism([rr(pr)],hb-bandB,hb),hull([prism([rr(pr)],hb-bandB-.01,hb-bandB),prism([rr(0)],hb-bandB-pr-.01,hb-bandB-pr)])]),[inner(hb-bandB-pr-1)]));
 // corner bumpers
 const bump=(z0,z1)=>{const out=[],q=R+6;for(const [x0,y0,x1,y1] of [[-pr-1,-pr-1,q,q],[w-q,-pr-1,w+pr+1,q],[-pr-1,d-q,q,d+pr+1],[w-q,d-q,w+pr+1,d+pr+1]])out.push(k(prism([rr(pr)],z0,z1).intersect(prism([rect(x0,y0,x1,y1)],z0-1,z1+1))));return sub(union(out),[prism([rr(-t)],z0-1,z1+1)]);};
 adds.push(bump(0,hb));
 // ribs: front, back and sides of the base, under the band
 const rz1=hb-bandB,rz0=o.floor>3?1:0;
 for(const x of ribXs(busyF,cornerX+3,w-cornerX-3))adds.push(prism([rect(x-RG.ribW/2,-RG.rib,x+RG.ribW/2,.5)],rz0,rz1));
 for(const x of ribXs([],cornerX+3,w-cornerX-3))adds.push(prism([rect(x-RG.ribW/2,d-.5,x+RG.ribW/2,d+RG.rib)],rz0,rz1));
 for(const y of ribXs([],cornerX+3,d-cornerX-3)){adds.push(prism([rect(-RG.rib,y-RG.ribW/2,.5,y+RG.ribW/2)],rz0,rz1));adds.push(prism([rect(w-.5,y-RG.ribW/2,w+RG.rib,y+RG.ribW/2)],rz0,rz1));}
 // keepers under the latches
 for(const x of xs){const kw=LG.gap-1;adds.push(profX(cs([front([[pr-.5,LG.kBot],[LG.uK,LG.kBot],[LG.uK,LG.kTop-1],[LG.uK-1,LG.kTop],[pr-.5,LG.kTop]])]),x-kw/2,x+kw/2));}
 // base padlock tabs (rise past the parting line, beside the lid tab)
 const pu=pr+6.5;
 for(const x0 of pads){adds.push(profX(cs([front([[pr+.5,hb+10],[pr+12,hb+10],[pr+12,hb-8],[-.5,hb-20.5-pr],[-.5,hb-bandB],[pr-.5,hb-bandB],[pr-.5,hb-.3],[pr+.5,hb-.3]])]),x0+4.6,x0+8.6));}
 // handle bosses
 if(HD){const {zH,uH,bw}=HD,top=zH+5,bot=HD.fixed?zH-14:zH-5;
  for(const xb of [cx-HD.hs/2,cx+HD.hs/2]){const P=HD.fixed?[[-.5,bot-uH-.5],[uH,bot],[uH+5,bot+3],[uH+5,top-3],[uH,top],[-.5,top]]:[[-.5,bot-uH-.5],[uH,bot],[uH+5,zH],[uH,top],[-.5,top]];
   adds.push(union([profX(cs([front(P)]),xb-bw/2,xb+bw/2),profX(cs([front(circ(uH,zH,5,40))]),xb-bw/2,xb+bw/2)]));}}
 // ------------------------------------------------ hinge
 const rk=RG.knuckle,eA=S.c-S.twTop/2,need=S.th/S.ta-(-eA)+.6,e=Math.max(pr+rk+RG.hingeClr,need),y0=d+e,z0=hb;
 const hx0=R+6.5,hx1=w-R-6.5,len=hx1-hx0;let nK=Math.max(5,Math.round(len/24));if(nK%2===0)nK++;const seg=(len-(nK-1)*RG.axial)/nK;
 // lid profile at the back (for the stop sweep): band, chamfer, wall and tongue
 const lidBack=cs([[[d-40,hb],[d+pr,hb],[d+pr,hb+RG.bandL],[d,hb+RG.bandL+pr],[d,hb+hl],[d-40,hb+hl]],rect(d+S.c-S.twTop/2-.2,hb-S.th-.2,d+S.c+S.twTop/2+.2,hb+.1)]);
 const sweep=[];for(let a=0;a<=RG.stopDeg+1e-9;a+=1)sweep.push(k(k(lidBack.translate([-y0,-z0])).rotate(-a)).translate([y0,z0]));
 const swept=k(M.CrossSection.union(sweep));
 const lug=k(cs([[[y0,z0-rk],[y0+rk+5,z0+5],[y0+rk+5,z0+12],[y0,z0+12]]]).subtract(swept));
 const webB=cs([[[d-.5,z0],[y0,z0],[y0,z0-rk],[d-.5,z0-rk-(y0-d+.5)]]]),webL=cs([[[d-.5,z0],[y0,z0],[y0,z0+rk],[d-.5,z0+rk+(y0-d+.5)]]]),kn=cs([circ(y0,z0,rk,48)]);
 const baseK=[],lidK=[];
 for(let i=0;i<nK;i++){const a=hx0+i*(seg+RG.axial),b=a+seg;if(i%2===0)baseK.push(union([profX(kn,a,b),profX(webB,a,b),profX(lug,a,b)]));else lidK.push(union([profX(kn,a,b),profX(webL,a,b)]));}
 adds.push(...baseK);
 let base=union(adds);
 // groove: a slot for the cord, then drafted walls up to the rim
 const gcut=[ring(S.c+S.gw/2,S.c-S.gw/2,hb-S.gd,hb-S.th+.01)],nL=8;
 for(let j=0;j<nL;j++){const z1=hb-S.th+S.th*(j+1)/nL,wj=S.gw+2*S.ta*(z1-(hb-S.th));gcut.push(ring(S.c+wj/2,S.c-wj/2,hb-S.th+S.th*j/nL,j===nL-1?hb+1:z1+.01));}
 const hingeHole=profX(cs([circ(y0,z0,hole/2,32)]),hx0-1,hx1+1),cuts=[...gcut,hingeHole];
 const endBase=[hx0,hx1].map((x,i)=>(i===0?0:nK-1)%2===0);
 if(m3){if(endBase[0])cuts.push(hex(y0,z0,5.7,hx0-1,hx0+2.6));if(endBase[1])cuts.push(hex(y0,z0,5.7,hx1-2.6,hx1+1));}
 if(printed){if(endBase[0])cuts.push(profX(cs([circ(y0,z0,3.2,32)]),hx0-1,hx0+1.6));if(endBase[1])cuts.push(profX(cs([circ(y0,z0,3.2,32)]),hx1-1.6,hx1+1));}
 // padlock holes and handle pivot holes
 for(const x0 of pads)cuts.push(profX(cs([front(circ(pu,hb,RG.padHole/2,32))]),x0-1,x0+9.6));
 if(HD)for(const [xb,sg] of [[cx-HD.hs/2,-1],[cx+HD.hs/2,1]]){const bx0=xb-HD.bw/2,bx1=xb+HD.bw/2,hz=HD.fixed?[HD.zH,HD.zH-9]:[HD.zH];
  for(const z of hz){if(m3)cuts.push(sg>0?profX(cs([front(circ(HD.uH,z,2,24))]),bx1-6,bx1+1):profX(cs([front(circ(HD.uH,z,2,24))]),bx0-1,bx0+6));else cuts.push(profX(cs([front(circ(HD.uH,z,hole/2,24))]),bx0-1,bx1+1));}}
 base=sub(base,cuts);
 // ------------------------------------------------ lid
 const zt=hb+hl,ladds=[];
 ladds.push(sub(prism([rr(0)],hb,zt),[prism([rr(-t)],hb-1,zt-RG.lidTop)]));
 ladds.push(sub(union([prism([rr(pr)],hb,hb+RG.bandL),hull([prism([rr(pr)],hb+RG.bandL,hb+RG.bandL+.01),prism([rr(0)],hb+RG.bandL+pr,hb+RG.bandL+pr+.01)])]),[prism([rr(-t)],hb-1,zt-RG.lidTop)]));
 ladds.push(bump(hb,zt));
 // tongue, drafted (narrower at the tip)
 for(let j=0;j<nL;j++){const z0j=hb-S.th+S.th*j/nL,wj=S.tw+2*S.ta*(z0j-(hb-S.th));ladds.push(ring(S.c+wj/2,S.c-wj/2,z0j,j===nL-1?hb+.01:z0j+S.th/nL+.01));}
 const lz0=hb+RG.bandL+pr,lz1=zt-1;
 for(const x of ribXs(busyL,cornerX+3,w-cornerX-3))ladds.push(prism([rect(x-RG.ribW/2,-RG.rib,x+RG.ribW/2,.5)],lz0,lz1));
 for(const y of ribXs([],cornerX+3,d-cornerX-3)){ladds.push(prism([rect(-RG.rib,y-RG.ribW/2,.5,y+RG.ribW/2)],lz0,lz1));ladds.push(prism([rect(w-.5,y-RG.ribW/2,w+RG.rib,y+RG.ribW/2)],lz0,lz1));}
 ladds.push(...lidK);
 // latch lugs
 const [uA,zA]=LG.A;
 const lugPs=cs([front([[pr-.5,zA-LG.rl],[uA,zA-LG.rl],[uA,zA+LG.rl],[uA-1.45,zA+LG.rl+1.45],[pr-.5,zA+LG.rl+1.45]])]),lugC=cs([front(circ(uA,zA,LG.rl,40))]);
 const lugX=x=>[[x-LG.lw/2-RG.clr-LG.lg,x-LG.lw/2-RG.clr],[x+LG.lw/2+RG.clr,x+LG.lw/2+RG.clr+LG.lg]];
 for(const x of xs)for(const [a,b] of lugX(x))ladds.push(union([profX(lugPs,a,b),profX(lugC,a,b)]));
 // lid padlock tabs
 for(const x0 of pads)ladds.push(profX(cs([front([[pr+.5,hb-10],[pr+12,hb-10],[pr+12,hb+RG.bandL],[-.5,hb+RG.bandL+pr+12.5],[-.5,hb+RG.bandL],[pr-.5,hb+RG.bandL],[pr-.5,hb+.3],[pr+.5,hb+.3]])]),x0,x0+4));
 let lid=union(ladds);
 const lcuts=[hingeHole];
 const endLid=[0,nK-1].map(i=>i%2===1);if(m3){if(endLid[0])lcuts.push(hex(y0,z0,5.7,hx0-1,hx0+2.6));if(endLid[1])lcuts.push(hex(y0,z0,5.7,hx1-2.6,hx1+1));}
 for(const x of xs){const [[a0,a1],[b0,b1]]=lugX(x);lcuts.push(profX(cs([front(circ(uA,zA,hole/2,32))]),a0-1,b1+1));
  if(m3){lcuts.push(profX(cs([front(circ(uA,zA,3.1,32))]),a0-1,a0+3.6));lcuts.push(hex(-uA,zA,5.7,b1-2.6,b1+1));}
  if(printed)lcuts.push(profX(cs([front(circ(uA,zA,3.2,32))]),a0-1,a0+1.6));}
 for(const x0 of pads)lcuts.push(profX(cs([front(circ(pu,hb,RG.padHole/2,32))]),x0-1,x0+9.6));
 // top panel recess and vent placeholder
 if(w>60&&d>60)lcuts.push(prism([T.roundRect(12,12,w-12,d-12,Math.max(2,R-4),16)],zt-.8,zt+1));
 let vent=null;if(o.vent){vent={x:cx,y:Math.max(24,d*.3),d:RG.ventD};lcuts.push(prism([circ(vent.x,vent.y,RG.ventD/2,48)],zt-RG.lidTop-1,zt+1));lcuts.push(prism([circ(vent.x,vent.y,10,48)],zt-1.6,zt+1));}
 lid=sub(lid,lcuts);
 // ------------------------------------------------ latch levers and bails (modelled closed, in place)
 const [Bu,Bz]=LG.B,[Cu,Cz]=LG.C2,levers=[],bails=[];
 const levP=cs([front([[uA-LG.rl,zA],[uA+LG.rl,zA],[uA+LG.rl,LG.zTop-3],[uA+LG.rl+3,LG.zTop-1.5],[uA+LG.rl+3,LG.zTop],[.2,LG.zTop],[.2,hb+RG.bandL+pr+.6],[uA-LG.rl,hb+RG.bandL+pr+.6]]),front(circ(uA,zA,LG.rl,40))]);
 const plane=pr+.5,arm=k(cs([front(circ(Bu,Bz,LG.rl,40))]).intersect(cs([front(rect(plane,-1e3,1e3,1e3))])));
 const armHull=k(M.CrossSection.hull([cs([front(circ(Bu,Bz,3,32))]),cs([front(circ(Cu,Cz,LG.rc,32))]),cs([front(rect(plane,Bz-3,plane+.5,Bz+3))]),cs([front(rect(plane,Cz-LG.rc,plane+.5,Cz+LG.rc))])])).intersect(cs([front(rect(plane,-1e3,1e3,1e3))]));
 for(const x of xs){
  let lv=profX(levP,x-LG.lw/2,x+LG.lw/2);
  lv=sub(lv,[profX(cs([front(circ(uA,zA,hole/2,32))]),x-LG.lw,x+LG.lw),profX(cs([front(circ(Bu,Bz,hole/2,32))]),x-LG.lw,x+LG.lw)]);
  levers.push(lv);
  const g0=x-LG.gap/2,g1=x+LG.gap/2,o0=g0-RG.armW,o1=g1+RG.armW,bossIn=LG.lw/2+RG.clr;
  const parts=[profX(armHull,o0,g0),profX(armHull,g1,o1),profX(arm,g0-.01,x-bossIn),profX(arm,x+bossIn,g1+.01),
   profX(cs([front(circ(Cu,Cz,LG.rc,40))]),o0,o1),profX(cs([front(rect(plane,Cz-LG.rc,Cu,Cz+LG.rc))]),o0,o1)];
  let bl=union(parts);
  const bc=[profX(cs([front(circ(Bu,Bz,hole/2,32))]),o0-1,o1+1)];if(m3)bc.push(hex(-Bu,Bz,5.7,o1-2.6,o1+1));
  bails.push(sub(bl,bc));
 }
 // ------------------------------------------------ handle part (in place, at rest)
 let handle=null;
 if(HD){const {zH,uH,La,hs}=HD,ax0=cx-hs/2-HD.bw/2-.4-6,ax1=cx-hs/2-HD.bw/2-.4,bx0=cx+hs/2+HD.bw/2+.4,bx1=bx0+6;
  if(!HD.fixed){const armU=k(M.CrossSection.union([cs([front(rect(uH-5,zH-La,uH+5,zH))]),cs([front(circ(uH,zH,5,40))])]));
   const grip=cs([front(T.roundRect(uH-5,zH-La-5,uH+5,zH-La+5,3,8))]);
   handle=union([profX(armU,ax0,ax1),profX(armU,bx0,bx1),profX(grip,ax0,bx1)]);
   handle=sub(handle,[profX(cs([front(circ(uH,zH,(m3?3.4:hole)/2,24))]),ax0-1,bx1+1)]);
  }else{const top=zH+5,bot=zH-14,P=cs([front(rect(uH-5,bot,uH+La,top))]),grip=cs([front(T.roundRect(uH+La-10,bot,uH+La,top,3,8))]);
   handle=union([profX(P,ax0,ax1),profX(P,bx0,bx1),profX(grip,ax0,bx1)]);
   handle=sub(handle,[profX(cs([front(circ(uH,zH,(m3?3.4:hole)/2,24)),front(circ(uH,zH-9,(m3?3.4:hole)/2,24))]),ax0-1,bx1+1)]);}
  HD.pin=6+.4+HD.bw;}
 // ------------------------------------------------ gasket: hollow square tube
 const ga=S.c+S.cord/2,gb=S.c-S.cord/2,gz=hb-S.gd;
 let gasket=sub(ring(ga,gb,0,S.cord),[ring(ga-RG.tube,gb+RG.tube,RG.tube,S.cord-RG.tube)]);
 // ------------------------------------------------ printed pins (D-flat, lying)
 const pins=[];
 if(printed){const pin=(L,name)=>{const r=1.55,body=k(k(M.Manifold.cylinder(L,r,r,24)).rotate([0,90,0])),head=k(k(M.Manifold.cylinder(1.4,3,3,32)).rotate([0,90,0]));let p=union([body,k(head.translate([-1.4,0,0]))]);p=k(p.intersect(k(M.Manifold.cube([L+4,10,10]).translate([-2,-5,-r+.3]))));pins.push({name,m:p});};
  pin(len/2-.3,'hinge_pin_a');pin(len/2-.3,'hinge_pin_b');xs.forEach((x,i)=>{pin(LG.SA-1.6,`latch_${i+1}_pivot_pin`);pin(LG.SB,`latch_${i+1}_bail_pin`);});if(HD)for(let i=0;i<(HD.fixed?4:2);i++)pin(HD.pin,`handle_pin_${i+1}`);}
 // ------------------------------------------------ to meshes
 const out={base:soup(base),lid:soup(lid),gasket:soup(gasket),levers:levers.map(soup),bails:bails.map(soup),handle:handle?soup(handle):null,pins:pins.map(p=>({name:p.name,p:soup(p.m)})),dividers:B0.parts.slice(1)};
 const hinge={axis:{y:y0,z:z0},e,knuckles:nK,seg,len,r:rk,hole,stop:RG.stopDeg};
 const inside={w:w-2*t,d:d-2*t,base:hb-o.floor,lid:hl-RG.lidTop};
 const info={w,d,h,hb,hl,wall:t,radius:R,seal:S,latch:LG,latchXs:xs,hinge,handle:HD,pads,vent,inside,hardware:o.hardware,dividers:B0.info.dividers};
 info.hardwareList=hardwareList(o,{latchXs:xs,latch:LG,hinge,handle:HD,pinCount:pins.length});
 return {mesh:out,info,notes,opts:o};
 }finally{free();}
}
const api={RG,HOLE,HW_LABEL,opts,seal,latchGeom,latchXs,build,hardwareList};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else G.GPRugged=api;
})(typeof globalThis!=='undefined'?globalThis:this);
