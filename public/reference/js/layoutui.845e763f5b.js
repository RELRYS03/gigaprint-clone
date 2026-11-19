/* Resizable workspace: draggable, keyboard-accessible splitters between the tool panel, 3D view and tray.
 * Sizes persist per browser. Splitters capture only their own pointer, so canvas orbit / pinch stay untouched. */
(function(){'use strict';
const KEY='gigaprint.layout.v1',app=document.getElementById('app');if(!app)return;
const rail=app.querySelector(':scope > .rail'),main=app.querySelector(':scope > .main'),tray=document.getElementById('tray'),view=document.getElementById('view');if(!rail||!main||!view)return;
const DEFAULT={rail:350,tray:null,view:null},SLIM=52,mobileQ=matchMedia('(max-width:860px)');
let st={...DEFAULT};try{st={...DEFAULT,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch(_){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st));}catch(_){}};
const maxRail=()=>Math.max(SLIM+40,Math.round(innerWidth*.75)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function grip(orient,label,id){const el=document.createElement('div');el.className='gp-split gp-split-'+orient;el.id=id;el.tabIndex=0;el.setAttribute('role','separator');el.setAttribute('aria-orientation',orient==='v'?'vertical':'horizontal');el.setAttribute('aria-label',label);el.title=label+' \u00b7 drag, arrow keys, double-click to reset';
 el.innerHTML=orient==='v'?'<button type="button" class="gp-split-btn" data-dir="-1" aria-label="Shrink tool panel" tabindex="-1">\u2039</button><span class="gp-grip" aria-hidden="true"></span><button type="button" class="gp-split-btn" data-dir="1" aria-label="Expand tool panel" tabindex="-1">\u203a</button>':'<button type="button" class="gp-split-btn" data-dir="-1" aria-label="Shrink" tabindex="-1">\u02c4</button><span class="gp-grip" aria-hidden="true"></span><button type="button" class="gp-split-btn" data-dir="1" aria-label="Expand" tabindex="-1">\u02c5</button>';return el;}
const vSplit=grip('v','Resize tool panel','gpSplitRail');app.insertBefore(vSplit,main);
const tSplit=tray?grip('h','Resize details tray','gpSplitTray'):null;if(tSplit)main.insertBefore(tSplit,tray);
const mSplit=grip('h','Resize 3D view height','gpSplitView');view.after(mSplit);
const railExpand=document.createElement('button');railExpand.type='button';railExpand.className='gp-rail-expand';railExpand.setAttribute('aria-label','Expand tool panel');railExpand.title='Expand tool panel';railExpand.textContent='\u203a';rail.prepend(railExpand);
function apply(){const mobile=mobileQ.matches;app.dataset.layout=mobile?'stacked':'split';
 const w=clamp(st.rail??DEFAULT.rail,SLIM,maxRail()),slim=w<=SLIM+8;app.style.setProperty('--gp-rail',(slim?SLIM:w)+'px');app.dataset.rail=slim?'collapsed':'open';
 vSplit.setAttribute('aria-valuemin',SLIM);vSplit.setAttribute('aria-valuemax',maxRail());vSplit.setAttribute('aria-valuenow',Math.round(slim?SLIM:w));vSplit.setAttribute('aria-valuetext',slim?'Tool panel collapsed':`Tool panel ${Math.round(w)} pixels, ${Math.round(w/innerWidth*100)}% of window`);
 const th=st.tray;if(tray){if(th&&!mobile){tray.style.height=clamp(th,48,innerHeight*.8)+'px';tray.style.maxHeight='none';}else{tray.style.height='';tray.style.maxHeight='';}}
 const vh=st.view;if(vh&&mobile)app.style.setProperty('--gp-view-h',clamp(vh,180,innerHeight*.88)+'px');else app.style.removeProperty('--gp-view-h');
 mSplit.setAttribute('aria-valuenow',Math.round(view.getBoundingClientRect().height||0));if(tSplit)tSplit.setAttribute('aria-valuenow',Math.round(tray.getBoundingClientRect().height||0));
 dispatchEvent(new CustomEvent('gp-layout',{detail:{...st,mobile}}));}
function setRail(v,persist=true){st.rail=v<=SLIM+8?SLIM:clamp(v,SLIM,maxRail());if(st.rail<240&&st.rail>SLIM+8)st.rail=v<st.rail?SLIM:240;apply();if(persist)save();}
function railFromDrag(v){st.rail=v<=SLIM+30?SLIM:clamp(Math.max(200,v),SLIM,maxRail());apply();}
function drag(el,move){el.addEventListener('pointerdown',e=>{if(e.button>0||e.target.closest('.gp-split-btn'))return;e.preventDefault();el.setPointerCapture(e.pointerId);el.classList.add('gp-dragging');document.body.classList.add('gp-resizing');
 const mv=ev=>move(ev),up=()=>{el.classList.remove('gp-dragging');document.body.classList.remove('gp-resizing');el.removeEventListener('pointermove',mv);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);save();};el.addEventListener('pointermove',mv);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);});}
drag(vSplit,e=>railFromDrag(e.clientX-app.getBoundingClientRect().left));
if(tSplit)drag(tSplit,e=>{st.tray=clamp(main.getBoundingClientRect().bottom-e.clientY,48,innerHeight*.8);apply();});
drag(mSplit,e=>{st.view=clamp(e.clientY-view.getBoundingClientRect().top,180,innerHeight*.88);apply();});
const step=e=>e.shiftKey?96:24;
vSplit.addEventListener('keydown',e=>{const cur=st.rail??DEFAULT.rail;let v=null;if(e.key==='ArrowLeft')v=cur<=240?SLIM:cur-step(e);else if(e.key==='ArrowRight')v=cur<=SLIM?240:cur+step(e);else if(e.key==='Home')v=SLIM;else if(e.key==='End')v=maxRail();else if(e.key==='Enter'||e.key===' ')v=cur<=SLIM?DEFAULT.rail:SLIM;if(v===null)return;e.preventDefault();setRail(v);});
const hKey=(get,set,min,max)=>e=>{const cur=get();let v=null;if(e.key==='ArrowUp')v=cur+step(e);else if(e.key==='ArrowDown')v=cur-step(e);else if(e.key==='Home')v=min();else if(e.key==='End')v=max();if(v===null)return;e.preventDefault();set(clamp(v,min(),max()));apply();save();};
if(tSplit)tSplit.addEventListener('keydown',hKey(()=>st.tray||tray.getBoundingClientRect().height,v=>st.tray=v,()=>48,()=>innerHeight*.8));
mSplit.addEventListener('keydown',e=>{const map={ArrowUp:'ArrowDown',ArrowDown:'ArrowUp'};hKey(()=>st.view||view.getBoundingClientRect().height,v=>st.view=v,()=>180,()=>innerHeight*.88)({key:map[e.key]||e.key,shiftKey:e.shiftKey,preventDefault:()=>e.preventDefault()});});
vSplit.addEventListener('dblclick',()=>{st.rail=DEFAULT.rail;apply();save();});
if(tSplit)tSplit.addEventListener('dblclick',()=>{st.tray=null;apply();save();});
mSplit.addEventListener('dblclick',()=>{st.view=null;apply();save();});
vSplit.addEventListener('click',e=>{const b=e.target.closest('.gp-split-btn');if(!b)return;const cur=st.rail??DEFAULT.rail,d=+b.dataset.dir;setRail(d<0?(cur<=240?SLIM:cur<=DEFAULT.rail?240:DEFAULT.rail):(cur<=SLIM?DEFAULT.rail:cur<Math.round(innerWidth*.5)?Math.round(innerWidth*.5):maxRail()));});
for(const [el,get,set,min,max] of [[tSplit,()=>st.tray||(tray&&tray.getBoundingClientRect().height)||120,v=>st.tray=v,48,()=>innerHeight*.8],[mSplit,()=>st.view||view.getBoundingClientRect().height,v=>st.view=v,180,()=>innerHeight*.88]])if(el)el.addEventListener('click',e=>{const b=e.target.closest('.gp-split-btn');if(!b)return;const d=+b.dataset.dir*(el===tSplit?-1:1);set(clamp(get()+d*innerHeight*.15,min,max()));apply();save();});
railExpand.addEventListener('click',()=>setRail(DEFAULT.rail));
mobileQ.addEventListener?.('change',apply);addEventListener('resize',apply);
window.GPLayout={get:()=>({...st,mobile:mobileQ.matches,railCollapsed:app.dataset.rail==='collapsed'}),setRail,reset(){st={...DEFAULT};apply();save();},SLIM,KEY};
apply();})();
