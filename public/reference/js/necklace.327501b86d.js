/* Original parametric curb-chain geometry. All dimensions in mm.
 * Cuban links have a nonplanar saddle center path and broad shaved faces;
 * round alternatives alternate their inclination. Curved packing preserves interlock.
 * Validation uses conservative swept-tube segment envelopes including chord sagitta;
 * flattening stays inside those envelopes, so the reported separation is a lower bound.
 */
(function(G){'use strict';
const C=G.SplitCore||require('./core');
const TAU=2*Math.PI, dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0), sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>a.map(v=>v/Math.hypot(...a));
// Signed inter-component crossings in a generic projection give the polygon linking number.
// Retry degenerate projections rather than guessing when a crossing lands on a vertex.
function linking(A,B){for(const w0 of [[.231,.417,1],[.713,1,.349],[1,.527,.839]]){const w=norm(w0),u=norm(cross(w,[0,1,0])),v=cross(w,u),pr=p=>[dot(p,u),dot(p,v),dot(p,w)],a=A.map(pr),b=B.map(pr);let sum=0,amb=false;for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){const p=a[i],q=a[(i+1)%a.length],r=b[j],s=b[(j+1)%b.length],dx=q[0]-p[0],dy=q[1]-p[1],ex=s[0]-r[0],ey=s[1]-r[1],det=dx*ey-dy*ex;if(Math.abs(det)<1e-12)continue;const rx=r[0]-p[0],ry=r[1]-p[1],t=(rx*ey-ry*ex)/det,k=(rx*dy-ry*dx)/det;if(t< -1e-8||t>1+1e-8||k< -1e-8||k>1+1e-8)continue;if(t<1e-7||t>1-1e-7||k<1e-7||k>1-1e-7){amb=true;break;}const z=p[2]+t*(q[2]-p[2])-r[2]-k*(s[2]-r[2]);if(Math.abs(z)<1e-7){amb=true;break;}sum+=Math.sign(det*z);}if(!amb&&sum%2===0)return sum/2;}return NaN;}
function coreCurve(points,s){return points.map(p=>[p[0],p[1],s.style==='cuban'?clamp(p[2],.001,s.height-.001):p[2]+s.b*Math.sin(s.angle)+s.r*.65]);}
function capacityError(count,capacity){const e=Error(`Requested ${count} links; these settings fit at most ${capacity} in one continuous chain on this plate. No links were omitted and no separate chain sections were created. Choose fewer/smaller links, thinner wire, or a larger plate.`);e.code='CHAIN_CAPACITY';e.capacity=capacity;return e;}
function requestedCount(o,fallback){const n=o.count===undefined?fallback:+o.count;if(!Number.isInteger(n)||n<4)throw Error('Choose a whole number of links (at least 4).');return n;}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function segmentDistance(p,q,a,b){
 const u=sub(q,p),v=sub(b,a),w=sub(p,a),A=dot(u,u),B=dot(u,v),D=dot(u,w),E=dot(v,w),F=dot(v,v),den=A*F-B*B;
 let s=den>1e-12?clamp((B*E-F*D)/den,0,1):0,t=F?clamp((B*s+E)/F,0,1):0;
 s=A?clamp((B*t-D)/A,0,1):0;t=F?clamp((B*s+E)/F,0,1):0;
 return Math.hypot(...w.map((x,i)=>x+s*u[i]-t*v[i]));
}
// Analytic saddle-curb link: broad rounded wire, twin shaved faces and flat printing feet.
// Proportions are measurements, never vertex data from the supplied reference.
function cubanSpec(o={}){
 const size=clamp(+o.size||+o.width||40,16,70),scale=size/31.4,width=size*25.434/31.339,thickness=clamp(+o.thickness||9.3,1.6,20),r=thickness/2,clearance=clamp(+o.clearance||.5,.3,1.2),height=size*9.632/31.339;
 if(width<3*thickness+clearance+.1)throw Error('The wire is too thick for this link size and clearance. Increase link size or reduce wire thickness.');
 const a=(size-thickness)/2,b=(width-thickness)/2,A=height/2+r*.4,n=160;
 const profile=['diamond','crowned','flat'].includes(o.profile)?o.profile:'flat';
 return {style:'cuban',size,width,thickness,r,a,b,height,A,scale,clearance,angle:0,n,profile,sag:Math.sqrt(a*a+b*b+16*A*A)*(TAU/n)**2/8};
}
function cubanLine(s,origin,heading){const ch=Math.cos(heading),sh=Math.sin(heading),out=[];
 for(let i=0;i<s.n;i++){const t=i*TAU/s.n,x=s.a*Math.cos(t),y=s.b*Math.sin(t),z=s.height/2-s.A*Math.sin(2*t);out.push([origin[0]+x*ch-y*sh,origin[1]+x*sh+y*ch,z]);}return out;}
// Upper-face profile inside the round-wire envelope: diamond-cut table + bevel facets, a gentle crown, or a flat shave.
// Material is only ever removed from inside the validated tube, so clearance/interlock checks remain lower bounds.
function cubanTop(s,q){const H=s.height,r=s.r;if(s.profile==='crowned')return H-Math.min(.2*r,1.2)*(q/r)**2;if(s.profile==='diamond'){const q0=.56*r;return H-.42*Math.max(0,Math.abs(q)-q0);}return H;}
function cubanTube(points,s,heading,clasp=false){
 // HD: the visible tube samples the exact analytic center path more densely than the validation polyline.
 if(!clasp&&points.length===s.n&&s.hd!==false){const c=cubanLine({...s,n:Math.round(s.n*1.5)},[0,0],0),ch=Math.cos(heading),sh=Math.sin(heading),o=[points[0][0]-(c[0][0]*ch-c[0][1]*sh),points[0][1]-(c[0][0]*sh+c[0][1]*ch)];points=c.map(p=>[o[0]+p[0]*ch-p[1]*sh,o[1]+p[0]*sh+p[1]*ch,p[2]]);}
 const n=points.length,m=s.hd===false?40:48,cs=Math.cos(heading),sn=Math.sin(heading),rings=[],out=[];
 const cut=clasp?Math.max(1,Math.round(Math.asin(Math.min(.8,s.r*.8/s.b))*n/TAU)):0;
 for(let k=cut;k<=n-cut;k++){
  const i=k%n,t=i*TAU/n,p=points[i],nx=Math.cos(t)/s.a,ny=Math.sin(t)/s.b,L=Math.hypot(nx,ny),u=[(nx*cs-ny*sn)/L,(nx*sn+ny*cs)/L];
  let extent;if(s.profile&&s.profile!=='flat'){
   // Narrow the section where its lower surface would reach the cut, so top and bottom never pinch together.
   const ok=q=>{const h=Math.sqrt(Math.max(0,s.r*s.r-q*q));return p[2]-h<=cubanTop(s,q)-.02&&p[2]+h>=.02;};let lo=0,hi=s.r;if(ok(hi))extent=hi;else{for(let it=0;it<40;it++){const mid=(lo+hi)/2;if(ok(mid))lo=mid;else hi=mid;}extent=Math.max(.03,lo);}
  }else{const dz=p[2]<0?-p[2]:p[2]>s.height?p[2]-s.height:0;extent=Math.sqrt(Math.max(.001,s.r*s.r-dz*dz));}
  const ring=[];for(let j=0;j<m;j++){const f=j*TAU/m,q=extent*Math.cos(f),v=(Math.sin(f)>=0?1:-1)*Math.sqrt(Math.max(0,s.r*s.r-q*q));ring.push([p[0]+q*u[0],p[1]+q*u[1],clamp(p[2]+v,0,Math.max(.05,cubanTop(s,q)))]);}rings.push(ring);
 }
 const tri=(a,b,c)=>{const u=sub(b,a),v=sub(c,a),q=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(Math.hypot(...q)>1e-9)out.push(...a,...b,...c);};
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<m;j++){const a=rings[i][j],b=rings[i+1][j],c=rings[i+1][(j+1)%m],d=rings[i][(j+1)%m];tri(a,b,c);tri(a,c,d);}
 if(clasp)for(const [k,flip]of [[0,false],[rings.length-1,true]]){const ring=rings[k],p=ring.reduce((s,p)=>s.map((v,i)=>v+p[i]/m),[0,0,0]);for(let j=0;j<m;j++)flip?tri(p,ring[(j+1)%m],ring[j]):tri(p,ring[j],ring[(j+1)%m]);}
 let p=Float64Array.from(out);if(C.signedVolume(p)<0)p=(()=>{for(let k=0;k<p.length;k+=9)for(let j=0;j<3;j++){const x=p[k+3+j];p[k+3+j]=p[k+6+j];p[k+6+j]=x;}return p;})();return p;
}
function cubanPitch(s){for(let p=s.size*.45;p<s.size*.72;p+=s.scale*.12){const A=cubanLine(s,[0,0],0),B=cubanLine(s,[p,0],0);if(envelopeGap(A,B,s)>=s.clearance+.15&&envelopeGap(A,cubanLine(s,[2*p,0],0),s)>=s.clearance+.15&&Math.abs(linking(coreCurve(A,s),coreCurve(B,s)))===1&&linking(coreCurve(A,s),coreCurve(cubanLine(s,[2*p,0],0),s))===0)return p;}throw Error('These dimensions do not meet the interlock and clearance checks. Reduce wire thickness, increase link size, or lower clearance.');}
function spec(o={}){
 if(!o.style||o.style==='cuban')return cubanSpec(o);
 const width=clamp(+o.width||18,10,40),thickness=clamp(+o.thickness||3,1.6,6),r=thickness/2;
 const b=(width-thickness)/2,a=b*(o.style==='rolo'?1.05:o.style==='figaro'?1.95:1.65), angle=(o.style==='rolo'?45:38)*Math.PI/180;
 const clearance=clamp(+o.clearance||0.5,0.3,1.2);
 if(b<r*2+clearance)throw Error('Link width is too small for this thickness and clearance. Increase width or lower thickness.');
 return {width,thickness,r,a,b,angle,clearance,style:o.style||'cuban'};
}
function line(s,origin,heading,sign,short=false){
 if(s.style==='cuban')return cubanLine(s,origin,heading);
 const a=short?s.a*.85:s.a, A=s.angle*sign, cs=Math.cos(A),sn=Math.sin(A),ch=Math.cos(heading),sh=Math.sin(heading),pts=[],n=128;
 for(let i=0;i<n;i++){const t=i*TAU/n,x=a*Math.cos(t),y=s.b*Math.sin(t)*cs,z=s.b*Math.sin(t)*sn;
 pts.push([origin[0]+x*ch-y*sh,origin[1]+x*sh+y*ch,z]);}return pts;
}
function envelopeGap(A,B,s){
 const sag=s.sag||s.a*(1-Math.cos(Math.PI/128)),r=s.r+sag;
 const bb=p=>[0,1,2].map(k=>[Math.min(...p.map(v=>v[k]))-r,Math.max(...p.map(v=>v[k]))+r]);
 const ab=bb(A),bb2=bb(B);if(ab.some((v,k)=>v[1]+s.clearance<bb2[k][0]||bb2[k][1]+s.clearance<v[0]))return Infinity;
 let d=Infinity;
 const segs=P=>P._segs||(Object.defineProperty(P,'_segs',{value:P.map((p,i)=>{const q=P[(i+1)%P.length];return {p,q,lo:p.map((v,k)=>Math.min(v,q[k])),hi:p.map((v,k)=>Math.max(v,q[k]))};})}),P._segs);
 for(const a of segs(A))for(const b of segs(B)){
  let dd=0;for(let k=0;k<3;k++){const q=Math.max(0,a.lo[k]-b.hi[k],b.lo[k]-a.hi[k]);dd+=q*q;}if(dd>=d*d)continue;
  d=Math.min(d,segmentDistance(a.p,a.q,b.p,b.q));
 }
 return d-2*r;
}
function solvePitch(s){
 if(s.style==='cuban')return cubanPitch(s);
 let best=null;for(let p=s.a*.72;p<s.a*1.85;p+=.12){const gap=envelopeGap(line(s,[0,0],0,1),line(s,[p,0],0,-1),s);if(gap>=s.clearance+.12 && envelopeGap(line(s,[0,0],0,1),line(s,[2*p,0],0,1),s)>=s.clearance+.12) {best=p;break;}}
 if(!best)throw Error('These links cannot interlock at the requested clearance. Increase width or reduce thickness.');return best;
}
function tube(points,s,heading,clasp=false){
 if(s.style==='cuban')return cubanTube(points,s,heading,clasp);
 const n=points.length,m=24,out=[],r=s.r,vertical=s.b*Math.sin(s.angle)+r*.65;
 // A short open arc is a flexible C-snap closure. Its throat is 80% of the neighboring wire diameter.
 const cut=clasp?Math.max(1,Math.round(Math.asin(Math.min(.8,r*.8/s.b))*n/TAU)):0;
 const ids=[];for(let i=cut;i<=n-cut;i++)ids.push(i%n);
 const rings=ids.map((id)=>{const p=points[id],prev=points[(id+n-1)%n],next=points[(id+1)%n],d=sub(next,prev),L=Math.hypot(...d),t=d.map(v=>v/L);
 let u=[-t[1],t[0],0],U=Math.hypot(...u);u=u.map(v=>v/U);const v=[t[1]*u[2]-t[2]*u[1],t[2]*u[0]-t[0]*u[2],t[0]*u[1]-t[1]*u[0]];
 return Array.from({length:m},(_,j)=>p.map((x,k)=>{const value=x+r*(Math.cos(j*TAU/m)*u[k]+Math.sin(j*TAU/m)*v[k]);return k===2?clamp(value+vertical,0,2*vertical):value;}));});
 const tri=(a,b,c)=>{const v=sub(b,a),w=sub(c,a),cross=[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]];if(Math.hypot(...cross)>1e-9)out.push(...a,...b,...c);};
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<m;j++){const a=rings[i][j],b=rings[i+1][j],c=rings[i+1][(j+1)%m],d=rings[i][(j+1)%m];tri(a,b,c);tri(a,c,d);}
 if(clasp){for(const [k,flip]of [[0,false],[rings.length-1,true]]){const ring=rings[k],center=ring.reduce((s,p)=>s.map((x,i)=>x+p[i]/m),[0,0,0]);for(let j=0;j<m;j++)flip?tri(center,ring[(j+1)%m],ring[j]):tri(center,ring[j],ring[(j+1)%m]);}}
 const p=Float64Array.from(out);if(C.signedVolume(p)<0)for(let k=0;k<p.length;k+=9)for(let j=0;j<3;j++){const tmp=p[k+j+3];p[k+j+3]=p[k+j+6];p[k+j+6]=tmp;}return p;
}
function pathAt(d,W,R){const straight=W-2*R,span=straight+Math.PI*R,row=Math.floor(d/span),u=d-row*span,reverse=row%2,base=row*2*R;
 if(u<=straight)return {xy:[reverse?W-R-u:R+u,base],angle:reverse?Math.PI:0};
 const t=(u-straight)/R,sgn=reverse?-1:1,cx=reverse?R:W-R;
 return {xy:[cx+sgn*R*Math.sin(t),base+R*(1-Math.cos(t))],angle:reverse?Math.PI-t:t};
}
function validateChain(curves,s){
 // Planar ellipse normal offsets are injective below their minimum radius of curvature.
 // Cuban shaving only clips each vertical cross-section, with >= .6*r material left.
 if(s.r>=s.b*s.b/s.a)throw Error('The wire exceeds the link curvature limit. Reduce thickness.');
 const cores=curves.map(q=>coreCurve(q,s)),neighbors=[];let minGap=Infinity,checkedPairs=0;
 for(let i=0;i<curves.length;i++)for(let j=0;j<i;j++){
  const gap=envelopeGap(curves[i],curves[j],s);minGap=Math.min(minGap,gap);checkedPairs++;
  if(gap<s.clearance-1e-8)throw Error(`Links ${j+1} and ${i+1} do not meet the requested separation. Reduce link size or count.`);
  const lk=gap===Infinity?0:linking(cores[j],cores[i]);
  if(j===i-1){if(Math.abs(lk)!==1)throw Error(`Links ${j+1} and ${i+1} are not mechanically interlocked. Adjust link dimensions.`);neighbors.push(lk);}
  else if(lk!==0)throw Error(`Unexpected interlock between nonadjacent links ${j+1} and ${i+1}. Adjust link dimensions.`);
 }
 return {safe:true,geometryChecked:true,minGap,neighbors,checkedPairs,connectedComponents:1,closedLinks:curves.length,minMaterialSection:.6*s.r,method:'Every neighbor: polygon linking number \u00b11; other pairs: 0; all-pair conservative swept-envelope separation including chord allowance; ellipse curvature bound. No physical print test.'};
}
function positive(o,key,fallback,min,max){const n=o[key]===undefined?fallback:+o[key];if(!Number.isFinite(n)||n<min||n>max)throw Error(`${({connectorInner:'Connector inner diameter',connectorWire:'Connector wire diameter',connectorThroat:'Snap throat opening',connectorClearance:'Assembly clearance',medallionWidth:'Medallion width',medallionThickness:'Medallion thickness',medallionHole:'Medallion hole diameter'})[key]||key}: choose ${min}\u2013${max} mm.`);return n;}
function orient(p){if(C.signedVolume(p)<0)for(let i=0;i<p.length;i+=9)for(let k=0;k<3;k++){const t=p[i+3+k];p[i+3+k]=p[i+6+k];p[i+6+k]=t;}return p;}
function snapConnector(inner,wire,throat,oval=false){
 const r=wire/2,b=inner/2+r,a=b*(oval?1.35:1),theta=Math.asin(throat/(2*(b-r))),n=192,m=40,rings=[],out=[];
 if(!Number.isFinite(theta)||theta<=0||r>=b*b/a)throw Error('The C-snap dimensions are incompatible. Increase its inner diameter.');
 for(let i=0;i<=n;i++){const t=theta+(TAU-2*theta)*i/n,cs=Math.cos(t),sn=Math.sin(t);rings.push(Array.from({length:m},(_,j)=>{const f=j*TAU/m;return [(a+r*Math.cos(f))*cs,(b+r*Math.cos(f))*sn,Math.max(0,.8*r+r*Math.sin(f))];}));}
 const tri=(a,b,c)=>{const n=cross(sub(b,a),sub(c,a));if(Math.hypot(...n)>1e-9)out.push(...a,...b,...c);};
 for(let i=0;i<n;i++)for(let j=0;j<m;j++){const k=(j+1)%m;tri(rings[i][j],rings[i+1][j],rings[i+1][k]);tri(rings[i][j],rings[i+1][k],rings[i][k]);}
 for(const [i,flip]of [[0,false],[n,true]]){const ring=rings[i],c=ring.reduce((s,p)=>s.map((v,k)=>v+p[k]/m),[0,0,0]);for(let j=0;j<m;j++)flip?tri(c,ring[(j+1)%m],ring[j]):tri(c,ring[j],ring[(j+1)%m]);}
 return orient(Float64Array.from(out));
}
function medallion(width,thickness,hole,oval,web){
 const a=width/2,b=a*(oval?1.3:1),r=hole/2,hy=b-web-r,n=192,outer=Array.from({length:n},(_,i)=>[a*Math.cos(i*TAU/n),b*Math.sin(i*TAU/n)]),cut=Array.from({length:n},(_,i)=>[r*Math.cos(-i*TAU/n),hy+r*Math.sin(-i*TAU/n)]);
 if(hy<0||cut.some(p=>(p[0]/a)**2+(p[1]/b)**2>=.98))throw Error('The medallion is too small for this hole and retaining web. Increase blank width or reduce connector / hole size.');
 const out=[],tri=(a,b,c)=>out.push(...a,...b,...c);
 C.triangulatePolys([{outer,holes:[cut]}],2,thickness,1,out,[],0);C.triangulatePolys([{outer,holes:[cut]}],2,0,-1,out,[],0);
 for(const loop of [outer,cut])for(let i=0;i<n;i++){const p=loop[i],q=loop[(i+1)%n],a=[...p,0],b=[...q,0],c=[...q,thickness],d=[...p,thickness];tri(a,b,c);tri(a,c,d);}
 return orient(Float64Array.from(out));
}
// Toggle clasp: a ring and a T-bar, each with an in-plane C-snap loop for a closed end link. Flat, support-free slabs
// with a softened top edge. Closed solids from polygon unions; retention and flex are not physically tested.
function cArc(cx,cy,ri,ro,throat,phi,n=96){const to=Math.asin(Math.min(.95,throat/2/ro)),ti=Math.asin(Math.min(.95,throat/2/ri)),L=[];for(let i=0;i<=n;i++){const t=phi+to+(TAU-2*to)*i/n;L.push([cx+ro*Math.cos(t),cy+ro*Math.sin(t)]);}for(let i=n;i>=0;i--){const t=phi+ti+(TAU-2*ti)*i/n;L.push([cx+ri*Math.cos(t),cy+ri*Math.sin(t)]);}return L;}
function slab(T,polys,t){const top=T.offset(polys,-.45,true);return T.steppedExtrude([{z0:0,z1:t-.5,polys},...(top.length?[{z0:t-.5,z1:t,polys:top}]:[])]);}
function toggleClasp(s,loopInner,wire,throat){
 const T=G.StudioTools||(typeof require==='function'?require('./tools'):null);if(!T)throw Error('Toggle clasp geometry is unavailable.');
 const band=Math.max(2.6,wire),t=clamp(s.thickness*.42,3,5),Di=clamp(s.size*.5,12,30),Ro=Di/2+band,li=loopInner/2,lo=li+band,circle=(r,cx=0,cy=0)=>Array.from({length:128},(_,i)=>[cx+r*Math.cos(i*TAU/128),cy+r*Math.sin(i*TAU/128)]);
 const d=Ro+lo-.8*band,ring=T.unionPolys([{outer:circle(Ro),holes:[circle(Di/2).reverse()]},{outer:cArc(d,0,li,lo,throat,0),holes:[]}]);
 const Lb=Di+2*band+Math.max(6,Di*.45),wb=Math.max(4.2,band*1.6),bar=T.unionPolys([{outer:Array.from({length:96},(_,i)=>{const a=i*TAU/96,c=Math.cos(a);return [(c>=0?Lb/2-wb/2:-Lb/2+wb/2)+wb/2*c,wb/2*Math.sin(a)];}),holes:[]},{outer:cArc(0,wb/2+lo-.8*band,li,lo,throat,Math.PI/2),holes:[]}]);
 return {ring:orient(slab(T,ring,t)),bar:orient(slab(T,bar,t)),ringInner:Di,barLength:Lb,thickness:t,band};
}
function accessories(result,o){
 const s=result.spec,clasp=o.clasp===undefined?'snap':o.clasp,connector=o.connector||'none',blank=o.medallion||'none';
 if(!['snap','toggle','none'].includes(clasp)||!['none','round','oval'].includes(connector)||!['none','round','oval'].includes(blank))throw Error('Choose a supported clasp, connector, and medallion.');
 if(blank!=='none'&&connector==='none')throw Error('Choose a pendant connector before adding a medallion.');
 const add=[],used=clasp!=='none'||connector!=='none',wire=used?positive(o,'connectorWire',2.4,1.2,6):2.4,clearance=used?positive(o,'connectorClearance',.5,.3,1.2):.5,throat=used?positive(o,'connectorThroat',.6,.2,2):.6,inner=used?positive(o,'connectorInner',16,6,48):16,minimum=.6*s.r;
 if((clasp!=='none'||connector!=='none')&&throat>=minimum-.05)throw Error(`The snap throat must be smaller than ${(minimum-.05).toFixed(2)} mm for these shaved links. Reduce the throat or choose your own clasp / no connector. Material flex and retention still need a printed test.`);
 const endInner=Math.max(inner,2*s.thickness+2*clearance+.8);
 let toggle=null;if(clasp==='snap')add.push({name:'assembly_end_clasp_C_snap',kind:'clasp',p:snapConnector(endInner,wire,throat),inner:endInner});
 if(clasp==='toggle'){toggle=toggleClasp(s,endInner,wire,throat);add.push({name:'assembly_end_toggle_ring',kind:'clasp',p:toggle.ring,inner:endInner},{name:'assembly_end_toggle_bar',kind:'clasp',p:toggle.bar,inner:endInner});}
 let target=null,blankSpec=null;
 if(connector!=='none'){
  target=o.pendantPosition==='custom'?+o.pendantLink:Math.ceil(result.count/2);
  if(!Number.isInteger(target)||target<1||target>result.count)throw Error(`Choose an attachment link from 1 to ${result.count}.`);
  const medThickness=blank!=='none'?positive(o,'medallionThickness',3,1.6,6):3,hole=blank!=='none'?positive(o,'medallionHole',6,3,16):6,medWidth=blank!=='none'?positive(o,'medallionWidth',38,18,70):38,web=Math.max(3.5,wire*1.5,medThickness);
  if(inner<s.thickness+(blank==='none'?0:medThickness)+2*clearance)throw Error(`Increase the pendant connector inner diameter to at least ${(s.thickness+(blank==='none'?0:medThickness)+2*clearance).toFixed(1)} mm for this chain / blank.`);
  if(blank!=='none'){
   if(hole<wire+2*clearance)throw Error(`The medallion hole must be at least ${(wire+2*clearance).toFixed(1)} mm for this connector and clearance.`);
   if(throat>=Math.min(medThickness,web)-.1)throw Error('Reduce the snap throat to retain this medallion.');
   blankSpec={shape:blank,width:medWidth,height:medWidth*(blank==='oval'?1.3:1),thickness:medThickness,hole,web};
   add.push({name:`assembly_${blank}_medallion_blank`,kind:'medallion',p:medallion(medWidth,medThickness,hole,blank==='oval',web)});
  }
  add.push({name:`assembly_${connector}_C_snap_pendant_clip`,kind:'pendant',p:snapConnector(inner,wire,throat,connector==='oval'),inner});
  result.parts[target-1].color='#58b8ba';
 }
 // Accessories deliberately have their own labeled assembly plate, never another chain run.
 if(add.length){const ids=[],offsetY=['P1S','P1P','X1 Carbon'].includes(result.preset)?24:0;let x=8,y=offsetY+8,rowHeight=0;
  for(const pt of add){const bb=C.bbox(pt.p),w=bb.max[0]-bb.min[0],h=bb.max[1]-bb.min[1];if(x+w>result.bed-8){x=8;y+=rowHeight+8;rowHeight=0;}if(y+h>result.bed-8)throw Error('The assembly accessories do not fit this plate. Reduce their dimensions.');
   const p=pt.p;for(let i=0;i<p.length;i+=3){p[i]+=x-bb.min[0];p[i+1]+=y-bb.min[1];}x+=w+8;rowHeight=Math.max(rowHeight,h);pt.color=pt.kind==='medallion'?'#e8c77b':'#58b8ba';pt.plate=1;ids.push(result.parts.length);result.parts.push(pt);
  }result.plates.push(ids);
 }
 result.chainIndices=result.plates[0];result.accessoryPlate=add.length?1:null;result.assembly={clasp,connector,target,wire,clearance,throat,inner,endInner:clasp!=='none'?endInner:null,toggle:toggle&&{ringInner:toggle.ringInner,barLength:toggle.barLength,thickness:toggle.thickness},medallion:blankSpec};
 return result;
}
// ---- Cuban serpentine: straight rows joined by U-turns where the links articulate sideways.
// Rows 2R apart use a plain semicircle; closer rows use a keyhole turn (bend out, around, back in).
// Link centers sit a fixed chord (the interlock pitch) apart along the path and each link points along
// the chord from its previous to its next neighbor, so every turn is the same hinge the straight row uses.
function pathSim(segs,x=0,y=0,h=0){let maxX=x,minY=y,maxY=y;for(const g of segs){const n=Math.max(2,Math.ceil((g.len||g.R*g.ang)/.5));for(let k=0;k<n;k++){if(g.len){x+=Math.cos(h)*g.len/n;y+=Math.sin(h)*g.len/n;}else{const cx=x-g.dir*g.R*Math.sin(h),cy=y+g.dir*g.R*Math.cos(h);h+=g.dir*g.ang/n;x=cx+g.dir*g.R*Math.sin(h);y=cy-g.dir*g.R*Math.cos(h);}maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}return {x,y,h,maxX,minY,maxY};}
function uTurn(R,g){if(g>=2*R-1e-9)return [{R,ang:Math.PI/2,dir:1},...(g-2*R>1e-9?[{len:g-2*R}]:[]),{R,ang:Math.PI/2,dir:1}];
 let lo=0,hi=Math.PI/2;for(let it=0;it<40;it++){const f=(lo+hi)/2;pathSim([{R,ang:f,dir:-1},{R,ang:Math.PI+2*f,dir:1},{R,ang:f,dir:-1}]).y>g?lo=f:hi=f;}
 const f=(lo+hi)/2;return [{R,ang:f,dir:-1},{R,ang:Math.PI+2*f,dir:1},{R,ang:f,dir:-1}];}
function pathWalker(x0,y0,segs){const st=[];let x=x0,y=y0,h=0,d0=0;for(const g of segs){st.push({x,y,h,d0,g});const e=pathSim([g],x,y,h);x=e.x;y=e.y;h=e.h;d0+=g.len||g.R*g.ang;}const total=d0;
 return d=>{if(d<0||d>total+1e-9)return null;let lo=0,hi=st.length-1;while(lo<hi){const m=(lo+hi+1)>>1;st[m].d0<=d?lo=m:hi=m-1;}const {x,y,h,d0,g}=st[lo],t=d-d0;
  if(g.len)return {xy:[x+Math.cos(h)*t,y+Math.sin(h)*t],angle:h};
  const cx=x-g.dir*g.R*Math.sin(h),cy=y+g.dir*g.R*Math.cos(h),hh=h+g.dir*t/g.R;return {xy:[cx+g.dir*g.R*Math.sin(hh),cy-g.dir*g.R*Math.cos(hh)],angle:hh};};}
function chordCenters(walk,pitch,limit,inside){const c=[];let d=0,q=walk(0);if(!q||(inside&&!inside(q)))return c;c.push(q);
 while(c.length<limit){const last=c[c.length-1].xy,dist=m=>{const p=walk(m);return p?Math.hypot(p.xy[0]-last[0],p.xy[1]-last[1]):-1;};
  let hi=d+pitch;if(!walk(hi))break;// chord <= arc, so the next center is at or beyond one pitch of arc length
  let step=pitch*.25;while(dist(hi)>=0&&dist(hi)<pitch)hi+=step;if(dist(hi)<0)break;let lo=hi-step<d?d:hi-step;
  for(let it=0;it<40;it++){const m=(lo+hi)/2;dist(m)<pitch?lo=m:hi=m;}const p=walk(hi);if(!p||(inside&&!inside(p)))break;c.push(p);d=hi;}
 return c.map((p,i)=>{if(i===0||i===c.length-1)return {xy:p.xy,angle:p.angle};const a=c[i-1].xy,b=c[i+1].xy;return {xy:p.xy,angle:Math.atan2(b[1]-a[1],b[0]-a[0])};});}
// Incremental safety: every new link vs every earlier one (bbox culled), stop at the first violation.
function placeLinks(s,centers,fits){const out=[];let minGap=Infinity;for(let i=0;i<centers.length;i++){const q=centers[i],pts=cubanLine(s,q.xy,q.angle);if(fits&&!fits(pts))return {links:out,minGap,edge:true};
 for(let j=out.length-1;j>=0;j--){const g=envelopeGap(out[j].pts,pts,s);if(g<s.clearance)return {links:out,minGap,fail:j===i-1?'neighbor':'crowd'};if(j<i-1&&g!==Infinity&&linking(coreCurve(out[j].pts,s),coreCurve(pts,s))!==0)return {links:out,minGap,fail:'crowd'};if(j>=i-1)minGap=Math.min(minGap,g);}
 if(i&&Math.abs(linking(coreCurve(out[i-1].pts,s),coreCurve(pts,s)))!==1)return {links:out,minGap,fail:'unlinked'};out.push({xy:q.xy,angle:q.angle,pts});}return {links:out,minGap};}
// Tightest U-turn radius (both turn directions) at which the links still hinge with full clearance.
function cubanMinTurn(s,base){const pitches=[base,base+.12*s.scale,base+.24*s.scale];
 for(let k=.35;k<=4.001;k+=.05){const R=k*s.size;for(const pitch of pitches){let ok=true;for(const dir of [1,-1]){const segs=[{len:2.5*pitch},{R,ang:Math.PI,dir},{len:2.5*pitch}],cs=chordCenters(pathWalker(0,0,segs),pitch,40);if(placeLinks(s,cs).fail){ok=false;break;}}if(ok)return {R,pitch};}}
 return null;}
function cubanSerpentine(s,base,bed,offsetY,limit=240){
 const turn=cubanMinTurn(s,base);if(!turn)return {links:[],minTurn:null};
 // Exact fit: each link's wire envelope stays 5.5 mm inside the usable plate (the export check uses 5 mm).
 const edge=5.5,ext=s.r+(s.sag||0),fits=pts=>pts.every(p=>p[0]-ext>=edge&&p[0]+ext<=bed-edge&&p[1]-ext>=offsetY+edge&&p[1]+ext<=bed-edge);
 const xs=s.size/2+edge+ext-s.r+.01,side=s.width/2+edge+ext-s.r+.01,ymin=offsetY+side,ymax=bed-side;
 let best={links:[],minTurn:turn.R};const rowGap=s.width+s.clearance+1;
 // Semicircle radii that land the last row exactly on the plate edge (most rows first), plus a keyhole try at the tightest radius.
 const H=ymax-ymin,tries=[];for(let n=Math.floor(H/(2*turn.R))+1;n>=2&&tries.length<3;n--){const R=Math.max(turn.R,H/(2*(n-1))-1e-6);tries.push([R,2*R]);}
 for(const k of [0,.05,.1,.15,.3]){const R=turn.R+k*s.size;tries.push([R,2*R]);}if(rowGap<2*turn.R)tries.push([turn.R,Math.max(rowGap,turn.R)]);
 for(const [R,g] of tries){
  const u=uTurn(R,g),e=pathSim(u),E=e.maxX,ylo=-e.minY,yhi=e.maxY-g,apex=bed-side;
  const left=side+E,right=apex-E,len=right-left;if(len<turn.pitch)continue;
  const y0=ymin+ylo;let rows=1;while(y0+rows*g<=ymax&&y0+rows*g+yhi<=ymax)rows++;
  const v=u.map(q=>q.len?q:{...q,dir:-q.dir}),segs=[{len:right-xs}];for(let r=1;r<rows;r++)segs.push(...(r%2?u:v),{len:r===rows-1?len+E:len});
  const cs=chordCenters(pathWalker(xs,y0,segs),turn.pitch,limit),res=placeLinks(s,cs,fits);
  if(res.links.length>best.links.length)best={links:res.links,minGap:res.minGap,pitch:turn.pitch,R,g,rows,minTurn:turn.R,keyhole:g<2*R-1e-9};}
 return best;}
function buildCuban(o={}){
 const notes=[];let s,base;
 // Thinner wire is the only way small links can still interlock with clearance: step it down instead of failing (and say so).
 try{s=cubanSpec(o);base=solvePitch(s);}catch(e){const want=clamp(+o.thickness||9.3,1.6,20);let ok=null;for(let k=Math.round(want*10)-1;k>=16;k--){const th=k/10;try{const t=cubanSpec({...o,thickness:th});const b=solvePitch(t);ok={t,b,th};break;}catch(_){}}if(!ok)throw e;s=ok.t;base=ok.b;notes.push(`Wire thinned from ${want.toFixed(1)} to ${ok.th.toFixed(1)} mm so ${s.size.toFixed(0)} mm links still interlock with ${s.clearance} mm clearance.`);}
 const count=requestedCount(o,32),bed=+o.bed||256,offsetY=['P1S','P1P','X1 Carbon'].includes(o.preset)?24:0;
 const cx=bed/2,cy=(bed+offsetY)/2,outer=(bed-offsetY)/2-s.width/2-7,step=s.width+s.clearance+2;
 const mode=['serpentine','spiral'].includes(o.layout)?o.layout:'auto';
 // Serpentine first: one flat back-and-forth necklace. Auto keeps it whenever the requested links fit.
 const serp=mode==='spiral'?null:cubanSerpentine(s,base,bed,offsetY);
 let best=[],bestGap=Infinity,bestPitch=base,kind='spiral';
 if(mode!=='serpentine'){
 // Compare inward spirals in both directions; reject every near-neighbor collision,
 // including adjacent turns. A straight fallback only wins if it holds more links.
 for(const direction of [1,-1])for(const pitch of [base,base-.24*s.scale,base+.24*s.scale]){
  const k=step/TAU,candidates=[];let theta=0,minGap=Infinity;
  for(let i=0;i<240;i++){
   const radius=outer-k*theta;if(radius<s.size*.68)break;
   const a=direction*theta,xy=[cx+radius*Math.cos(a),cy+radius*Math.sin(a)],angle=Math.atan2(direction*radius*Math.cos(a)-k*Math.sin(a),-k*Math.cos(a)-direction*radius*Math.sin(a));
   const pts=cubanLine(s,xy,angle);let gap=Infinity;
   for(let j=0;j<candidates.length;j++){const p=candidates[j],g=envelopeGap(p.pts,pts,s);gap=Math.min(gap,g);if(gap<s.clearance)break;if(j<i-1&&g!==Infinity&&linking(coreCurve(p.pts,s),coreCurve(pts,s))!==0){gap=-Infinity;break;}}
   if(gap<s.clearance||(i&&Math.abs(linking(coreCurve(candidates[i-1].pts,s),coreCurve(pts,s)))!==1))break;
   candidates.push({xy,angle,pts});minGap=Math.min(minGap,gap);
   // Arc-length integration to place the next center, never merely equally-spaced angles.
   let remaining=pitch;while(remaining>1e-6){const dr=Math.min(.025,remaining/Math.hypot(outer-k*theta,k));remaining-=dr*Math.hypot(outer-k*(theta+dr/2),k);theta+=dr;}
  }
  if(candidates.length>best.length){best=candidates;bestGap=minGap;bestPitch=pitch;}
 }
 // Small plates / very large links retain a safe single-row fallback.
 const row=[],span=bed-2*(s.size/2+7);for(let i=0;i<=Math.floor(span/base);i++){const xy=[s.size/2+7+i*base,cy],pts=cubanLine(s,xy,0);if(row.some((p,j)=>{const g=envelopeGap(p.pts,pts,s);return g<s.clearance||(j<i-1&&g!==Infinity&&linking(coreCurve(p.pts,s),coreCurve(pts,s))!==0);})||(i&&Math.abs(linking(coreCurve(row[i-1].pts,s),coreCurve(pts,s)))!==1))break;row.push({xy,angle:0,pts});}
 if(row.length>best.length){best=row;bestPitch=base;bestGap=row.length>1?envelopeGap(row[0].pts,row[1].pts,s):Infinity;kind='row';}
 }
 // Capacity is the best either layout can do; auto lays the necklace flat whenever the requested links fit in rows.
 const most=Math.max(best.length,serp?serp.links.length:0);
 if(serp&&(mode==='serpentine'||serp.links.length>=Math.min(count,most))){best=serp.links;bestGap=serp.minGap;bestPitch=serp.pitch;kind='serpentine';}
 const turnNote=serp?(serp.minTurn?`Tightest safe U-turn at this link and wire: ${Math.round(serp.minTurn)} mm radius${serp.links.length?`; laid-flat rows hold ${serp.links.length} links`:''}.`:'These links are too stiff sideways for any U-turn on this plate; use thinner wire or the spiral.'):'';
 if(mode==='serpentine'&&serp&&serp.links.length<2)throw Error(turnNote+' Choose the spiral layout, thinner wire, smaller links or a larger plate.');
 if(best.length<2)throw Error('These links cannot fit safely on this plate. Increase plate size or reduce link size / wire thickness.');
 const perPlate=mode==='auto'?most:best.length,plates=[[]],parts=[];if(count>perPlate){const e=capacityError(count,perPlate);if(turnNote)e.message+=' '+turnNote;e.layout=kind;e.serpentine=serp?serp.links.length:null;throw e;}
 if(turnNote)notes.push(turnNote);
 for(let i=0;i<count;i++){const q=best[i],p=cubanTube(q.pts,s,q.angle,false),box=C.bbox(p);
  if(box.min[0]<5||box.min[1]<offsetY+5||box.max[0]>bed-5||box.max[1]>bed-5)throw Error('A link extends beyond the usable plate. Reduce link size.');
  plates[0].push(i);parts.push({name:`chain_link_${i+1}`,kind:'chain',p,plate:0,color:i%2?'#c9a75d':'#e8c77b',center:q.xy,heading:q.angle,curve:coreCurve(q.pts,s)});
 }
 const validation=validateChain(best.slice(0,count).map(q=>q.pts),s);
 return accessories({parts,plates,count,perPlate,length:Math.round(((count-1)*bestPitch+s.size)*10)/10,pitch:bestPitch,bed,preset:o.preset,spec:s,validation,multi:false,notes,layoutMode:mode,turnRadius:kind==='serpentine'?serp.R:null,minTurnRadius:serp?serp.minTurn:null,serpentineCapacity:serp?serp.links.length:null,layout:kind==='serpentine'?`continuous serpentine (${serp.rows} rows, ${Math.round(serp.R)} mm U-turns)`:kind==='row'?'continuous straight row':'continuous curved spiral'},o);
}
function build(o={}){
 if(!o.style||o.style==='cuban')return buildCuban(o);
 const s=spec(o),pitch=solvePitch(s),count=requestedCount(o,48),bed=+o.bed||256,offsetY=['P1S','P1P','X1 Carbon'].includes(o.preset)?24:0,margin=s.a+s.r+8,W=bed-2*margin;
 // Bend radius is increased until every candidate neighbor at the U-turn is safely separated.
 let R=Math.max(s.a*1.25,s.width),slots=[],safeRadius=false;
 for(;R<W/2-1;R+=s.a*.25){
  const maxD=(Math.floor((bed-2*margin-offsetY)/(2*R))+1)*(W-2*R+Math.PI*R),candidates=[];let safe=true;
  for(let i=0;i<Math.ceil(maxD/pitch);i++){const q=pathAt(i*pitch,W,R);if(q.xy[1]>bed-2*margin-offsetY)break;
   const pts=line(s,q.xy,q.angle,i%2?-1:1);const cur={...q,pts};
   // Check every potentially nearby link (the bbox filter makes distant checks cheap).
   for(let j=0;j<candidates.length;j++){const g=envelopeGap(candidates[j].pts,pts,s);if(g<s.clearance||(j<i-1&&g!==Infinity&&linking(coreCurve(candidates[j].pts,s),coreCurve(pts,s))!==0)){safe=false;break;}}
   if(i&&Math.abs(linking(coreCurve(candidates[i-1].pts,s),coreCurve(pts,s)))!==1)safe=false;
   if(!safe)break;candidates.push(cur);
  }
  if(safe&&candidates.length>=2){slots=candidates;safeRadius=true;break;}
 }
 if(!safeRadius)throw Error('These links cannot safely snake on this plate. Choose a larger plate or smaller links.');
 const perPlate=Math.min(240,slots.length),plates=[[]],parts=[];if(count>perPlate)throw capacityError(count,perPlate);
 const curves=[];
 for(let i=0;i<count;i++){const q=slots[i],pts=q.pts.map(p=>[p[0]+margin,p[1]+margin+offsetY,p[2]]),p=tube(pts,s,q.angle,false),box=C.bbox(p);
  if(box.min[0]<5||box.min[1]<offsetY+5||box.max[0]>bed-5||box.max[1]>bed-5)throw Error('A link extends beyond the usable plate. Reduce link size.');
  plates[0].push(i);parts.push({name:`chain_link_${i+1}`,kind:'chain',p,plate:0,color:i%2?'#c9a75d':'#e8c77b',center:[q.xy[0]+margin,q.xy[1]+margin+offsetY],heading:q.angle,curve:coreCurve(pts,s)});curves.push(pts);
 }
 const validation=validateChain(curves,s);
 return accessories({parts,plates,count,perPlate,length:Math.round(((count-1)*pitch+2*(s.a+s.r))*10)/10,pitch,bed,preset:o.preset,spec:s,validation,multi:false,layout:'continuous serpentine'},o);
}
const api={linking,coreCurve,validateChain,snapConnector,medallion, spec,line,envelopeGap,solvePitch,segmentDistance,cubanSpec,cubanLine,cubanTube,cubanMinTurn,cubanSerpentine,build};if(typeof module!=='undefined'&&module.exports)module.exports=api;else G.GPNecklace=api;
})(typeof globalThis!=='undefined'?globalThis:this);
