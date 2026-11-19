/* Home organization: independently printable drawer bins and labeled tool holders.
 * Preview coordinates use the measured drawer; exported objects are packed independently.
 * Rectangular merges preserve exact coverage, with explicit outside and inter-bin clearances.
 */
(function(G){'use strict';
const C=G.SplitCore||require('./core'),T=G.StudioTools||require('./tools'),I=G.GPInserts||require('./organizer-inserts'),BF=G.GPBinFeatures||require('./bin-features'),LIDS=G.GPLids||require('./lid-features'),PL=G.GPPlates||require('./plates'),MD=G.MeshDoctor||(typeof require==='function'?require('./repair'):null);
const DU=G.GPDrawerUp||(typeof require==='function'?require('./drawer-upgrades'):null);
const BLADE_INDEX=id=>Math.max(0,I.BLADES.findIndex(b=>b.id===id)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),poly=outer=>({outer,holes:[]}),colors=['#6eaaa0','#d7ae69','#6d8ab4','#c98270','#9d8cb3','#78a4b4'];
function move(p,x=0,y=0,z=0){const q=new Float64Array(p.length);for(let i=0;i<p.length;i++)q[i]=p[i]+[x,y,z][i%3];return q;}
let nextId=0;
const leaf=()=>({id:++nextId});
const branch=(axis,ratio,left=leaf(),right=leaf())=>({id:++nextId,axis,ratio,left,right});
function treeGrid(rows=3,cols=3){const divide=(n,axis,child)=>{if(n===1)return child();const a=Math.ceil(n/2);return branch(axis,a/n,divide(a,axis,child),divide(n-a,axis,child));};return divide(rows,'y',()=>divide(cols,'x',leaf));}
function treeCells(tree,rect={x0:0,y0:0,x1:1,y1:1},out=[],path=[]){if(tree.layout){for(const c of tree.layout)out.push({...c,...(c.bin?{bin:{...c.bin}}:{}),...(c.insert?{insert:{...c.insert}}:{}),path:[]});return out;}if(!tree.axis){out.push({...rect,id:tree.id,...(tree.bin?{bin:{...tree.bin}}:{}),...(tree.insert?{insert:{...tree.insert}}:{}),path});return out;}const k=tree.axis,mid=rect[k+'0']+(rect[k+'1']-rect[k+'0'])*tree.ratio;treeCells(tree.left,{...rect,[k+'1']:mid},out,path.concat({node:tree,side:'left',rect}));treeCells(tree.right,{...rect,[k+'0']:mid},out,path.concat({node:tree,side:'right',rect}));return out;}
function treeMinimum(tree,axis,min=30){if(tree.layout)return Math.max(...tree.layout.map(c=>min/(c[axis+'1']-c[axis+'0'])));if(!tree.axis)return min;const a=treeMinimum(tree.left,axis,min),b=treeMinimum(tree.right,axis,min);return tree.axis===axis?Math.max(a/tree.ratio,b/(1-tree.ratio)):Math.max(a,b);}

// Shrink or replace a layout so every bin stays at least minBin mm inside usable W\u00d7D.
// Returns {tree, cols, rows, reflowed, reason}. Throws only when the drawer itself is below minBin.
function layoutFits(tree,W,D,minBin=30,gap=.8){
 if(!tree)return false;gap=Math.max(0,+gap||0);minBin=+minBin||30;
 for(const c of treeCells(tree)){
  const gx=(c.x0>1e-12?gap/2:0)+(c.x1<1-1e-12?gap/2:0),gy=(c.y0>1e-12?gap/2:0)+(c.y1<1-1e-12?gap/2:0);
  if((c.x1-c.x0)*W-gx<minBin-1e-6||(c.y1-c.y0)*D-gy<minBin-1e-6)return false;
 }
 return true;
}
function fitLayout(W,D,tree,minBin=30,gap=.8){
 W=+W;D=+D;minBin=+minBin||30;gap=Math.max(0,+gap||0);
 const cell=minBin+gap;
 if(!(W>=minBin&&D>=minBin))throw Error(`Drawer inside must be at least ${minBin} mm wide and deep to print bins. Measure the clear opening and try again.`);
 if(tree&&layoutFits(tree,W,D,minBin,gap))return {tree,reflowed:false};
 // Prefer fewer, larger bins (~90 mm cells \u2192 about 2\u20133 columns in a typical drawer) instead of a dense mini grid.
 const prefer=Math.max(cell,90),cols=Math.max(1,Math.min(4,Math.floor(W/prefer)||1,Math.floor(W/cell))),rows=Math.max(1,Math.min(4,Math.floor(D/prefer)||1,Math.floor(D/cell)));
 return {tree:treeGrid(rows,cols),cols,rows,reflowed:true,reason:`Reflowed to a ${cols}\u00d7${rows} grid of larger bins so every compartment stays at least ${minBin} mm in this drawer.`};
}

// A merge can remove a historical split line or create a non-slicing partition.
// Store actual rectangles rather than forcing the layout back into a binary split history.
const layoutEps=1e-9;
const sameBinValue=(a,b)=>a===b||Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-6;
function layoutCell(c){return {id:c.id,x0:c.x0,x1:c.x1,y0:c.y0,y1:c.y1,...(c.bin?{bin:{...c.bin}}:{}),...(c.kitchen?{kitchen:{...c.kitchen}}:{}),...(c.insert?{insert:{...c.insert}}:{})};}
function setLayout(tree,cells){const id=tree.id;for(const k of Object.keys(tree))delete tree[k];tree.id=id;tree.layout=cells.map(layoutCell);}
function treeCanResize(tree,id,axis,edge){const c=treeCells(tree).find(c=>c.id===id);if(!c||!['x','y'].includes(axis))return false;if(edge)return edge==='min'?c[axis+'0']>layoutEps:edge==='max'&&c[axis+'1']<1-layoutEps;return c[axis+'1']<1-layoutEps||c[axis+'0']>layoutEps;}
// Intervals that only touch at an endpoint still belong to one continuous divider.
// The old >layoutEps test skipped those, so dragging one bin's edge left a jog and later 3-bin merges failed.
const intervalsJoin=(a0,a1,b0,b1)=>Math.min(a1,b1)-Math.max(a0,b0)>=-layoutEps;
function layoutSeam(cells,c,axis,edge){
 const other=axis==='x'?'y':'x',q=c[axis+(edge==='max'?'1':'0')];let lo=c[other+'0'],hi=c[other+'1'],changed=true;
 const on=cells.filter(a=>Math.abs(a[axis+'0']-q)<layoutEps||Math.abs(a[axis+'1']-q)<layoutEps);
 while(changed){changed=false;for(const a of on)if(intervalsJoin(lo,hi,a[other+'0'],a[other+'1'])){const l=Math.min(lo,a[other+'0']),h=Math.max(hi,a[other+'1']);if(l<lo-layoutEps||h>hi+layoutEps){lo=l;hi=h;changed=true;}}}
 const touching=on.filter(a=>intervalsJoin(lo,hi,a[other+'0'],a[other+'1']));
 return {before:touching.filter(a=>Math.abs(a[axis+'1']-q)<layoutEps),after:touching.filter(a=>Math.abs(a[axis+'0']-q)<layoutEps)};
}
function treeResize(tree,id,axis,desired,W,D,edge,unitMm){
 const cells=treeCells(tree).map(layoutCell),c=cells.find(c=>c.id===id);if(!c)throw Error('Select a bin first.');if(!Number.isFinite(desired))return false;
 edge||=c[axis+'1']<1-layoutEps?'max':'min';if(!treeCanResize(tree,id,axis,edge))return false;
 const span=axis==='x'?W:D;if(!Number.isFinite(span)||span<=0)throw Error('Enter valid drawer dimensions before resizing bins.');const unit=+unitMm>0?+unitMm:0;if(unit)desired=Math.max(1,Math.round(desired/unit))*unit;const seam=layoutSeam(cells,c,axis,edge),min=(unit||30)/span,lo=Math.max(...seam.before.map(a=>a[axis+'0']+min)),hi=Math.min(...seam.after.map(a=>a[axis+'1']-min));
 if(lo>hi+layoutEps)throw Error('Drawer is too small to keep every bin at its minimum size. Use fewer bins or a larger drawer.');
 let q=clamp(edge==='max'?c[axis+'0']+desired/span:c[axis+'1']-desired/span,lo,hi);if(unit){const n=span/unit;q=clamp(Math.round(q*n)/n,lo,hi);}const old=c[axis+(edge==='max'?'1':'0')];if(Math.abs(q-old)<1e-12)return false;
 for(const a of seam.before)a[axis+'1']=q;for(const a of seam.after)a[axis+'0']=q;setLayout(tree,cells);return true;
}
// Appearance overrides live on stable leaf IDs, not display indices or generated meshes.
function treeBinStyle(tree,id,changes){
 if(tree.layout){const c=tree.layout.find(c=>c.id===id);return c?treeBinStyle(c,id,changes):false;}
 if(tree.axis)return treeBinStyle(tree.left,id,changes)||treeBinStyle(tree.right,id,changes);
 if(tree.id!==id)return false;
 const style={...tree.bin},extra=BF.clampStyleChanges(changes);
 for(const key of ['wall','radius','innerRadius','height'])if(Object.hasOwn(changes,key)){if(changes[key]==null)delete style[key];else if(Number.isFinite(+changes[key]))style[key]=clamp(+changes[key],key==='wall'?.8:key==='height'?6:0,key==='wall'?6:key==='height'?298:150);}
 for(const [key,v] of Object.entries(extra)){if(['wall','radius','innerRadius','height'].includes(key))continue;if(v==null)delete style[key];else style[key]=v;}
 if(Object.keys(style).length)tree.bin=style;else delete tree.bin;return true;
}
// Organizer objects live on stable leaf IDs; choosing one replaces any kitchen feature in that slot.
// Make a bin flat again: drop its organizer object and any kitchen / crafts insert (style, label and size stay).
// Label text for one bin: kitchen trays print it on the floor; other bins use it on their label tab, front label or lid.
function treeLabel(tree,id,text){
 if(tree.layout){const c=tree.layout.find(c=>c.id===id);return c?treeLabel(c,id,text):false;}
 if(tree.axis)return treeLabel(tree.left,id,text)||treeLabel(tree.right,id,text);
 if(tree.id!==id)return false;
 if(tree.kitchen){if(text==null)delete tree.kitchen.text;else tree.kitchen={...tree.kitchen,text:BF.cleanLabel(text)};return true;}
 return treeBinStyle(tree,id,{labelText:text==null?null:String(text).slice(0,24)});
}
// Where a kitchen tray's floor lettering goes: centered near the back wall, 4.4 mm tall, inside the walls with 5 mm margins.
function kitchenLabelBox(w,d,wall){return {height:4.4,maxWidth:w-2*wall-10,cx:w/2,cy:d-wall-10};}
function treeFlat(tree,id){
 if(tree.layout){const c=tree.layout.find(c=>c.id===id);if(!c)return false;delete c.insert;delete c.kitchen;return true;}
 if(tree.axis)return treeFlat(tree.left,id)||treeFlat(tree.right,id);
 if(tree.id!==id)return false;delete tree.insert;delete tree.kitchen;return true;
}
function treeInsert(tree,id,insert){
 if(tree.layout){const c=tree.layout.find(c=>c.id===id);if(!c)return false;if(insert){c.insert={...insert};delete c.kitchen;}else delete c.insert;return true;}
 if(tree.axis)return treeInsert(tree.left,id,insert)||treeInsert(tree.right,id,insert);
 if(tree.id!==id)return false;if(insert){tree.insert={...insert};delete tree.kitchen;}else delete tree.insert;return true;
}
function treeSplit(tree,id,axis,ratio=.5){if(tree.layout){const i=tree.layout.findIndex(c=>c.id===id);if(i<0)return false;const c=tree.layout[i],plain=layoutCell(c);delete plain.kitchen;delete plain.insert;const mid=c[axis+'0']+(c[axis+'1']-c[axis+'0'])*clamp(ratio,.15,.85),cells=tree.layout.slice();cells.splice(i,1,{...plain,id:++nextId,[axis+'1']:mid},{...plain,id:++nextId,[axis+'0']:mid});setLayout(tree,cells);return true;}if(tree.id===id&&!tree.axis){const style=tree.bin;Object.assign(tree,branch(axis,clamp(ratio,.15,.85)));delete tree.bin;delete tree.insert;if(style){tree.left.bin={...style};tree.right.bin={...style};}return true;}return !!tree.axis&&(treeSplit(tree.left,id,axis,ratio)||treeSplit(tree.right,id,axis,ratio));}
function binList(nums){
 const n=[...new Set(nums)].sort((a,b)=>a-b);
 if(n.length===1)return `bin ${n[0]}`;
 if(n.length===2)return `bins ${n[0]} and ${n[1]}`;
 return `bins ${n.slice(0,-1).join(', ')}, and ${n.at(-1)}`;
}
const mergeEps=1e-6;
function mergeBounds(tree,ids){
 const chosen=new Set(ids),cells=treeCells(tree),selected=cells.filter(c=>chosen.has(c.id));
 if(chosen.size<2)throw Error('Select at least two bins to merge. Tap layout tiles, or turn on Select multiple bins for 3D.');
 if(selected.length!==chosen.size)throw Error('The layout changed. Select the bins again.');
 const box={x0:Math.min(...selected.map(c=>c.x0)),x1:Math.max(...selected.map(c=>c.x1)),y0:Math.min(...selected.map(c=>c.y0)),y1:Math.max(...selected.map(c=>c.y1))};
 const overlap=c=>Math.max(0,Math.min(c.x1,box.x1)-Math.max(c.x0,box.x0))*Math.max(0,Math.min(c.y1,box.y1)-Math.max(c.y0,box.y0));
 // If every bin inside the bounding rectangle is selected, merge into that rectangle (tiny gaps from stretching are fine).
 const missing=cells.filter((c,i)=>!chosen.has(c.id)&&overlap(c)>mergeEps);
 if(missing.length){
  const nums=missing.map(c=>cells.indexOf(c)+1);
  throw Error(`These bins don't form a rectangle; also select ${binList(nums)}.`);
 }
 return {...box,selected};
}
function treeMerge(tree,ids,defaults={}){
 // Validate the ENTIRE selection before changing anything: no partial merges on error.
 const {selected,...box}=mergeBounds(tree,ids),chosen=new Set(ids),style={};
 for(const key of ['wall','radius','innerRadius','height',...BF.STYLE_KEYS.filter(k=>!['wall','radius','innerRadius','height'].includes(k))]){const values=selected.map(c=>c.bin?.[key]??defaults[key]);if(values.every(v=>sameBinValue(v,values[0]))&&values[0]!=null&&selected.some(c=>Object.hasOwn(c.bin||{},key)))style[key]=values[0];}
 const merged={...box,id:++nextId,...(Object.keys(style).length?{bin:style}:{})},cells=[];let added=false;
 for(const c of treeCells(tree)){if(chosen.has(c.id)){if(!added){cells.push(merged);added=true;}}else cells.push(c);}
 setLayout(tree,cells);return tree;
}
function mixedTree(){return branch('x',.45,branch('y',.5,leaf(),branch('x',.5,branch('y',.32),branch('y',.65))),branch('x',.5,branch('y',.5,branch('x',.4),leaf()),branch('y',.5,leaf(),branch('y',.6))));}
function randomTree(W,D,count=15,seed=Date.now()){let x=seed>>>0;const rand=()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;},root=leaf();for(let i=1;i<count;i++){const options=treeCells(root).filter(c=>(c.x1-c.x0)*W>=65||(c.y1-c.y0)*D>=65);if(!options.length)break;options.sort((a,b)=>(b.x1-b.x0)*(b.y1-b.y0)-(a.x1-a.x0)*(a.y1-a.y0));const c=options[Math.min(options.length-1,Math.floor(rand()*Math.min(3,options.length)))],w=(c.x1-c.x0)*W,d=(c.y1-c.y0)*D,axis=w>d*1.3?'x':d>w*1.3?'y':rand()<.5?'x':'y',span=axis==='x'?w:d;if(span<65){i--;continue;}treeSplit(root,c.id,axis,clamp(.28+rand()*.44,30/span,1-30/span));}return root;}
// 42 mm grid unit layouts: every seam sits on a whole unit, so bins are n\u00d742 \u2212 0.5 mm and line up with a standard baseplate.
const GU=42;
function gridUnitFit(width,depth){const nx=Math.max(1,Math.floor((+width+1e-6)/GU)),ny=Math.max(1,Math.floor((+depth+1e-6)/GU));return {nx,ny,w:nx*GU,d:ny*GU,leftW:Math.max(0,+width-nx*GU),leftD:Math.max(0,+depth-ny*GU)};}
function snapUnit(v,n){return clamp(Math.round(v*n),0,n)/n;}
function treeSnapUnits(tree,nx,ny){
 nx=Math.max(1,Math.round(nx));ny=Math.max(1,Math.round(ny));
 const before=treeCells(tree),cells=before.map(layoutCell).map(c=>({...c,x0:snapUnit(c.x0,nx),x1:snapUnit(c.x1,nx),y0:snapUnit(c.y0,ny),y1:snapUnit(c.y1,ny)})).filter(c=>c.x1-c.x0>layoutEps&&c.y1-c.y0>layoutEps);
 const changed=cells.length!==before.length||cells.some((c,i)=>{const b=before.find(b=>b.id===c.id);return !b||['x0','x1','y0','y1'].some(k=>Math.abs(b[k]-c[k])>1e-12);});
 if(changed)setLayout(tree,cells);return {changed,dropped:before.length-cells.length};
}
function cellUnits(c,nx,ny){return {ux0:Math.round(c.x0*nx),ux1:Math.round(c.x1*nx),uy0:Math.round(c.y0*ny),uy1:Math.round(c.y1*ny)};}
function randomUnitTree(nx,ny,count,seed=Date.now()){
 nx=Math.max(1,Math.round(nx));ny=Math.max(1,Math.round(ny));count=Math.round(count||clamp(Math.round(nx*ny/2.5),2,15));
 let x=seed>>>0;const rand=()=>{x=(1664525*x+1013904223)>>>0;return x/4294967296;};
 let cells=[{id:++nextId,ux0:0,ux1:nx,uy0:0,uy1:ny}];
 for(let guard=0;cells.length<count&&guard<200;guard++){
  const options=cells.filter(c=>c.ux1-c.ux0>=2||c.uy1-c.uy0>=2);if(!options.length)break;
  options.sort((a,b)=>(b.ux1-b.ux0)*(b.uy1-b.uy0)-(a.ux1-a.ux0)*(a.uy1-a.uy0));
  const c=options[Math.min(options.length-1,Math.floor(rand()*Math.min(3,options.length)))],w=c.ux1-c.ux0,d=c.uy1-c.uy0;
  const axis=w<2?'y':d<2?'x':w>d*1.3?'x':d>w*1.3?'y':rand()<.5?'x':'y',span=axis==='x'?w:d,k=1+Math.floor(rand()*(span-1)),cut=(axis==='x'?c.ux0:c.uy0)+k;
  const a={...c,id:++nextId},b={...c,id:++nextId};if(axis==='x'){a.ux1=cut;b.ux0=cut;}else{a.uy1=cut;b.uy0=cut;}
  cells.splice(cells.indexOf(c),1,a,b);
 }
 return {id:++nextId,layout:cells.map(c=>({id:c.id,x0:c.ux0/nx,x1:c.ux1/nx,y0:c.uy0/ny,y1:c.uy1/ny}))};
}
function grid(rows=3,cols=3){return Array.from({length:rows*cols},(_,i)=>({x0:i%cols,x1:i%cols+1,y0:Math.floor(i/cols),y1:Math.floor(i/cols)+1}));}
function merge(cells,ids){if(ids.length<2)throw Error('Select at least two neighboring bins to merge.');const selected=ids.map(i=>cells[i]);const q={x0:Math.min(...selected.map(c=>c.x0)),x1:Math.max(...selected.map(c=>c.x1)),y0:Math.min(...selected.map(c=>c.y0)),y1:Math.max(...selected.map(c=>c.y1))};
 const area=selected.reduce((s,c)=>s+(c.x1-c.x0)*(c.y1-c.y0),0);if(Math.abs(area-(q.x1-q.x0)*(q.y1-q.y0))>1e-6)throw Error('Select a complete rectangle of neighboring bins. L-shaped selections cannot become one rectangular bin.');return cells.filter((c,i)=>!ids.includes(i)).concat(q);}
function split(cells,id,axis='x',ratio=.5){if(!cells[id])throw Error('Select one bin to split.');ratio=clamp(+ratio||.5,.15,.85);const c=cells[id],mid=c[axis+'0']+(c[axis+'1']-c[axis+'0'])*ratio;return cells.filter((c,i)=>i!==id).concat({...c,[axis+'1']:mid},{...c,[axis+'0']:mid});}
function coordinate(value,weights){const sum=weights.reduce((a,b)=>a+b,0),i=Math.min(weights.length-1,Math.floor(value));return (weights.slice(0,i).reduce((a,b)=>a+b,0)+(value-i)*weights[i])/sum;}
// Usable plate area for one part (Bambu X1/P1 keep a 24 mm strip free); bed may be a square size or [x, y].
const EDGE=6,PACK_GAP=4;
function bedXY(bed){return Array.isArray(bed)?[+bed[0]||256,+bed[1]||+bed[0]||256]:[+bed||256,+bed||256];}
function usable(bed,preset){const [bx,by]=bedXY(bed),offsetY=['P1S','P1P','X1 Carbon'].includes(preset)?24:0;return [bx-2*EDGE-1,by-offsetY-2*EDGE-1,offsetY];}
// Printables: a part split to the bed contributes its pieces; every other part prints whole.
function printables(parts){const out=[];for(const pt of parts){if(pt.isGhost)continue;if(pt.pieces)out.push(...pt.pieces);else out.push(pt);}return out;}
function pack(parts,bed,preset,bedZ){const [bx,by]=bedXY(bed),offsetY=['P1S','P1P','X1 Carbon'].includes(preset)?24:0,list=printables(parts),maxZ=bedZ||Math.min(bx,by);const p=T.pack(list.map(pt=>({w:pt.w,h:pt.d})),bx,by-offsetY,PACK_GAP,EDGE),plates=Array.from({length:p.sheets},()=>[]),packed=[];const oversize=[];
 list.forEach((pt,i)=>{const pos=p.place[i];if(pos.sheet<0||pt.h>maxZ){oversize.push(pt.name);return;}let q=pt.local;
 if(pos.rot){q=Float64Array.from(q,(v,k)=>k%3===0?pt.local[k+1]:k%3===1?pt.w-pt.local[k-1]:v);}
 q=move(q,pos.x,pos.y+offsetY);plates[pos.sheet].push(packed.length);
 const bodies=pt.bodies?pt.bodies.map(b=>{let m=b.local;if(pos.rot)m=Float64Array.from(m,(v,k)=>k%3===0?m[k+1]:k%3===1?pt.w-m[k-1]:v);return {...b,p:move(m,pos.x,pos.y+offsetY)};}):null;
 packed.push({...pt,p:q,plate:pos.sheet,...(bodies?{bodies}:{})});});return {packed,plates:plates.filter(l=>l.length),oversize};}
// A part bigger than the plate is rebuilt in pieces with dovetail joints (GPPlates). build() returns
// {mesh, lids:[{local,...}]} in the part's own 0..w \u00d7 0..d frame; pieces keep that frame for the assembled preview.
function splitToBed(w,d,bed,preset,build,o={}){const [W,D]=usable(bed,preset);return PL.buildSplit(w,d,W,D,build,{count:o.splitCount,edge:o.edge,tabZ:o.tabZ});}
// Kitchen layouts keep the same normalized slot model and printable-bin export path.
const KNIFE_PRESETS={chef:{label:'Chef',length:200,slot:3.6,spacing:22,angle:18},bread:{label:'Bread',length:240,slot:4.0,spacing:24,angle:16},paring:{label:'Paring',length:110,slot:3.2,spacing:18,angle:20},mixed:{label:'Mixed set',lengths:[240,210,200,180,160,140,120,100],slot:3.8,spacing:22,angle:18}};
function kitchenPreset(o={}){
 const W=+o.width-2*(o.clearance??1),D=+o.depth-2*(o.clearance??1),kind=o.kind||'silverware',count=Math.round(o.count??(kind==='spice'?6:kind==='herb'?6:kind==='utensils'?3:kind==='small'?4:kind==='knives'?6:5)),rows=Math.round(o.rows??(kind==='herb'?4:2)),length=+o.length||220,knifeWidth=+o.laneWidth||80,diameter=+o.diameter||42,spacing=+o.spacing||14,slot=+o.slot||2.5,wall=+o.wall||1.6,entries=[];
 const maxCount=kind==='herb'?12:8,maxRows=kind==='herb'?8:6;
 if(![W,D,count,rows,length,knifeWidth,diameter,spacing,slot,wall].every(Number.isFinite)||W<40||D<40||count<1||count>maxCount||rows<1||rows>maxRows)throw Error(kind==='herb'?'Use valid drawer dimensions, 1\u201312 jars per row and 1\u20138 tiers.':'Use valid drawer dimensions, 1\u20138 compartments per row and 1\u20136 rows.');
 const pick=o.wells?{wells:true,lift:o.lift??5,wellWidth:o.wellWidth??26,wellLength:o.wellLength??34,wellOffset:o.wellOffset??6,wellEnds:o.wellEnds||'front',wellThrough:o.wellThrough===true}:{},scoopSize={...(o.scoopDepth!=null?{scoopDepth:+o.scoopDepth}:{}),...(o.scoopWidth!=null?{scoopWidth:+o.scoopWidth}:{})};
 const add=(x0,y0,x1,y1,label,feature='tray',extra={})=>{if(x1-x0<30-1e-6||y1-y0<30-1e-6)throw Error('Kitchen compartments would be too narrow. Reduce the count or increase drawer dimensions.');entries.push({id:++nextId,x0:x0/W,x1:x1/W,y0:y0/D,y1:y1/D,bin:{height:Math.min(40,o.binHeight??((o.height??70)-2)),radius:Math.min(6,o.radius??6)},kitchen:{kind:feature,label,scoop:!!o.scoops,...scoopSize,...extra}});};
 const shortRows=(x0,y0,x1,y1,names)=>{const nx=Math.max(1,Math.ceil((x1-x0)/170)),ny=Math.max(1,Math.ceil((y1-y0)/180));for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)add(x0+(x1-x0)*x/nx,y0+(y1-y0)*y/ny,x0+(x1-x0)*(x+1)/nx,y0+(y1-y0)*(y+1)/ny,names[(x+y*nx)%names.length]);};
 if(kind==='silverware'||kind==='utensils'){
  if(kind==='silverware'&&count<4)throw Error('Silverware uses at least four lanes for forks, spoons, table knives and teaspoons.');
  const need=length+2*wall+8;if(D<need)throw Error('Drawer is too shallow for the requested utensil length. Reduce utensil length or increase drawer depth.');const front=D-need<40?D:need;
  const widths=kind==='silverware'?Array.from({length:count},(_,i)=>i===2?knifeWidth:(W-knifeWidth)/(count-1)):Array(count).fill(W/count),names=kind==='silverware'?['Forks','Spoons','Table knives','Teaspoons','Larger utensils','Dessert forks','Soup spoons','Extra cutlery']:['Spatulas','Whisks','Tongs','Serving tools','Long utensils'];let x=0;
  for(let i=0;i<count;i++){add(x,0,x+widths[i],front,names[i%names.length],'tray',{usableLength:length,...pick});x+=widths[i];}if(front<D)shortRows(0,front,W,D,['Measuring spoons','Bag clips','Tea packets']);
 }else if(kind==='small'){
  const names=['Bag clips','Measuring spoons','Tea packets','Bottle tools','Jar lids','Small utensils'];for(let y=0;y<rows;y++)for(let x=0;x<count;x++)add(W*x/count,D*y/rows,W*(x+1)/count,D*(y+1)/rows,names[(x+y*count)%names.length]);
 }else if(kind==='spice'){
  if(diameter<20||diameter>80||length<40)throw Error('Use a jar diameter within the displayed range and measure the full jar length.');if((o.height??70)<diameter+(o.floor??1.6)+2)throw Error('The jars need more drawer headroom. Increase drawer height or reduce jar diameter.');
  for(let y=0;y<rows;y++)for(let x=0;x<count;x++)add(W*x/count,D*y/rows,W*(x+1)/count,D*(y+1)/rows,`Spice ${x+y*count+1}`,'spice',{diameter,length,scoop:false});
 }else if(kind==='knives'){
  const preset=KNIFE_PRESETS[o.knifePreset]||null;
  const mixed=!!(o.mixed||o.knifePreset==='mixed'||preset?.lengths);
  const lengths=mixed?(preset?.lengths||o.lengths||[240,210,200,180,160,140,120,100]):null;
  const n=mixed?lengths.length:count;
  const kLength=mixed?Math.max(...lengths):(preset?preset.length:length);
  const kSlot=preset?preset.slot:slot;let kSpacing=preset?preset.spacing:spacing;const kAngle=clamp(+(o.angle??preset?.angle??18),8,40);
  if(kSpacing<10||kSpacing>40||kSlot<1.5||kSlot>6||kSpacing-kSlot<3)throw Error('Use the displayed blade-slot spacing and width ranges, leaving sufficient material between slots.');
  const fill=o.fillDrawer===true;
  const handleDeck=clamp(+(o.handleDeck??(fill?45:36)),28,80);
  // One-click knife block can fill most of the drawer; the kitchen preset keeps a compact lane plus accessory bins.
  const needW=n*kSpacing+2*wall+16,needD=handleDeck+kLength+2*wall+(fill?24:12);
  let w=needW,d=needD;
  if(fill){w=Math.min(W,Math.max(needW,W*.92));d=Math.min(D,Math.max(needD,D*.9));kSpacing=Math.max(kSpacing,Math.min(36,(w-2*wall-24)/n));}
  if(w>W||d>D)throw Error('Knife rack does not fit. Reduce blade count, spacing or blade length, or increase drawer dimensions.');
  if((o.height??70)<40)throw Error('Angled knife block needs at least about 40 mm of drawer height.');
  const binH=fill?Math.min(Math.max(40,o.binHeight??((o.height??70)-4)), (o.height??70)-2):Math.min(40,o.binHeight??((o.height??70)-2));
  add(0,0,w,d,'Knife rack','knife',{count:n,spacing:kSpacing,slot:kSlot,length:kLength,lengths:lengths||undefined,angle:kAngle,handleDeck,scoop:false});
  entries[0].bin={height:binH,radius:Math.min(6,o.radius??6)};
  if(!fill){
   if(D-d>=30)shortRows(0,d,w,D,['Knife accessories']);else entries[0].y1=1;
   if(W-w>=30)shortRows(w,0,W,D,['Small utensils','Bag clips','Measuring spoons']);else{entries[0].x1=1;for(const e of entries.slice(1))e.x1=1;}
  }else{entries[0].x1=1;entries[0].y1=1;}
 }else if(kind==='herb'){
  // Stepped angled herb/spice rack: 3\u20134 rising tiers with roll-stop lips (no brand names).
  if(diameter<20||diameter>80||length<40||length>200)throw Error('Use a jar diameter and length within the displayed ranges.');
  const angle=clamp(+(o.tierAngle??o.angle??30),18,40),lip=clamp(+(o.lip??10),5,16);
  const gap=clamp(+(o.jarGap??5),2,16),pitchX=diameter+gap,rad=angle*Math.PI/180;
  const rampRun=clamp(+(o.rampRun)||Math.max(42,diameter*1.1),32,70);
  const rampRise=Math.max(16,rampRun*Math.tan(rad));
  const stepH=clamp(+(o.stepHeight??14),10,28);
  const tierPitch=rampRun+lip+8;
  const floorTh=+o.floor||1.6,drawerH=o.height??70;
  const needFor=t=>floorTh+lip+rampRise+(t-1)*stepH+diameter*.25;
  let cols=count,tiers=rows;
  if(o.autofit!==false){
   cols=Math.max(1,Math.min(10,Math.floor(W/pitchX)));
   // Prefer 3\u20134 clearly readable tiers that also fit drawer headroom
   tiers=Math.max(3,Math.min(4,Math.floor(D/tierPitch)));
   if(tiers*tierPitch>D)tiers=Math.max(2,Math.floor(D/tierPitch));
   while(tiers>2&&needFor(tiers)>drawerH-1)tiers--;
   const target=Math.round(o.targetJars??24);
   while(cols*tiers>Math.ceil(target*1.2)&&cols>4)cols--;
   if(cols<1||tiers<1)throw Error('Drawer is too small for a herb tray. Widen or deepen it, or reduce jar size.');
  }else if(cols*pitchX>W+1e-6||tiers*tierPitch>D+1e-6)throw Error('Herb tray does not fit. Reduce jars per row or tiers, or enlarge the drawer.');
  const needH=needFor(tiers);
  if(drawerH<needH)throw Error('Herb tray needs more drawer headroom for the angled jars. Increase drawer height or reduce jar diameter / tier angle.');
  const binH=Math.min(Math.max(needH,o.binHeight??needH), drawerH-2);
  add(0,0,W,D,'Herb tray','herb',{diameter,length,cols,rows:tiers,angle,lip,rampRun,stepHeight:stepH,jarGap:gap,scoop:false,count:cols*tiers,ghostJars:o.ghostJars!==false});
  entries[0].bin={height:binH,radius:Math.min(4,o.radius??4)};
 }else if(kind==='silverwareDrawer'){
  // One-click forks/knives/spoons + utensil tray; always auto-fit to the entered drawer size.
  if(W<160||D<150)throw Error('Silverware drawer needs at least about 160 \u00d7 150 mm inside. Enter your drawer size, or try the 40 \u00d7 30 cm example.');
  const silverLen=clamp(Math.min(220,Math.max(150,D*.52)),120,Math.min(260,D-70));
  const front=clamp(silverLen+2*wall+8,Math.min(D*.48,D-70),D-Math.max(70,D*.28));
  const back=D-front;
  const knifeWidth=clamp(Math.min(90,Math.max(55,W*.22)),50,120);
  const widths=[(W-knifeWidth)/3,(W-knifeWidth)/3,knifeWidth,(W-knifeWidth)/3],names=['Forks','Spoons','Table knives','Teaspoons'];let x=0;
  for(let i=0;i<4;i++){add(x,0,x+widths[i],front,names[i],'tray',{usableLength:Math.min(silverLen,front-2*wall-4),...pick});x+=widths[i];}
  if(back>=70){const uCount=back>=110?3:2,uNames=['Spatulas','Whisks','Tongs'],uLen=Math.min(back-2*wall-8,Math.max(100,back*.85));for(let i=0;i<uCount;i++)add(W*i/uCount,front,W*(i+1)/uCount,D,uNames[i],'tray',{usableLength:uLen,...pick});}
  else shortRows(0,front,W,D,['Measuring spoons','Bag clips','Tea packets']);
 }else throw Error('Choose a kitchen layout.');
 // Only geometrically matching slots inherit old overrides; Undo restores the entire previous layout.
 for(const e of entries){const old=(o.previous||[]).find(c=>['x0','x1','y0','y1'].every(k=>Math.abs(c[k]-e[k])<1e-8));if(old?.bin)e.bin={...e.bin,...old.bin};}
 return {id:++nextId,layout:entries};
}
// Slice triangle faces at identical X stations before warping. Shared edges remain identical,
// so curved scoops/cradle floors are actual smooth-profile surfaces, not stacked steps or overlapping solids.
function kitchenSlices(mesh,cuts,minZ=-Infinity){const result=[],clip=(vs,x,keep)=>{const out=[];for(let i=0;i<vs.length;i++){const a=vs[i],b=vs[(i+1)%vs.length],A=keep*(a[0]-x)>=-1e-10,B=keep*(b[0]-x)>=-1e-10;if(A)out.push(a);if(A!==B){const t=(x-a[0])/(b[0]-a[0]);out.push([x,a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])]);}}return out;};
 for(let i=0;i<mesh.length;i+=9){const tri=[Array.from(mesh.slice(i,i+3)),Array.from(mesh.slice(i+3,i+6)),Array.from(mesh.slice(i+6,i+9))];if(Math.max(...tri.map(p=>p[2]))<minZ){result.push(...tri.flat());continue;}const lo=Math.min(...tri.map(p=>p[0])),hi=Math.max(...tri.map(p=>p[0])),xs=[lo,...cuts.filter(x=>x>lo+1e-8&&x<hi-1e-8),hi];if(hi-lo<1e-8){result.push(...tri.flat());continue;}for(let j=0;j<xs.length-1;j++){const p=clip(clip(tri,xs[j],1),xs[j+1],-1);for(let k=1;k<p.length-1;k++){const a=p[0],b=p[k],c=p[k+1],u=b.map((v,n)=>v-a[n]),v=c.map((v,n)=>v-a[n]);if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-9)result.push(...a,...b,...c);}}}return Float64Array.from(result);
}
function pickWells(w,d,h,wall,floor,radius,k,innerRadius){
 const lift=clamp(k.lift??5,2,15),ww=clamp(k.wellWidth??26,12,60),wl=clamp(k.wellLength??34,16,80),off=clamp(k.wellOffset??6,2,60),ends=['front','back','both'].includes(k.wellEnds)?k.wellEnds:'front',through=k.wellThrough!==false,iw=w-2*wall,id=d-2*wall;
 if(h-floor-lift<10)throw Error('Pick-out wells need a taller bin: the raised lane floor must leave at least 10 mm of wall. Lower the raised floor, turn wells off, or use a taller bin.');
 const W=Math.min(ww,iw-6);if(W<12)throw Error('This lane is too narrow for a finger well. Widen the lane or turn pick-out wells off.');
 const R=BF.clampInnerRadius(innerRadius,w,d,wall,radius),y0=off+Math.min(R,W/2),need=(ends==='both'?2:1)*(wl+y0)+20;if(id<need)throw Error('This lane is too short for its pick-out wells. Shorten the wells, reduce the offset, use one end, or deepen the bin.');
 const at=y=>T.roundRect(w/2-W/2,y,w/2+W/2,y+wl,W/2-.02,24),holes=[];if(ends!=='back')holes.push(poly(at(wall+y0)));if(ends!=='front')holes.push(poly(at(d-wall-y0-wl)));
 return {lift,width:W,length:wl,offset:off,ends,through,holes};
}
// V-notch knife handle cradle geometry for the in-drawer knife block (shared by the mesh, the info and the tests).
function knifeCradle({w,wall,yDeck,handleDeck,spacing,count,x0,deckTop,pocketBottom,blockH}){
 const half=clamp(spacing/2-1.2,4,14),depth=half,zTop=clamp(pocketBottom+22,deckTop+depth+3,blockH-1),zBottom=zTop-depth,y0=yDeck,y1=yDeck+clamp(handleDeck*.35,10,16),steps=Math.max(12,Math.ceil(depth/.5));
 const centers=Array.from({length:count},(_,i)=>x0+(i+.5)*spacing);
 const notches=zm=>{const hw=half*clamp((zm-zBottom)/depth,0,1);return hw<.05?[]:centers.map(cx=>poly([[cx-hw,y0-1],[cx+hw,y0-1],[cx+hw,y1+1],[cx-hw,y1+1]]));};
 return {half,depth,zTop,zBottom,y0,y1,steps,centers,notches,angle:90};
}
function kitchenBin(w,d,h,wall,floor,radius,k,innerRadius){
 [w,d,h,wall,floor,radius]=[w,d,h,wall,floor,radius].map(v=>Math.round(v*1e5)/1e5);
 if(k.usableLength&&d-2*wall<k.usableLength+4)throw Error('This utensil bin is now too short for its measured contents. Deepen it, shorten the requested utensils and Apply again, or Undo the resize.');
 const innerR=BF.clampInnerRadius(innerRadius,w,d,wall,radius);
 const outer=T.roundRect(0,0,w,d,radius,32),inner=T.roundRect(wall,wall,w-wall,d-wall,innerR,32),ring=[{outer,holes:[inner.slice().reverse()]}],layers=[{z0:0,z1:floor,polys:[poly(outer)]}],labelsText={Forks:'FORKS',Spoons:'SPOONS','Table knives':'KNIVES',Teaspoons:'TEASPOONS','Larger utensils':'UTENSILS',Spatulas:'SPATULAS',Whisks:'WHISKS',Tongs:'TONGS','Bag clips':'CLIPS','Tea packets':'TEA','Measuring spoons':'MEASURE'};
 if(k.kind==='knife'){
  // Classic in-drawer knife block: low front handle deck + tall rear block with deep parallel blade pockets.
  const count=Math.round(k.count),spacing=+k.spacing,slotW=Math.max(+k.slot,3.2);
  const lengths=(Array.isArray(k.lengths)&&k.lengths.length===count)?k.lengths.map(Number):Array(count).fill(+k.length);
  const maxLen=Math.max(...lengths),angle=clamp(+(k.angle??18),8,40)*Math.PI/180;
  const handleDeck=clamp(+(k.handleDeck??50),28,90);
  const blockW=count*spacing,x0=(w-blockW)/2;
  if(blockW+2*wall+8>w)throw Error('Knife slots no longer fit this bin. Widen it or apply a smaller knife preset.');
  const yDeck=wall+4,yBlock=yDeck+handleDeck,yEnd=Math.min(d-wall-4,yBlock+maxLen+20);
  if(yEnd<=yBlock+40)throw Error('Knife rack needs a deeper bin for its blade slots.');
  const blockH=Math.min(h-0.5,Math.max(floor+36,h*0.96)),slotFloor=floor+6,pocketBottom=slotFloor+4;
  if(blockH<pocketBottom+18)throw Error('Knife rack needs a taller bin to support its blade slots.');
  // Raised block spans most of the bin width so the insert fills the drawer; blade pockets stay centered.
  const blockLeft=wall+2.5,blockRight=w-wall-2.5;
  const deckPoly=poly([[wall+1.5,yDeck],[w-wall-1.5,yDeck],[w-wall-1.5,yBlock],[wall+1.5,yBlock]]);
  const blockPoly=poly([[blockLeft,yBlock],[blockRight,yBlock],[blockRight,yEnd],[blockLeft,yEnd]]);
  const deckTop=Math.min(floor+10,slotFloor),nZ=8;
  // V-notch handle cradle across the front of the deck: each blade drops into its slot and its handle rests in a V
  // right in front of it (90\u00b0 V, 0.5 mm steps; straight walls, prints without supports).
  const cr=knifeCradle({w,wall,yDeck,handleDeck,spacing,count,x0,deckTop,pocketBottom,blockH});
  const cradlePoly=poly([[wall-.3,cr.y0],[w-wall+.3,cr.y0],[w-wall+.3,cr.y1],[wall-.3,cr.y1]]);
  const zs=new Set([0,floor,deckTop,slotFloor,pocketBottom,blockH,h,cr.zBottom,cr.zTop]);
  for(let s=1;s<nZ;s++)zs.add(pocketBottom+(blockH-pocketBottom)*s/nZ);
  for(let k=1;k<cr.steps;k++)zs.add(cr.zBottom+(cr.zTop-cr.zBottom)*k/cr.steps);
  const Z=[...zs].filter(z=>z>=0&&z<=h+1e-9).map(z=>Math.round(z*1e5)/1e5).sort((p,q)=>p-q).filter((z,i,A)=>i===0||z-A[i-1]>1e-4);
  const slotHoles=zm=>{const s=clamp(Math.floor((zm-pocketBottom)/(blockH-pocketBottom)*nZ),0,nZ-1),z0=pocketBottom+(blockH-pocketBottom)*s/nZ,widen=(z0-pocketBottom)*Math.tan(angle)*.35,holes=[];
   for(let i=0;i<count;i++){const cx=x0+(i+.5)*spacing,half=slotW/2+widen,len=lengths[i],y0s=yBlock+8,y1s=Math.min(yEnd-5,y0s+len);holes.push(poly([[cx-half,y0s],[cx+half,y0s],[cx+half,y1s],[cx-half,y1s]]));}return holes;};
  const L=[];
  for(let k=0;k+1<Z.length;k++){const z0=Z[k],z1=Z[k+1],zm=(z0+z1)/2;
   if(zm<floor){L.push({z0,z1,polys:[poly(outer)]});continue;}
   const parts=ring.slice();
   if(zm<deckTop)parts.push(deckPoly);
   if(zm<blockH)parts.push(...(zm<pocketBottom?[blockPoly]:T.diffPolys([blockPoly],slotHoles(zm))));
   if(zm<cr.zTop)parts.push(...(zm<=cr.zBottom?[cradlePoly]:T.diffPolys([cradlePoly],cr.notches(zm))));
   L.push({z0,z1,polys:T.unionPolys(parts)});}
  let mesh=T.steppedExtrude(L);
  for(let i=0;i<mesh.length;i++)mesh[i]=Math.round(mesh[i]*1e5)/1e5;
  if(!C.checkClosed(mesh).closed){if(C.fixTJunctions){for(const tol of[1e-4,1e-3,5e-3,2e-2]){mesh=Float64Array.from(C.fixTJunctions(mesh,new Array(mesh.length/9).fill(0),tol).p);if(C.checkClosed(mesh).closed)break;}}if(!C.checkClosed(mesh).closed&&MD&&MD.repair)mesh=MD.repair(mesh,{}).p;if(!C.checkClosed(mesh).closed)throw Error('This kitchen profile could not form a closed solid. Adjust bin size, corner roundness or access scoops and try again.');}
  return mesh;
 }else if(k.kind==='herb'){
  // Bold stepped tiers rising toward the back \u2014 each with a tall lip and steep angled bed.
  const cols=Math.round(k.cols||5),tiers=Math.round(k.rows||4),dia=+k.diameter;
  const angle=clamp(+(k.angle??30),18,40)*Math.PI/180,lip=clamp(+(k.lip??10),5,16);
  const gap=clamp(+(k.jarGap??5),2,16),pitchX=dia+gap;
  const rampRun=clamp(+(k.rampRun)||Math.max(42,dia*1.1),32,70);
  const rampRise=Math.max(16,rampRun*Math.tan(angle));
  const stepH=clamp(+(k.stepHeight??14),10,28),tierPitch=rampRun+lip+8;
  if(cols*pitchX>w+1e-6)throw Error('Herb tray columns no longer fit this bin. Widen it or reduce jar diameter.');
  if(tiers*tierPitch>d-2*wall+1e-6)throw Error('Herb tray tiers no longer fit this bin. Deepen it or reduce tiers.');
  const x0=(w-cols*pitchX)/2,x1=x0+cols*pitchX;
  const roundM=m=>{for(let i=0;i<m.length;i++)m[i]=Math.round(m[i]*1e5)/1e5;return m;};
  const concat=ms=>{let n=0;for(const m of ms)n+=m.length;const out=new Float64Array(n);let o=0;for(const m of ms){out.set(m,o);o+=m.length;}return out;};
  const box=(xA,xB,yA,yB,zA,zB)=>roundM(T.steppedExtrude([{z0:zA,z1:zB,polys:[poly([[xA,yA],[xB,yA],[xB,yB],[xA,yB]])]}]));
  const wedge=(xA,xB,yA,yB,zA,rise,n=14)=>{const L=[];for(let s=0;s<n;s++){const u0=s/n,u1=(s+1)/n,z0=zA+rise*u0,z1=zA+rise*u1,yS=yA+(yB-yA)*u0;L.push({z0,z1,polys:[poly([[xA,yS],[xB,yS],[xB,yB],[xA,yB]])]});}return roundM(T.steppedExtrude(L));};
  // Low outer shell so tiers stay the visual hero
  const rimH=Math.min(h,floor+6);
  const shell=roundM(T.steppedExtrude([{z0:0,z1:floor,polys:[poly(outer)]},{z0:floor,z1:rimH,polys:ring}]));
  const pieces=[shell];
  for(let t=0;t<tiers;t++){
   const yLip=wall+4+t*tierPitch,yRamp0=yLip+Math.max(2.4,lip*.4),yRamp1=yRamp0+rampRun;
   const zBase=floor+t*stepH;
   // Tall roll-stop lip
   pieces.push(box(x0,x1,yLip,yRamp0,zBase,zBase+lip));
   // Thick angled bed wedge
   pieces.push(wedge(x0,x1,yRamp0,yRamp1,zBase+1.2,rampRise,14));
   // Side rails + column dividers
   pieces.push(box(x0-1.5,x0+1.5,yLip,yRamp1,zBase,zBase+lip+rampRise*.6));
   pieces.push(box(x1-1.5,x1+1.5,yLip,yRamp1,zBase,zBase+lip+rampRise*.6));
   for(let c=1;c<cols;c++){const xr=x0+c*pitchX-1.2;pieces.push(box(xr,xr+2.4,yLip,yRamp1,zBase,zBase+lip+rampRise*.45));}
  }
  let mesh=concat(pieces);
  if(!C.checkClosed(mesh).closed){if(C.fixTJunctions){for(const tol of[1e-4,1e-3,5e-3,2e-2]){mesh=Float64Array.from(C.fixTJunctions(mesh,new Array(mesh.length/9).fill(0),tol).p);if(C.checkClosed(mesh).closed)break;}}if(!C.checkClosed(mesh).closed&&MD&&MD.repair)mesh=MD.repair(mesh,{}).p;if(!C.checkClosed(mesh).closed)throw Error('This kitchen profile could not form a closed solid. Adjust bin size, corner roundness or access scoops and try again.');}
  return mesh;
 }else{
  // Pick-out wells: a raised lane floor with finger wells under the handle ends; walls are vertical, so no supports.
  const well=k.wells?pickWells(w,d,h,wall,floor,radius,k,innerRadius):null,base=floor+(well?well.lift:0);if(well){layers.length=0;layers.push({z0:0,z1:floor,polys:well.through?T.diffPolys([poly(outer)],well.holes):[poly(outer)]});layers.push({z0:floor,z1:base,polys:T.unionPolys(ring.concat(T.diffPolys([poly(inner)],well.holes)))});}
  const text=k.text!=null?BF.cleanLabel(k.text):labelsText[k.label],letter=text?labels(text,kitchenLabelBox(w,d,wall).cx,kitchenLabelBox(w,d,wall).cy,4.4,kitchenLabelBox(w,d,wall).maxWidth):[];if(letter.length){layers.push({z0:base,z1:base+.55,polys:T.unionPolys(ring.concat(letter))},{z0:base+.55,z1:h,polys:ring});}else layers.push({z0:base,z1:h,polys:ring});}
 let mesh=T.steppedExtrude(layers);
 if(k.kind==='spice'){
  const R=(k.diameter+1)/2,maxX=R*.86;if(w-2*wall<k.diameter+4||d-2*wall<k.length+4)throw Error('Spice jar does not fit its cradle. Reduce columns/rows or jar dimensions, or widen/deepen the bin.');const rise=R-Math.sqrt(R*R-maxX*maxX);if(h<floor+rise+3)throw Error('Spice cradle needs a taller bin for its anti-roll shoulders.');const cuts=Array.from({length:81},(_,i)=>w/2-maxX+2*maxX*i/80);mesh=kitchenSlices(mesh,cuts);for(let i=0;i<mesh.length;i+=3)if(Math.abs(mesh[i+2]-floor)<1e-7){const x=Math.min(maxX,Math.abs(mesh[i]-w/2));mesh[i+2]+=R-Math.sqrt(R*R-x*x);}
 }else if(k.scoop){
  const sw=Math.min(clamp(k.scoopWidth??46,16,120),w-2*Math.max(radius,wall)-4),depth=Math.min(clamp(k.scoopDepth??16,4,60),(h-floor-(k.wells?clamp(k.lift??5,2,15):0))*.75);if(sw>=10){const cuts=Array.from({length:65},(_,i)=>w/2-sw/2+sw*i/64);mesh=kitchenSlices(mesh,cuts,h-1e-6);for(let i=0;i<mesh.length;i+=3)if(Math.abs(mesh[i+2]-h)<1e-7&&mesh[i+1]<=wall+1e-6){const x=Math.abs(mesh[i]-w/2);if(x<sw/2)mesh[i+2]-=depth*(1+Math.cos(2*Math.PI*x/sw))/2;}}
 }
 // Match the existing polygon/STL weld grid; sub-micron interpolation noise must not open shared edges.
 for(let i=0;i<mesh.length;i++)mesh[i]=Math.round(mesh[i]*1e5)/1e5;
 if(!C.checkClosed(mesh).closed){if(C.fixTJunctions){for(const tol of[1e-4,1e-3,5e-3,2e-2]){mesh=Float64Array.from(C.fixTJunctions(mesh,new Array(mesh.length/9).fill(0),tol).p);if(C.checkClosed(mesh).closed)break;}}if(!C.checkClosed(mesh).closed&&MD&&MD.repair)mesh=MD.repair(mesh,{}).p;if(!C.checkClosed(mesh).closed)throw Error('This kitchen profile could not form a closed solid. Adjust bin size, corner roundness or access scoops and try again.');}
 return mesh;
}

function bin(w,d,h,wall,floor,radius,style,globals,innerRadius){
 const feat=BF.resolveStyle(style,globals),need=feat.scoop||feat.magnets||feat.labelTab!=='none'||feat.stack||feat.floorFillet>0||feat.lid!=='none'||feat.honeycomb||feat.noFloor||feat.gridBase||feat.frontLabel!=='none'||feat.slots!=='none'||feat.cups;
 const innerR=BF.clampInnerRadius(innerRadius,w,d,wall,radius);
 if(!need){const outer=T.roundRect(0,0,w,d,radius,32),inner=T.roundRect(wall,wall,w-wall,d-wall,innerR,32);let mesh=T.steppedExtrude([{z0:0,z1:floor,polys:[poly(outer)]},{z0:floor,z1:h,polys:[{outer,holes:[inner.slice().reverse()]}]}]);for(let i=0;i<mesh.length;i++)mesh[i]=Math.round(mesh[i]*1e5)/1e5;if(!C.checkClosed(mesh).closed&&C.fixTJunctions){for(const tol of[1e-4,1e-3,5e-3,2e-2]){mesh=Float64Array.from(C.fixTJunctions(mesh,new Array(mesh.length/9).fill(0),tol).p);if(C.checkClosed(mesh).closed)break;}}if(!C.checkClosed(mesh).closed&&MD&&MD.repair)mesh=MD.repair(mesh,{}).p;if(!C.checkClosed(mesh).closed)throw Error('This bin could not form a closed solid. Adjust corner roundness or wall thickness and try again.');return {mesh,lids:[],floor,height:h,info:{innerRadius:innerR},style:feat,w,d,radius,innerRadius:innerR};}
 return BF.buildBin(w,d,h,wall,floor,radius,feat,{innerRadius});
}
function drawer(o={}){
 let width=clamp(+o.width||420,50,3000),depth=clamp(+o.depth||360,50,3000);const measuredW=width,measuredD=depth;
 // 42 mm grid unit mode: the layout is exactly cols\u00d7rows units (cols\u00d742 by rows\u00d742 mm), centered in the drawer.
 const unitMode=!!o.gridBase&&!!o.gridUnits;let GX=0,GY=0,FW=0,FD=0,gridOverflow=false;
 if(unitMode){const fit=gridUnitFit(width,depth);GX=clamp(Math.round(+o.gridCols||fit.nx),1,60);GY=clamp(Math.round(+o.gridRows||fit.ny),1,60);FW=GX*GU;FD=GY*GU;gridOverflow=FW>width+1e-6||FD>depth+1e-6;width=Math.max(width,FW);depth=Math.max(depth,FD);}
 const height=clamp(+o.height||70,20,300),clearance=clamp(o.clearance==null?1:+o.clearance,.3,6),gap=clamp(o.gap==null?.8:+o.gap,.3,3),wall=clamp(o.wall==null?1.6:+o.wall,.8,6),floor=clamp(+o.floor||1.6,1.2,4),radius=clamp(o.radius==null?5:+o.radius,0,150),bed=+o.bed||256,plateBed=o.bedY?[bed,+o.bedY]:bed;
 const rows=clamp(Math.round(+o.rows||3),1,8),cols=clamp(Math.round(+o.cols||3),1,8),xs=o.colWeights||Array(cols).fill(1),ys=o.rowWeights||Array(rows).fill(1),cells=o.cells||grid(rows,cols),parts=[],W=width-2*clearance,D=depth-2*clearance,maxHeight=height-2,binHeight=clamp(o.binHeight==null?maxHeight:+o.binHeight,6,maxHeight);
 const gridBase=!!o.gridBase,gridHeightUnits=!!o.gridHeightUnits,lidNotes=new Set(),props=[],obstructions=DU?DU.normObstructions(o.obstructions,width,depth,height):[];let obstructDropped=0;
 const ox=unitMode?(width-FW)/2:clearance,oy=unitMode?(depth-FD)/2:clearance,LW=unitMode?FW:W,LD=unitMode?FD:D;let gridDropped=0;
 cells.forEach((c,i)=>{const at=(v,w)=>o.normalized?v:coordinate(v,w);let left,right,bottom,top,gx0,gx1,gy0,gy1,unitCell=null;
 if(unitMode){
  // Whole units only: each bin is n\u00d742 \u2212 0.5 mm (0.25 mm standard clearance per side), no extra padding or gaps.
  const ux0=Math.round(at(c.x0,xs)*GX),ux1=Math.round(at(c.x1,xs)*GX),uy0=Math.round(at(c.y0,ys)*GY),uy1=Math.round(at(c.y1,ys)*GY);
  if(ux1<=ux0||uy1<=uy0){gridDropped++;return;}
  unitCell={ux0,ux1,uy0,uy1};left=ux0*GU;right=ux1*GU;bottom=uy0*GU;top=uy1*GU;gx0=gx1=gy0=gy1=BF.GRID.clear;
 }else{left=at(c.x0,xs)*W;right=at(c.x1,xs)*W;bottom=at(c.y0,ys)*D;top=at(c.y1,ys)*D;gx0=c.x0>0?gap/2:0;gx1=c.x1<(o.normalized?1:cols)?gap/2:0;gy0=c.y0>0?gap/2:0;gy1=c.y1<(o.normalized?1:rows)?gap/2:0;}
 let w=right-left-gx0-gx1,d=top-bottom-gy0-gy1,obH=Infinity;
 // Obstruction cutouts: a bin under a pipe or post shrinks beside it (or drops); one under an overhang gets lower.
 if(obstructions.length){const ob=DU.obstruct({x:ox+left+gx0,y:oy+bottom+gy0,w,d},Infinity,obstructions);if(ob){if(ob.drop||(gridBase&&(ob.rect.w<w-1e-6||ob.rect.d<d-1e-6))){obstructDropped++;return;}obH=ob.H;left=ob.rect.x-ox-gx0;right=left+ob.rect.w+gx0+gx1;bottom=ob.rect.y-oy-gy0;top=bottom+ob.rect.d+gy0+gy1;w=ob.rect.w;d=ob.rect.d;}}
 const globals={scoop:o.scoop,scoopDepth:o.scoopDepth,scoopWidth:o.scoopWidth,magnets:false,magD:o.magD,magH:o.magH,magClear:o.magClear,labelTab:o.labelTab,labelAngle:o.labelAngle,labelStyle:o.labelStyle,labelText:o.labelText,stack:o.stack,frontLabel:o.frontLabel,stackClear:o.stackClear,floorFillet:o.floorFillet,lid:o.lid,lidT:o.lidT,lidClear:o.lidClear,lidMag:o.lidMag,lidMagFit:o.lidMagFit,lidLabel:o.lidLabel,lidTextStyle:o.lidTextStyle,lidGrab:o.lidGrab,lidGridTop:o.lidGridTop,honeycomb:o.honeycomb,honeyCell:o.honeyCell,noFloor:gridBase?false:o.noFloor,footFlange:o.footFlange,gridBase,gridHeightUnits,gridFoot:BF.footMode(o.gridFoot)};
 let H=Math.min(obH,clamp(c.bin?.height==null?binHeight:+c.bin.height,6,maxHeight)),binWall=clamp(c.bin?.wall==null?wall:+c.bin.wall,.8,6),binRadius=Math.min(clamp(c.bin?.radius==null?radius:+c.bin.radius,0,150),w/2-.01,d/2-.01);
 // Per-bin inside corner; unset falls back to global, then to classic outside-wall pairing.
 const requestedInner=Object.hasOwn(c.bin||{},'innerRadius')?c.bin.innerRadius:(Object.hasOwn(o,'innerRadius')?o.innerRadius:null);
 let binInner=BF.clampInnerRadius(requestedInner,w,d,binWall,binRadius);
 // Divider frame: a walls-only separator with square corners so neighboring frames line up like one divider grid.
 if(c.bin?.binType==='divider'&&!c.insert&&!c.kitchen){binRadius=0;binInner=0;}
 let gridNx=null,gridNy=null,slotW=w,slotD=d;
 if(gridBase){
  if(unitCell){gridNx=unitCell.ux1-unitCell.ux0;gridNy=unitCell.uy1-unitCell.uy0;w=gridNx*GU-BF.GRID.outerPad;d=gridNy*GU-BF.GRID.outerPad;slotW=w;slotD=d;}
  else{const snap=BF.gridSnapSize(w,d);gridNx=snap.nx;gridNy=snap.ny;w=snap.w;d=snap.d;}
  if(gridHeightUnits){const sn=BF.gridSnapHeight(H,true);H=Math.min(sn.h,maxHeight);if(H<BF.GRID.baseH+6)throw Error(`Bin ${i+1}: 42 mm grid height units need more drawer headroom.`);}
  binRadius=Math.min(BF.GRID.rTop,w/2-.01,d/2-.01);
  binInner=BF.clampInnerRadius(requestedInner,w,d,binWall,binRadius);
  globals.gridNx=gridNx;globals.gridNy=gridNy;
 }
 // A lid sits on the rim, so the bin gets shorter by the lid's height and the drawer still closes.
 const lidStyle=BF.resolveStyle(c.bin,globals),lidUp=LIDS.stackHeight(lidStyle,gridBase&&gridNx?{nx:gridNx,ny:gridNy}:null);
 if(lidUp>0){const cap=maxHeight-lidUp;if(cap<(gridBase?BF.GRID.baseH+12:12))throw Error(`Bin ${i+1}: the drawer is too shallow for a lid on this bin. Turn the lid off or use a deeper drawer.`);if(H>cap){H=gridHeightUnits?Math.max(BF.GRID.hUnit*2,Math.floor(cap/BF.GRID.hUnit)*BF.GRID.hUnit):cap;lidNotes.add('Bins with lids are made shorter by the lid height so the drawer still closes.');}}
 if(w<binWall*2+8||d<binWall*2+8)throw Error(`Bin ${i+1} is too narrow. Widen its row/column or merge it.`);
 if(c.kitchen?.kind==='spice'&&height<c.kitchen.diameter+floor+2)throw Error('The spice jars need more drawer headroom. Increase drawer height or reduce jar diameter and Apply again.');
 if(c.kitchen?.kind==='herb'){const a=(c.kitchen.angle||30)*Math.PI/180,run=c.kitchen.rampRun||c.kitchen.diameter*1.1,tiers=c.kitchen.rows||3,step=c.kitchen.stepHeight||14,need=floor+(c.kitchen.lip||10)+Math.max(16,run*Math.tan(a))+(tiers-1)*step+c.kitchen.diameter*.25;if(height<need)throw Error('The herb tray needs more drawer headroom for the angled jars. Increase drawer height or reduce jar diameter / tier angle.');}
 const buildCell=()=>{let local,insert=null,lids=[],plates=[],cups=[],featInfo=null,floorUsed=floor,exportH=H,outW=w,outD=d,outR=binRadius,lidRefused=null;
 // Bins with an organizer object or kitchen insert get the same lid when everything stays at or below the rim; otherwise a clear reason, never silence.
 const lidFor=(feat,what)=>{if(!LIDS.kind(feat.lid))return;let top=-Infinity;for(let k=2;k<local.length;k+=3)if(local[k]>top)top=local[k];if(top>H+.05){lidRefused=`Bin ${i+1}: the ${what} stands ${(top-H).toFixed(1)} mm above the rim, so a lid can't close. Lower the object, make the bin flat, or turn the lid off.`;lidNotes.add(lidRefused);return;}
  const lid=LIDS.buildLid({w,d,radius:binRadius,wall:binWall,innerRadius:binInner,binH:H,style:feat,grid:gridBase&&gridNx?{nx:gridNx,ny:gridNy}:null});if(!lid)return;lids.push(lid);featInfo=Object.assign({},featInfo,{lidInfo:lid.info});(lid.notes||[]).forEach(n=>lidNotes.add(n));if(feat.lid==='magnet')lidNotes.add('Bins with organizer objects or inserts get the magnet pockets in the lid; glue the matching magnets just inside the bin rim.');};
 try{
  const feat=BF.resolveStyle(c.bin,globals),rem=c.insert&&I.byId[c.insert.id]?.kind==='removable'?I.removableStyle(c.insert):null;
  if(rem){const {name,item,id,category,...sty}=rem;let st={...(c.bin||{}),...sty};if(!st.frontText&&st.labelText)st={...st,frontText:st.labelText};const built=bin(w,d,H,binWall,floor,binRadius,st,globals,binInner);if(built.info?.lidNotes)built.info.lidNotes.forEach(n=>lidNotes.add(n));local=built.mesh;lids=built.lids||[];plates=built.plates||[];cups=built.cups||[];featInfo=built.info;floorUsed=built.floor;exportH=built.height||H;outW=built.w||w;outD=built.d||d;outR=built.radius||binRadius;binInner=built.innerRadius??binInner;
   const si=featInfo.slots,ci=featInfo.cups;insert={id,name,category,kind:'removable',item,warnings:ci&&ci.skipped?[`${ci.skipped} compartment${ci.skipped===1?' is':'s are'} too small for a cup.`]:[],count:plates.length,summary:`${[si.countAcross?`${si.countAcross} left-to-right`:'',si.countAlong?`${si.countAlong} front-to-back`:''].filter(Boolean).join(' and ')} slide-in plate${plates.length===1?'':'s'} (${si.t} mm in ${si.slot} mm slots${si.dir==='grid'?', interlocking':''}${si.tab?', label tabs':''}), ${si.cells} compartment${si.cells===1?'':'s'}${ci?`, ${ci.count} drop-in cup${ci.count===1?'':'s'}`:''}`};
  }else if(c.insert){
   const r=I.insertBin(w,d,H,binWall,floor,binRadius,c.insert,height,binInner,{frontLabel:feat.frontLabel,frontText:c.bin?.frontText||c.bin?.labelText||''});local=r.mesh;insert=r.info;if(feat.scoop)local=BF.applyScoop(local,w,d,H,binWall,floor,binRadius,feat);featInfo={scoop:feat.scoop,innerRadius:binInner};lidFor(feat,insert?.name?insert.name.toLowerCase():'object');
   if(feat.gridBase){const g=BF.attachGridFeet(local,w,d,gridNx,gridNy,floor,{foot:feat.gridFoot});local=g.mesh;floorUsed=g.floor;exportH=g.height;outW=g.w;outD=g.d;outR=BF.GRID.rTop;featInfo=Object.assign({},featInfo,{gridBase:true,grid:g.grid});}
  }else if(c.kitchen){
   local=kitchenBin(w,d,H,binWall,floor,binRadius,c.kitchen,binInner);featInfo={scoop:!!c.kitchen.scoop,innerRadius:binInner};lidFor(feat,(c.kitchen.label||'insert').toLowerCase());
   if(feat.gridBase){const g=BF.attachGridFeet(local,w,d,gridNx,gridNy,floor,{foot:feat.gridFoot});local=g.mesh;floorUsed=g.floor;exportH=g.height;outW=g.w;outD=g.d;outR=BF.GRID.rTop;featInfo=Object.assign({},featInfo,{gridBase:true,grid:g.grid,kitchenGrid:true});}
  }else{let st=c.bin&&!c.bin.lidText&&c.bin.labelText?{...c.bin,lidText:c.bin.labelText}:c.bin;if(st&&!st.frontText&&st.labelText)st={...st,frontText:st.labelText};const built=bin(w,d,H,binWall,floor,binRadius,st,globals,binInner);if(built.info?.lidNotes)built.info.lidNotes.forEach(n=>lidNotes.add(n));local=built.mesh;lids=built.lids||[];plates=built.plates||[];cups=built.cups||[];featInfo=built.info;floorUsed=built.floor;exportH=built.height||H;outW=built.w||w;outD=built.d||d;outR=built.radius||binRadius;binInner=built.innerRadius??binInner;}
 }catch(e){throw Error(`Bin ${i+1}: ${e.message}`);}
 return {local,insert,lids,plates,cups,featInfo,floorUsed,exportH,outW,outD,outR,lidRefused};};
 const whole=buildCell(),{insert,featInfo,floorUsed,exportH,outW,outD,outR,plates,cups,lidRefused}=whole;let {local,lids}=whole;
 w=outW;d=outD;binRadius=outR;
 const x=ox+left+gx0+(slotW-w)/2,y=oy+bottom+gy0+(slotD-d)/2;
 const tag=insert?insert.name:(c.kitchen?.label||c.label),base=`${tag?tag.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')+'_':''}bin_${i+1}`;
 // Too big for the plate: the same bin in pieces that lock together with dovetails in the floor (and through any raised block).
 const fitsWhole=PL.fits(w,d,...usable(plateBed,o.preset));let split=null,pieces=null,lidPieces=null;
 if(!fitsWhole){
  const splitOpts={splitCount:o.splitCount,edge:Math.max(12,Math.min(binRadius,40)+binWall+4),tabZ:floorUsed};
  if(gridBase&&gridNx&&gridNy){
   splitOpts.snapX=Array.from({length:gridNx-1},(_,k)=>BF.GRID.pitch*(k+1)-BF.GRID.clear);
   splitOpts.snapY=Array.from({length:gridNy-1},(_,k)=>BF.GRID.pitch*(k+1)-BF.GRID.clear);
  }
  split=splitToBed(w,d,plateBed,o.preset,()=>{const b=buildCell();return b;},splitOpts);
  if(split){
   const n=split.pieces.length,norm=(m0,label,nm,h,isLid,idx)=>{const m=PL.dropCrumbs(m0),bb=C.bbox(m),q=move(m,-bb.min[0],-bb.min[1],-bb.min[2]);return {label,name:nm,local:q,w:bb.max[0]-bb.min[0],d:bb.max[1]-bb.min[1],h:bb.max[2]-bb.min[2],isLid,splitPiece:true,pieceIndex:idx};};
   pieces=split.pieces.map(pc=>norm(pc.built.local,`Bin ${i+1} \u00b7 piece ${pc.index+1} of ${n}`,`${base}_piece_${pc.index+1}of${n}_${w.toFixed(1)}x${d.toFixed(1)}x${exportH.toFixed(1)}mm`,exportH,false,pc.index));
   lidPieces=lids.map((lid,li)=>split.pieces.map(pc=>norm(pc.built.lids[li].local,`Lid \u00b7 bin ${i+1} \u00b7 piece ${pc.index+1} of ${n}`,`${lid.name}_bin_${i+1}_piece_${pc.index+1}of${n}`,lid.h,true,pc.index)));
   local=T.concat(split.pieces.map(pc=>pc.built.local));lids=lids.map((lid,li)=>({...lid,local:T.concat(split.pieces.map(pc=>pc.built.lids[li].local)),worn:T.concat(split.pieces.map(pc=>pc.built.lids[li].worn||pc.built.lids[li].local))}));
  }
 }
 parts.push({label:tag,kitchen:c.kitchen?{...c.kitchen}:null,insert,features:featInfo,grid:featInfo&&featInfo.grid||null,name:`${base}_${w.toFixed(1)}x${d.toFixed(1)}x${exportH.toFixed(1)}mm${featInfo&&featInfo.grid?`_${featInfo.grid.nx}x${featInfo.grid.ny}`:''}`,local,p:move(local,x-width/2,y-depth/2),x,y,w,d,h:exportH,wall:binWall,radius:binRadius,innerRadius:binInner,floor:floorUsed,lids,lidRefused,color:o.normalized?'#cf333f':colors[i%colors.length],cell:c,...(pieces?{pieces,pieceSpans:split.pieces.map(pc=>pc.built.local.length),split:{count:pieces.length,tabs:split.straight?0:split.tabs,nx:split.plan.nx,ny:split.plan.ny,xCuts:split.xCuts,yCuts:split.yCuts}}:{})});
 // Blade bank: a separate closed box (body + snap lid) standing in its pocket; the files keep the support-free print orientation.
 if(insert?.bank){const bk=I.bladeBank(insert.bank.blade==null?0:BLADE_INDEX(insert.bank.blade),insert.bank.height),rotq=(m,w)=>insert.bank.rot?Float64Array.from(m,(v,k)=>k%3===0?bk.D-m[k+1]:k%3===1?m[k-1]:v):m,bw=insert.bank.rot?bk.D:bk.W,bd=insert.bank.rot?bk.W:bk.D;
  const bx=x+binWall+insert.bank.cx-bw/2-width/2,by=y+binWall+insert.bank.cy-bd/2-depth/2,bz=floor+insert.bank.z0,tagB=`${bk.blade.id}_${bk.W.toFixed(1)}x${bk.D.toFixed(1)}`;
  parts.push({label:`Blade bank \u00b7 bin ${i+1}`,name:`blade_bank_body_bin_${i+1}_${tagB}x${bk.body.h.toFixed(1)}mm`,local:bk.body.local,p:move(rotq(bk.body.local),bx,by,bz),x,y,w:bk.W,d:bk.D,h:bk.body.h,wall:null,radius:0,floor:0,isLid:true,isAccessory:true,color:'#9fb6c9',cell:c});
  parts.push({label:`Blade bank lid \u00b7 bin ${i+1}`,name:`blade_bank_lid_bin_${i+1}_${tagB}x${bk.lid.h.toFixed(1)}mm`,local:bk.lid.local,p:move(rotq(bk.lid.worn),bx,by,bz),x,y,w:bk.W,d:bk.D,h:bk.lid.h,wall:null,radius:0,floor:0,isLid:true,isAccessory:true,color:'#7f9ab0',cell:c});
  lidNotes.add(bk.note);}
 // Display-only items (toothbrushes, tubes, swabs\u2026): placement data only; the preview draws them, files never include them.
 if(c.kitchen)props.push({id:'kitchen',kind:c.kitchen.kind,label:String(c.kitchen.label||c.label||''),cell:i,ox:x+binWall-width/2,oy:y+binWall-depth/2,oz:floorUsed,innerW:w-2*binWall,innerD:d-2*binWall,kitchen:{...c.kitchen}});
 if(insert&&(insert.places||insert.ghost))props.push({id:insert.id,cell:i,ox:x+binWall-width/2,oy:y+binWall-depth/2,oz:floorUsed,innerW:insert.innerW,innerD:insert.innerD,places:insert.places||null,ghost:insert.ghost||null,model:insert.ghost?I.BRUSHES[insert.ghost.model].id:null,count:insert.count});
 // Slide-in divider plates: shown standing in their slots; the files print flat.
 // Plates longer than the printer plate print in pieces that lock together with an in-plane dovetail.
 const DXm=G.GPDrawerX||require('./drawer-extras'),[ux,uy]=usable(plateBed,o.preset),plateMax=Math.max(ux,uy);
 const platesOut=[];plates.forEach((pl,k)=>{const big=!PL.fits(pl.w,pl.d,ux,uy)&&pl.outline?DXm.splitPlate(pl,plateMax):null;if(!big){platesOut.push({...pl,k});return;}big.forEach(pc=>platesOut.push({...pl,...pc,k,pieceOf:pc.of,piece:pc.piece}));});
 if(platesOut.some(pl=>pl.pieceOf))lidNotes.add(`Bin ${i+1}: divider plates longer than the printer plate print in pieces that lock together with a dovetail; join the pieces flat on the table, then slide the plate in.`);
 platesOut.forEach(pl=>{const k=pl.k;parts.push({label:`Divider ${k+1}${pl.pieceOf?` piece ${pl.piece} of ${pl.pieceOf}`:''} \u00b7 bin ${i+1}`,name:`divider_plate_${k+1}${pl.pieceOf?`_piece_${pl.piece}of${pl.pieceOf}`:''}_bin_${i+1}_${pl.dir&&featInfo?.slots?.dir==='grid'?(pl.dir==='across'?'lr_':'fb_'):''}${pl.w.toFixed(1)}x${pl.d.toFixed(1)}x${pl.h.toFixed(1)}mm`,divider:{dir:pl.dir,joints:pl.joints,tab:pl.tab,notch:pl.notch,piece:pl.piece||null},local:pl.local,p:move(pl.worn,x-width/2,y-depth/2),x,y,w:pl.w,d:pl.d,h:pl.h,wall:null,radius:0,floor:0,isLid:true,isDivider:true,color:'#9fc29a',cell:c});});
 // Drop-in cups for small parts: shown in their compartments; the files keep them upright (open side up).
 (cups||[]).forEach((cp,k)=>parts.push({label:`Cup ${k+1} \u00b7 bin ${i+1}`,name:`drop_in_cup_${k+1}_bin_${i+1}_${cp.w.toFixed(1)}x${cp.d.toFixed(1)}x${cp.h.toFixed(1)}mm`,local:cp.local,p:move(cp.worn,x-width/2,y-depth/2),x,y,w:cp.w,d:cp.d,h:cp.h,wall:null,radius:0,floor:0,isLid:true,isDivider:true,isCup:true,color:'#e3c27a',cell:c}));
 // Small parts shown in divider / cup compartments (screws, nuts, brass jets, springs): placement only, never exported.
 if(featInfo&&(featInfo.slots||featInfo.cups)&&(featInfo.smallCells||[]).length)props.push({id:'smallparts',cell:i,ox:x-width/2,oy:y-depth/2,oz:floorUsed,cells:featInfo.smallCells,cups:!!(cups&&cups.length)});
 lids.forEach((lid,li)=>{const ln=`${lid.name}_bin_${i+1}_${lid.w.toFixed(1)}x${lid.d.toFixed(1)}x${lid.h.toFixed(1)}mm`;
  // Preview shows the lid closed on its bin; the exported file keeps the support-free print orientation.
  if(lid.knob)parts.push({label:`Knob \u00b7 bin ${i+1}`,name:`lid_knob_bin_${i+1}`,local:lid.knob.local,p:move(lid.knob.worn,x-width/2,y-depth/2,exportH),x,y,w:lid.knob.w,d:lid.knob.d,h:lid.knob.h,wall:null,radius:0,floor:0,isLid:true,isKnob:true,color:'#e0a96d',cell:c});
  // Color decoration: a second body of the same lid (one object, two parts in the 3MF; its own STL).
  const col=!lidPieces&&lid.colors&&lid.colors.length?lid.colors[0]:null;if(lid.colors&&lid.colors.length&&lidPieces)lidNotes.add(`Bin ${i+1}: the lid is split to fit the plate, so its color decoration is left off. Use one color or a bigger printer.`);
  const deco=col?{bodies:[{name:`${ln}_color`,local:col.local,color:col.color}],decoP:move(col.worn,x-width/2,y-depth/2,exportH),decoColor:col.color}:{};
  parts.push({label:`Lid \u00b7 bin ${i+1}`,lidInfo:lid.info||null,name:ln,...deco,local:lid.local,p:lid.worn?move(lid.worn,x-width/2,y-depth/2,exportH):move(lid.local,x-width/2,y-depth/2,exportH+3),x,y,w:lid.w,d:lid.d,h:lid.h,wall:binWall,radius:binRadius,floor:0,isLid:true,color:'#8aa7d6',cell:c,...(lidPieces?{pieces:lidPieces[li]}:{})});});
 });
 if(gridBase&&o.gridBaseplate){
  try{
   const nx=unitMode?GX:Math.max(1,Math.floor(W/BF.GRID.pitch)),ny=unitMode?GY:Math.max(1,Math.floor(D/BF.GRID.pitch));
   if(nx>=1&&ny>=1){
    const bp=BF.buildGridBaseplate(nx,ny,1.2);
    const bx=unitMode?ox:clearance+(W-bp.w)/2,by=unitMode?oy:clearance+(D-bp.d)/2;
    parts.push({label:'42 mm grid baseplate',name:bp.name,local:bp.mesh,p:move(bp.mesh,bx-width/2,by-depth/2,-bp.h-1),x:bx,y:by,w:bp.w,d:bp.d,h:bp.h,wall:0,radius:1,floor:0,isBaseplate:true,color:'#7a8aa0',grid:{nx,ny,label:nx+'\u00d7'+ny+' baseplate'}});
   }
  }catch(e){}
 }
 let gridLeftover=null;
 if(gridBase){
  const bins=parts.filter(p=>!p.isLid&&!p.isBaseplate);
  const used=bins.reduce((s,p)=>s+p.w*p.d,0),area=Math.max(0,W*D-used);
  // Rough leftover strip sizes: unused length along each axis vs the bounding box of snapped bins.
  const minX=Math.min(...bins.map(p=>p.x)),maxX=Math.max(...bins.map(p=>p.x+p.w));
  const minY=Math.min(...bins.map(p=>p.y)),maxY=Math.max(...bins.map(p=>p.y+p.d));
  gridLeftover=unitMode?{area:Math.max(0,measuredW*measuredD-FW*FD),w:Math.max(0,measuredW-FW),d:Math.max(0,measuredD-FD),used,slot:FW*FD,perSideW:Math.max(0,measuredW-FW)/2,perSideD:Math.max(0,measuredD-FD)/2,units:true}:{area,w:Math.max(0,W-(maxX-minX)),d:Math.max(0,D-(maxY-minY)),used,slot:W*D};
 }
 const gridUnits=unitMode?{nx:GX,ny:GY,w:FW,d:FD,x:ox,y:oy,leftW:Math.max(0,measuredW-FW),leftD:Math.max(0,measuredD-FD),overflow:gridOverflow,dropped:gridDropped,measuredW,measuredD}:null;
 if(obstructDropped)lidNotes.add(`${obstructDropped} bin${obstructDropped>1?'s are':' is'} left out where an obstruction leaves less than 30 mm.`);if(obstructions.length&&!obstructDropped)lidNotes.add('Bins next to the obstruction are cut back to clear it.');
 if(DU)for(const n of DU.extras(parts,{o,width,depth,height,unitMode,ox,oy,FW,FD,gap,bed:Math.min(...[].concat(plateBed)),binHeight,move}))lidNotes.add(n);
 const layout=pack(parts,plateBed,o.preset,o.bedZ),drawerPreview=bin(width+8,depth+8,height,4,2,7).mesh;
 return {parts,props,printables:printables(parts),...layout,splits:parts.filter(p=>p.split).map(p=>({name:p.label||'Bin',bin:parts.indexOf(p),count:p.split.count,tabs:p.split.tabs})),width,depth,height,bed,bedY:o.bedY||bed,preset:o.preset,clearance,gap,wall,floor,radius,innerRadius:Object.hasOwn(o,'innerRadius')?o.innerRadius:null,binHeight,gridBase,gridHeightUnits,gridFoot:BF.footMode(o.gridFoot),gridLeftover,gridUnits,layoutOrigin:{x:ox,y:oy,w:LW,d:LD},obstructions,lidNotes:[...lidNotes],drawer:move(drawerPreview,-width/2-4,-depth/2-4,-2),count:parts.length,presets:BF.DRAWER_PRESETS};
}
function labels(text,x,y,height,maxWidth){
 const tl=C.textLoops(text),scale=Math.min(height/5,maxWidth/Math.max(1,tl.W)),positive=[],negative=[];
 for(const L of tl.loops){let area=0;L.forEach((p,i)=>{const q=L[(i+1)%L.length];area+=p[0]*q[1]-q[0]*p[1];});(area>0?positive:negative).push(poly(L.map(p=>[x+(p[0]-tl.W/2)*scale,y+p[1]*scale])));}
 // The existing font deliberately omits punctuation; add printable decimal points and fraction slashes.
 for(let i=0;i<text.length;i++){const bx=x+(i*4-tl.W/2)*scale;if(text[i]==='.')positive.push(poly([[bx,y],[bx+scale,y],[bx+scale,y+scale],[bx,y+scale]]));if(text[i]==='/')positive.push(poly([[bx,y],[bx+scale*.8,y],[bx+3*scale,y+5*scale],[bx+2.2*scale,y+5*scale]]));}
 return negative.length?T.diffPolys(T.unionPolys(positive),negative):T.unionPolys(positive);
}
function tool(o={}){
 const kind=o.kind||'standard',count=clamp(Math.round(+o.count||12),1,80),rows=clamp(Math.round(+o.rows||2),1,8),cols=Math.ceil(count/rows),pitch=clamp(+o.pitch||(kind==='sockets'?32:18),kind==='sockets'?24:kind==='precision'?14:16,65),fit=clamp(+o.fit||.25,.1,.8),bed=+o.bed||256;
 const w=o.fitW?+o.fitW:cols*pitch+8,d=o.fitD?+o.fitD:Math.min(rows,count)*pitch+12;
 if(w<cols*pitch+4||d<Math.min(rows,count)*pitch+8)throw Error('This holder will not fit the selected drawer cell. Reduce the count/rows or spacing, or choose a larger cell.');
 const outer=[poly(T.roundRect(0,0,w,d,4,32))],holes=[],posts=[],text=[],sizes=String(o.sizes||(o.units==='sae'?'1/4,5/16,3/8,7/16,1/2,9/16,5/8,3/4':'6,7,8,9,10,11,12,13,14,15,16,17')).split(',').map(s=>s.trim()).filter(Boolean),drive=+o.drive||6.35,spacingX=(w-8)/cols,usedRows=Math.min(rows,count),spacingY=(d-12)/usedRows;
 if(kind==='sockets'&&!sizes.length)throw Error('Enter at least one metric or SAE socket size.');
 const height=kind==='sockets'?4:18;if(+o.fitH>0&&(kind==='sockets'?12:height+.6)>+o.fitH)throw Error('This holder is taller than the usable drawer-bin height. Choose a taller bin or a shorter holder type.');
 for(let i=0;i<count;i++){
  const x=4+(i%cols+.5)*spacingX,y=7+(Math.floor(i/cols)+.55)*spacingY;
  let name;if(kind==='sockets'){
   const half=(drive-fit)/2;posts.push(poly(T.roundRect(x-half,y-half,x+half,y+half,.5)));name=sizes[i%sizes.length];
   if(drive+4>pitch)throw Error('Socket spacing is too tight for the selected drive. Increase spacing.');
  }else{
   const af=kind==='precision'?4:6.35,R=(af+fit)/Math.sqrt(3),hex=Array.from({length:6},(_,j)=>[x+R*Math.cos(j*Math.PI/3),y+R*Math.sin(j*Math.PI/3)]);holes.push(poly(hex));name=(o.labels||'').split(',')[i]?.trim()||String(i+1);
  }
  if(o.showLabels!==false)text.push(...labels(name,x,y-spacingY*.48,3.2,spacingX-3));
 }
 const label=T.unionPolys(text),top=kind==='sockets'?T.unionPolys(posts.concat(label)):label;
 const layers=kind==='sockets'?[{z0:0,z1:4,polys:outer},{z0:4,z1:4.6,polys:top},{z0:4.6,z1:12,polys:T.unionPolys(posts)}]:[{z0:0,z1:3,polys:outer},{z0:3,z1:height,polys:T.diffPolys(outer,holes)},...(label.length?[{z0:height,z1:height+.6,polys:label}]:[])];
 let local=T.steppedExtrude(layers);const part={name:`${kind}_holder_${count}`,local,p:null,w,d,h:kind==='sockets'?12:height+.6,color:'#6d9f9a'},plateBed=o.bedY?[bed,+o.bedY]:bed;
 // A holder longer than the plate prints in pieces that lock together with dovetails through the base.
 if(!PL.fits(w,d,...usable(plateBed,o.preset))){const split=splitToBed(w,d,plateBed,o.preset,()=>T.steppedExtrude(layers),{splitCount:o.splitCount,edge:6,tabZ:kind==='sockets'?4:3});
  if(split){const n=split.pieces.length;part.pieces=split.pieces.map(pc=>{const m=PL.dropCrumbs(pc.built),bb=C.bbox(m);return {label:`Holder piece ${pc.index+1} of ${n}`,name:`${part.name}_piece_${pc.index+1}of${n}`,local:move(m,-bb.min[0],-bb.min[1],-bb.min[2]),w:bb.max[0]-bb.min[0],d:bb.max[1]-bb.min[1],h:bb.max[2]-bb.min[2],color:part.color,splitPiece:true,pieceIndex:pc.index};});
   part.local=local=T.concat(split.pieces.map(pc=>pc.built));part.split={count:n,tabs:split.straight?0:split.tabs,nx:split.plan.nx,ny:split.plan.ny};}}
 if(o.gridBase){
  try{
   const snap=BF.gridSnapSize(Math.max(w,BF.GRID.footTop),Math.max(d,BF.GRID.footTop));
   const g=BF.attachGridFeet(local,snap.w,snap.d,snap.nx,snap.ny,3,{foot:o.gridFoot});
   local=g.mesh;part.local=local;part.w=g.w;part.d=g.d;part.h=g.height;part.grid=g.grid;w=g.w;d=g.d;
  }catch(e){}
 }
 part.p=move(local,-w/2,-d/2);
 return {parts:[part],printables:printables([part]),splits:part.split?[{name:'Holder',bin:0,count:part.split.count,tabs:part.split.tabs}]:[],...pack([part],plateBed,o.preset,o.bedZ),width:w,depth:d,height:part.h,bed,preset:o.preset,count,kind,drive,fit,pitch,gridBase:!!o.gridBase};
}
// Room presets: a whole drawer laid out as rows of bins, each fitted with an organizer object from the library.
// Rows and cells are proportional weights; ins is a library id plus optional overrides, or null for an open bin.
const ROOMS={
 vanity:{name:'Bathroom vanity drawer',rows:[{h:1,cells:[{w:1.4,ins:{id:'brushes'},label:'Toothbrushes'},{w:1,ins:{id:'lipstick'},label:'Lipstick and balm'},{w:1,ins:{id:'polish'},label:'Nail polish'}]},{h:1,cells:[{w:1.6,ins:{id:'razor'},label:'Razors'},{w:1,ins:{id:'grid',nx:1,ny:1},label:'Small items'},{w:1,ins:null,label:'Open bin'}]}]},
 desk:{name:'Desk and office drawer',rows:[{h:1,cells:[{w:1.4,ins:{id:'penTray'},label:'Pens'},{w:1.2,ins:{id:'sticky'},label:'Sticky notes'},{w:1,ins:{id:'cards'},label:'Business cards'}]},{h:1,cells:[{w:1,ins:{id:'cups',a:28,b:28},label:'Paper clips'},{w:1,ins:{id:'usb'},label:'USB sticks'},{w:1,ins:{id:'sd'},label:'SD cards'},{w:1.2,ins:{id:'cables'},label:'Cables'}]}]},
 junk:{name:'Junk drawer',rows:[{h:1,cells:[{w:1,ins:{id:'aa'},label:'AA batteries'},{w:1,ins:{id:'coins'},label:'Coins'},{w:1.2,ins:{id:'cups'},label:'Odds and ends'}]},{h:1.2,cells:[{w:1.3,ins:{id:'grid'},label:'Small parts'},{w:1,ins:{id:'cables'},label:'Chargers'},{w:1,ins:null,label:'Open bin'}]}]},
 craft:{name:'Craft and sewing drawer',rows:[{h:1,cells:[{w:1.4,ins:{id:'spools'},label:'Thread spools'},{w:1,ins:{id:'bobbins'},label:'Bobbins'},{w:1,ins:{id:'needles'},label:'Needles and pins'}]},{h:1,cells:[{w:1.6,ins:{id:'scissors'},label:'Scissors'},{w:1,ins:{id:'beads'},label:'Buttons and beads'},{w:1,ins:{id:'paint'},label:'Paint bottles'}]}]},
 cables:{name:'Cable and charger drawer',rows:[{h:1.3,cells:[{w:1,ins:{id:'cables'},label:'Coiled cables'},{w:1,ins:{id:'cables'},label:'Wall chargers'}]},{h:1,cells:[{w:1.6,ins:{id:'cableLanes'},label:'Straight cables'},{w:1,ins:{id:'usb'},label:'USB sticks'},{w:1,ins:{id:'tablet'},label:'Phones'}]}]},
 jewelry:{name:'Jewelry tray',rows:[{h:1,cells:[{w:1.4,ins:{id:'rings'},label:'Rings'},{w:1,ins:{id:'earrings'},label:'Stud earrings'}]},{h:1,cells:[{w:1,ins:{id:'grid',nx:2,ny:1},label:'Bracelets'},{w:1,ins:{id:'cups',a:26,b:26},label:'Small pieces'},{w:1,ins:{id:'grid',nx:1,ny:2},label:'Necklaces'}]}]},
 smallparts:{name:'Small parts tray',fitted:true,rows:[{h:1,cells:[{w:1,ins:{id:'smallPartsDividers'},label:'Screws and bolts'},{w:1,ins:{id:'smallPartsCups'},label:'Tiny jets and springs'}]},{h:1,cells:[{w:1,ins:{id:'smallPartsCups'},label:'Nuts and washers'},{w:1,ins:{id:'smallPartsDividers'},label:'Long parts'}]}]},
 gaming:{name:'Video game drawer',rows:[{h:1.6,cells:[{w:1,ins:{id:'gameKit'},label:'Controllers'}]},{h:1,cells:[{w:1.2,ins:{id:'gameCases'},label:'Game cases'},{w:1,ins:{id:'gameCards'},label:'Game cards'},{w:1,ins:{id:'cables'},label:'Cables and headset'}]}]},
 charging:{name:'Charging station drawer',rows:[{h:1,cells:[{w:1,ins:{id:'chargeKit'},label:'Phones and chargers'}]},{h:.6,cells:[{w:1.4,ins:{id:'cableLanes'},label:'Cables'},{w:1,ins:{id:'batteryKit'},label:'Batteries'}]}]},
 tooldrawer:{name:'Tool chest drawer',rows:[{h:1.3,cells:[{w:1,ins:{id:'toolKit'},label:'Hand tools'}]},{h:1,cells:[{w:1,ins:{id:'socketKit'},label:'Sockets'},{w:1,ins:{id:'wrenchKit'},label:'Wrenches'}]}]},
 remotes:{name:'Living room remotes',rows:[{h:1,cells:[{w:1,ins:{id:'remoteKit'},label:'Remotes'},{w:.5,ins:{id:'gameCards'},label:'Game cards'}]}]},
 art:{name:'Kids art and school supplies',rows:[{h:1.2,cells:[{w:1.5,ins:{id:'artKit'},label:'Art kit'},{w:1,ins:{id:'crayons'},label:'Crayons'}]},{h:1,cells:[{w:1.4,ins:{id:'markers'},label:'Markers'},{w:1,ins:{id:'penTray'},label:'Pens and pencils'},{w:1,ins:{id:'erasers'},label:'Erasers'}]}]},
 workshop:{name:'Workshop small parts',rows:[{h:1,cells:[{w:1,ins:{id:'cups',a:24,b:24},label:'Screws'},{w:1,ins:{id:'cups',a:24,b:24},label:'Nuts and washers'},{w:1,ins:{id:'bits'},label:'Hex bits'}]},{h:1,cells:[{w:1.2,ins:{id:'drill'},label:'Drill bits'},{w:1,ins:{id:'hexkeys'},label:'Hex keys'},{w:1,ins:{id:'cups',a:36,b:36},label:'Anchors and plugs'}]}]}
};
function roomPreset(o={}){
 const room=ROOMS[o.kind];if(!room)throw Error('Choose a room layout.');
 if(room.fitted)return smallpartsDrawerPreset(o); // bins sized to the printer plate, so the divider plates fit it too
 const W=+o.width-2*(o.clearance??1),D=+o.depth-2*(o.clearance??1);if(!(W>=80&&D>=80))throw Error('Use valid drawer dimensions of at least 80 mm inside.');
 const entries=[],rows=room.rows,rh=rows.reduce((s,r)=>s+r.h,0);let y=0;
 for(const r of rows){const y1=y+r.h/rh,cw=r.cells.reduce((s,c)=>s+c.w,0);let x=0;
  for(const c of r.cells){const x1=x+c.w/cw;if((x1-x)*W<30-1e-6||(y1-y)*D<30-1e-6)throw Error(`${room.name} needs a larger drawer: some bins would be under 30 mm. Increase drawer width or depth.`);
   const e={id:++nextId,x0:x,x1,y0:y,y1,bin:{height:Math.min(o.binHeight??((o.height??70)-2),(o.height??70)-2)},label:c.label};if(c.ins)e.insert={...c.ins};entries.push(e);x=x1;}
  entries[entries.length-1].x1=1;y=y1;}
 for(const e of entries.slice(-rows[rows.length-1].cells.length))e.y1=1;
 return {id:++nextId,layout:entries,room:o.kind};
}

// Generic paint-container sizes for the arts & crafts drawer (no brand names).
const PAINT_PRESETS={
 craft2oz:{id:'paint',name:'Craft paint bottle (2 oz)',a:39,depth:14,block:16,itemH:100,kind:'pockets'},
 miniPot:{id:'paintMini',name:'Mini paint pot',a:28,depth:12,block:14,itemH:45,kind:'pockets'},
 dropper:{id:'paintDropper',name:'Dropper bottle',a:25,depth:18,block:20,itemH:90,kind:'pockets'},
 acrylicTube:{id:'paintTube',name:'Acrylic paint tube (lying flat)',a:36,depth:12,block:14,itemH:0,kind:'channels'}
};
// One-click arts & crafts drawer: paint rack + pen/marker tray + small bins for gloss, brushes and bits.
function craftsDrawerPreset(o={}){
 const W=+o.width-2*(o.clearance??1),D=+o.depth-2*(o.clearance??1),wall=+o.wall||1.6,gap=+o.gap||.8;
 if(!(W>=80&&D>=80))throw Error('Arts & crafts drawer needs at least about 80 \u00d7 80 mm inside. Enter your drawer size and try again.');
 const paintKey=['craft2oz','miniPot','dropper','acrylicTube'].includes(o.paintPreset)?o.paintPreset:'craft2oz';
 const preset=PAINT_PRESETS[paintKey],diameter=clamp(+(o.paintDiameter??preset.a),12,80);
 const loads=o.loadsOfPaint!==false&&o.loadsOfPaint!==0; // default on for "loads of paints"
 const binH=Math.min(o.binHeight??((o.height??70)-2),(o.height??70)-2);
 const entries=[],push=(x0,y0,x1,y1,label,ins)=>{
  if(x1-x0<30-1e-6||y1-y0<30-1e-6)throw Error('Arts & crafts compartments would be too narrow. Increase drawer dimensions or choose fewer paint holes.');
  const e={id:++nextId,x0:x0/W,x1:x1/W,y0:y0/D,y1:y1/D,bin:{height:binH,radius:Math.min(6,o.radius??6)},label};if(ins)e.insert={...ins};entries.push(e);
 };
 // Layout: paint zone takes most of the drawer when loads-of-paint is on; otherwise about half.
 const paintW=loads?Math.min(W,Math.max(W*.62,W-110)):Math.min(W*.55,W-100);
 const paintD=loads?D:Math.min(D,Math.max(D*.55,140));
 const paintIns=preset.kind==='channels'
  ?{id:preset.id,a:diameter,depth:preset.depth,block:preset.block,...(o.paintCount?{count:Math.round(+o.paintCount)}:{})}
  :{id:preset.id,a:diameter,depth:preset.depth,block:preset.block,fit:1.2,web:2.4,...(o.paintCount?{count:Math.round(+o.paintCount)}:{})};
 push(0,0,paintW,paintD,'Paint rack',paintIns);
 // Right column: pens / markers (long slots) and brush holes.
 if(W-paintW>=60){
  const penD=Math.min(D*.55,Math.max(90,D-90));
  push(paintW,0,W,penD,'Pens and markers',{id:'markers',a:18,depth:10,block:12,web:3});
  if(D-penD>=50)push(paintW,penD,W,D,'Brushes',{id:'brushes',a:14,depth:Math.min(30,binH-2),block:Math.min(32,binH),fit:1.2,web:4});
  else entries[entries.length-1].y1=1;
 }else{entries[0].x1=1;}
 // Front/back strip for small things when paint does not fill the full depth.
 if(paintD<D-1e-6){
  const y0=paintD,strip=D-paintD,nx=W>=200?3:W>=120?2:1;
  const labels=['Lip gloss and tubes','Erasers and clips','Open bin'],ins=[{id:'lipstick',a:22,depth:Math.min(22,binH-2),block:Math.min(24,binH),fit:1,web:2.4},{id:'erasers',a:26,b:26,depth:14,block:16,fit:0,web:2,radius:5},null];
  for(let i=0;i<nx;i++){
   const x0=W*i/nx,x1=W*(i+1)/nx;
   if(i===nx-1&&nx>=2&&!loads)push(x0,y0,x1,D,labels[2],null);
   else push(x0,y0,x1,D,labels[i%labels.length],ins[i%ins.length]);
  }
 }
 for(const e of entries){if(e.x1>0.98)e.x1=1;if(e.y1>0.98)e.y1=1;if(e.x0<0.02)e.x0=0;if(e.y0<0.02)e.y0=0;}
 return {id:++nextId,layout:entries,room:'artsCrafts',paint:{preset:paintKey,diameter,loads,name:preset.name}};
}
// One-click bathroom drawer: toothbrush cradles shaped to the chosen model, a used-blade bank and floss along the back;
// toothpaste lanes, an upright cotton swab cubby (lying-flat tray in shallow drawers), cotton rounds and razors in the
// middle; nail tools, lip balm, hair ties and a contact lens case along the front. Cells drop by priority to fit.
function bathroomDrawerPreset(o={}){
 const cl=o.clearance??1,Wd=+o.width-2*cl,Dd=+o.depth-2*cl,wall=+o.wall||1.6,gap=+o.gap||.8,height=+o.height||100,binH=Math.min(o.binHeight??(height-2),height-2,Math.max(40,Math.round(height*.6)));
 if(!(Wd>=150&&Dd>=120))throw Error('The bathroom drawer needs at least about 150 \u00d7 120 mm inside. Enter your drawer size and try again.');
 const swap=Dd>Wd,A=swap?Dd:Wd,Bn=swap?Wd:Dd,model=clamp(Math.round(+o.brushModel||0),0,I.BRUSHES.length-1),B=I.BRUSHES[model],fit=1.5,web=6,edge=2*2+2*wall+gap+1;
 const brushLen=B.length+2*fit+edge+10;if(A<brushLen)throw Error(`Toothbrush cradles for the ${B.name} need a drawer at least ${Math.ceil(brushLen+2*cl)} mm wide (inside). Pick a shorter toothbrush or enter a larger drawer.`);
 const pitch=Math.max(...B.profile.map(q=>q[1]))+2*fit,maxFit=Math.max(1,Math.floor((Bn*.4-edge+web)/(pitch+web))),count=clamp(Math.round(+o.brushCount||2),1,Math.min(6,maxFit));
 const backD=Math.max(70,count*pitch+(count-1)*web+edge),R=Bn-backD,upright=height>=80,blade=clamp(Math.round(+o.blade||0),0,I.BLADES.length-1);
 const cells=[],push=(x0,x1,y0,y1,label,ins)=>{const e={id:++nextId,x0,x1,y0,y1,bin:{height:binH,radius:Math.min(6,o.radius??6),innerRadius:Math.min(ins&&ins.id==='toothbrush'?4:8,o.innerRadius??8)},label};if(ins)e.insert=ins;cells.push(e);};
 // Fill one row: keep items by priority while they fit, then share the spare width.
 const row=(items,y0,y1)=>{const d=y1-y0;let keep=items.filter(it=>!it.minD||d>=it.minD).map(it=>({...it,min:typeof it.min==='function'?it.min(d):it.min}));
  while(keep.length&&keep.reduce((s,it)=>s+it.min,0)>A)keep.splice(keep.reduce((k,it,j)=>it.pri<keep[k].pri?j:k,0),1);if(!keep.length)return false;
  const extra=A-keep.reduce((s,it)=>s+it.min,0),grow=keep.reduce((s,it)=>s+(it.grow??1),0);let x=0;keep.forEach((it,j)=>{const w=it.min+extra*(it.grow??1)/grow,x1=j===keep.length-1?A:x+w;push(x,x1,y0,y1,it.label,it.ins);x=x1;});return true;};
 const bank=I.bankDims(I.BLADES[blade]),bankMin=bank.W+1.2+edge,flossMin=48+1+edge+1;
 row([{label:'Toothbrushes',ins:{id:'toothbrush',model,count},min:brushLen,pri:9,grow:.15},{label:'Blade bank',ins:{id:'bladebank',blade},min:bankMin,pri:5,grow:.4},{label:'Floss',ins:{id:'floss'},min:flossMin,pri:4,grow:1}],Bn-backD,Bn);
 const front=R>=250?90:R>=170?70:0,M=R-front;
 const swab=upright?{label:'Cotton swabs',ins:{id:'swabs',pegH:Math.min(46,height-30)},min:50+4+edge,minD:50+4+edge,pri:8,grow:.3}:{label:'Cotton swabs',ins:{id:'swabTray'},min:d=>d>=86+edge?44+edge+4:86+edge,minD:44+edge+4,pri:8,grow:.3};
 const middle=[{label:'Toothpaste',ins:{id:'toothpaste',count:2},min:2*52+3+edge+2,minD:60,pri:9,grow:.6},swab,{label:'Cotton rounds',ins:{id:'pads'},min:62+4+edge,minD:62+4+edge,pri:6,grow:.3},{label:'Razors',ins:{id:'razor',count:2},min:d=>d>=122+4+edge?2*26+4+edge:122+4+edge,minD:26+edge,pri:7,grow:.6},{label:'Combs',ins:{id:'comb'},min:36+edge+2,minD:60,pri:2,grow:1}];
 const small=[{label:'Nail clippers and tweezers',ins:{id:'clippers'},min:d=>d>=101+edge?17+edge+4:101+edge,minD:22+edge,pri:5,grow:.6},{label:'Lip balm',ins:upright?{id:'balm'}:{id:'hairties',a:30,b:30},min:18+edge+4,minD:18+edge+4,pri:3,grow:.6},{label:'Hair ties and bobby pins',ins:{id:'hairties'},min:38+edge+2,minD:38+edge+2,pri:4,grow:1},{label:'Contact lens case',ins:{id:'lens',count:1},min:d=>d>=56+edge?26+edge+4:56+edge,minD:26+edge+2,pri:1,grow:.6}];
 if(M>=30){if(!row(front?middle:middle.concat(small),0+front,front+M))row([{label:'Open bin',ins:null,min:30,pri:1}],front,front+M);}
 if(front)row(small,0,front);
 for(const e of cells){e.x0/=A;e.x1/=A;e.y0/=Bn;e.y1/=Bn;if(swap){[e.x0,e.y0]=[e.y0,e.x0];[e.x1,e.y1]=[e.y1,e.x1];}}
 for(const e of cells)for(const k of ['x0','x1','y0','y1']){if(e[k]>1-1e-9)e[k]=1;if(e[k]<1e-9)e[k]=0;}
 return {id:++nextId,layout:cells,room:'bathroom',bathroom:{model,modelName:B.name,count,blade,bladeName:I.BLADES[blade].name,upright}};
}
// Makeup, medicine and paint drawers: rows of cells filled by priority (drawer-upgrades.js).
function makeupDrawerPreset(o={}){return DU.presets.makeup(o,()=>++nextId);}
function medicineDrawerPreset(o={}){return DU.presets.medicine(o,()=>++nextId);}
function paintDrawerPreset(o={}){return DU.presets.paint(o,()=>++nextId);}
// Small parts tray: plate-sized bins with interlocking removable dividers, drop-in scoop cups and lanes (small-parts.js).
function smallpartsDrawerPreset(o={}){const SP=G.GPSmallParts||require('./small-parts');return SP.preset(o,()=>++nextId);}
function silverwareDrawerPreset(o={}){return kitchenPreset({...o,kind:'silverwareDrawer',count:4,scoops:!!o.scoops,wells:!!o.wells});}
function herbTrayPreset(o={}){return kitchenPreset({...o,kind:'herb',autofit:true,targetJars:o.targetJars??24,diameter:o.diameter??42,length:o.length??100,tierAngle:o.tierAngle??30,lip:o.lip??10,stepHeight:o.stepHeight??14,scoops:false,wells:false,ghostJars:o.ghostJars!==false});}
// One-click plain layouts: a clean grid of empty bins (no objects or inserts) sized near 100 mm, every bin fitting the plate.
// Bottomless: the same grid with every bin walls only (whole floor removed).
function plainBinsGrid(o={}){
 const W=(+o.width||420)-2*(o.clearance??1),D=(+o.depth||360)-2*(o.clearance??1),[ux,uy]=usable(+o.bed||256,o.preset),target=clamp(+o.target||100,60,200);
 let cols=clamp(Math.round(W/target),1,8),rows=clamp(Math.round(D/target),1,8);
 while(cols<8&&W/cols>Math.min(ux,uy)-2)cols++;while(rows<8&&D/rows>Math.min(ux,uy)-2)rows++;
 while(cols>1&&W/cols<45)cols--;while(rows>1&&D/rows<45)rows--;
 return {tree:treeGrid(rows,cols),cols,rows};
}
function standardBinsPreset(o={}){return plainBinsGrid(o);}
function bottomlessBinsPreset(o={}){const g=plainBinsGrid(o);for(const c of treeCells(g.tree))treeBinStyle(g.tree,c.id,{binType:'bottomless',noFloor:1,footFlange:0});return g;}
function knifeBlockPreset(o={}){return kitchenPreset({...o,kind:'knives',knifePreset:o.knifePreset||'mixed',fillDrawer:true,mixed:true,count:8,angle:o.angle??18,scoops:false,wells:false,binHeight:o.binHeight??Math.max(55,(o.height??70)-4)});}
// A project loaded from storage or a file keeps its bin IDs; new bins must never reuse one.
function reserveIds(tree){let m=0;const walk=n=>{if(!n||typeof n!=='object')return;if(Number.isFinite(+n.id))m=Math.max(m,+n.id);if(Array.isArray(n.layout))n.layout.forEach(walk);walk(n.left);walk(n.right);};walk(tree);nextId=Math.max(nextId,m);return nextId;}
const api={kitchenLabelLoops:labels,treeLabel,kitchenLabelBox,knifeCradle,standardBinsPreset,bottomlessBinsPreset,plainBinsGrid,reserveIds,printables,usable,splitToBed,bedXY,ROOMS,DRAWER_PRESETS:BF.DRAWER_PRESETS,KNIFE_PRESETS,PAINT_PRESETS,binFeatures:BF,roomPreset,treeInsert,treeFlat,inserts:I,kitchenPreset,silverwareDrawerPreset,herbTrayPreset,knifeBlockPreset,craftsDrawerPreset,bathroomDrawerPreset,smallpartsDrawerPreset,makeupDrawerPreset,medicineDrawerPreset,paintDrawerPreset,upgrades:DU,kitchenBin,kitchenSlices,treeGrid,treeCells,treeMinimum,layoutFits,fitLayout,treeResize,treeCanResize,treeSplit,treeMerge,gridUnitFit,treeSnapUnits,cellUnits,randomUnitTree,GRID_UNIT:GU,mergeBounds,sameBinValue,treeBinStyle,mixedTree,randomTree,grid,merge,split,coordinate,drawer,tool,move,pack,labels,bin};if(typeof module!=='undefined'&&module.exports)module.exports=api;else G.GPHomeOrg=api;
})(typeof globalThis!=='undefined'?globalThis:this);
