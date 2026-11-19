/* Lid decoration (GPLidDeco): text, a traced logo, or a photo relief on the top of a drawer-bin lid.
 * Everything is built from flat stepped layers, so each part stays one closed solid.
 *  - finishes for text and traced logos: raised, engraved, color raised (a separate color part on top) and color inlay
 *    (cut into the top and filled flush by a separate color part, for AMS / multi-material printers);
 *  - photos: a height-map relief (dark is high, in 0.2 mm steps) or a lithophane window (bright is thin).
 * Friction lids print top down, so anything raised on their top would hang in the air: raised art is cut flush into
 * the top inside a recessed border instead, color raised becomes a flush inlay and a relief is carved in.
 * Images live in a small registry (and in localStorage in the browser) so a style only carries the image id. */
(function(G){'use strict';
const T=G.StudioTools||require('./tools'),C=G.SplitCore||require('./core');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),num=(v,d)=>Number.isFinite(+v)&&v!==''&&v!=null?+v:d,P=L=>({outer:L,holes:[]});
const stamp=()=>G.GPStamp||(typeof require==='function'?require('./stamp.js'):null),clicker=()=>G.GPClicker||(typeof require==='function'?require('./clicker.js'):null);
const FONTS={round:'Round',chunky:'Chunky',slab:'Slab',block:'Block'};
const FINISHES={raised:'Raised',engraved:'Engraved (indented)',color:'Color, raised',inlay:'Color inlay (flush)'};
const IMG_MODES={trace:'Logo outline',relief:'Photo relief',litho:'Lithophane window'};
const DEFAULTS={kind:'text',text:'',font:'round',size:10,x:0,y:0,rot:0,finish:'raised',depth:.8,color:'#1E1E1E',img:null,imgMode:'trace',imgSize:40,threshold:50,invert:false,relief:1.6};
const LITHO_BASE=.6,STEP=.2,MIN_LEFT=.8;
function norm(v){
 if(!v||typeof v!=='object')return null;
 const o={...DEFAULTS,...v};
 o.kind=o.kind==='image'?'image':'text';o.text=String(o.text||'').replace(/\r/g,'').split('\n').slice(0,3).map(s=>s.slice(0,24)).join('\n');
 o.font=FONTS[o.font]?o.font:'round';o.size=clamp(num(o.size,10),3,60);o.x=clamp(num(o.x,0),-45,45);o.y=clamp(num(o.y,0),-45,45);o.rot=[0,90,180,270].includes(+o.rot)?+o.rot:0;
 o.finish=FINISHES[o.finish]?o.finish:'raised';o.depth=clamp(num(o.depth,.8),.4,3);o.color=/^#[0-9a-f]{6}$/i.test(o.color)?o.color.toUpperCase():'#1E1E1E';
 o.img=o.img?String(o.img).slice(0,40):null;o.imgMode=IMG_MODES[o.imgMode]?o.imgMode:'trace';o.imgSize=clamp(num(o.imgSize,40),8,400);o.threshold=clamp(num(o.threshold,50),2,98);o.invert=!!o.invert;o.relief=clamp(num(o.relief,1.6),.4,4);
 return o;
}
const photo=o=>o&&o.kind==='image'&&(o.imgMode==='relief'||o.imgMode==='litho');
const usesColor=(o,k)=>!!o&&!photo(o)&&(o.finish==='inlay'||o.finish==='color');
// Plate thickness a decoration needs (cut depth plus plastic left under it).
function thickNeed(o,k){o=norm(o);if(!o)return 0;const fr=k==='friction';
 if(photo(o))return o.imgMode==='litho'?LITHO_BASE+o.relief:fr?o.relief+MIN_LEFT:0;
 return o.finish==='engraved'||o.finish==='inlay'||fr?o.depth+MIN_LEFT:0;}
// Height above the lid top (raised art on lids that print top up).
function above(o,k){o=norm(o);if(!o||k==='friction')return 0;if(photo(o))return o.imgMode==='relief'?o.relief:0;return o.finish==='raised'||o.finish==='color'?o.depth:0;}

// ---------------------------------------------------------------- images
const IMG=new Map(),KEY='gigaprint.lidDecoImages.v1';
const b64=u8=>{if(typeof Buffer!=='undefined')return Buffer.from(u8).toString('base64');let s='';for(let i=0;i<u8.length;i+=8192)s+=String.fromCharCode.apply(null,u8.subarray(i,i+8192));return btoa(s);};
const unb64=s=>{if(typeof Buffer!=='undefined')return new Uint8Array(Buffer.from(s,'base64'));const t=atob(s),u=new Uint8Array(t.length);for(let i=0;i<t.length;i++)u[i]=t.charCodeAt(i);return u;};
function save(){try{if(typeof localStorage==='undefined')return;const list=[...IMG.values()].slice(-4).map(m=>({id:m.id,name:m.name,w:m.w,h:m.h,g:b64(Uint8Array.from(m.gray,v=>Math.round(v*255))),a:m.alpha?b64(Uint8Array.from(m.alpha,v=>Math.round(v*255))):null}));localStorage.setItem(KEY,JSON.stringify(list));}catch(e){}}
function load(){try{if(typeof localStorage==='undefined')return;const list=JSON.parse(localStorage.getItem(KEY)||'[]');for(const m of list){if(IMG.has(m.id))continue;const g=unb64(m.g),a=m.a?unb64(m.a):null;IMG.set(m.id,{id:m.id,name:m.name,w:m.w,h:m.h,gray:Float32Array.from(g,v=>v/255),alpha:a?Float32Array.from(a,v=>v/255):null});}}catch(e){}}
// img = {name, gray (0..1, row 0 = top), alpha|null, w, h}. Returns the id to keep in the style.
function addImage(img){let hsh=2166136261;const g=img.gray;for(let i=0;i<g.length;i+=7){hsh^=Math.round(g[i]*255);hsh=Math.imul(hsh,16777619)>>>0;}
 const id=`img${img.w}x${img.h}_${hsh.toString(36)}`;IMG.delete(id);IMG.set(id,{id,name:String(img.name||'image').slice(0,60),w:img.w,h:img.h,gray:Float32Array.from(img.gray),alpha:img.alpha?Float32Array.from(img.alpha):null});while(IMG.size>8)IMG.delete(IMG.keys().next().value);save();CACHE.clear();return id;}
function image(id){if(!id)return null;if(!IMG.has(id))load();return IMG.get(id)||null;}

// ---------------------------------------------------------------- 2D art (centered on 0,0, mm, y up)
const CACHE=new Map();
const tf=(ps,f)=>ps.map(Q=>({outer:Q.outer.map(f),holes:Q.holes.map(h=>h.map(f))}));
const moveP=(ps,dx,dy)=>tf(ps,p=>[p[0]+dx,p[1]+dy]);
function rdp(L,tol){if(L.length<3)return L;const a=L[0],b=L[L.length-1],dx=b[0]-a[0],dy=b[1]-a[1],n=Math.hypot(dx,dy)||1;let far=-1,fd=0;for(let i=1;i<L.length-1;i++){const d=Math.abs((L[i][0]-a[0])*dy-(L[i][1]-a[1])*dx)/n;if(d>fd){fd=d;far=i;}}if(fd<=tol)return [a,b];return rdp(L.slice(0,far+1),tol).slice(0,-1).concat(rdp(L.slice(far),tol));}
function simpLoop(L,tol){if(L.length<8)return L;let far=0,fd=-1;for(let i=0;i<L.length;i++){const d=Math.hypot(L[i][0]-L[0][0],L[i][1]-L[0][1]);if(d>fd){fd=d;far=i;}}const a=rdp(L.slice(0,far+1),tol),b=rdp(L.slice(far).concat([L[0]]),tol);const out=a.concat(b.slice(1,-1));return out.length>=3?out:L;}
const center=ps=>{if(!ps.length)return ps;const b=T.polysBBox(ps);return moveP(ps,-(b.x0+b.x1)/2,-(b.y0+b.y1)/2);};
function textArt(o,notes){const S=stamp();if(!S||!o.text.trim())return [];const dropped=new Set(),lines=o.text.split('\n').map(s=>s.trim()).filter(Boolean);
 const ps=S.textBlock(lines,o.font,o.size,.06,dropped);if(dropped.size)notes.push(`Some characters are not in this font and were left out: ${[...dropped].join(' ')}`);return center(ps);}
function traceArt(o,img){const K=clicker();if(!K||!img)return [];const ps=K.traceImage(img.gray,img.w,img.h,{threshold:o.threshold/100,invert:o.invert,dropBg:!img.alpha,smooth:1,minFeature:.8,width:o.imgSize},img.alpha);return center(ps||[]);}
// Height levels 1..N of a photo (dark = high unless inverted), each as outlines, plus the image rectangle.
function levelArt(o,img){
 const N=Math.max(2,Math.round(o.relief/STEP)),Wmm=o.imgSize,Hmm=Wmm*img.h/img.w,px=Math.max(.3,Wmm/110),nx=Math.max(4,Math.round(Wmm/px)),ny=Math.max(4,Math.round(Hmm/px)),sx=Wmm/nx,sy=Hmm/ny;
 const g=new Float32Array(nx*ny),a=new Float32Array(nx*ny);
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){let s=0,sa=0,c=0;const x0=Math.floor(i*img.w/nx),x1=Math.max(x0+1,Math.floor((i+1)*img.w/nx)),y0=Math.floor(j*img.h/ny),y1=Math.max(y0+1,Math.floor((j+1)*img.h/ny));
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const k=y*img.w+x;s+=img.gray[k];sa+=img.alpha?img.alpha[k]:1;c++;}g[j*nx+i]=s/c;a[j*nx+i]=sa/c;}
 const bl=new Float32Array(nx*ny);for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){let s=0,c=0;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const x=i+di,y=j+dj;if(x<0||y<0||x>=nx||y>=ny)continue;s+=g[y*nx+x];c++;}bl[j*nx+i]=s/c;}
 const L=new Uint8Array(nx*ny);for(let k=0;k<nx*ny;k++){const v=o.invert?bl[k]:1-bl[k];L[k]=a[k]<.08?0:Math.round(clamp(v,0,1)*N);}
 const levels=[];for(let k=1;k<=N;k++){const bin=new Uint8Array(nx*ny);let any=0;for(let q=0;q<nx*ny;q++)if(L[q]>=k){bin[q]=1;any=1;}
  if(!any){levels.push([]);continue;}
  let loops=T.traceBinary(bin,nx,ny).map(l=>simpLoop(l,.45)).filter(l=>l.length>=3);
  let ps=T.unionPolys(loops.map(l=>P(l.map(p=>[p[0]*sx-Wmm/2,p[1]*sy-Hmm/2]))),'evenodd');
  ps=ps.filter(Q=>T.polysArea([Q])>.12);levels.push(ps);}
 return {levels,N,dz:o.relief/N,rect:[P([[-Wmm/2,-Hmm/2],[Wmm/2,-Hmm/2],[Wmm/2,Hmm/2],[-Wmm/2,Hmm/2]])],w:Wmm,h:Hmm};
}
function art(o,notes){
 const key=JSON.stringify([o.kind,o.text,o.font,o.size,o.img,o.imgMode,o.imgSize,o.threshold,o.invert,o.relief]);if(CACHE.has(key)){const c=CACHE.get(key);notes.push(...c.notes);return c.v;}
 const n=[];let v=null;
 if(o.kind==='text')v={polys:textArt(o,n)};
 else if(!o.img)v=null;else{const img=image(o.img);if(!img)n.push('Upload the logo or photo again to put it on the lid (images stay in this browser only).');else if(photo(o))v=levelArt(o,img);else v={polys:traceArt(o,img)};}
 if(CACHE.size>40)CACHE.clear();CACHE.set(key,{v,notes:n});notes.push(...n);return v;
}
const rotP=(ps,deg)=>{if(!deg)return ps;const a=deg*Math.PI/180,c=Math.round(Math.cos(a)),s=Math.round(Math.sin(a));return tf(ps,p=>[p[0]*c-p[1]*s,p[0]*s+p[1]*c]);};
/* Builds the decoration on a lid plate (worn frame: z 0..t, top at t).
 * o: {deco, kind ('friction'|'magnet'), w, d, t, region (polys the art may use)}.
 * Returns {cuts, adds, top (layers above t), color (layers of the color part)|null, notes, info} or null. */
function apply(raw){
 const o=norm(raw.deco);if(!o)return null;const {w,d,t,kind}=raw,fr=kind==='friction',notes=[],cuts=[],adds=[],top=[];let color=null;
 const a=art(o,notes);if(!a)return {cuts,adds,top,color,notes,info:null};
 const region=raw.region,rb=T.polysBBox(region);let cx=w/2+o.x/100*w,cy=d/2+o.y/100*d;
 const place=ps=>moveP(rotP(ps,o.rot),cx,cy);
 // Left in the middle (x = y = 0): slide it front or back if a finger hole, knob or label sits there.
 const auto=ps=>{if(o.x||o.y||!ps.length)return;const A=T.polysArea(ps);let best=null;for(const f of [0,-.28,.28,-.2,.2,-.34,.34,-.12,.12]){cy=d/2+f*d;const B=T.polysArea(T.interPolys(place(ps),region));if(!best||B>best.B+1e-6)best={f,B};if(B>=A*.995)return;}cy=d/2+best.f*d;};
 const fit=ps=>{if(!ps.length)return ps;const b=T.polysBBox(rotP(ps,o.rot)),k=Math.min(1,(rb.x1-rb.x0-2)/(b.x1-b.x0),(rb.y1-rb.y0-2)/(b.y1-b.y0));if(k<.999){notes.push('The decoration was scaled down to fit the lid.');return tf(ps,p=>[p[0]*k,p[1]*k]);}return ps;};
 const clip=(ps,what)=>{const A=T.polysArea(ps);if(!A)return [];const q=T.interPolys(ps,region),B=T.polysArea(q);if(B<A*.98)notes.push(`Part of the ${what} was trimmed to stay clear of the lid edge, magnets, knob, finger hole and label.`);return q.filter(Q=>T.polysArea([Q])>.05);};
 const info={kind:o.kind,finish:photo(o)?o.imgMode:o.finish,color:usesColor(o,kind)?o.color:null};
 if(photo(o)){
  let k0=1;const b=Math.max(a.w,a.h),lim=Math.min(rb.x1-rb.x0-2,rb.y1-rb.y0-2);if(b>lim){k0=lim/b;notes.push('The photo was scaled down to fit the lid.');}
  const sc=ps=>k0<1?tf(ps,p=>[p[0]*k0,p[1]*k0]):ps;auto(sc(a.rect));const R=clip(place(sc(a.rect)),'photo');if(!R.length)return {cuts,adds,top,color,notes,info:null};
  const Lk=a.levels.map(ps=>ps.length?T.interPolys(place(sc(ps)),R):[]),dz=a.dz;
  if(o.imgMode==='relief'){
   if(!fr)Lk.forEach((ps,i)=>{if(ps.length)top.push({z0:t+i*dz,z1:t+(i+1)*dz,polys:ps});});
   else{for(let k=1;k<=a.N;k++){const keep=Lk[a.N-k],cut=keep.length?T.diffPolys(R,keep):R;if(cut.length)cuts.push({z0:t-k*dz,z1:t-(k-1)*dz,polys:cut});}notes.push('Friction lids print top down, so the photo relief is carved into the top.');}
  }else{
   if(!fr){cuts.push({z0:LITHO_BASE,z1:t+1e-3,polys:R});Lk.forEach((ps,i)=>{if(ps.length)adds.push({z0:LITHO_BASE+i*dz,z1:LITHO_BASE+(i+1)*dz,polys:ps});});}
   else{cuts.push({z0:-1e-3,z1:t-LITHO_BASE,polys:R});Lk.forEach((ps,i)=>{if(ps.length)adds.push({z0:t-LITHO_BASE-(i+1)*dz,z1:t-LITHO_BASE-i*dz,polys:ps});});}
   notes.push('Lithophane window: hold the lid up to a light to see the photo. Print it at 100% infill.');
  }
  info.size=[+(a.w*k0).toFixed(1),+(a.h*k0).toFixed(1)];info.steps=a.N;return {cuts,adds,top,color,notes,info};
 }
 const fitted=fit(a.polys);auto(fitted);const ps=clip(place(fitted),o.kind==='text'?'text':'logo');if(!ps.length){if(o.kind==='text'&&!o.text.trim())return null;notes.push(o.kind==='text'?'The text does not fit on this lid. Make it smaller or move it.':'No outline came out of this image. Adjust the threshold or try a higher-contrast image.');return {cuts,adds,top,color,notes,info:null};}
 const dd=o.depth;let fin=o.finish;
 if(fr&&fin==='color'){fin='inlay';notes.push('Friction lids print top down, so the color art is inlaid flush instead of raised.');}
 if(fin==='engraved')cuts.push({z0:t-dd,z1:t+1e-3,polys:ps});
 else if(fin==='raised'){if(!fr)top.push({z0:t,z1:t+dd,polys:ps});else{const ring=T.interPolys(T.diffPolys(T.offset(ps,1.2,true),ps),region);if(ring.length)cuts.push({z0:t-dd,z1:t+1e-3,polys:ring});notes.push('Friction lids print top down, so raised art stands flush with the top inside a recessed border.');}}
 else if(fin==='color')color=[{z0:t,z1:t+dd,polys:ps}];
 else{cuts.push({z0:t-dd,z1:t+1e-3,polys:ps});color=[{z0:t-dd,z1:t,polys:ps}];}
 info.finish=fin;const b=T.polysBBox(ps);info.size=[+(b.x1-b.x0).toFixed(1),+(b.y1-b.y0).toFixed(1)];
 return {cuts,adds,top,color,notes,info};
}
const api={FONTS,FINISHES,IMG_MODES,DEFAULTS,norm,photo,usesColor,thickNeed,above,addImage,image,apply,levelArt,STEP};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else G.GPLidDeco=api;
})(typeof globalThis!=='undefined'?globalThis:this);
