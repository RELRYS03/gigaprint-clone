// Drawer organizer upgrades: one-click makeup, medicine and paint drawers; obstruction cutouts; filler strips for
// 42 mm grid unit layouts; bin-to-bin clips; TPU non-slip pads (a second color part of each bin in the 3MF); per-bin
// print time and filament estimates. Pure geometry/data (Node and browser); home-organization.js calls it.
(function(G){'use strict';
const T=G.StudioTools||require('./tools'),C=G.SplitCore||require('./core'),estMod=()=>G.PrintEstimate||(typeof require==='function'?(()=>{try{return require('./estimate');}catch(_){return null;}})():null); // looked up on use: estimate.js loads after this file in the page
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const move=(m,x,y,z=0)=>{const q=new Float64Array(m.length);for(let i=0;i<m.length;i+=3){q[i]=m[i]+x;q[i+1]=m[i+1]+y;q[i+2]=m[i+2]+z;}return q;};
const prism=(outer,h,z0=0)=>T.steppedExtrude([{z0,z1:z0+h,polys:[{outer,holes:[]}]}]);
const box=(w,d,h,r=0)=>prism(r>0?T.roundRect(0,0,w,d,Math.min(r,w/2-.01,d/2-.01),8):[[0,0],[w,0],[w,d],[0,d]],h);

/* ---------------- one-click room drawers (rows of cells, like the bathroom drawer) ---------------- */
// Smallest bin width (along the row) that holds one pocket a \u00d7 b in a row d deep; edge = walls, gaps and margins.
const pocketMin=(a,b,edge)=>d=>d>=a+edge?b+edge+1:a+edge+1;
function rowsPreset(o,def,nid){
 const cl=o.clearance??1,Wd=+o.width-2*cl,Dd=+o.depth-2*cl,wall=+o.wall||1.6,gap=+o.gap||.8,height=+o.height||100,floor=+o.floor||1.6;
 const binH=Math.min(o.binHeight??(height-2),height-2,Math.max(40,Math.round(height*.6)));
 if(!(Wd>=def.minW&&Dd>=def.minD))throw Error(def.small);
 const swap=Dd>Wd,A=swap?Dd:Wd,Bn=swap?Wd:Dd,edge=2*2+2*wall+gap+1,cells=[];
 const push=(x0,x1,y0,y1,label,ins)=>{const e={id:nid(),x0,x1,y0,y1,bin:{height:binH,radius:Math.min(6,o.radius??6),innerRadius:Math.min(8,o.innerRadius??8)},label};if(ins)e.insert=ins;cells.push(e);};
 // Upright items need headroom: an item that would stand above the drawer clearance uses its lying-flat alternative.
 const ok=it=>!it.need||it.need+floor<=height;
 const row=(items,y0,y1)=>{const d=y1-y0;const pick=it=>ok(it)?it:it.alt?pick({...it,...it.alt,alt:it.alt.alt||null}):null;let keep=items.map(pick).filter(it=>it&&(!it.minD||d>=it.minD)).map(it=>({...it,min:typeof it.min==='function'?it.min(d):it.min}));
  while(keep.length&&keep.reduce((s,it)=>s+it.min,0)>A)keep.splice(keep.reduce((k,it,j)=>it.pri<keep[k].pri?j:k,0),1);if(!keep.length)return false;
  const extra=A-keep.reduce((s,it)=>s+it.min,0),grow=keep.reduce((s,it)=>s+(it.grow??1),0);let x=0;keep.forEach((it,j)=>{const w=it.min+extra*(it.grow??1)/grow,x1=j===keep.length-1?A:x+w;push(x,x1,y0,y1,it.label,it.ins);x=x1;});return true;};
 const rows=def.rows({A,Bn,edge,height});let y=Bn;
 rows.forEach((r,k)=>{const last=k===rows.length-1,d=last?y:Math.min(y,r.d);if(d<30)return;const y0=last?0:y-d;if(!row(r.items,y0,y))row([{label:'Open bin',ins:null,min:30,pri:1}],y0,y);y=y0;});
 for(const e of cells){e.x0/=A;e.x1/=A;e.y0/=Bn;e.y1/=Bn;if(swap){[e.x0,e.y0]=[e.y0,e.x0];[e.x1,e.y1]=[e.y1,e.x1];}}
 for(const e of cells)for(const k of ['x0','x1','y0','y1']){if(e[k]>1-1e-9)e[k]=1;if(e[k]<1e-9)e[k]=0;}
 return {id:nid(),layout:cells,room:def.room};
}
const lanes=(a,edge)=>a+edge+2;
const ROOMS={
 makeup:{room:'makeup',minW:200,minD:150,small:'The makeup drawer needs at least about 200 \u00d7 150 mm inside. Enter your drawer size and try again.',rows:({Bn,edge})=>[
  {d:Math.max(86,Math.round(Bn*.34)),items:[{label:'Palettes',ins:{id:'palette'},min:pocketMin(104,72,edge),minD:74+edge,pri:9,grow:1},{label:'Compacts',ins:{id:'compact'},min:74+edge+1,minD:74+edge,pri:6,grow:.5},{label:'Foundation',ins:{id:'foundation'},need:116,min:42+edge+2,minD:42+edge,pri:7,grow:.6,alt:{label:'Lip gloss and concealer',ins:{id:'balm'},need:72,min:18+edge+4,minD:18+edge+4,alt:{label:'Sponges',ins:{id:'sponges'},min:50+edge+1,minD:50+edge,need:0}}}]},
  {d:Bn>=250?Math.round((Bn-Math.max(86,Math.round(Bn*.34)))-70):1e9,items:[{label:'Makeup brushes',ins:{id:'makeupBrushes'},min:2*24+3+edge+2,minD:70,pri:9,grow:1},{label:'Lipstick',ins:{id:'lipstick'},need:84,min:24+edge+2,minD:24+edge,pri:8,grow:.6,alt:{label:'Lip balm',ins:{id:'balm'},need:72,alt:{label:'Hair ties and bobby pins',ins:{id:'hairties',a:30,b:30},need:0,min:32+edge+2,minD:32+edge}}},{label:'Mascara and eyeliner',ins:{id:'mascara'},min:2*20+3+edge+2,minD:70,pri:8,grow:.6},{label:'Nail polish',ins:{id:'polish'},need:74,min:36+edge+2,minD:36+edge,pri:6,grow:.5,alt:{label:'Compacts',ins:{id:'compact'},min:74+edge+1,minD:74+edge,need:0}},{label:'Sponges',ins:{id:'sponges'},min:50+edge+1,minD:50+edge,pri:4,grow:.4}]},
  {d:70,items:[{label:'Lip balm',ins:{id:'balm'},need:72,min:18+edge+4,minD:18+edge+4,pri:5,grow:.6,alt:{label:'Earring posts',ins:{id:'earrings'},need:0,min:30+edge,minD:24+edge}},{label:'Hair ties and bobby pins',ins:{id:'hairties'},min:38+edge+2,minD:38+edge+2,pri:4,grow:1},{label:'Rings',ins:{id:'rings'},min:40+edge,minD:30+edge,pri:2,grow:.5}]}]},
 medicine:{room:'medicine',minW:220,minD:150,small:'The medicine drawer needs at least about 220 \u00d7 150 mm inside. Enter your drawer size and try again.',rows:({Bn,edge})=>[
  {d:Math.max(80,Math.round(Bn*.32)),items:[{label:'Pill bottles',ins:{id:'pillBottle'},need:79,min:38+edge+2,minD:38+edge,pri:9,grow:1,alt:{label:'Pill bottles (lying flat)',ins:{id:'pillBottleFlat'},need:0,min:pocketMin(80,40,edge),minD:40+edge}},{label:'Large bottles',ins:{id:'pillBottleLarge'},need:99,min:52+edge+2,minD:52+edge,pri:6,grow:.6,alt:{label:'Dosing cups',ins:{id:'medCups'},need:0,min:40+edge+2,minD:40+edge}},{label:'Blister packs',ins:{id:'blister'},need:74,min:pocketMin(105,9,edge),minD:9+edge+2,pri:8,grow:.8,alt:{label:'Bandages',ins:{id:'bandages'},need:0,min:pocketMin(86,54,edge),minD:54+edge}}]},
  {d:Bn>=250?Math.round((Bn-Math.max(80,Math.round(Bn*.32)))-70):1e9,items:[{label:'Weekly pill organizer',ins:{id:'pillOrganizer'},min:pocketMin(198,42,edge),minD:42+edge,pri:7,grow:.4},{label:'Bandages',ins:{id:'bandages'},min:pocketMin(86,54,edge),minD:54+edge,pri:8,grow:.6},{label:'Ointment tubes',ins:{id:'ointment'},min:2*32+3+edge+2,minD:70,pri:7,grow:.8},{label:'Thermometer',ins:{id:'thermometer'},min:pocketMin(142,26,edge),minD:26+edge,pri:6,grow:.4}]},
  {d:70,items:[{label:'Dosing cups and small items',ins:{id:'medCups'},min:40+edge+2,minD:40+edge+2,pri:5,grow:1},{label:'Tweezers and clippers',ins:{id:'clippers'},min:pocketMin(98,19,edge),minD:19+edge+2,pri:4,grow:.6},{label:'Small bottle wells',ins:{id:'pillBottle'},need:79,min:38+edge+2,minD:38+edge,pri:3,grow:.6,alt:{label:'Hair ties and bobby pins',ins:{id:'hairties',a:30,b:30},need:0,min:32+edge+2,minD:32+edge}}]}]},
 paint:{room:'paint',minW:200,minD:140,small:'The paint drawer needs at least about 200 \u00d7 140 mm inside. Enter your drawer size and try again.',rows:({Bn,edge})=>[
  {d:Math.max(90,Math.round(Bn*.42)),items:[{label:'Craft paint bottles',ins:{id:'paint'},need:104,min:41+edge+2,minD:41+edge,pri:9,grow:1,alt:{label:'Mini paint pots',ins:{id:'paintMini'},need:49,min:30+edge+2,minD:30+edge}},{label:'Dropper bottles',ins:{id:'paintDropper'},need:94,min:27+edge+2,minD:27+edge,pri:7,grow:.5,alt:{label:'Paint pens',ins:{id:'markers'},need:0,min:2*18+3+edge+2,minD:70}}]},
  {d:Bn>=250?Math.round((Bn-Math.max(90,Math.round(Bn*.42)))-64):1e9,items:[{label:'Acrylic paint tubes',ins:{id:'paintTube'},min:2*36+3+edge+2,minD:70,pri:9,grow:1},{label:'Paint brushes',ins:{id:'markers'},min:2*18+3+edge+2,minD:70,pri:8,grow:.7},{label:'Mini paint pots',ins:{id:'paintMini'},need:49,min:30+edge+2,minD:30+edge,pri:6,grow:.5,alt:{label:'Eraser and clip cups',ins:{id:'erasers'},need:0,min:28+edge+2,minD:28+edge}}]},
  {d:64,items:[{label:'Palette knives and bits',ins:{id:'erasers'},min:28+edge+2,minD:28+edge+2,pri:4,grow:1},{label:'Beads and charms',ins:{id:'beads'},min:26+edge+2,minD:26+edge+2,pri:3,grow:.6}]}]}
};
for(const r of Object.values(ROOMS)){const rows=r.rows;r.rows=ctx=>rows(ctx).filter(x=>x.d>=30||x.d===1e9);}
const presets={makeup:(o,nid)=>rowsPreset(o,ROOMS.makeup,nid),medicine:(o,nid)=>rowsPreset(o,ROOMS.medicine,nid),paint:(o,nid)=>rowsPreset(o,ROOMS.paint,nid)};

/* ---------------- obstruction cutouts ---------------- */
// o: [{x, y, w, d, z}] in mm from the drawer's inside left wall (x), front (y) and floor (z). z = 0: the obstruction
// rises from the floor (pipe, post): bins under it shrink to the largest rectangle beside it, or drop when that is
// under 30 mm. z > 0: it hangs over the drawer (slide bracket, lip): bins under it get lower.
function normObstructions(list,width,depth,height){return (Array.isArray(list)?list:[]).map(b=>({x:clamp(+b.x||0,0,width),y:clamp(+b.y||0,0,depth),w:clamp(+b.w||0,0,width),d:clamp(+b.d||0,0,depth),z:clamp(+b.z||0,0,height),label:String(b.label||'').slice(0,40)})).filter(b=>b.w>=2&&b.d>=2);}
function obstruct(rect,H,list,clear=1){let r={...rect},h=H,changed=false,drop=false;
 for(const b of list){const bx0=b.x-clear,bx1=b.x+b.w+clear,by0=b.y-clear,by1=b.y+b.d+clear;if(r.x>=bx1||r.x+r.w<=bx0||r.y>=by1||r.y+r.d<=by0)continue;changed=true;
  if(b.z>0){h=Math.min(h,b.z-clear);continue;}
  const opts=[{x:r.x,y:r.y,w:bx0-r.x,d:r.d},{x:bx1,y:r.y,w:r.x+r.w-bx1,d:r.d},{x:r.x,y:r.y,w:r.w,d:by0-r.y},{x:r.x,y:by1,w:r.w,d:r.y+r.d-by1}].filter(q=>q.w>=30&&q.d>=30).sort((p,q)=>q.w*q.d-p.w*p.d);
  if(!opts.length){drop=true;break;}r=opts[0];}
 if(h<12)drop=true;return changed?{rect:r,H:h,drop}:null;}

/* ---------------- filler strips (42 mm grid unit layouts) ---------------- */
// The unit layout is centered in the drawer; strips fill the margin on each side so the bins cannot slide.
function fillers(ctx){const {width,depth,FW,FD,ox,oy,bed,fillerH,move:mv}=ctx,out=[],clear=.3,maxL=Math.max(60,bed-10);
 const strip=(side,x,y,w,d)=>{if(w<2||d<2)return;const along=w>=d,L=along?w:d,n=Math.ceil(L/maxL);for(let k=0;k<n;k++){const a=L*k/n,b=L*(k+1)/n,pw=along?b-a:w,pd=along?d:b-a,px=along?x+a:x,py=along?y:y+a,local=box(pw,pd,fillerH,.8);
   out.push({label:`Filler strip \u00b7 ${side}${n>1?` \u00b7 piece ${k+1} of ${n}`:''}`,name:`filler_strip_${side}${n>1?`_${k+1}of${n}`:''}_${pw.toFixed(1)}x${pd.toFixed(1)}x${fillerH.toFixed(1)}mm`,local,p:mv(local,px-width/2,py-depth/2),x:px,y:py,w:pw,d:pd,h:fillerH,wall:null,radius:.8,floor:0,isLid:true,isAccessory:true,isFiller:true,color:'#c8b28a'});}};
 const mx=ox-clear,my=oy-clear;
 if(mx>=2){strip('left',clear,clear,mx-clear,depth-2*clear);strip('right',ox+FW+clear,clear,mx-clear,depth-2*clear);}
 if(my>=2){const x0=mx>=2?ox:clear,x1=mx>=2?ox+FW:width-clear;strip('front',x0,clear,x1-x0,my-clear);strip('back',x0,oy+FD+clear,x1-x0,my-clear);}
 return out;}

/* ---------------- bin-to-bin clips ---------------- */
const CLIP={t:1.6,top:1.6,leg:7,len:10,fit:.15,grip:.25};
function clipProfile(span){const s=span+2*CLIP.fit,t=CLIP.t,L=CLIP.leg,g=CLIP.grip;return [[-s/2-t,-L],[-s/2+g,-L],[-s/2,-L+1.2],[-s/2,0],[s/2,0],[s/2,-L+1.2],[s/2-g,-L],[s/2+t,-L],[s/2+t,CLIP.top],[-s/2-t,CLIP.top]];}
// Shared edges between neighboring bins of the same height (no lids, no grid feet): one clip per 160 mm of edge.
function clipSpots(bins,gap){const out=[],tol=gap+.6;
 for(let i=0;i<bins.length;i++)for(let j=0;j<bins.length;j++){if(i===j)continue;const A=bins[i],B=bins[j];if(Math.abs(A.h-B.h)>.6)continue;
  if(Math.abs(B.x-(A.x+A.w))<=tol){const y0=Math.max(A.y,B.y)+Math.max(A.radius,B.radius)+4,y1=Math.min(A.y+A.d,B.y+B.d)-Math.max(A.radius,B.radius)-4;if(y1-y0>=CLIP.len+4){const n=Math.max(1,Math.round((y1-y0)/160));for(let k=0;k<n;k++)out.push({axis:'x',at:(A.x+A.w+B.x)/2,c:y0+(y1-y0)*(k+.5)/n,span:B.x-A.x-A.w+A.wall+B.wall,h:A.h,a:i,b:j});}}
  if(Math.abs(B.y-(A.y+A.d))<=tol){const x0=Math.max(A.x,B.x)+Math.max(A.radius,B.radius)+4,x1=Math.min(A.x+A.w,B.x+B.w)-Math.max(A.radius,B.radius)-4;if(x1-x0>=CLIP.len+4){const n=Math.max(1,Math.round((x1-x0)/160));for(let k=0;k<n;k++)out.push({axis:'y',at:(A.y+A.d+B.y)/2,c:x0+(x1-x0)*(k+.5)/n,span:B.y-A.y-A.d+A.wall+B.wall,h:A.h,a:i,b:j});}}}
 return out;}
function clipsPart(spots,ctx){if(!spots.length)return null;const {width,depth,move:mv,bed}=ctx,flat=[],worn=[];let cx=0,cy=0,rowH=0,maxW=0;const lim=Math.max(60,bed-20);
 for(const s of spots){const P=clipProfile(s.span),m=prism(P,CLIP.len),w=s.span+2*CLIP.fit+2*CLIP.t,h=CLIP.leg+CLIP.top;
  // Print: the U profile flat on the plate (legs standing), so the clip needs no supports.
  if(cx+w>lim){cx=0;cy+=rowH+4;rowH=0;}flat.push(move(m,cx+w/2,cy+CLIP.leg,0));cx+=w+4;rowH=Math.max(rowH,h);maxW=Math.max(maxW,cx);
  // Preview: standing over the two rims (profile across the shared edge, length along it).
  const q=new Float64Array(m.length);for(let k=0;k<m.length;k+=3){const u=m[k],v=m[k+1],l=m[k+2]-CLIP.len/2;if(s.axis==='x'){q[k]=s.at+u;q[k+1]=s.c+l;}else{q[k]=s.c+l;q[k+1]=s.at+u;}q[k+2]=s.h+v;}
  if(s.axis==='x'){for(let k=0;k<q.length;k+=9)for(let c=0;c<3;c++){const t=q[k+3+c];q[k+3+c]=q[k+6+c];q[k+6+c]=t;}}worn.push(move(q,-width/2,-depth/2));}
 const local=T.concat(flat),bb=C.bbox(local),L=move(local,-bb.min[0],-bb.min[1],-bb.min[2]);
 return {label:`Bin clips \u00d7 ${spots.length}`,name:`bin_clips_x${spots.length}_${(bb.max[0]-bb.min[0]).toFixed(1)}x${(bb.max[1]-bb.min[1]).toFixed(1)}x${CLIP.len.toFixed(1)}mm`,local:L,p:T.concat(worn),x:0,y:0,w:bb.max[0]-bb.min[0],d:bb.max[1]-bb.min[1],h:CLIP.len,wall:null,radius:0,floor:0,isLid:true,isAccessory:true,isClip:true,clips:spots.length,color:'#e0a96d'};}

/* ---------------- TPU non-slip pads ---------------- */
const PAD={t:.8,size:14,r:3,color:'#2B2D31',every:150};
function padSpots(w,d,radius){const inset=Math.max(radius,4)+3,xs=[inset,w-inset-PAD.size],ys=[inset,d-inset-PAD.size];
 const nx=Math.max(0,Math.round((w-2*inset)/PAD.every)-1),ny=Math.max(0,Math.round((d-2*inset)/PAD.every)-1);for(let k=1;k<=nx;k++)xs.push(inset+(w-2*inset-PAD.size)*k/(nx+1));for(let k=1;k<=ny;k++)ys.push(inset+(d-2*inset-PAD.size)*k/(ny+1));
 const pts=[];for(const x of xs)for(const y of ys){const edgeX=x===xs[0]||x===xs[1],edgeY=y===ys[0]||y===ys[1];if(edgeX||edgeY)pts.push([x,y]);}return pts;}
function addPads(pt,ctx){if(pt.w<PAD.size*2+8||pt.d<PAD.size*2+8)return false;const spots=padSpots(pt.w,pt.d,pt.radius||0),pads=T.concat(spots.map(([x,y])=>move(box(PAD.size,PAD.size,PAD.t,PAD.r),x,y,0)));
 pt.local=move(pt.local,0,0,PAD.t);pt.p=move(pt.p,0,0,PAD.t);pt.h+=PAD.t;pt.name=pt.name.replace(/(_[\d.]+x[\d.]+x)([\d.]+)mm/,(m,a,h)=>`${a}${(+h+PAD.t).toFixed(1)}mm`);
 pt.bodies=[{name:`${pt.name}_tpu_pads`,local:pads,color:PAD.color}];pt.decoP=move(pads,pt.x-ctx.width/2,pt.y-ctx.depth/2,0);pt.decoColor=PAD.color;pt.pads=spots.length;return true;}

/* ---------------- extras after the bins are built ---------------- */
function extras(parts,ctx){const o=ctx.o||{},notes=[];
 const bins=parts.filter(p=>!p.isLid&&!p.isBaseplate);
 if(o.fillers&&ctx.unitMode){const f=fillers({...ctx,fillerH:clamp(+o.fillerHeight||14,4,Math.max(4,ctx.binHeight))});parts.push(...f);notes.push(f.length?`${f.length} filler strip${f.length>1?'s':''} fill the space around the 42 mm grid layout.`:'The 42 mm grid layout already fills the drawer, so no filler strips are needed.');}
 else if(o.fillers)notes.push('Filler strips are for 42 mm grid unit layouts (Size the layout by 42 mm grid units); other layouts already fill the drawer.');
 if(o.clips){const ok=bins.filter(p=>!p.lids?.length&&!p.grid&&!p.features?.stack&&!p.pieces),spots=clipSpots(ok,ctx.gap),part=clipsPart(spots,ctx);if(part){parts.push(part);notes.push(`${spots.length} clips lock neighboring bins together over their rims (print the clip set once).`);}else notes.push('No bins share an edge at the same height without a lid, so no clips were added.');}
 if(o.pads){let n=0,skip=0;for(const p of bins){if(p.grid||p.pieces||p.features?.noFloor||p.badBin){skip++;continue;}if(addPads(p,ctx))n++;}if(n)notes.push(`TPU non-slip pads under ${n} bin${n>1?'s':''}: a separate dark gray part of each bin; print them in TPU or another soft filament.${skip?` ${skip} bin${skip>1?'s':''} with 42 mm grid feet, walls only or split into pieces skip the pads.`:''}`);}
 return notes;}

/* ---------------- per-bin print time and filament ---------------- */
function estimates(r,settings){const E=estMod();if(!E)return [];const out=[];const list=(r.printables||[]);
 for(const pt of list){const g=E.geometry(pt.local),e=E.estimate(g,settings);let pad=null;if(pt.bodies&&pt.bodies.length){const gp=E.geometry(T.concat(pt.bodies.map(b=>b.local)));pad=E.estimate(gp,{...(settings||{}),material:'tpu',infill:100});}
  out.push({name:pt.name,label:pt.label||pt.name,hours:e.hours+(pad?pad.hours:0),grams:e.grams+(pad?pad.grams:0),cost:e.cost+(pad?pad.cost:0),meters:e.meters,tpuGrams:pad?pad.grams:0});}
 const total=out.reduce((s,x)=>({hours:s.hours+x.hours,grams:s.grams+x.grams,cost:s.cost+x.cost}),{hours:0,grams:0,cost:0});return Object.assign(out,{total});}
const hm=h=>{const m=Math.max(1,Math.round(h*60));return m<60?`${m} min`:`${Math.floor(m/60)} h ${String(m%60).padStart(2,'0')} min`;};

const api={presets,ROOMS,rowsPreset,normObstructions,obstruct,fillers,clipProfile,clipSpots,clipsPart,CLIP,PAD,padSpots,addPads,extras,estimates,hm};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else G.GPDrawerUp=api;
})(typeof globalThis!=='undefined'?globalThis:this);
