/* Drawer bin extras (batch 3): engraved or inlaid label text on the front wall, slotted walls with slide-in divider
 * plates, a stacking lip shaped like a 42 mm grid baseplate so the next bin's feet key in, and tracing a tool
 * outline from a photo for a shaped cutout pocket. Everything works on stepped layers {z0,z1,polys}, so the bin stays
 * one closed solid that prints open side up without supports. */
(function(G){'use strict';
const T=G.StudioTools||require('./tools'),C=G.SplitCore||require('./core');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),poly=outer=>({outer,holes:[]}),rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
// Front text: 0.6 mm deep, letters at most 10 mm tall, at least 0.8 mm of wall left behind the cut.
const FRONT={depth:.6,minLeft:.8,maxH:10,minH:3,margin:1.2};
// Slots: two 1.2 mm ribs standing 1.4 mm proud of the wall; the plate is 1.6 mm with 0.3 mm clearance per side.
const SLOT={rib:1.2,proud:1.4,t:1.6,clear:.3,minGap:12,notchW:20,notchD:8,belowRim:1};
// Stacking lip: the inverse of the 42 mm grid foot (35.6 \u2192 37.2 \u2192 41.5 mm) with 0.25 mm clearance per side,
// cut off where the solid top is 0.6 mm wide. Depth 3.9 mm; the foot's top 0.85 mm stays above the rim.
const LIP={clear:.25,top:.6,h:3.9,step:.2};
const cleanText=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9 -]/g,'').trim().slice(0,16);

// Point in polygon (even-odd over every loop) on the half-pixel font grid \u2192 filled runs per row, origin bottom-left.
function inLoops(loops,x,y){let c=false;for(const L of loops)for(let i=0,j=L.length-1;i<L.length;j=i++){const a=L[i],b=L[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
function textRows(text){
 const s=cleanText(text);if(!s)return null;const tl=C.textLoops(s),W=tl.W,rows=[];
 for(let r=0;r<10;r++){const y=(r+.5)/2,runs=[];let start=null;for(let k=0;k<=W*2;k++){const on=k<W*2&&inLoops(tl.loops,(k+.5)/2,y);if(on&&start==null)start=k/2;if(!on&&start!=null){runs.push([start,k/2]);start=null;}}rows.push({y0:r/2,y1:(r+1)/2,runs});}
 return {text:s,W,H:5,rows};
}
// Split every layer at the item heights and apply the cuts (diff) and adds (union) that cover each slice.
function applyBands(layers,items){
 if(!items.length)return layers;const out=[];
 for(const L of layers){
  const hit=items.filter(it=>it.z0<L.z1-1e-9&&it.z1>L.z0+1e-9);if(!hit.length){out.push(L);continue;}
  const zs=[...new Set([L.z0,L.z1,...hit.flatMap(it=>[it.z0,it.z1]).filter(z=>z>L.z0&&z<L.z1)].map(z=>Math.round(z*1e5)/1e5))].sort((a,b)=>a-b);
  for(let i=0;i+1<zs.length;i++){const a=zs[i],b=zs[i+1],m=(a+b)/2;if(b-a<1e-6)continue;let p=L.polys;
   const act=hit.filter(it=>it.z0<m&&it.z1>m),adds=act.flatMap(it=>it.add||[]),cuts=act.flatMap(it=>it.cut||[]);
   if(adds.length)p=T.unionPolys(p.concat(adds));if(cuts.length)p=T.diffPolys(p,cuts);if(p.length)out.push({z0:a,z1:b,polys:p});}
 }
 layers.length=0;layers.push(...out);return layers;
}
/* Front-wall label on the outside of the y = 0 wall. engraved: letters cut 0.6 mm in.
 * raised: a 0.6 mm recessed panel with the letters left standing flush with the wall, so nothing sticks out past the
 * bin outline and it still drops into a snug drawer slot or a 42 mm grid baseplate. */
function frontLabel(layers,o){
 const R=textRows(o.text);if(!R)return null;const style=o.style==='raised'?'raised':'engraved';
 const depth=Math.min(FRONT.depth,o.wall-FRONT.minLeft);if(depth<.3)return {skipped:'The wall is too thin for front lettering; use at least a 1.2 mm wall.'};
 const flat0=Math.max(o.radius,o.wall)+2,flat1=o.w-flat0,span=flat1-flat0-(style==='raised'?2*FRONT.margin:0),room=o.zHigh-o.zLow-(style==='raised'?2*FRONT.margin:0);
 const sc=Math.min(Math.min(FRONT.maxH,room*.7)/5,span/R.W);if(sc*5<FRONT.minH)return {skipped:'This bin is too small for front lettering.'};
 const cx=o.w/2,zc=(o.zLow+o.zHigh)/2,X=fx=>cx+(fx-R.W/2)*sc,Z=fy=>zc+(fy-2.5)*sc,y0=-1,y1=depth,items=[];
 if(style==='engraved'){for(const row of R.rows)if(row.runs.length)items.push({z0:Z(row.y0),z1:Z(row.y1),cut:row.runs.map(([a,b])=>poly(rect(X(a),y0,X(b),y1)))});}
 else{
  const px0=X(0)-FRONT.margin,px1=X(R.W)+FRONT.margin,pz0=Z(0)-FRONT.margin,pz1=Z(5)+FRONT.margin,panel=[poly(rect(px0,y0,px1,y1))];
  items.push({z0:pz0,z1:Z(0),cut:panel},{z0:Z(5),z1:pz1,cut:panel});
  for(const row of R.rows){const letters=row.runs.map(([a,b])=>poly(rect(X(a),y0-1,X(b),y1+1)));items.push({z0:Z(row.y0),z1:Z(row.y1),cut:letters.length?T.diffPolys(panel,letters):panel});}
 }
 applyBands(layers,items);
 return {text:R.text,style,height:+(sc*5).toFixed(2),depth:+depth.toFixed(2),width:+(sc*R.W).toFixed(1)};
}
/* Slotted walls: rib pairs on opposite inside walls and one flat, separately printed plate per slot.
 * dir 'across': plates run left to right (rails on the side walls); 'along': plates run front to back (rails on the
 * front and back walls); 'grid': both, and the plates interlock with halving joints (egg-crate): plates that run left
 * to right have slots cut down from the top, plates that run front to back have slots cut up from the bottom, so the
 * two sets drop into each other flush and every small cell is closed on four sides.
 * o: {dir, count, countY (grid: front-to-back plates), clear (per side), t (plate thickness), hFrac (plate height as a
 * share of the slot height), pos / posY (custom plate centers in mm from the inside left or front wall), tab (label
 * tab), w, d, wall, innerRadius, floorZ, topZ}. Plates are tool-free: friction fit between the ribs, a finger notch in
 * the top edge, and the label tab doubles as a pull tab. */
const TAB={h:7,w:22,minW:9,r:2.5};
const JOINT={extra:.2}; // each half-joint is 0.2 mm deeper than half the plate, so the pair sits flush with a 0.4 mm gap
function slotPositions(n,inside,wall,t,custom,what){
 let pos;
 if(Array.isArray(custom)&&custom.length){pos=custom.map(Number).filter(Number.isFinite).map(v=>wall+v).sort((a,b)=>a-b);if(!pos.length)pos=null;}
 if(!pos)pos=Array.from({length:n},(_,i)=>wall+inside*(i+1)/(n+1));
 const spaces=[pos[0]-wall-t/2,...pos.slice(1).map((p,i)=>p-pos[i]-t),wall+inside-pos[pos.length-1]-t/2];
 if(spaces.some(g=>g<SLOT.minGap-1e-6))throw Error(`Too many divider slots${what?' '+what:''}: each space must stay at least ${SLOT.minGap} mm. Use fewer slots${custom&&custom.length?', spread the custom positions out':''} or a bigger bin.`);
 return pos;
}
function parsePositions(v){if(Array.isArray(v))return v.map(Number).filter(Number.isFinite);if(v==null||v==='')return null;const a=String(v).split(/[,;\s]+/).map(Number).filter(x=>Number.isFinite(x)&&x>0);return a.length?a:null;}
function plateOutline(L,Hb,o){
 // o: {ch, joints:[u], jointFrom:'top'|'bottom', sw, tab, notch}
 const ch=o.ch;let out=[poly([[ch,0],[L-ch,0],[L,ch],[L,Hb],[0,Hb],[0,ch]])];const info={notch:false,tab:false};
 const joints=(o.joints||[]).slice().sort((a,b)=>a-b),half=Hb/2+JOINT.extra;
 // Label / pull tab at the left end, clear of the first joint.
 if(o.tab){const first=joints.length?joints[0]-o.sw/2-2:L-ch-2,x0=ch+1,tw=Math.min(TAB.w,first-x0);
  if(tw>=TAB.minW){out=T.unionPolys(out.concat([poly(T.roundRect(x0,Hb-1,x0+tw,Hb+TAB.h,TAB.r,8))]));info.tab=true;info.tabW=+tw.toFixed(1);}}
 if(joints.length){const cuts=joints.map(u=>o.jointFrom==='top'?poly(rect(u-o.sw/2,Hb-half,u+o.sw/2,Hb+TAB.h+1)):poly(rect(u-o.sw/2,-1,u+o.sw/2,half)));out=T.diffPolys(out,cuts);}
 // Finger notch in the top edge, centered in the widest stretch between joints (and away from the tab).
 if(o.notch!==false&&Hb>=20){const edges=[info.tab?ch+1+info.tabW+1:0,...joints.flatMap(u=>[u-o.sw/2,u+o.sw/2]),L];let best=null;
  for(let i=0;i+1<edges.length;i+=2){const a=edges[i],b=edges[i+1];if(b-a>=SLOT.notchW+6&&(!best||b-a>best[1]-best[0]))best=[a,b];}
  if(best&&(!joints.length||o.jointFrom==='top'||Hb-SLOT.notchD>half+1)){const c=(best[0]+best[1])/2;out=T.diffPolys(out,[poly(T.roundRect(c-SLOT.notchW/2,Hb-SLOT.notchD,c+SLOT.notchW/2,Hb+SLOT.notchW,SLOT.notchW/2-.01,24))]);info.notch=true;info.notchAt=+c.toFixed(1);}}
 return {outline:out,info};
}
function slots(layers,o){
 const dir=['along','grid'].includes(o.dir)?o.dir:'across',t=clamp(+o.t||SLOT.t,1.2,3),c=clamp(o.clear??SLOT.clear,.15,.6),s=t+2*c,{w,d,wall}=o,iR=o.innerRadius||0;
 const nA=clamp(Math.round(o.count||1),1,8),nB=clamp(Math.round(dir==='grid'?(o.countY??o.count??1):(o.count||1)),1,8);
 const z0=o.floorZ,z1=o.topZ;if(z1-z0<10)throw Error('This bin is too short for removable dividers.');
 // Plates left to right sit at y positions (rails on the side walls); plates front to back sit at x positions.
 const sets=[];
 if(dir!=='along')sets.push({dir:'across',pos:slotPositions(nA,d-2*wall,wall,t,parsePositions(o.pos),dir==='grid'?'left to right':''),inside:d-2*wall,cross:w-2*wall});
 if(dir!=='across')sets.push({dir:'along',pos:slotPositions(dir==='grid'?nB:nA,w-2*wall,wall,t,parsePositions(dir==='grid'?o.posY:o.pos),dir==='grid'?'front to back':''),inside:w-2*wall,cross:d-2*wall});
 const ribs=[];
 for(const S of sets){const lo=wall+iR+SLOT.rib+s/2,hi=wall+S.inside-iR-SLOT.rib-s/2;
  if(S.pos.some(p=>p<lo-1e-6||p>hi+1e-6))throw Error('The corners are too rounded for divider slots here. Reduce the inside corner roundness or use fewer slots.');
  for(const p of S.pos)for(const [a,b] of [[p-s/2-SLOT.rib,p-s/2],[p+s/2,p+s/2+SLOT.rib]]){
   if(S.dir==='across'){ribs.push(poly(rect(wall-.05,a,wall+SLOT.proud,b)),poly(rect(w-wall-SLOT.proud,a,w-wall+.05,b)));}
   else{ribs.push(poly(rect(a,wall-.05,b,wall+SLOT.proud)),poly(rect(a,d-wall-SLOT.proud,b,d-wall+.05)));}}}
 applyBands(layers,[{z0,z1,add:ribs}]);
 // Plate height: the slot height, or lower; a label tab rises above the plate but never past the rib tops.
 const full=z1-z0,want=Math.max(8,clamp(o.hFrac??1,.2,1)*full),Hb=o.tab?Math.min(want,full-TAB.h):want;
 if(Hb<8)throw Error('This bin is too short for divider plates with a label tab. Turn the tab off or use a taller bin.');
 const ch=Math.max(1,o.chamfer||0)+.2,plates=[],setInfo=[];
 for(const S of sets){const L=S.cross-2*c,other=sets.find(x=>x!==S),joints=dir==='grid'?other.pos.map(q=>q-(wall+c)):[];
  const {outline,info}=plateOutline(L,Hb,{ch,joints,jointFrom:S.dir==='across'?'top':'bottom',sw:s,tab:!!o.tab});
  const local=T.steppedExtrude([{z0:0,z1:t,polys:outline}]);for(let i=0;i<local.length;i++)local[i]=Math.round(local[i]*1e5)/1e5;
  const Hp=Hb+(info.tab?TAB.h:0);
  S.pos.forEach((p,k)=>{const place=m=>{const q=new Float64Array(m.length);for(let i=0;i<m.length;i+=3){const u=m[i],v=m[i+1],z=m[i+2];
    if(S.dir==='across'){q[i]=wall+c+u;q[i+1]=p+t/2-z;q[i+2]=z0+v;}else{q[i]=p-t/2+z;q[i+1]=wall+c+u;q[i+2]=z0+v;}}return q;},q=place(local);
   plates.push({local,worn:q,outline,place,jointsU:joints,jointFrom:S.dir==='across'?'top':'bottom',sw:s,plateH:Hb,w:L,d:Hp,h:t,dir:S.dir,index:k,at:+(p-wall).toFixed(2),joints:joints.length,tab:info.tab,notch:info.notch});});
  setInfo.push({dir:S.dir,count:S.pos.length,positions:S.pos.map(p=>+(p-wall).toFixed(1)),plate:[+L.toFixed(1),+Hp.toFixed(1),t],notch:info.notch,tab:info.tab,joints:joints.length});}
 const A=sets.find(x=>x.dir==='across'),B=sets.find(x=>x.dir==='along');
 // Compartments (inside coordinates of the bin, mm): between the plates and the walls. Drop-in cups use these.
 const cut=(S,lo,hi)=>{const e=[lo,...(S?S.pos.flatMap(p=>[p-t/2,p+t/2]):[]),hi],out=[];for(let i=0;i+1<e.length;i+=2)out.push([e[i],e[i+1]]);return out;};
 const xs=cut(B,wall,w-wall),ys=cut(A,wall,d-wall),cells=[];for(const [y0,y1] of ys)for(const [x0,x1] of xs)cells.push({x0,x1,y0,y1});
 return {plates,cells,railsX:!!A,railsY:!!B,height:Hb,info:{dir,count:plates.length,countAcross:A?A.pos.length:0,countAlong:B?B.pos.length:0,t,clear:c,slot:+s.toFixed(2),
  plate:setInfo[0].plate,sets:setInfo,notch:setInfo.every(x=>x.notch),tab:!!o.tab&&setInfo.some(x=>x.tab),plateHeight:+Hb.toFixed(1),fullHeight:+full.toFixed(1),
  jointDepth:dir==='grid'?+(Hb/2+JOINT.extra).toFixed(2):0,positions:sets[0].pos.map(p=>+p.toFixed(1)),cells:cells.length,
  cellSize:cells.length?[+Math.min(...cells.map(q=>q.x1-q.x0)).toFixed(1),+Math.min(...cells.map(q=>q.y1-q.y0)).toFixed(1)]:null}};
}
/* A divider plate longer than the printer plate prints in pieces that lock together in the plate's own plane with a
 * dovetail (tool-free, 0.15 mm clearance), so the joined plate still slides into its slots. Cuts stay clear of the
 * halving joints, the finger notch and the label tab; the dovetail sits in the half without joint slots. */
const DOVE={neck:6,head:10,depth:6,clear:.15};
function splitPlate(pl,maxLen){
 const L=pl.w,H=pl.plateH||pl.d,n=Math.ceil((L-1)/Math.max(40,maxLen-DOVE.depth-2));if(n<=1)return null;
 const head=Math.min(DOVE.head,H*.45),neck=Math.min(DOVE.neck,head*.6),dep=Math.min(DOVE.depth,head*.7),yc=!pl.jointsU||!pl.jointsU.length?H/2:pl.jointFrom==='top'?H*.27:H*.73;
 const keep=[...(pl.jointsU||[]).map(u=>[u-pl.sw/2-dep-2,u+pl.sw/2+2]),[0,DOVE.depth+TAB.w+4],[L-DOVE.depth-4,L]];
 const cuts=[];for(let k=1;k<n;k++){let u=L*k/n;for(let it=0;it<20;it++){const hit=keep.find(([a,b])=>u>a&&u<b);if(!hit)break;u=u-L*k/n<0?hit[0]-.5:hit[1]+.5;if(it>10)u=hit[0]-.5;}cuts.push(u);}
 const region=(u,e)=>({outer:[[-50,-50],[u+e,-50],[u+e,yc-neck/2-e],[u+dep+e,yc-head/2-e],[u+dep+e,yc+head/2+e],[u+e,yc+neck/2+e],[u+e,H+50],[-50,H+50]],holes:[]});
 const pieces=[];let rest=pl.outline;
 for(let k=0;k<=cuts.length;k++){let part;
  if(k<cuts.length){part=T.interPolys(rest,[region(cuts[k],0)]);rest=T.diffPolys(rest,[region(cuts[k],DOVE.clear)]);}else part=rest;
  const local0=T.steppedExtrude([{z0:0,z1:pl.h,polys:part}]);for(let i=0;i<local0.length;i++)local0[i]=Math.round(local0[i]*1e5)/1e5;
  const worn=pl.place(local0);let x0=Infinity,x1=-Infinity,y1=-Infinity;for(let i=0;i<local0.length;i+=3){x0=Math.min(x0,local0[i]);x1=Math.max(x1,local0[i]);y1=Math.max(y1,local0[i+1]);}
  const local=new Float64Array(local0.length);for(let i=0;i<local0.length;i+=3){local[i]=local0[i]-x0;local[i+1]=local0[i+1];local[i+2]=local0[i+2];}
  pieces.push({local,worn,w:x1-x0,d:y1,h:pl.h,piece:k+1,of:cuts.length+1});}
 return pieces;
}
/* 42 mm grid stacking lip. Inset of the open socket from the outside edge at height h above the lip base, taken at
 * the top of each 0.2 mm step so the stepped socket is never narrower than the foot plus clearance. */
const FOOT=h=>h<.8?2.95-h:h<2.6?2.15:Math.max(0,2.15-(h-2.6));
function lipInset(h){return FOOT(h)-LIP.clear;}
function gridLip(layers,o){
 const {w,d,radius:R,wall}=o,top=o.wallTop,outer=T.roundRect(0,0,w,d,R,32),ring=s=>[{outer,holes:[T.roundRect(s,s,w-s,d-s,Math.max(0,R-s),32).slice().reverse()]}];
 // Support under the inward ledge: 45\u00b0 from the wall up to the socket floor.
 const s0=lipInset(0),sup=Math.max(0,s0-wall),items=[];
 for(let z=top-sup;z<top-1e-6;z+=LIP.step){const z1=Math.min(top,z+LIP.step),s=wall+(z-(top-sup));items.push({z0:z,z1,add:ring(Math.max(wall,s))});}
 applyBands(layers,items);
 const hs=[0,.2,.4,.6,.8,2.6,2.8,3,3.2,3.4,3.6,3.8,LIP.h];
 for(let i=0;i+1<hs.length;i++)layers.push({z0:top+hs[i],z1:top+hs[i+1],polys:ring(lipInset(hs[i+1]))});
 return {height:LIP.h,support:+sup.toFixed(2),socket:[+(w-2*lipInset(0)).toFixed(2),+(w-2*lipInset(LIP.h)).toFixed(2)]};
}

/* Trace a tool outline from a photo or a drawn outline. img: {width,height,data RGBA}. The object should sit on a
 * plain contrasting background (white paper works best). Returns the outer outline (y up), normalized so the longest
 * side is 1, plus the traced aspect. */
function trace(img,opt={}){
 const maxPx=opt.maxPx||360,sc=Math.min(1,maxPx/Math.max(img.width,img.height)),W=Math.max(8,Math.round(img.width*sc)),H=Math.max(8,Math.round(img.height*sc)),g=new Float32Array(W*H);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const x0=Math.floor(x/sc),y0=Math.floor(y/sc),x1=Math.max(x0+1,Math.floor((x+1)/sc)),y1=Math.max(y0+1,Math.floor((y+1)/sc));let s=0,n=0;
  for(let yy=y0;yy<Math.min(img.height,y1);yy++)for(let xx=x0;xx<Math.min(img.width,x1);xx++){const k=(yy*img.width+xx)*4,a=img.data[k+3]/255;s+=(.299*img.data[k]+.587*img.data[k+1]+.114*img.data[k+2])*a+255*(1-a);n++;}g[y*W+x]=n?s/n:255;}
 // Otsu threshold.
 const hist=new Float64Array(256);for(const v of g)hist[Math.min(255,Math.max(0,Math.round(v)))]++;let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];
 let wB=0,sB=0,best=-1,thr=128;for(let i=0;i<256;i++){wB+=hist[i];if(!wB)continue;const wF=g.length-wB;if(!wF)break;sB+=i*hist[i];const mB=sB/wB,mF=(sum-sB)/wF,v=wB*wF*(mB-mF)**2;if(v>best){best=v;thr=i;}}
 if(opt.threshold!=null)thr=opt.threshold;
 let border=0,bn=0;for(let x=0;x<W;x++){border+=g[x]+g[(H-1)*W+x];bn+=2;}for(let y=0;y<H;y++){border+=g[y*W]+g[y*W+W-1];bn+=2;}
 const darkObj=border/bn>thr;let m=new Uint8Array(W*H);for(let i=0;i<g.length;i++)m[i]=(darkObj?g[i]<=thr:g[i]>thr)?1:0;
 const morph=(src,grow)=>{const o=new Uint8Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){let v=grow?0:1;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy,s=X<0||Y<0||X>=W||Y>=H?0:src[Y*W+X];if(grow&&s)v=1;if(!grow&&!s)v=0;}o[y*W+x]=v;}return o;};
 m=morph(morph(m,false),true);m=morph(morph(m,true),false); // open then close: drop specks, bridge hairline gaps
 // Largest 4-connected blob.
 const lab=new Int32Array(W*H).fill(-1);let bestId=-1,bestN=0,id=0;const st=[];
 for(let i=0;i<m.length;i++){if(!m[i]||lab[i]>=0)continue;let n=0;st.push(i);lab[i]=id;while(st.length){const k=st.pop();n++;const x=k%W,y=(k-x)/W;for(const [X,Y] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){if(X<0||Y<0||X>=W||Y>=H)continue;const q=Y*W+X;if(m[q]&&lab[q]<0){lab[q]=id;st.push(q);}}}if(n>bestN){bestN=n;bestId=id;}id++;}
 if(bestN<30)throw Error('No clear object was found in this image. Photograph the tool from straight above on plain white paper, or upload a dark outline on white.');
 const fill=new Uint8Array(W*H);for(let i=0;i<m.length;i++)fill[i]=lab[i]===bestId?1:0;
 // Fill holes: background not reachable from the border becomes part of the object.
 const out=new Uint8Array(W*H);for(let i=0;i<W*H;i++){const x=i%W,y=(i-x)/W;if((x===0||y===0||x===W-1||y===H-1)&&!fill[i]&&!out[i]){out[i]=1;st.push(i);while(st.length){const k=st.pop(),kx=k%W,ky=(k-kx)/W;for(const [X,Y] of [[kx+1,ky],[kx-1,ky],[kx,ky+1],[kx,ky-1]]){if(X<0||Y<0||X>=W||Y>=H)continue;const q=Y*W+X;if(!fill[q]&&!out[q]){out[q]=1;st.push(q);}}}}}
 let touches=false;for(let i=0;i<W*H;i++){if(!out[i])fill[i]=1;}
 for(let x=0;x<W;x++)if(fill[x]||fill[(H-1)*W+x])touches=true;for(let y=0;y<H;y++)if(fill[y*W]||fill[y*W+W-1])touches=true;
 // Boundary edges with the object on the left (y up), chained into loops; keep the longest.
 const at=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&fill[y*W+x],next=new Map(),key=(x,y)=>x+','+y,edges=[];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!at(x,y))continue;const Y=H-y; // pixel spans [x,x+1]\u00d7[Y-1,Y] in y-up
  if(!at(x,y+1))edges.push([x,Y-1,x+1,Y-1]);if(!at(x+1,y))edges.push([x+1,Y-1,x+1,Y]);if(!at(x,y-1))edges.push([x+1,Y,x,Y]);if(!at(x-1,y))edges.push([x,Y,x,Y-1]);}
 for(const e of edges){const k=key(e[0],e[1]);if(!next.has(k))next.set(k,[]);next.get(k).push(e);}
 const used=new Set();let loop=null;
 for(const e0 of edges){if(used.has(e0))continue;const L=[];let e=e0;while(e&&!used.has(e)){used.add(e);L.push([e[0],e[1]]);const cand=(next.get(key(e[2],e[3]))||[]).filter(f=>!used.has(f));
   if(cand.length>1){const dx=e[2]-e[0],dy=e[3]-e[1];cand.sort((a,b)=>{const t=f=>{const fx=f[2]-f[0],fy=f[3]-f[1],cr=dx*fy-dy*fx;return cr<0?0:cr===0?1:2;};return t(a)-t(b);});}
   e=cand[0];}
  if(!loop||L.length>loop.length)loop=L;}
 // Douglas-Peucker to about one pixel.
 const rdp=(P,eps)=>{if(P.length<3)return P;let i0=0,dm=0;const a=P[0],b=P[P.length-1],L=Math.hypot(b[0]-a[0],b[1]-a[1])||1;for(let i=1;i<P.length-1;i++){const dd=Math.abs((b[0]-a[0])*(a[1]-P[i][1])-(a[0]-P[i][0])*(b[1]-a[1]))/L;if(dd>dm){dm=dd;i0=i;}}return dm>eps?rdp(P.slice(0,i0+1),eps).slice(0,-1).concat(rdp(P.slice(i0),eps)):[a,b];};
 const half=Math.floor(loop.length/2);let pts=rdp(loop.slice(0,half+1),opt.eps||.9).slice(0,-1).concat(rdp(loop.slice(half).concat([loop[0]]),opt.eps||.9).slice(0,-1));
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const [x,y] of pts){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
 const big=Math.max(x1-x0,y1-y0),cx=(x0+x1)/2,cy=(y0+y1)/2;let norm=pts.map(([x,y])=>[+((x-cx)/big).toFixed(4),+((y-cy)/big).toFixed(4)]);
 if(norm.length>400){const k=Math.ceil(norm.length/400);norm=norm.filter((_,i)=>i%k===0);}
 let a2=0;norm.forEach((p,i)=>{const q=norm[(i+1)%norm.length];a2+=p[0]*q[1]-q[0]*p[1];});if(a2<0)norm.reverse();
 return {outline:norm,aspect:+((x1-x0)/(y1-y0)).toFixed(3),pixels:bestN,size:[W,H],threshold:thr,darkObject:darkObj,touchesEdge:touches,coverage:+(bestN/(W*H)).toFixed(3)};
}
const api={FRONT,SLOT,LIP,TAB,JOINT,DOVE,splitPlate,slotPositions,parsePositions,plateOutline,textRows,applyBands,frontLabel,slots,gridLip,lipInset,trace,cleanText};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else G.GPDrawerX=api;
})(typeof globalThis!=='undefined'?globalThis:this);
