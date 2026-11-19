// Drawer preview items for every other pocket: realistic, display-only stand-ins for what each insert holds (pens,
// pencils, crayons with paper wrappers and sharpened tips, capped markers, scissors, batteries, makeup, jewelry, kitchen
// utensils in the silverware trays, tools, controllers, phones, remotes and more). No brand names or logos.
// layout(r) turns the drawer result's placement data (r.props) into item placements (pure data, testable in Node);
// recipes(THREE, kit) adds the shapes to the bathroom preview's renderer (bathroom-props.js draws everything with one
// InstancedMesh per shape and material). Nothing here is ever exported: the items are not drawer parts, so they never
// reach the STL / 3MF files, the plate packer or the estimates.
(function(G){'use strict';
const FL=G.GPFitLib||(typeof require==='function'?require('./fit-library'):null),I=G.GPInserts||(typeof require==='function'?require('./organizer-inserts'):null);
const PI=Math.PI,rnd=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
// Palettes (generic, no brand colors on purpose).
const CRAYON=['#d7263d','#f46036','#f6ae2d','#f2d930','#7bc043','#1b998b','#2e86de','#3c40c6','#8e44ad','#e84393','#8d5524','#2d3436','#ff7f50','#00a8a8'];
const MARKER=['#e53935','#1e88e5','#43a047','#fdd835','#8e24aa','#fb8c00','#212121','#ec407a','#00897b','#6d4c41'];
const INK=['#1d3fbf','#1b1b1d','#c62828','#1d3fbf','#2e7d32','#1b1b1d'];
const HILITE=['#f4ff3a','#ff6ec7','#7cff6b','#ffb347','#6ee7ff'];
const LIP=['#b3123b','#d6336c','#a8323e','#e57373','#8e2443','#f48fb1'];
const POLISH=['#c2185b','#d32f2f','#7b1fa2','#f8bbd0','#00838f','#283593','#ff8a65','#ad1457'];
const SHADOW=['#e8c4a8','#c99a77','#a26a4a','#6e4430','#d9a1a0','#b5838d','#f1d6c6','#8d6e63','#c1a17b','#5d4037','#e0b8a4','#9c6b5e'];
const PAINT=['#e53935','#fdd835','#1e88e5','#43a047','#fb8c00','#8e24aa','#ffffff','#212121','#ec407a','#00acc1','#6d4c41','#c0ca33'];
const CASEART=['#2f80ed','#eb5757','#27ae60','#f2994a','#9b51e0','#f2c94c','#56ccf2','#219653'];
const pick=(a,i)=>a[((i%a.length)+a.length)%a.length];
// Fit-library item id -> preview type and look (sizes come from the library: L along x, W across, H tall).
const FIT={
 // Hand tools
 sdPrecision:['screwdriver',{color:'#2f6fd6'}],sdMedium:['screwdriver',{color:'#d63a2f'}],sdSmall:['screwdriver',{color:'#f2b705'}],sdStubby:['screwdriver',{color:'#2a9d58'}],
 wrench8:['outline',{mat:'flat'}],wrench10:['outline',{mat:'flat'}],wrench13:['outline',{mat:'flat'}],wrench17:['outline',{mat:'flat'}],wrenchAdj:['outline',{mat:'flat',grip:'#c62828'}],
 pliersNeedle:['pliers',{color:'#d63a2f'}],pliersSlip:['pliers',{color:'#2f6fd6'}],pliersLock:['pliers',{color:'#c62828'}],cutters:['pliers',{color:'#f2b705'}],
 utilityKnife:['utilKnife',{color:'#f2b705'}],tape25:['tape',{color:'#f6c200'}],tape16:['tape',{color:'#f6c200'}],hexFold:['outline',{mat:'darkMetal'}],hammer:['hammer',{}],
 level:['level',{color:'#f6c200'}],multimeter:['multimeter',{color:'#f57c00'}],caliper:['outline',{mat:'flat',screen:true}],multitool:['outline',{mat:'flat'}],
 ratchet14:['ratchet',{}],ratchet38:['ratchet',{}],socket14:['socket',{}],socket38:['socket',{}],extBar:['rod',{mat:'chrome'}],flashlight:['flashlight',{}],pencilCarp:['carpPencil',{}],
 // Bathroom (reuses the bathroom recipes where they exist)
 tbManual:['brush',{model:'manual'}],tbKids:['brush',{model:'manual',color:'#7cc242'}],tbElectric:['brush',{model:'io'}],tbSonic:['brush',{model:'sonicare4100'}],
 paste:['tube',{color:'#2f7fd8'}],pasteTravel:['tube',{color:'#d64545'}],razorCart:['razor',{color:'#3f6f8f'}],razorSafety:['safetyRazor',{}],comb:['comb',{color:'#202226'}],
 paddleBrush:['paddleBrush',{}],roundBrush:['roundBrush',{}],floss:['flossFlat',{}],clipper:['clippers',{}],tweezers:['tweezers',{}],trimmer:['trimmer',{}],deo:['deodorant',{}],hairTie:['hairties',{}],
 // Kitchen
 teaspoon:['spoon',{}],tablespoon:['spoon',{}],fork:['fork',{}],knife:['knife',{}],mSpoons:['mSpoons',{}],mCup:['mCup',{}],spatula:['spatula',{color:'#d84343'}],whisk:['whisk',{}],
 peeler:['peeler',{color:'#2a9d58'}],canOpener:['outline',{mat:'flat',grip:'#222428'}],pizza:['pizza',{}],tongs:['tongs',{color:'#d84343'}],kScissors:['scissors',{color:'#222428'}],ladle:['ladle',{}],
 // Office and art
 pen:['pen',{style:'ball'}],pencil:['pen',{style:'pencil'}],marker:['pen',{style:'marker'}],dryErase:['pen',{style:'dryErase'}],highlighter:['pen',{style:'highlighter'}],
 crayon:['pen',{style:'crayon'}],crayonJumbo:['pen',{style:'crayon'}],coloredPencil:['pen',{style:'colored'}],glueStick:['glueStick',{}],eraser:['eraser',{}],
 scissors8:['scissors',{color:'#e85d2a'}],scissorsKids:['scissors',{color:'#2f6fd6'}],sticky3:['sticky',{}],stickySm:['sticky',{}],usbStick:['usb',{}],sdCard:['card',{color:'#1f3a93'}],microSd:['card',{color:'#202226',micro:true}],
 stapler:['stapler',{}],tapeDisp:['tapeDisp',{}],calculator:['calculator',{}],glassesCase:['glassesCase',{}],glasses:['glasses',{}],
 // Makeup and jewelry
 lipstick:['lipstick',{}],mascara:['mascara',{}],eyeliner:['pen',{style:'colored',color:'#1b1b1d'}],compact:['compact',{}],palette:['palette',{}],foundation:['bottle',{lay:true,glass:'#f3d9c4',liquid:'#d9a47a',cap:'#1b1b1d'}],
 mkBrush:['mkBrush',{}],curler:['curler',{}],sponge:['sponge',{}],polish:['polish',{lay:true}],ringBox:['ring',{upright:true}],watch:['watch',{}],bracelet:['bangle',{}],earringCard:['earringCard',{}],
 // Batteries
 aa:['battery',{}],aaa:['battery',{}],c:['battery',{}],d:['battery',{}],'18650':['battery',{cell:true}],'9v':['nineVolt',{}],cr2032:['coin',{}],lr44:['coin',{button:true}],
 aaUp:['battery',{stand:true}],aaaUp:['battery',{stand:true}],
 // Gaming
 xboxSeries:['controller',{style:'x',color:'#2b2d31'}],xboxOne:['controller',{style:'x',color:'#dfe2e6'}],dualsense:['controller',{style:'ps',color:'#e4e6ea'}],dualshock4:['controller',{style:'ps',color:'#1f2124'}],
 switchPro:['controller',{style:'x',color:'#26282c'}],genericPad:['controller',{style:'x',color:'#3a3f47'}],joycon:['joycon',{}],joycon2:['joycon',{}],retroPad:['retroPad',{}],
 switchCase:['gameCase',{color:'#d7262b'}],discCase:['gameCase',{color:'#1d5fbf'}],dvdCase:['gameCase',{color:'#1d1f22'}],switchCart:['cart',{}],dsCart:['cart',{color:'#4a4e55'}],gbCart:['cart',{color:'#8c8f94',retro:true}],
 headset:['headset',{}],earbudsCase:['earbuds',{}],handheld:['handheld',{}],cableCoil:['coil',{color:'#1b1b1d'}],
 // Phones, chargers and remotes
 phone61:['phone',{color:'#3a3d44'}],phone67:['phone',{color:'#d9d4cc'}],tablet8:['phone',{color:'#8e9399',tablet:true}],chargerUsbc:['charger',{}],laptopBrick:['brick',{}],powerBank:['powerBank',{}],
 smartwatch:['smartwatch',{}],tvRemote:['remote',{}],streamRemote:['remote',{slim:true,color:'#2b2d31'}],acRemote:['remote',{color:'#f2f3f5',light:true}],uniRemote:['remote',{}],cableTie:['coil',{color:'#f4f5f6'}],adapter:['adapter',{}],
};
// Organizer-object pocket inserts -> what fills each pocket.
const SKIP=new Set(['smallparts','smallPartsDividers','smallPartsCups']);
const BATHSET=()=>G.GPBathProps?.BATH||(typeof require==='function'?(()=>{try{return require('./bathroom-props').BATH;}catch(_){return new Set();}})():new Set());
function layout(r){
 const out=[],list=r&&r.props||[],bath=BATHSET();
 for(const pr of list){if(SKIP.has(pr.id))continue;if(bath.has(pr.id)&&!(pr.places||[]).some(p=>p.k))continue;
  const at=(pl,rot,extra)=>Object.assign({x:pr.ox+pl.x,y:pr.oy+pl.y,z:pr.oz+(pl.z||0),rot,cell:pr.cell,item:pr.id},extra);
  const along=pl=>pl.w>=pl.d?0:PI/2,across=pl=>pl.w>=pl.d?PI/2:0,len=pl=>Math.max(pl.w,pl.d),wid=pl=>Math.min(pl.w,pl.d);
  const spec=I&&I.byId[pr.id]||{},H=spec.itemH||0;
  if(pr.id==='kitchen'){kitchenTray(pr,out);continue;}
  (pr.places||[]).forEach((pl,k)=>{const seed=1000*(pr.cell+1)+k,R=rnd(seed+17);
   if(pl.k){const f=FIT[pl.k],it=FL&&FL.byId[pl.k];if(!f||!it)return;const [type,o]=f,L=it.L,W=it.W,Hh=it.H,asym=type==='controller'||type==='joycon';
    const base={type,w:L,d:W,h:Hh,seed,k:pl.k,...o};
    if(o.stand){base.w=Hh;base.d=W;base.h=W;}
    if(type==='pen'&&!o.color)base.color=o.style==='crayon'?pick(CRAYON,k*5+3):o.style==='marker'||o.style==='dryErase'?pick(MARKER,k*3+1):o.style==='highlighter'?pick(HILITE,k):o.style==='colored'?pick(CRAYON,k*3):pick(INK,k);
    if(type==='brush'){const B=I.BRUSHES.find(b=>b.id===o.model)||I.BRUSHES[0];base.sx=L/B.length;base.sy=W/B.width;base.model=B.id;base.manual=B.id==='manual';}
    if(type==='tube'){base.w=L-4;base.d=W-3;}
    if(type==='bottle'||type==='polish'){base.w=W;base.d=Math.min(W,Hh);base.h=L;}
    if(type==='hairties'){base.w=Math.min(L,W)+6;}
    let rot=asym?(pl.rotX??pl.rot??0):(pl.rot??0);if(o.stand||it.up)rot=0;
    out.push(at(pl,rot,base));return;}
   const p=pl,L=len(p),Wd=wid(p);
   switch(pr.id){
    case 'aa':case 'aaa':out.push(at(p,R()*6,{type:'battery',w:H,d:Math.min(p.w,p.d)-.4,h:Math.min(p.w,p.d)-.4,stand:true,seed,variant:k%7===3?1:0}));break;
    case 'cd':{const s=p.size||p.w,big=s>30;out.push(at(p,R()*6,{type:'battery',w:big?61.5:50,d:s-.6,h:s-.6,stand:true,seed}));break;}
    case '9v':out.push(at(p,along(p)+PI/2,{type:'nineVolt',w:48.5,d:Math.max(p.w,p.d)-.6,h:Math.min(p.w,p.d)-.6,stand:true,seed}));break;
    case 'coincell':out.push(at(p,R()*6,{type:'coin',w:p.w-.4,d:p.w-.4,h:3.2,seed}));break;
    case 'coins':{const s=p.size||p.w,copper=Math.abs(s-19.05)<.3;out.push(at(p,0,{type:'coinStack',w:s-.6,n:4+Math.floor(R()*6),t:copper?1.52:s>24?1.75:s>21?1.95:1.35,copper,seed}));break;}
    case 'cups':case 'medCups':case 'erasers':{const kind=pr.id==='erasers'?'eraser':(k%3===0?'clips':k%3===1?'pushPins':'clips');out.push(at(p,0,{type:kind==='eraser'?'eraser':kind,w:p.w,d:p.d,h:12,seed,color:kind==='eraser'?pick(['#f48fb1','#ffffff','#90caf9'],k):null}));break;}
    case 'beads':out.push(at(p,0,{type:'beads',w:p.w,d:p.d,seed}));break;
    case 'pens':out.push(at(p,R()*6,{type:'pen',style:k%4===3?'pencil':'ball',w:Math.min(H||150,150),d:Math.min(10,p.w-.6),h:Math.min(10,p.w-.6),color:pick(INK,k),stand:true,flip:k%4!==3,seed}));break;
    case 'crayons':out.push(at(p,R()*6,{type:'pen',style:'crayon',w:H||92,d:Math.min(8.4,p.w-.4),h:Math.min(8.4,p.w-.4),color:pick(CRAYON,k*5+2),stand:true,seed}));break;
    case 'penTray':{const st=['ball','pencil','ball','marker','highlighter','ball','colored'][k%7];out.push(at(p,along(p)+(k%2?PI:0),{type:'pen',style:st,w:Math.min(L-6,st==='pencil'?175:st==='marker'?138:st==='highlighter'?118:142),d:st==='marker'?13:st==='highlighter'?16:Math.min(9.5,Wd-1),h:st==='highlighter'?11:st==='marker'?13:9.5,color:st==='marker'?pick(MARKER,k):st==='highlighter'?pick(HILITE,k):st==='colored'?pick(CRAYON,k*3):pick(INK,k),seed}));break;}
    case 'markers':{const st=k%3===2?'crayonRow':'marker';if(st==='crayonRow'){const n=Math.max(1,Math.floor((L-4)/96));for(let i=0;i<n;i++)out.push(at({...p,x:p.x+(p.w>=p.d?(i-(n-1)/2)*96:0),y:p.y+(p.w>=p.d?0:(i-(n-1)/2)*96)},along(p)+(i%2?PI:0),{type:'pen',style:'crayon',w:92,d:Math.min(8.4,Wd-1),h:8.4,color:pick(CRAYON,k*3+i),seed:seed+i}));}
     else out.push(at(p,along(p)+(k%2?PI:0),{type:'pen',style:'marker',w:Math.min(L-6,140),d:Math.min(14,Wd-1.5),h:Math.min(14,Wd-1.5),color:pick(MARKER,k),seed}));break;}
    case 'mascara':{const st=k%3;out.push(at(p,along(p)+(k%2?PI:0),st===1?{type:'pen',style:'colored',w:Math.min(L-6,140),d:8.5,h:8.5,color:pick(['#1b1b1d','#5d4037','#3e2723'],k),seed}:{type:'mascara',w:Math.min(L-8,138),d:Math.min(16,Wd-1),h:Math.min(16,Wd-1),seed}));break;}
    case 'makeupBrushes':out.push(at(p,along(p)+(k%2?PI:0),{type:'mkBrush',w:Math.min(L-6,168),d:Math.min(20,Wd-1.5),h:Math.min(20,Wd-1.5),seed}));break;
    case 'sd':out.push(at(p,across(p),{type:'card',w:32,d:Math.max(p.w,p.d)-.4,h:2,stand:true,color:pick(['#1f3a93','#202226','#b71c1c','#1f3a93'],k),seed}));break;
    case 'microsd':out.push(at(p,across(p),{type:'card',w:15,d:Math.max(p.w,p.d)-.3,h:.9,micro:true,stand:true,color:'#202226',seed}));break;
    case 'usb':out.push(at(p,across(p),{type:'usb',w:55,d:Math.max(p.w,p.d)+6,h:Math.min(p.w,p.d)+3,stand:true,flip:true,seed,color:pick(['#2b2d31','#1e88e5','#e53935','#c9ccd1'],k)}));break;
    case 'cards':out.push(at(p,along(p),{type:'cardStack',w:L-1.5,d:Wd-1.5,h:51,seed}));break;
    case 'sticky':out.push(at(p,R()*.1,{type:'sticky',w:p.w-1,d:p.d-1,h:18,seed,color:pick(['#f9e04c','#ff9eb5','#8fd3ff','#b5f28a'],k)}));break;
    case 'bits':out.push(at(p,R()*6,{type:'bit',w:25,d:6.35,h:6.35,stand:true,seed}));break;
    case 'hexkeys':{const s=p.size||2;out.push(at(p,R()*6,{type:'hexKey',w:Math.min(H||70,30+s*7),d:s,seed}));break;}
    case 'drill':{const s=p.size||2;out.push(at(p,0,{type:'drillBit',w:Math.min(90,30+s*9),d:s,h:s,stand:true,seed}));break;}
    case 'screwdrivers':out.push(at(p,R()*6,{type:'screwdriver',w:200,d:30,h:30,stand:true,flip:true,color:pick(['#d63a2f','#2f6fd6','#f2b705','#2a9d58'],k),seed}));break;
    case 'lipstick':out.push(at(p,R()*6,{type:'lipstick',w:80,d:p.w-1.2,h:p.w-1.2,open:true,color:pick(LIP,k),seed}));break;
    case 'polish':out.push(at(p,R()*.3,{type:'polish',w:p.w-1.4,d:p.w-1.4,h:H||70,color:pick(POLISH,k),seed}));break;
    case 'brushes':out.push(at(p,R()*6,{type:'mkBrush',w:Math.min(H||170,170),d:Math.min(13,p.w-.8),h:Math.min(13,p.w-.8),stand:true,seed}));break;
    case 'rings':{const n=Math.max(1,Math.floor((L-10)/26));for(let i=0;i<n;i++){if(R()<.25)continue;const off=(i-(n-1)/2)*26;out.push(at({...p,x:p.x+(p.w>=p.d?off:0),y:p.y+(p.w>=p.d?0:off)},along(p),{type:'ring',w:19,d:Math.min(3,Wd),h:19,slot:true,seed:seed+i,gem:R()<.6}));}break;}
    case 'earrings':if((k>>1)%3!==2)out.push(at(p,0,{type:'stud',w:4.5,seed:Math.floor(k/2)+seed,top:(spec.depth||8)}));break;
    case 'palette':out.push(at(p,along(p),{type:'palette',w:L-1.5,d:Wd-1.5,h:12,seed}));break;
    case 'compact':out.push(at(p,R()*6,{type:'compact',w:p.w-1.5,d:p.w-1.5,h:15,seed}));break;
    case 'foundation':out.push(at(p,R()*.4,{type:'bottle',w:p.w-1.2,d:p.w-1.2,h:H||110,glass:'#f3d9c4',liquid:pick(['#e0b48f','#c98f65','#f1caa5'],k),cap:'#1b1b1d',round:true,seed}));break;
    case 'sponges':out.push(at(p,R()*6,{type:'sponge',w:p.w-2,d:p.w-2,h:p.w*1.2,seed,color:pick(['#f2709c','#f7a8b8','#f4c095','#c39bd3'],k)}));break;
    case 'pillBottle':case 'pillBottleLarge':out.push(at(p,R()*6,{type:'pillBottle',w:p.w-1,d:p.w-1,h:H||75,white:pr.id==='pillBottleLarge',seed}));break;
    case 'pillBottleFlat':out.push(at(p,along(p),{type:'pillBottle',w:Wd-1,d:Wd-1,h:L-3,lay:true,seed}));break;
    case 'blister':out.push(at(p,across(p),{type:'blister',w:Math.max(p.w,p.d)-2,d:Math.min(p.w,p.d)-1,h:H||70,seed}));break;
    case 'bandages':out.push(at(p,along(p),{type:'box',w:L-1.5,d:Wd-1.5,h:22,color:pick(['#e9f1f7','#fbe9e7'],k),label:'#d32f2f',seed}));break;
    case 'thermometer':out.push(at(p,along(p),{type:'thermometer',w:Math.min(L-4,136),d:Math.min(Wd-2,20),h:12,seed}));break;
    case 'ointment':case 'paintTube':out.push(at(p,along(p)+(k%2?PI:0),{type:'tube',w:Math.min(L-8,pr.id==='paintTube'?150:120),d:Math.min(Wd-3,30),color:pr.id==='paintTube'?pick(PAINT,k*5):pick(['#2e7d32','#1565c0','#c62828'],k),seed}));break;
    case 'pillOrganizer':out.push(at(p,along(p),{type:'pillOrganizer',w:L-1.5,d:Wd-1.5,h:22,seed}));break;
    case 'cables':out.push(at(p,R()*6,k%2?{type:'charger',w:Math.min(44,p.w-4),d:Math.min(44,p.w-4),h:30,seed}:{type:'coil',w:p.w-4,d:p.w-4,h:16,color:pick(['#1b1b1d','#f4f5f6'],k>>1),seed}));break;
    case 'cableLanes':out.push(at(p,along(p)+(k%2?PI:0),{type:'cable',w:L-4,d:Math.min(Wd-1,6),h:5,color:pick(['#f4f5f6','#1b1b1d','#f4f5f6'],k),seed}));break;
    case 'scissors':out.push(at(p,along(p)+(k%2?PI:0),{type:'scissors',w:Math.min(L-2,150),d:Math.min(Wd-1,52),h:10,color:pick(['#e85d2a','#2f6fd6','#2a9d58','#1b1b1d'],k),seed}));break;
    case 'needles':out.push(at(p,along(p),{type:'needleCase',w:L-2,d:Math.min(Wd-.6,8),h:8,seed}));break;
    case 'bobbins':out.push(at(p,0,{type:'bobbin',w:p.w-.6,d:p.w-.6,h:11.7,color:pick(PAINT,k*7+1),seed}));break;
    case 'paint':out.push(at(p,R()*6,{type:'paintBottle',w:p.w-1,d:p.w-1,h:H||100,color:pick(PAINT,k*5+1),seed}));break;
    case 'paintMini':out.push(at(p,0,{type:'paintPot',w:p.w-1,d:p.w-1,h:H||45,color:pick(PAINT,k*5+2),seed}));break;
    case 'paintDropper':out.push(at(p,0,{type:'dropper',w:p.w-1,d:p.w-1,h:H||90,color:pick(PAINT,k*5+3),seed}));break;
    case 'tea':out.push(at(p,across(p),{type:'teaBag',w:Math.max(p.w,p.d)-1,d:Math.min(p.w,p.d)-1.5,h:H||70,color:pick(['#2e7d32','#c62828','#f9a825','#6d4c41','#5e35b1'],k),seed}));break;
    case 'measure':out.push(at(p,across(p),{type:'measureSpoon',w:Math.max(p.w,p.d)-2,d:Math.min(p.w,p.d)-1,h:30,seed}));break;
    case 'gameCases':case 'discCases':{const disc=pr.id==='discCases';out.push(at(p,across(p),{type:'caseStanding',w:Math.min(p.w,p.d)-.6,d:Math.max(p.w,p.d)-.8,h:H||170,color:disc?pick(['#1d5fbf','#1d1f22'],k>>2):'#d7262b',art:pick(CASEART,k),seed}));break;}
    case 'gameCards':out.push(at(p,across(p),{type:'cart',w:31,d:Math.max(p.w,p.d)-.4,h:3.3,stand:true,seed}));break;
    case 'tablet':out.push(at(p,across(p),{type:'phone',w:H||160,d:Math.max(p.w,p.d)-6,h:Math.min(p.w,p.d)-3,stand:true,color:pick(['#3a3d44','#d9d4cc','#8e9399'],k),seed}));break;
   }});
 }
 return out;}
// Silverware trays: utensils lying along the tray's long side, a little staggered so the pile looks real.
const TRAY={forks:['fork',195,25],spoons:['spoon',195,42],'table knives':['knife',230,20],knives:['knife',230,20],teaspoons:['spoon',150,30],spatulas:['spatula',300,75],whisks:['whisk',250,60],tongs:['tongs',230,45],ladles:['ladle',300,90],'serving spoons':['spoon',260,60],utensils:['spatula',300,75]};
function kitchenTray(pr,out){const key=String(pr.label||'').toLowerCase().trim(),t=TRAY[key];if(!t||pr.kind!=='tray')return;const [type,L0,W0]=t,iw=pr.innerW,id=pr.innerD,long=iw>=id,A=long?iw:id,B=long?id:iw;
 const L=Math.min(L0,A-8),sc=L/L0,W=W0*Math.max(.8,sc),R=rnd(97+pr.cell*31);if(L<60)return;
 const n=Math.max(1,Math.min(type==='whisk'||type==='spatula'||type==='tongs'?3:6,Math.floor((B-6)/(W*.86))));
 for(let i=0;i<n;i++){const off=(i-(n-1)/2)*Math.min(W+3,(B-W-4)/Math.max(1,n-1)),flip=type==='knife'?0:(i%2?0:0),s=(R()-.5)*6;
  const x=long?iw/2+s:iw/2+off,y=long?id/2+off:id/2+s;out.push({type,x:pr.ox+x,y:pr.oy+y,z:pr.oz+.05+(i%2)*.0,rot:(long?0:PI/2)+(R()-.5)*.05+(i%3===2?PI:0)*(type==='fork'||type==='spoon'?0:0),w:L,d:W,h:W*.3,cell:pr.cell,item:'kitchen',seed:pr.cell*100+i});}}
/* Transform for standing / laid-down / scaled items: local-frame matrix applied before the placement.
 * stand: a lying item (length along +x, thickness it.h) stands up with its +x end on top (flip: +x end down).
 * lay: a standing item (height it.h along z, width it.d) lies down with its top toward +x. sx/sy: scale. */
function xform(THREE,it){if(!it.stand&&!it.lay&&!it.sx)return null;const m=new THREE.Matrix4(),q=new THREE.Quaternion(),y=new THREE.Vector3(0,1,0),s=new THREE.Vector3(it.sx||1,it.sy||it.sx||1,it.sx||1);
 if(it.stand){const a=it.flip?PI/2:-PI/2;q.setFromAxisAngle(y,a);m.compose(new THREE.Vector3(it.flip?-it.h/2:it.h/2,0,it.w/2),q,s);}
 else if(it.lay){q.setFromAxisAngle(y,PI/2);m.compose(new THREE.Vector3(-it.h/2,0,it.d/2),q,s);}
 else m.compose(new THREE.Vector3(),q,s);return m;}
const api={layout,FIT,TRAY,xform};
/* ---------------- browser rendering (THREE) ---------------- */
// recipes(THREE, kit): type -> (item, parts) like bathroom-props; local frame: item centered on x/y, resting on z=0,
// length along +x. kit = {loft, slab, geo, k1} from bathroom-props so geometry is shared and cached.
function recipes(THREE,K){const {loft,slab,geo,k1}=K,V=(x,y,z)=>new THREE.Vector3(x,y,z),Q=new THREE.Quaternion(),E=new THREE.Euler();
 const mtx=(x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=sx,sz=sx)=>new THREE.Matrix4().compose(V(x,y,z),Q.clone().setFromEuler(E.set(rx,ry,rz)),V(sx,sy,sz));
 const cylG=s=>geo('cyl'+s,()=>{const g=new THREE.CylinderGeometry(1,1,1,s,1);g.rotateX(PI/2);g.translate(0,0,.5);return g;});
 const fruG=t=>{const key='dp:fru'+t.toFixed(2);return geo(key,()=>{const g=new THREE.CylinderGeometry(t,1,1,28,1);g.rotateX(PI/2);g.translate(0,0,.5);return g;});};
 const sph=()=>geo('dp:sph',()=>new THREE.SphereGeometry(1,24,16)),dish=()=>geo('dp:dish',()=>new THREE.SphereGeometry(1,28,10,0,2*PI,PI/2,PI/2));
 const torT=t=>geo('dp:tor'+t,()=>new THREE.TorusGeometry(1,t,12,56));
 const P=(out,g,make,mat,m,color)=>out.push({g,make,mat,m,color});
 // primitives (all sized in mm)
 const cyl=(out,x,y,z,r,h,mat,color,s=24,rx=0,ry=0,rz=0,ry2)=>P(out,'cyl'+s,()=>cylG(s),mat,mtx(x,y,z,rx,ry,rz,r,ry2??r,h),color);
 const rodX=(out,x0,len,r,zc,mat,color,y=0,s=24,rz=r)=>P(out,'cyl'+s,()=>cylG(s),mat,mtx(x0,y,zc,0,PI/2,0,rz,r,len),color); // along +x from x0
 const fruX=(out,x0,len,r,t,zc,mat,color,y=0)=>P(out,'dp:fru'+t.toFixed(2),()=>fruG(t),mat,mtx(x0,y,zc,0,PI/2,0,r,r,len),color); // narrows toward +x
 const fruZ=(out,x,y,z,r,h,t,mat,color)=>P(out,'dp:fru'+t.toFixed(2),()=>fruG(t),mat,mtx(x,y,z,0,0,0,r,r,h),color);
 const ball=(out,x,y,z,sx,sy,sz,mat,color,rz=0,rx=0,ry=0)=>P(out,'dp:sph',sph,mat,mtx(x,y,z,rx,ry,rz,sx,sy,sz),color);
 const bx=(out,x,y,z,w,d,h,mat,color,rz=0,rx=0,ry=0)=>P(out,'box',()=>geo('box',()=>new THREE.BoxGeometry(1,1,1)),mat,mtx(x,y,z+h/2,rx,ry,rz,w,d,h),color);
 const sl=(out,x,y,z,w,d,h,r,b,mat,color,rz=0)=>{const key=`dp:sl:${k1(w)}:${k1(d)}:${k1(h)}:${k1(r)}:${k1(b??-1)}`;P(out,key,()=>geo(key,()=>slab(THREE,w,d,h,r,b)),mat,mtx(x,y,z,0,0,rz),color);};
 const lo=(out,key,rows,mat,color,seg=28,ex=2,m)=>P(out,'dp:lo:'+key,()=>geo('dp:lo:'+key,()=>loft(THREE,rows,seg,ex)),mat,m,color);
 const lathe=(out,key,pts,mat,color,m,seg=40)=>P(out,'dp:la:'+key,()=>geo('dp:la:'+key,()=>{const g=new THREE.LatheGeometry(pts.map(([r,z])=>new THREE.Vector2(Math.max(0,r),z)),seg);g.rotateX(PI/2);g.computeVertexNormals();return g;}),mat,m,color);
 const tube=(out,key,pts,r,mat,color,m,closed=false,seg=6)=>P(out,'dp:tu:'+key,()=>geo('dp:tu:'+key,()=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>V(...p)),closed),Math.max(24,pts.length*3),r,seg,closed)),mat,m,color);
 const outlineG=(id,h,bev)=>{const key=`dp:ol:${id}:${k1(h)}`;return geo(key,()=>{const polys=FL.outline(id),shapes=polys.map(Q2=>{const s=new THREE.Shape();Q2.outer.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));return s;});const b=Math.min(bev,h/2-.05);const g=new THREE.ExtrudeGeometry(shapes,{depth:Math.max(.05,h-2*b),bevelEnabled:true,bevelThickness:b,bevelSize:b*.85,bevelSegments:3,curveSegments:8});g.translate(0,0,b);g.computeVertexNormals();return g;});};
 const roundRows=(x0,x1,r,zc,n=10,endR=.7)=>{const rows=[];for(let i=0;i<=n;i++){const t=i/n,x=x0+t*(x1-x0),e=Math.min(1,Math.min(t,1-t)*n/1.6),s=endR+(1-endR)*Math.sqrt(Math.min(1,e));rows.push([x,r*s,r*s,zc]);}return rows;};
 const ss=(a,b,x)=>{const u=Math.min(1,Math.max(0,(x-a)/(b-a)));return u*u*(3-2*u);},smax=(a,b,k)=>(a+b+Math.sqrt((a-b)**2+k*k))/2-k/2*Math.exp(-Math.abs(a-b)/k);
 const wareG=(N,M,f)=>{const rows=[];for(let i=0;i<=N;i++)rows.push(f(i/N));const pos=[],idx=[];
  const vt=(r,j,top)=>{const [x,yl,yr,zc,th,D,B]=r,v=-1+2*j/M,c=1-v*v;return [x,yl+(yr-yl)*j/M,zc+(top?th/2+(B||0)*c:-th/2-(B||0)*c)-(D||0)*c];};
  const grid=top=>{const b0=pos.length/3;for(let i=0;i<=N;i++)for(let j=0;j<=M;j++)pos.push(...vt(rows[i],j,top));
   for(let i=0;i<N;i++)for(let j=0;j<M;j++){const a=b0+i*(M+1)+j,c=a+M+1;top?idx.push(a,c,a+1,a+1,c,c+1):idx.push(a,a+1,c,a+1,c+1,c);}};
  grid(true);grid(false);
  const strip=(pts,flip)=>{const b0=pos.length/3;for(const [T,Bv]of pts)pos.push(...T,...Bv);for(let i=0;i<pts.length-1;i++){const t0=b0+2*i,b1=t0+1,t1=t0+2,b2=t0+3;flip?idx.push(t0,b1,t1,t1,b1,b2):idx.push(t0,t1,b1,t1,b2,b1);}};
  strip(rows.map(r=>[vt(r,M,true),vt(r,M,false)]),false);strip(rows.map(r=>[vt(r,0,true),vt(r,0,false)]),true);
  const cap=(r,flip)=>{const pts=[];for(let j=0;j<=M;j++)pts.push([vt(r,j,true),vt(r,j,false)]);strip(pts,flip);};cap(rows[N],true);cap(rows[0],false);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;};
 const ware=(out,key,f,mat,N=60,M=10,color)=>P(out,'dp:wa:'+key,()=>geo('dp:wa:'+key,()=>wareG(N,M,f)),mat,null,color);
 const R={
  // Pens, pencils, crayons, markers and highlighters lying flat (tip toward +x).
  pen(it,out){const L=it.w,r=Math.max(1.6,Math.min(it.d,it.h)/2),x0=-L/2,zc=r,c=it.color||'#1d3fbf',st=it.style||'ball';
   if(st==='pencil'||st==='colored'||st==='carp'){const cone=Math.min(16,L*.09),body=L-cone-(st==='pencil'?9:0),bx0=x0+(st==='pencil'?9:0);
    if(st==='pencil'){P(out,'cyl6',()=>cylG(6),'plastic',mtx(bx0,0,zc*0.92,0,PI/2,PI/6,r,r,body),'#f2b705');rodX(out,x0+2.4,6.8,r*1.02,zc,'gold',null,0,24);for(let i=0;i<3;i++)P(out,'dp:tor0.12',()=>torT(.12),'gold',mtx(x0+3.4+i*2.2,0,zc,0,PI/2,0,r*1.02,r*1.02,r*1.02),null);rodX(out,x0,2.6,r*.96,zc,'rubber','#f28b9c');ball(out,x0+.2,0,zc,.9,r*.95,r*.95,'rubber','#f28b9c');}
    else{rodX(out,bx0,body,r,zc,'plastic',c,0,24);ball(out,bx0+.3,0,zc,.8,r*.98,r*.98,'plastic',c);}
    fruX(out,x0+L-cone,cone,r*.98,.24,zc,'wood','#e2bf8f');fruX(out,x0+L-cone*.26,cone*.26,r*.24,.12,zc,st==='colored'?'wax':'darkMetal',st==='colored'?c:'#3a3a3e');return;}
   if(st==='crayon'){const tip=Math.min(11,L*.12),wrapL=L-tip-6;rodX(out,x0,L-tip,r,zc,'wax',c,0,24);ball(out,x0+.15,0,zc,.5,r,r,'wax',c);
    rodX(out,x0+3,wrapL,r*1.03,zc,'paper',c,0,24);for(const xb of [x0+6,x0+3+wrapL-6])rodX(out,xb,2.2,r*1.045,zc,'paper','#1b1b1d',0,24);rodX(out,x0+3+wrapL*.32,wrapL*.36,r*1.04,zc,'paper',shade(c,.25),0,24);
    fruX(out,x0+L-tip,tip-1,r,.36,zc,'wax',c);ball(out,x0+L-1.4,0,zc,1.4,r*.36,r*.36,'wax',c);return;}
   if(st==='marker'||st==='dryErase'){const capL=L*.36,bodyL=L-capL+2,bodyC=st==='dryErase'?c:'#f3f4f6';lo(out,`pm:${k1(L)}:${k1(r)}`,roundRows(x0+5,x0+bodyL,r*.94,zc,12,.85),'plastic',bodyC);rodX(out,x0,5.4,r*.95,zc,'plastic',c);ball(out,x0+.6,0,zc,1.4,r*.9,r*.9,'plastic',c);
    if(st==='marker')rodX(out,x0+bodyL*.18,bodyL*.5,r*.955,zc,'satin',shade(c,-.05),0,28);
    lo(out,`pmc:${k1(capL)}:${k1(r)}`,(()=>{const rows=[];for(let i=0;i<=10;i++){const t=i/10,x=x0+L-capL+t*capL,e=t>.82?Math.sqrt(Math.max(.05,1-((t-.82)/.18)**2)):1;rows.push([x,r*e,r*e,zc]);}return rows;})(),'plastic',st==='dryErase'?'#1b1b1d':c);
    rodX(out,x0+L-capL-1,2.2,r*1.02,zc,'plastic',st==='dryErase'?'#1b1b1d':c);sl(out,x0+L-capL*.52,0,zc+r*.8,capL*.62,3.2,1.8,1.4,.6,'plastic',st==='dryErase'?'#1b1b1d':c);return;}
   if(st==='highlighter'){const capL=L*.3,ex=3.2;lo(out,`ph:${k1(L)}:${k1(r)}`,roundRows(x0+2,x0+L-capL+2,r,zc*.8,12,.8).map(q=>[q[0],q[1]*1.2,q[2]*.78,q[3]]),'clear',c,28,ex);
    lo(out,`ph2:${k1(L)}:${k1(r)}`,roundRows(x0+2.2,x0+L-capL+1,r*.92,zc*.8,8,.8).map(q=>[q[0],q[1]*1.1,q[2]*.7,q[3]]),'plastic',c,28,ex);
    lo(out,`phc:${k1(capL)}:${k1(r)}`,roundRows(x0+L-capL,x0+L,r*1.02,zc*.8,8,.75).map(q=>[q[0],q[1]*1.2,q[2]*.8,q[3]]),'plastic',shade(c,-.2),28,ex);return;}
   // ballpoint: barrel, rubber grip, cone and tip, clicker and clip
   const b1=x0+L*.84;lo(out,`pb:${k1(L)}:${k1(r)}`,roundRows(x0+6,b1,r*.92,zc,14,.92),'plastic',it.barrel||'#f3f4f6');rodX(out,x0+L*.55,L*.28,r*.98,zc,'rubber',c);
   fruX(out,b1,L*.13,r*.86,.22,zc,'chrome');ball(out,x0+L-.9,0,zc,.9,.6,.6,'steel');rodX(out,x0,6.5,r*.55,zc,'plastic',c);ball(out,x0+.3,0,zc,.6,r*.55,r*.55,'plastic',c);
   rodX(out,x0+6,2.4,r*.97,zc,'chrome');sl(out,x0+6+L*.17,0,zc+r*.86,L*.3,2.4,1,1,.35,'chrome');ball(out,x0+6+L*.32,0,zc+r*.98,1.6,1.4,1.1,'chrome');},
  glueStick(it,out){const L=it.w,r=it.d/2,x0=-L/2;rodX(out,x0,L*.72,r,r,'plastic','#f3f4f6',0,32);rodX(out,x0+L*.2,L*.4,r*1.01,r,'paper','#7b3fbf',0,32);rodX(out,x0+L*.71,L*.29,r*1.02,r,'plastic','#7b3fbf',0,32);ball(out,x0+L-.8,0,r,.8,r*.98,r*.98,'plastic','#7b3fbf');rodX(out,x0-.01,1.6,r*.9,r,'plastic','#7b3fbf',0,32);},
  eraser(it,out){const w=Math.min(it.w,40),d=Math.min(it.d,22),h=Math.min(it.h||12,12);sl(out,0,0,0,w,d,h,2,1.2,'rubber',it.color||'#f48fb1');if(it.k||it.seed%2)sl(out,w*.12,0,-.01,w*.6,d+.6,h+.6,.6,.3,'paper','#1e88e5');},
  // Scissors: two crossed steel blades, chrome pivot and soft-touch handle loops (handles toward +x).
  scissors(it,out){const L=it.w,W=it.d,x0=-L/2,xp=x0+L*.5,hR=Math.min(W*.24,L*.13);
   for(const s of [-1,1]){const rows=[];for(let i=0;i<=12;i++){const t=i/12,x=xp-t*(L*.5-2),hw=(W*.11)*(1-t)+1.1*t;rows.push([x,hw,.75,1+(s>0?1.6:0)]);}lo(out,`scb:${k1(L)}:${k1(W)}:${s}`,rows,'flat',null,16,3.4,mtx(0,s*W*.03,0,0,0,s*.035));
    const cx=x0+L*.79,cy=s*W*.25;P(out,'dp:tor0.22',()=>torT(.22),'plastic',mtx(cx,cy,2.4,0,0,0,hR,hR*.78,hR*.9),it.color||'#e85d2a');
    {const ang=Math.atan2(cy,cx-hR*.9-xp),len=Math.hypot(cy,cx-hR*.9-xp),sh=[];for(let i=0;i<=8;i++){const t=i/8;sh.push([2+t*(len-2),Math.max(2.2,W*.06)*(1+.25*t),2.1,2.4]);}lo(out,`scs:${k1(L)}:${k1(W)}:${s}`,sh,'plastic',it.color||'#e85d2a',20,2.4,mtx(xp,0,0,0,0,ang));}}
   cyl(out,xp,0,0,3.2,4.4,'chrome',null,24);ball(out,xp,0,4.4,3.2,3.2,.9,'chrome');},
  curler(it,out){R.scissors({...it,color:'#c9ccd1'},out);const L=it.w,x0=-L/2;sl(out,x0+L*.15,0,4,L*.26,it.d*.5,4,4,1,'chrome');sl(out,x0+L*.15,0,8,L*.24,2.4,2,1,.5,'rubber','#1b1b1d');},
  // Batteries: steel ends, positive nub and a colored wrap with a contrasting top band.
  battery(it,out){const L=it.w,r=Math.min(it.d,it.h)/2,x0=-L/2,zc=r,R0=rnd(it.seed||3),v=it.variant??Math.floor(R0()*3),wrap=it.cell?'#2f6fd6':['#1c1c1e','#1c1c1e','#2b3a55'][v],band=it.cell?'#2f6fd6':['#c87533','#c87533','#9aa4b1'][v];
   rodX(out,x0,.7,r*.93,zc,'steel');rodX(out,x0+.6,L-2.4,r,zc,'satin',wrap,0,32);rodX(out,x0+.6+(L-2.4)*.68,(L-2.4)*.32,r*1.004,zc,'satin',band,0,32);rodX(out,x0+L*.2,L*.3,r*1.006,zc,'satin',shade(wrap,.25),0,32);
   rodX(out,x0+L-1.8,.8,r*.9,zc,'steel');rodX(out,x0+L-1.2,1.2,r*.36,zc,'steel');P(out,'dp:tor0.12',()=>torT(.12),'steel',mtx(x0+.6,0,zc,0,PI/2,0,r*.95,r*.95,r*.95),null);},
  nineVolt(it,out){const L=it.w,W=it.d,T=it.h,x0=-L/2;sl(out,-1.5,0,0,L-3,W,T,1.6,.8,'satin','#1c1c1e');sl(out,L*.18,0,-.02,L*.42,W+.06,T+.04,1.6,.8,'satin','#c87533');sl(out,L/2-2.6,0,.4,2.4,W-1,T-.8,1,.4,'steel');
   rodX(out,L/2-.6,3,3.1,T/2,'chrome',null,-W*.24,24);P(out,'cyl6',()=>cylG(6),'chrome',mtx(L/2-.6,W*.24,T/2,0,PI/2,0,4.2,4.2,3),null);rodX(out,L/2+1.4,1,2.4,T/2,'darkMetal','#333',W*.24,6);},
  coin(it,out){const r=it.w/2,h=it.h||3.2;cyl(out,0,0,0,r,h*.82,'steel',null,48);cyl(out,0,0,h*.8,r*.9,h*.2,'chrome',null,48);P(out,'dp:tor0.08',()=>torT(.08),'chrome',mtx(0,0,h*.82,0,0,0,r*.95,r*.95,r*.6),null);},
  coinStack(it,out){const R0=rnd(it.seed||5),r=it.w/2,t=it.t||1.6;for(let i=0;i<it.n;i++){const dx=(R0()-.5)*.8,dy=(R0()-.5)*.8;cyl(out,dx,dy,i*t,r,t*.96,it.copper?'gold':'steel',it.copper?'#c46b3c':null,40);P(out,'dp:tor0.08',()=>torT(.08),it.copper?'gold':'steel',mtx(dx,dy,i*t+t*.96,0,0,0,r*.94,r*.94,r*.3),it.copper?'#c46b3c':null);}},
  // Clips and push pins piled in small cups.
  clips(it,out){const R0=rnd(it.seed||9),n=Math.max(4,Math.floor(it.w*it.d/110));const path=[[0,0,0],[24,0,0],[26.5,2.2,0],[24,4.4,0],[3,4.4,0],[1,2.6,0],[3,1.2,0],[20,1.2,0],[21.6,2.6,0],[20,3.4,0],[7,3.4,0]];
   for(let i=0;i<n;i++){const a=R0()*6.3,x=(R0()-.5)*(it.w-26),y=(R0()-.5)*(it.d-26);const m=mtx(x,y,.6+i*.9,0,(R0()-.5)*.25,a,1,1,1);m.multiply(mtx(-13,-2.2,0));tube(out,'clip',path,.48,i%4===3?'plastic':'chrome',i%4===3?pick(MARKER,i):null,m,false,6);}},
  pushPins(it,out){const R0=rnd(it.seed||8),n=Math.max(5,Math.floor(it.w*it.d/80));for(let i=0;i<n;i++){const x=(R0()-.5)*(it.w-10),y=(R0()-.5)*(it.d-10),a=R0()*6.3,z=.8+(i%3)*2.2,c=pick(MARKER,i+3);
   const m=mtx(x,y,z,PI/2*(.9+R0()*.2),0,a);const p=[];cyl(p,0,0,0,3.2,1.2,'plastic',c,20);fruZ(p,0,0,1.2,2.4,5,.75,'plastic',c);cyl(p,0,0,6.2,3,1.4,'plastic',c,20);cyl(p,0,0,-7,.42,7,'chrome',null,8);for(const q of p){q.m=m.clone().multiply(q.m);out.push(q);}}},
  beads(it,out){const R0=rnd(it.seed||4),n=Math.max(4,Math.floor(it.w*it.d/40));for(let i=0;i<n;i++){const r=2+R0()*2.2;ball(out,(R0()-.5)*(it.w-2*r-2),(R0()-.5)*(it.d-2*r-2),r+.3+(i%3)*1.6,r,r,r,'gem',pick(PAINT.concat(['#d4af37','#c0c0c0']),i*3+1));}},
  // Business cards on edge, sticky-note stacks, USB drives and memory cards.
  cardStack(it,out){const n=Math.max(1,Math.floor(it.d/1.6));sl(out,0,0,0,it.w,it.d,it.h,1,.3,'paper','#f7f6f2');for(let i=0;i<Math.min(n,8);i++)bx(out,0,-it.d/2+.3+i*(it.d-.6)/Math.max(1,Math.min(n,8)-1),it.h-.2+(i%2)*.35,it.w-.6,.18,.5,'paper',i%3?'#ffffff':'#e8e6df');bx(out,0,it.d/2+.01,it.h*.35,it.w*.6,.1,it.h*.3,'paper','#1e3a5f');},
  sticky(it,out){const R0=rnd(it.seed||2),h=it.h||18,c=it.color||'#f9e04c';sl(out,0,0,0,it.w,it.d,h-1.4,.6,.25,'paper',c);for(let i=0;i<4;i++){bx(out,(R0()-.5)*.8,(R0()-.5)*.8,h-1.4+i*.35,it.w-.2,it.d-.2,.32,'paper',i%2?c:shade(c,.08),(R0()-.5)*.03);}bx(out,0,-it.d/2+4,h+.02,it.w-.4,7.6,.08,'paper',shade(c,-.06));},
  usb(it,out){const L=it.w,W=Math.min(it.d,20),T=Math.min(it.h,9),x0=-L/2,body=L*.7,c=it.color||'#2b2d31';sl(out,x0+body/2,0,0,body,W,T,W*.3,1.6,'plastic',c);sl(out,x0+body*.35,0,T-.3,body*.4,W*.55,.5,1,.2,'satin',shade(c,.3));
   sl(out,x0+body+(L-body)/2-.5,0,(T-4.5)/2,L-body+1,12,4.5,.3,.2,'steel');for(const s of [-1,1])bx(out,x0+body+(L-body)*.55,s*2.5,(T+4.5)/2-.02,2,1.6,.1,'darkMetal','#222');P(out,'dp:tor0.22',()=>torT(.22),'plastic',mtx(x0+5,0,T/2,0,0,0,2.4,2.4,4),c);},
  card(it,out){const L=it.w,W=it.d,T=it.h||2.1,c=it.color||'#1f3a93',x0=-L/2;sl(out,0,0,0,L,W,T,it.micro?.8:1.2,.25,'satin',c);sl(out,-L*.08,0,T-.05,L*.62,W*.82,.1,.6,0,'paper',shade(c,.35));
   const n=it.micro?8:9;for(let i=0;i<n;i++)bx(out,x0+L*.92-(it.micro?1:0),-W/2+W*.12+i*(W*.76/(n-1)),T-.06,it.micro?1.8:3.4,W*.06,.1,'gold',null);bx(out,x0+L*.25,W/2-.6,T*.25,L*.18,1.4,T*.6,'satin',shade(c,-.2));},
  stapler(it,out){const L=it.w,W=Math.min(it.d,38),H=Math.min(it.h,55),x0=-L/2;sl(out,0,0,0,L,W*.9,6,3,1.5,'satin','#1b1b1d');const rows=[];for(let i=0;i<=14;i++){const t=i/14,x=x0+3+t*(L-6),hh=(H*.32)*(1-.35*t)+2;rows.push([x,W*.46*(1-.15*t),hh/2,8+H*.38*(1-t*.25)-hh/2+hh/2]);}lo(out,`stp:${k1(L)}`,rows,'plastic','#c62828',30,2.6);
   sl(out,x0+L*.55,0,8+H*.5,L*.55,W*.4,1.2,1,.4,'chrome');cyl(out,x0+8,0,6,4,H*.4,'darkMetal','#333',16);},
  tapeDisp(it,out){const L=it.w,W=it.d,H=Math.min(it.h,60);sl(out,0,0,0,L,W,H*.45,8,3,'plastic','#1b1b1d');P(out,'dp:tor0.22',()=>torT(.22),'clear',mtx(-L*.08,0,H*.5,PI/2,0,0,H*.3,H*.3,W*.9),'#eae6d0');cyl(out,-L*.08,-W*.45,H*.5,H*.16,W*.9,'plastic','#3a3a3e',32,-PI/2);sl(out,L*.38,0,H*.44,L*.16,W*.9,H*.3,3,1.4,'plastic','#1b1b1d');bx(out,L*.43,0,H*.74,2,W*.85,1,'steel');},
  calculator(it,out){const L=it.w,W=it.d,H=Math.min(it.h,15),x0=-L/2;sl(out,0,0,0,L,W,H,6,2.4,'satin','#2b2d31');sl(out,x0+L*.83,0,H-.2,L*.24,W*.78,.6,2,.2,'screen');sl(out,x0+L*.83,0,H+.3,L*.2,W*.68,.12,1,0,'satin','#9aab8c');
   for(let i=0;i<5;i++)for(let j=0;j<4;j++)sl(out,x0+L*.1+i*L*.13,-W*.3+j*W*.2,H-.3,L*.1,W*.15,2.2,2,.6,'rubber',j===3&&i<2?'#e65100':i===4?'#5d6168':'#3e4248');},
  glassesCase(it,out){const L=it.w,W=it.d,H=Math.min(it.h,35);lo(out,`gc:${k1(L)}:${k1(W)}`,roundRows(-L/2,L/2,1,H/2,18,.25).map(q=>[q[0],W/2*(q[1]**.5),H/2*q[2],H/2]),'satin','#2b3a55',36,2.6);bx(out,0,0,H/2-.4,L*.96,W*1.005,.8,'satin','#1e2a40');},
  glasses(it,out){const L=it.w,W=Math.min(it.d,45),r=L*.2;for(const s of [-1,1]){P(out,'dp:tor0.1',()=>torT(.1),'plastic',mtx(s*L*.24,0,r*.1+1.6,0,0,0,r,r*.78,r*.4),'#1b1b1d');cyl(out,s*L*.24,0,1.4,r*.94,.6,'glass',null,40,0,0,0,r*.72);}bx(out,0,0,2.4,L*.12,3,1.6,'plastic','#1b1b1d');for(const s of [-1,1])bx(out,0,s*(W/2-2.5),4,L*.9,2,2,'plastic','#1b1b1d');},
  // Makeup.
  lipstick(it,out){const L=it.w,r=Math.min(it.d,it.h)/2;if(it.open){cyl(out,0,0,0,r,L*.45,'gold',null,40);cyl(out,0,0,L*.45,r*.84,L*.14,'gold',null,40);cyl(out,0,0,L*.58,r*.62,L*.18,'wax',it.color,32);ball(out,0,r*.15,L*.76,r*.62,r*.52,r*.7,'wax',it.color,0,.5);P(out,'dp:tor0.08',()=>torT(.08),'gold',mtx(0,0,L*.45,0,0,0,r*.97,r*.97,r*.4),null);return;}
   const x0=-L/2;rodX(out,x0,L*.5,r,r,'gold',null,0,40);rodX(out,x0+L*.5,L*.5,r*1.01,r,'plastic',it.color||'#1b1b1d',0,40);ball(out,x0+L,0,r,.8,r,r,'plastic',it.color||'#1b1b1d');},
  mascara(it,out){const L=it.w,r=Math.min(it.d,it.h)/2,x0=-L/2;lo(out,`ms:${k1(L)}:${k1(r)}`,roundRows(x0,x0+L*.42,r,r,10,.8),'plastic','#c2185b');rodX(out,x0+L*.41,2.4,r*.96,r,'chrome');lo(out,`msc:${k1(L)}:${k1(r)}`,roundRows(x0+L*.43,x0+L,r*.92,r,14,.7).map((q,i,a)=>[q[0],q[1]*(1-.25*i/a.length),q[2]*(1-.25*i/a.length),q[3]]),'plastic','#1b1b1d');},
  compact(it,out){const r=it.w/2,H=Math.min(it.h||15,15);cyl(out,0,0,0,r,H*.45,'gold','#e3b7a0',56);cyl(out,0,0,H*.45,r*1.005,H*.45,'plastic','#1b1b1d',56);ball(out,0,0,H*.9,r*.96,r*.96,H*.12,'plastic','#1b1b1d');P(out,'dp:tor0.08',()=>torT(.08),'gold',mtx(0,0,H*.45,0,0,0,r*1.01,r*1.01,r*.25),'#e3b7a0');ball(out,0,0,H*.97,r*.25,r*.25,.6,'gold','#e3b7a0');},
  palette(it,out){const L=it.w,W=it.d,H=Math.min(it.h||12,12),R0=rnd(it.seed||1);sl(out,0,0,0,L,W,H,4,1.4,'satin','#1b1b1d');const nx=L>W*1.3?4:3,ny=W>50?3:2,pw=(L-8)/nx,pd=(W-8)/ny;
   for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const c=pick(SHADOW,i*ny+j+Math.floor(R0()*3));sl(out,-L/2+4+pw*(i+.5),-W/2+4+pd*(j+.5),H-1.6,pw-2,pd-2,1.7,1.2,.3,(i+j)%3===0?'gold':'satin',c);}},
  mkBrush(it,out){const L=it.w,r=Math.min(it.d,it.h)/2,x0=-L/2,zc=r,R0=rnd(it.seed||6),wood=R0()<.5;const hr=[];for(let i=0;i<=14;i++){const t=i/14,x=x0+t*L*.6,s=(.55+.45*Math.sin(Math.min(1,t*1.1)*PI*.5))*(t<.04?.8:1);hr.push([x,r*.48*s,r*.48*s,zc]);}lo(out,`mbh:${k1(L)}:${k1(r)}`,hr,wood?'wood':'plastic',wood?'#7a4a2a':'#1b1b1d');
   const fr=[];for(let i=0;i<=6;i++){const t=i/6,x=x0+L*.6+t*L*.15,s=.48+.14*t;fr.push([x,r*s,r*s*.9,zc]);}lo(out,`mbf:${k1(L)}:${k1(r)}`,fr,'gold',wood?null:'#e8c3a8');
   const br=[];for(let i=0;i<=12;i++){const t=i/12,x=x0+L*.75+t*L*.25,s=t<.6?.62+.38*Math.sin(t/.6*PI/2):Math.sqrt(Math.max(.02,1-((t-.6)/.4)**2));br.push([x,r*s,r*s*.85,zc]);}lo(out,`mbb:${k1(L)}:${k1(r)}`,br,'bristle',pick(['#3b2f2f','#d9b38c','#efe6dc'],Math.floor(R0()*3)),24);},
  sponge(it,out){const r=Math.min(it.w,it.d)/2-.5;ball(out,0,0,r*.95,r,r,r*.95,'rubber',it.color||'#f2709c');ball(out,r*.25,0,r*1.6,r*.7,r*.7,r*.75,'rubber',it.color||'#f2709c');},
  polish(it,out){const w=Math.min(it.w,it.d),H=it.h||70,bh=H*.42,c=it.color||'#c2185b';sl(out,0,0,0,w,w,bh,w*.2,w*.12,'glass','#ffffff');sl(out,0,0,.8,w*.86,w*.86,bh*.78,w*.17,w*.1,'gem',c);cyl(out,0,0,bh-.2,w*.18,2.4,'plastic','#1b1b1d',20);lo(out,`plc:${k1(w)}:${k1(H)}`,roundRows(bh+2,H,w*.22,0,10,.9).map(q=>[q[0],q[1],q[2],0]),'plastic','#1b1b1d',24,2,mtx(0,0,0,0,-PI/2,0));},
  bottle(it,out){const w=Math.min(it.w,it.d),H=it.h||110,bh=H*.68;if(it.round){lathe(out,`bt:${k1(w)}:${k1(bh)}`,[[0,0],[w/2-2,0],[w/2,2],[w/2,bh-6],[w*.3,bh],[w*.16,bh+3],[0,bh+3]],'glass','#ffffff',mtx(),40);cyl(out,0,0,1.2,w/2-1.6,bh*.7,'gem',it.liquid||'#d9a47a',32);}
   else{sl(out,0,0,0,w,w*.62,bh,w*.18,w*.12,'glass','#ffffff');sl(out,0,0,1,w*.86,w*.5,bh*.7,w*.15,w*.08,'gem',it.liquid||'#d9a47a');}cyl(out,0,0,bh,w*.18,4,'chrome',null,24);cyl(out,0,0,bh+4,w*.26,H-bh-4,'plastic',it.cap||'#1b1b1d',32);ball(out,0,0,H,w*.26,w*.26,1.6,'plastic',it.cap||'#1b1b1d');},
  // Jewelry.
  ring(it,out){const R0=rnd(it.seed||7),r=(it.w||19)/2,gold=R0()<.65,t=1.6;P(out,'dp:tor0.12',()=>torT(.12),gold?'gold':'chrome',mtx(0,0,r*.6,PI/2,0,0,r,r,r*.9),null);if(it.gem!==false){ball(out,0,0,r*.6+r+.9,2.2,2.2,2.2,'gem',pick(['#ffffff','#e0115f','#0f52ba','#50c878'],Math.floor(R0()*4)));cyl(out,0,0,r*.6+r-.4,1.6,1.4,gold?'gold':'chrome',null,12);}},
  stud(it,out){const R0=rnd(it.seed||3),z=it.top||8;ball(out,0,0,z+1.4,1.9,1.9,1.6,'gem',pick(['#ffffff','#ffffff','#e0115f','#5dade2','#d4af37'],Math.floor(R0()*5)));cyl(out,0,0,z,1.7,1.2,R0()<.6?'gold':'chrome',null,12);},
  bangle(it,out){const r=it.w/2-3;P(out,'dp:tor0.09',()=>torT(.09),'gold',mtx(0,0,r*.09+.4,0,0,0,r,r,r*.6),null);},
  watch(it,out){const L=it.w,W=Math.min(it.d,45),H=Math.min(it.h,40),cr=W*.42;const pts=[];for(let i=0;i<=40;i++){const a=i/40*2*PI;pts.push([L*.46*Math.cos(a),0,H*.5+H*.48*Math.sin(a)]);}
   for(let i=0;i<24;i++){const a=(i+.5)/24*2*PI,x=L*.44*Math.cos(a),z=H*.5+H*.46*Math.sin(a);bx(out,x,0,z-1.2,Math.max(2,L*.13),W*.5,2.4,'satin','#5b3a29',0,0,-a+PI/2);}
   cyl(out,0,0,H*.86,cr,6,'chrome',null,48);cyl(out,0,0,H*.86+6,cr*.86,.8,'screen',null,48);for(let i=0;i<12;i++){const a=i*PI/6;bx(out,Math.cos(a)*cr*.72,Math.sin(a)*cr*.72,H*.86+6.7,1.6,.5,.2,'chrome',null,a);}bx(out,cr*.15,0,H*.86+6.8,cr*.6,.7,.2,'chrome',null,.4);rodX(out,cr,3,1.6,H*.86+3,'chrome');},
  earringCard(it,out){sl(out,0,0,0,it.w,it.d,1.6,3,.4,'paper','#f7f6f2');for(const s of [-1,1]){ball(out,s*it.w*.18,0,2.4,3,3,2.2,'gem','#ffffff');cyl(out,s*it.w*.18,0,1.4,2.6,1,'gold',null,16);}},
  // Tools.
  outline(it,out){const id=it.k,H=Math.min(it.h,24),g=outlineG(id,H*.55,Math.min(2,H*.15));P(out,`dp:ol:${id}:${k1(H*.55)}`,()=>g,it.mat||'steel',mtx(),it.mat==='plastic'?it.color:null);
   if(it.grip){const L=it.w,W=it.d;lo(out,`olg:${id}`,roundRows(L*.08,L*.48,Math.min(W*.14,7),H*.55+1.2,10,.7),'rubber',it.grip,24,2.4);}if(it.screen)sl(out,-it.w*.05,it.d*.3,H*.55-.1,30,14,1.2,2,.3,'screen');},
  pliers(it,out){const L=it.w,W=it.d,H=Math.min(it.h,16),x0=-L/2,id=it.k||'pliersNeedle',jaw=id==='cutters'?.16:id==='pliersNeedle'?.36:.24,xp=x0+L*jaw+L*.06,c=it.color||'#d63a2f',zc=H*.32;
   const jr=[];for(let i=0;i<=12;i++){const t=i/12,x=x0+t*(xp-x0+6),hw=(id==='pliersNeedle'?1.2+W*.1*t:W*.08+W*.1*t)*(t<.04?.7:1);jr.push([x,hw,H*.2,zc]);}lo(out,`pj:${id}:${k1(L)}`,jr,'flat',null,22,2.6);
   cyl(out,xp,0,zc-H*.24,W*.11,H*.48,'flat',null,32);cyl(out,xp,0,zc+H*.24-.2,W*.06,.6,'chrome',null,20);
   for(const s2 of [-1,1]){const rows=[];for(let i=0;i<=14;i++){const t=i/14,x=xp+4+t*(x0+L-xp-4),y=s2*(W*.06+W*.34*Math.pow(t,.8)),hw=Math.min(W*.1,6.5)*(t>.94?.75:1)*(t<.1?.8:1);rows.push([x,hw,H*.2*(t<.12?.9:1.05),zc,y]);}
    const base=rows.map(q=>[q[0],q[1],q[2],q[3]]),ang=Math.atan2(rows.at(-1)[4]-rows[0][4],rows.at(-1)[0]-rows[0][0]),len=Math.hypot(rows.at(-1)[4]-rows[0][4],rows.at(-1)[0]-rows[0][0]);
    const straight=[];for(let i=0;i<=14;i++){const t=i/14;straight.push([t*len,base[i][1],base[i][2],zc]);}
    lo(out,`ph:${id}:${k1(L)}:${k1(W)}`,straight.slice(0,3),'flat',null,20,2.6,mtx(xp+4,s2*W*.06,0,0,0,ang));lo(out,`pg:${id}:${k1(L)}:${k1(W)}`,straight.slice(2).map(q=>[q[0],q[1]*1.12,q[2]*1.15,q[3]]),'rubber',c,24,2.4,mtx(xp+4,s2*W*.06,0,0,0,ang));}},
  screwdriver(it,out){const L=it.w,r=Math.min(it.d,it.h)/2,x0=-L/2,hl=L*.42,c=it.color||'#d63a2f';const rows=[];for(let i=0;i<=16;i++){const t=i/16,x=x0+t*hl,s=t<.08?.75+t*3:t>.85?1-(t-.85)*2.6:1;rows.push([x,r*s,r*s,r]);}
   lo(out,`sdh:${k1(L)}:${k1(r)}`,rows,'clear',c,30,2.6);lo(out,`sdg:${k1(L)}:${k1(r)}`,rows.slice(3,12).map(q=>[q[0],q[1]*1.03,q[2]*1.03,q[3]]),'rubber','#1b1b1d',8,2);
   rodX(out,x0+hl-1,L-hl-5,Math.max(1.4,r*.2),r,'chrome',null,0,20);fruX(out,x0+L-6,6,Math.max(1.4,r*.2),.3,r,'chrome');},
  hammer(it,out){const L=it.w,W=it.d,H=Math.min(it.h,32),x0=-L/2;const rows=[];for(let i=0;i<=16;i++){const t=i/16,x=x0+t*L*.86,w=(t<.45?8.5:6.5)*(t<.03?.8:1);rows.push([x,w,w*.75,H/2]);}lo(out,`hmh:${k1(L)}`,rows.slice(0,8),'rubber','#1b1b1d',24,2.4);lo(out,`hmf:${k1(L)}`,rows.slice(7),'plastic','#f2b705',24,2.4);
   sl(out,x0+L*.93,-W*.08,H/2-11,L*.12,W*.6,22,4,2,'steel');rodX(out,x0+L*.87,L*.12,10,H/2,'steel',null,W*.25,28);fruX(out,x0+L*.87,1,10.5,.95,H/2,'chrome',null,W*.25+.01);lo(out,`hmc:${k1(W)}`,[[x0+L*.93,9,8,H/2],[x0+L*.93+2,8,7,H/2]],'steel',null);
   for(const s of [-1,1])bx(out,x0+L*.95+s*3,-W*.42,H/2-3,3.4,W*.3,6,'steel',null,s*.12);},
  tape(it,out){const L=it.w,W=it.d,H=Math.min(it.h,45);sl(out,0,0,0,L,W,H,L*.3,4,'plastic',it.color||'#f6c200');sl(out,0,0,-.05,L*.9,W*1.01,H*.36,L*.28,2,'rubber','#1b1b1d');cyl(out,0,0,H-.4,L*.22,1.2,'chrome',null,32);bx(out,L/2-2,-W*.3,H*.12,4,W*.3,2,'steel');bx(out,L/2+1,-W*.3,H*.1,1,W*.34,6,'chrome');sl(out,-L*.2,0,H-.1,L*.2,W*.18,1,2,.4,'rubber','#1b1b1d');},
  utilKnife(it,out){const L=it.w,W=it.d,H=Math.min(it.h,18),x0=-L/2;const rows=[];for(let i=0;i<=14;i++){const t=i/14,x=x0+t*L*.86,w=W*.5*(.75+.25*Math.sin(PI*t));rows.push([x,w,H*.45,H*.45]);}lo(out,`uk:${k1(L)}`,rows,'plastic',it.color||'#f2b705',28,2.8);lo(out,`ukg:${k1(L)}`,rows.slice(2,10).map(q=>[q[0],q[1]*1.03,q[2]*1.04,q[3]]),'rubber','#1b1b1d',28,2.8);
   const blade=new THREE.Shape();blade.moveTo(0,-W*.28);blade.lineTo(L*.16,-W*.1);blade.lineTo(L*.16,W*.05);blade.lineTo(0,W*.18);const key=`dp:ukb:${k1(L)}`;P(out,key,()=>geo(key,()=>new THREE.ExtrudeGeometry(blade,{depth:.6,bevelEnabled:false})),'chrome',mtx(x0+L*.84,0,H*.42),null);},
  level(it,out){const L=it.w,W=it.d,H=Math.min(it.h,25);sl(out,0,0,0,L,W,H,3,1.4,'plastic',it.color||'#f6c200');sl(out,0,0,-.02,L*.98,W*.5,H*1.003,2,.8,'steel');for(const x of [-L*.3,0,L*.3]){sl(out,x,0,H-1,x?14:22,W*.42,1.4,3,.4,'satin','#1b1b1d');rodX(out,x-(x?5:8),x?10:16,2.6,H-.2,'gem','#a6e22e',0,16);}},
  multimeter(it,out){const L=it.w,W=it.d,H=Math.min(it.h,45),x0=-L/2;sl(out,0,0,0,L,W,H,8,4,'rubber',it.color||'#f57c00');sl(out,0,0,H-3,L-8,W-8,3.4,6,1,'satin','#2b2d31');sl(out,x0+L*.78,0,H+.2,L*.3,W*.66,.6,2,.2,'screen');sl(out,x0+L*.78,0,H+.7,L*.26,W*.58,.1,1,0,'satin','#9aab8c');
   cyl(out,x0+L*.42,0,H,W*.24,4,'satin','#1b1b1d',40);bx(out,x0+L*.42,0,H+4,W*.4,3,1.8,'satin','#e8e8e8');for(let i=0;i<3;i++)cyl(out,x0+L*.12,(i-1)*W*.26,H-.2,3.4,1.2,'satin',i===0?'#d32f2f':'#1b1b1d',20);},
  ratchet(it,out){const L=it.w,W=it.d,H=Math.min(it.h,28),x0=-L/2;const rows=[];for(let i=0;i<=14;i++){const t=i/14,x=x0+t*L*.68,w=W*.22*(t<.05?.8:1);rows.push([x,w,w*.7,H*.4]);}lo(out,`rh:${k1(L)}`,rows,'chrome',null,24,2.4);lo(out,`rg:${k1(L)}`,rows.slice(1,9).map(q=>[q[0],q[1]*1.12,q[2]*1.15,q[3]]),'rubber','#c62828',24,2.4);
   cyl(out,x0+L-W/2,0,0,W/2,H*.75,'chrome',null,40);bx(out,x0+L*.72,0,H*.25,L*.12,W*.5,H*.35,'chrome');cyl(out,x0+L-W/2,0,H*.75,W*.18,1.6,'steel',null,20);bx(out,x0+L-W/2,0,H*.75+1.4,W*.3,2.4,1.2,'steel');},
  socket(it,out){const r=it.w/2,H=it.h||25;cyl(out,0,0,0,r,H,'chrome',null,40);cyl(out,0,0,H-.01,r*.62,.05,'darkMetal','#222',6);P(out,'dp:tor0.08',()=>torT(.08),'chrome',mtx(0,0,H*.55,0,0,0,r*1.01,r*1.01,r*.6),null);},
  rod(it,out){const L=it.w,r=Math.min(it.d,it.h)/2;rodX(out,-L/2,L,r*.6,r,'chrome',null,0,24);rodX(out,-L/2,12,r,r,'chrome',null,0,32);P(out,'cyl4',()=>cylG(4),'chrome',mtx(L/2-8,0,r,PI/4,PI/2,0,r*.75,r*.75,8),null);},
  flashlight(it,out){const L=it.w,r=Math.min(it.d,it.h)/2,x0=-L/2;lo(out,`fl:${k1(L)}`,roundRows(x0,x0+L*.75,r*.85,r,12,.9),'darkMetal','#2b2d31');fruX(out,x0+L*.75,L*.25,r*.85,1.18,r,'darkMetal','#2b2d31');cyl(out,x0+L-.2,0,r,r*.9,.3,'glass',null,32,0,PI/2);ball(out,x0+L-2,0,r,1,r*.55,r*.55,'light','#fff6d8');rodX(out,x0+L*.3,4,r*.88,r,'rubber','#f57c00');},
  carpPencil(it,out){const L=it.w,W=it.d,T=it.h;sl(out,-6,0,0,L-12,W,T,1,.4,'plastic','#c62828');const b=new THREE.Shape();b.moveTo(0,-W/2);b.lineTo(12,-W*.12);b.lineTo(12,W*.12);b.lineTo(0,W/2);const key=`dp:cp:${k1(W)}:${k1(T)}`;P(out,key,()=>geo(key,()=>new THREE.ExtrudeGeometry(b,{depth:T*.8,bevelEnabled:false})),'wood',mtx(L/2-12,0,T*.1),'#e2bf8f');bx(out,L/2-1.5,0,T*.3,3,W*.24,T*.4,'darkMetal','#333');},
  // Bathroom extras.
  safetyRazor(it,out){const L=it.w,x0=-L/2;lo(out,`sr:${k1(L)}`,roundRows(x0,x0+L*.75,5.5,6,14,.85),'chrome',null,28);for(let i=0;i<8;i++)P(out,'dp:tor0.12',()=>torT(.12),'chrome',mtx(x0+L*.15+i*L*.06,0,6,0,PI/2,0,5.6,5.6,5.6),null);sl(out,x0+L*.88,0,1,L*.24,it.d-2,10,3,2,'chrome');bx(out,x0+L*.88,0,11,L*.18,it.d-4,.4,'steel');},
  paddleBrush(it,out){const L=it.w,W=it.d,x0=-L/2,R0=rnd(it.seed||2);lo(out,`pbh:${k1(L)}`,roundRows(x0,x0+L*.52,W*.16,8,12,.8).map(q=>[q[0],q[1],q[2]*.7,q[3]]),'satin','#1b1b1d',28,2.4);sl(out,x0+L*.76,0,2,L*.46,W,10,W*.45,3,'satin','#1b1b1d');sl(out,x0+L*.76,0,11.5,L*.42,W*.9,1,W*.42,.4,'rubber','#3a3d42');
   for(let i=0;i<8;i++)for(let j=0;j<5;j++){const x=x0+L*.58+i*L*.05,y=(j-2)*W*.17;if(((x-(x0+L*.76))/(L*.21))**2+(y/(W*.43))**2>1)continue;cyl(out,x,y,12,.5,7,'darkMetal','#222',6);ball(out,x,y,19.3,1.1,1.1,1.1,'rubber','#1b1b1d');}},
  roundBrush(it,out){const L=it.w,r=it.d/2,x0=-L/2;lo(out,`rbh:${k1(L)}`,roundRows(x0,x0+L*.45,r*.3,r,12,.8),'satin','#1b1b1d',28);rodX(out,x0+L*.45,L*.55,r*.42,r,'chrome',null,0,32);for(let i=0;i<10;i++)for(let j=0;j<10;j++){const a=j/10*2*PI+i*.3,x=x0+L*.5+i*L*.05;cyl(out,x,Math.cos(a)*r*.42,r+Math.sin(a)*r*.42,.5,r*.5,'rubber','#e8e8e8',6,-Math.sin(a)*0+(a-PI/2)*0,0,0);}},
  flossFlat(it,out){const L=it.w,W=it.d,H=Math.min(it.h,18);sl(out,0,0,0,L,W,H*.65,6,1.6,'clear','#8fd3c7');sl(out,0,0,H*.65,L+.3,W+.3,H*.35,6,1.4,'plastic','#f6f7f8');cyl(out,0,0,1,W*.3,H*.55,'floss','#ffffff',32);bx(out,L*.3,0,H-.3,9,W*.5,.5,'steel');},
  trimmer(it,out){const L=it.w,W=it.d,H=Math.min(it.h,35),x0=-L/2;lo(out,`tr:${k1(L)}`,roundRows(x0,x0+L*.82,W/2,H/2,16,.8).map((q,i)=>[q[0],q[1]*(1-.2*i/16),q[2]*(1-.2*i/16),q[3]]),'satin','#2b2d31',32,2.4);sl(out,x0+L*.9,0,H*.2,L*.18,W*.9,H*.6,3,1.4,'darkMetal','#3a3632');for(let i=0;i<10;i++)bx(out,x0+L-.8,-W*.4+i*W*.09,H*.3,1.4,1,H*.4,'steel');ball(out,x0+L*.45,0,H*.98,4,4,1.2,'satin','#d9dde2');},
  // Kitchen utensils (bowl / tines / blade toward +x).
  // Flatware: one solid sampled body per piece. f(t) -> [x, yl, yr, zc, th, dish, bulge]; across the piece v in [-1,1]
  // the top sits at zc+th/2+bulge*(1-v^2)-dish*(1-v^2) and the bottom at zc-th/2-bulge*(1-v^2)-dish*(1-v^2), so a dish
  // makes a concave bowl with a matching convex back and a bulge rounds a handle.
  spoon(it,out){const L=it.w,W=it.d,x0=-L/2,b=.36,Dm=W*.17;
   const f=t=>{const u=Math.max(0,(t-(1-b))/b),uu=Math.pow(u,1.3),s=Math.min(1,t/(1-b));
    const hwB=u>0?W/2*Math.sqrt(Math.max(0,1-(2*uu-1)**2)):0;
    const endR=Math.sqrt(Math.max(0,1-(Math.max(0,.09-s)/.09)**2)),hwH=W*(.085+.135*(1-ss(.12,.97,s)))*endR*(1-ss(0,.45,u));
    const hw=smax(hwH,hwB,W*.05),D=u>0?Dm*(1-(2*uu-1)**2):0,th=1.6+.6*(1-ss(.6,1,s)),B=.45*(1-ss(.85,1,s));
    const zb=Dm+th/2+.15,zEnd=th/2+B+.5,zc=zEnd+(zb-zEnd)*ss(.25,1.02,t/(1-b))+1.4*Math.sin(PI*s)*(1-ss(.8,1,s));
    return [x0+t*L,-hw,hw,zc,th,D,B];};
   ware(out,`sp:${k1(L)}:${k1(W)}`,f,'flat',72,12);},
  ladle(it,out){R.spoon({...it,d:Math.min(it.d,90)},out);},
  fork(it,out){const L=it.w,W=it.d,x0=-L/2,tb=.8,tl=L*.19,HW=W*.48;
   const zAt=t=>{const zEnd=1.6,zH=4.2;return t<tb?zEnd+(zH-zEnd)*ss(.25,.72,t)+1.1*Math.sin(PI*Math.min(1,t/.7))*(1-ss(.55,.72,t)):zH+3.2*((t-tb)/(1-tb))**2;};
   const f=t=>{const tt=t*tb,s=Math.min(1,tt/.66);const endR=Math.sqrt(Math.max(0,1-(Math.max(0,.09-s)/.09)**2));
    const hwH=W*(.12+.2*(1-ss(.12,.97,s)))*endR,hw=hwH+(HW-hwH)*ss(.64,.79,tt),th=1.7+.5*(1-ss(.6,1,s));
    return [x0+tt*L,-hw,hw,zAt(tt),th,ss(.66,.8,tt)*W*.05,.4*(1-ss(.85,1,s))];};
   ware(out,`fkb:${k1(L)}:${k1(W)}`,f,'flat',60,10);
   const gap=HW*2*.09,tw=(HW*2-3*gap)/4;
   for(let k=0;k<4;k++){const yc=-HW+tw/2+k*(tw+gap),v=yc/HW,dz=W*.05*(1-v*v);
    const g=t=>{const tt=tb+t*(1-tb),w=tw/2*(1-.3*t)*(t<.82?1:Math.sqrt(Math.max(0,1-((t-.82)/.18)**2))),x=x0+tb*L-1.5+t*(tl+1.5);
     return [x,yc-w,yc+w,zAt(Math.min(1,tt))-dz,1.6,0,.15];};
    ware(out,`fkt:${k1(L)}:${k1(W)}:${k}`,g,'flat',22,4);}},
  knife(it,out){const L=it.w,W=it.d,x0=-L/2;
   const f=t=>{const s=Math.min(1,t/.44),endR=Math.sqrt(Math.max(0,1-(Math.max(0,.07-s)/.07)**2)),hh=W*(.17+.13*(1-ss(.1,1,s)))*endR;
    const p=Math.max(0,(t-.5)/.5),yr=W*.2-W*.08*Math.max(0,(p-.85)/.15)**2,yl=-W*.25+W*.37*Math.max(0,(p-.55)/.45)**2,m=ss(.43,.52,t);
    const th=2.4*(1-m)+1.1*m,B=1.7*(1-m),zc=th/2+B;return [x0+t*L,-hh*(1-m)+yl*m,hh*(1-m)+yr*m,zc,th,0,B];};
   ware(out,`kn:${k1(L)}:${k1(W)}`,f,'flat',80,8);},
  spatula(it,out){const L=it.w,W=it.d,x0=-L/2,hL=L*.62;lo(out,`stH:${k1(L)}`,roundRows(x0,x0+hL,Math.min(W*.13,10),5,14,.75).map(q=>[q[0],q[1],q[2]*.6,q[3]]),'satin','#1b1b1d',24,2.6);P(out,'dp:tor0.22',()=>torT(.22),'satin',mtx(x0+5,0,5,0,0,0,3.4,3.4,3),'#1b1b1d');
   sl(out,x0+hL+(L-hL)/2,0,1,L-hL,W,2.2,W*.18,.9,'satin',it.color||'#d84343');for(let i=0;i<4;i++)sl(out,x0+hL+(L-hL)*.5,(i-1.5)*W*.2,3.1,(L-hL)*.6,W*.06,.1,W*.03,0,'satin',shade(it.color||'#d84343',-.35));},
  whisk(it,out){const L=it.w,W=it.d,x0=-L/2,hL=L*.4,wl=L-hL;lo(out,`wh:${k1(L)}`,roundRows(x0,x0+hL,Math.min(W*.16,9),W/2,12,.8),'satin','#1b1b1d',28);rodX(out,x0+hL-2,6,Math.min(W*.13,7),W/2,'chrome',null,0,24);
   for(let k=0;k<4;k++){const a=k*PI/4,pts=[];for(let i=0;i<=36;i++){const t=i/36*2*PI,u=(1-Math.cos(t))/2,s=(W/2)*Math.sin(t)*Math.pow(u,.55);pts.push([x0+hL+2+wl*u*.98,s*Math.cos(a),W/2+s*Math.sin(a)]);}tube(out,`wk:${k1(L)}:${k1(W)}:${k}`,pts,.55,'chrome',null,mtx(),true,6);}},
  tongs(it,out){const L=it.w,W=it.d,x0=-L/2;for(const s of [-1,1]){const rows=[];for(let i=0;i<=12;i++){const t=i/12,x=x0+8+t*(L-8),y=s*(2+W*.32*t);rows.push([x,6,1,3+0*y]);}lo(out,`tg:${k1(L)}`,rows,'flat',null,12,4,mtx(0,s*W*.22,0,0,0,-s*Math.atan2(W*.3,L)));sl(out,x0+L*.85,s*W*.42,1.5,L*.28,12,4,4,1.4,'rubber',it.color||'#d84343');}cyl(out,x0+6,0,0,6,8,'flat',null,24);P(out,'dp:tor0.22',()=>torT(.22),'flat',mtx(x0+1,0,4,PI/2,0,0,4,4,4),null);},
  peeler(it,out){const L=it.w,W=it.d,x0=-L/2;lo(out,`pl:${k1(L)}`,roundRows(x0,x0+L*.62,Math.min(W*.2,10),7,12,.8).map(q=>[q[0],q[1],q[2]*.75,q[3]]),'rubber',it.color||'#2a9d58',28,2.4);P(out,'dp:tor0.08',()=>torT(.08),'flat',mtx(x0+L*.8,0,6,0,0,0,L*.2,W*.45,8),null);bx(out,x0+L*.8,0,5,L*.32,2.6,1.6,'flat',null,0,.2);},
  pizza(it,out){const L=it.w,W=it.d,x0=-L/2,r=Math.min(W/2,L*.25);lo(out,`pz:${k1(L)}`,roundRows(x0,x0+L-2*r,9,7,12,.8),'rubber','#1b1b1d',28);bx(out,x0+L-2*r,0,4,r*.9,4,3,'steel');cyl(out,x0+L-r,0,r,r,1.4,'chrome',null,48,PI/2);},
  mSpoons(it,out){const n=4;for(let i=0;i<n;i++){const s=1-i*.13;R.spoon({...it,w:it.w*s,d:it.d*s},out.__tmp=[]);for(const p of out.__tmp){p.m=mtx(-it.w*(1-s)/2,0,i*1.2).multiply(p.m||new THREE.Matrix4());p.color=null;out.push(p);}}delete out.__tmp;},
  mCup(it,out){const L=it.w,W=it.d,r=W/2-1;for(let i=0;i<3;i++){const s=1-i*.16;P(out,'dp:dish',dish,'steelD',mtx(L/2-r,0,r*.62*s+i*1.2,0,0,0,r*s,r*s,r*.6*s),null);P(out,'dp:tor0.06',()=>torT(.06),'flat',mtx(L/2-r,0,r*.62*s+i*1.2,0,0,0,r*s,r*s,r*.4),null);}sl(out,-L/2+(L-2*r)/2+2,0,r*.55,L-2*r+6,14,2,5,.8,'flat');},
  measureSpoon(it,out){sl(out,0,0,0,Math.min(it.w,46),Math.min(it.d,8),Math.min(it.h,26),3,1,'flat');},
  // Phones, remotes, chargers.
  phone(it,out){const L=it.w,W=it.d,T=Math.min(it.h,it.tablet?7:9),r=Math.min(W*.14,10);sl(out,0,0,0,L,W,T,r,T*.4,'gold',it.color||'#3a3d44');sl(out,0,0,T-.4,L-1.4,W-1.4,.5,r-.7,.2,'screen');sl(out,L/2-(it.tablet?8:9),0,T+.06,it.tablet?2.6:3.4,it.tablet?2.6:13,.06,1.3,0,'satin','#050506');},
  remote(it,out){const L=it.w,W=it.d,H=Math.min(it.h,20),x0=-L/2,c=it.color||'#1e2023',btn=it.light?'#c9ccd1':'#3e4248';sl(out,0,0,0,L,W,H*.75,W*.32,H*.3,'satin',c);
   cyl(out,x0+L*.9,W*.25,H*.75-.3,3,1.4,'rubber','#d32f2f',20);if(it.light)sl(out,x0+L*.78,0,H*.75-.2,L*.22,W*.6,.6,2,.2,'screen');
   const n=it.slim?2:4;for(let i=0;i<n;i++)for(let j=0;j<3;j++)if(!it.slim||j!==1)sl(out,x0+L*(.12+i*.09),(j-1)*W*.26,H*.75-.3,L*.06,W*.18,1.8,1.6,.5,'rubber',btn);
   P(out,'dp:tor0.22',()=>torT(.22),'rubber',mtx(x0+L*.62,0,H*.75,0,0,0,W*.22,W*.22,2.4),btn);cyl(out,x0+L*.62,0,H*.75-.4,W*.12,1.8,'rubber',btn,28);for(const s of [-1,1])sl(out,x0+L*.45,s*W*.26,H*.75-.3,L*.08,W*.16,1.8,2,.5,'rubber',btn);},
  charger(it,out){const w=it.w,d=it.d,h=Math.min(it.h,30);sl(out,0,0,0,w,d,h,w*.18,h*.2,'plastic','#f5f6f7');sl(out,w/2-.2,0,h*.5-1.6,.6,8.6,3.2,1.5,.2,'satin','#1b1b1d');bx(out,-w*.1,0,h-.05,w*.5,1.6,.1,'satin','#d8dadd');},
  brick(it,out){const L=it.w,W=it.d,H=Math.min(it.h,28);sl(out,0,0,0,L,W,H,6,2.6,'satin','#1e2023');cyl(out,L*.3,W*.3,H-.2,1.2,.5,'light','#7cffb0',12);P(out,'dp:tor0.06',()=>torT(.06),'rubber',mtx(-L*.15,0,H+2,0,0,0,W*.35,W*.35,W*.4),'#1b1b1d');},
  powerBank(it,out){const L=it.w,W=it.d,H=Math.min(it.h,25);sl(out,0,0,0,L,W,H,8,4,'darkMetal','#3a3d44');for(let i=0;i<4;i++)cyl(out,L*.3+i*3,-W*.3,H-.15,.8,.4,'light','#5ab4ff',10);sl(out,L/2-.2,0,H/2-1.5,.6,9,3,1.4,.2,'satin','#111');},
  smartwatch(it,out){const L=it.w,W=it.d,H=Math.min(it.h,40);R.watch({...it,w:L+20,d:W,h:H},out.__w=[]);for(const p of out.__w)if(!/^cyl48$|^box$/.test(p.g)||p.mat==='satin')out.push(p);delete out.__w;sl(out,0,0,H*.86,W*.8,W*.95,8,8,3,'darkMetal','#2b2d31');sl(out,0,0,H*.86+8,W*.72,W*.86,.4,7,.1,'screen');},
  adapter(it,out){const L=it.w,W=it.d,H=Math.min(it.h,10);sl(out,-L*.12,0,0,L*.76,W,H,3,1.6,'satin','#8e9399');sl(out,L*.38,0,H*.2,L*.24,W*.6,H*.6,1.2,.4,'steel');},
  coil(it,out){const R0=rnd(it.seed||5),r=Math.min(it.w,it.d)/2-3;for(let i=0;i<5;i++)P(out,'dp:tor0.06',()=>torT(.06),'rubber',mtx((R0()-.5)*3,(R0()-.5)*3,r*.07+i*r*.11,(R0()-.5)*.15,(R0()-.5)*.15,0,r*(.86+R0()*.1),r*(.86+R0()*.1),r),it.color||'#1b1b1d');sl(out,r*.2,-r*.3,r*.5,14,9,6,2,1,'satin',it.color==='#f4f5f6'?'#f4f5f6':'#2b2d31',.6);},
  cable(it,out){const L=it.w,r=Math.min(it.d,it.h)/2;rodX(out,-L/2+10,L-20,r*.5,r,'rubber',it.color||'#f4f5f6',0,12);for(const s of [-1,1]){sl(out,s*(L/2-6),0,r-3.5,12,8,7,2,1.4,'satin',it.color||'#f4f5f6');sl(out,s*(L/2+1.5),0,r-1.6,4,6.6,3.2,1.4,.3,'steel');}},
  // Gaming.
  controller(it,out){const L=it.w,W=it.d,H=Math.min(it.h,66),id=it.k||'genericPad',hb=H*.42,c=it.color||'#2b2d31',dark=shade(c,-.5),ps=it.style==='ps';P(out,`dp:ol:${id}:${k1(hb)}`,()=>outlineG(id,hb,Math.min(5,hb*.3)),'satin',mtx(),c);
   for(const [z,sx,sy,sz] of [[hb*.3,.95,.9,.55],[hb*.52,.86,.76,.45]])P(out,`dp:ol:${id}:${k1(hb)}`,()=>outlineG(id,hb,Math.min(5,hb*.3)),'satin',mtx(0,W*.03,z,0,0,0,sx,sy,sz),c);const top=hb*.52+hb*.45;
   const stick=(x,y)=>{cyl(out,x,y,top-1,W*.11,1.6,'satin','#1b1b1d',32);cyl(out,x,y,top,W*.045,6,'satin','#1b1b1d',16);cyl(out,x,y,top+6,W*.095,2.4,'rubber','#26282c',32);P(out,'dp:tor0.12',()=>torT(.12),'rubber',mtx(x,y,top+8.4,0,0,0,W*.088,W*.088,W*.06),'#3a3d42');};
   const btns=(x,y,cols)=>{const s=W*.085;[[0,s],[s,0],[0,-s],[-s,0]].forEach(([u,v],i)=>{cyl(out,x+u,y+v,top-.6,W*.04,2.6,'plastic',cols[i],20);ball(out,x+u,y+v,top+2,W*.04,W*.04,.8,'plastic',cols[i]);});};
   const dpad=(x,y)=>{bx(out,x,y,top-.6,W*.2,W*.065,2.4,'satin','#26282c');bx(out,x,y,top-.6,W*.065,W*.2,2.4,'satin','#26282c');};
   if(ps){stick(-L*.14,-W*.12);stick(L*.14,-W*.12);dpad(-L*.3,W*.12);btns(L*.3,W*.12,['#d9d9de','#d9d9de','#d9d9de','#d9d9de']);sl(out,0,W*.2,top-.6,L*.3,W*.26,1.4,4,.6,'satin',shade(c,-.08));}
   else{stick(-L*.3,W*.12);stick(L*.13,-W*.15);dpad(-L*.13,-W*.15);btns(L*.3,W*.12,['#f2c94c','#e74c3c','#2ecc71','#3498db']);cyl(out,0,W*.27,top-.8,W*.07,2,'chrome',null,28);}
   for(const s of [-1,1])sl(out,s*L*.3,W*.42,hb*.45,L*.22,W*.12,hb*.5,3,1.4,'satin',dark);},
  joycon(it,out){const L=it.w,W=it.d,H=Math.min(it.h,30),R0=rnd(it.seed||1),c=R0()<.5?'#00a5d9':'#ff3c28';sl(out,0,0,0,L,W,H*.6,W*.45,H*.2,'satin',c);sl(out,-L*.4,0,0,L*.12,W*1.004,H*.6,2,.4,'satin','#1b1b1d');cyl(out,L*.2,0,H*.6,W*.28,1.4,'satin','#1b1b1d',32);cyl(out,L*.2,0,H*.6+1.4,W*.18,4,'rubber','#26282c',32);for(let i=0;i<4;i++){const a=i*PI/2;cyl(out,-L*.12+Math.cos(a)*W*.2,Math.sin(a)*W*.2,H*.6-.4,W*.08,1.6,'plastic','#26282c',16);}},
  retroPad(it,out){const L=it.w,W=it.d,H=Math.min(it.h,25);sl(out,0,0,0,L,W,H*.5,W*.45,H*.2,'satin','#9aa0a6');bx(out,-L*.28,0,H*.5-.4,W*.36,W*.12,2,'satin','#26282c');bx(out,-L*.28,0,H*.5-.4,W*.12,W*.36,2,'satin','#26282c');for(const s of [0,1])cyl(out,L*.2+s*L*.14,-W*.08+s*W*.12,H*.5-.4,W*.09,2,'plastic','#b71c1c',24);for(const s of [-1,1])sl(out,s*L*.06,-W*.12,H*.5-.4,L*.08,3,1.2,1.4,.3,'rubber','#4a4e55',.4);},
  gameCase(it,out){const L=it.w,W=it.d,T=Math.min(it.h,14),R0=rnd(it.seed||4);sl(out,0,0,0,L,W,T,2.4,1,'plastic',it.color||'#d7262b');sl(out,0,0,T-.2,L*.92,W*.9,.4,1.4,.1,'satin',pick(CASEART,Math.floor(R0()*8)));sl(out,-L*.3,W*.3,T+.15,L*.24,W*.16,.1,1,0,'satin','#ffffff');},
  caseStanding(it,out){const T=it.w,D=it.d,H=it.h;sl(out,0,0,0,T,D,H,1.6,.6,'plastic',it.color||'#d7262b');for(const s of [-1,1])bx(out,s*(T/2+.01),0,H*.06,.1,D*.9,H*.88,'satin',it.art||'#2f80ed');bx(out,0,0,H+.01,T*.7,D*.75,.1,'satin','#ffffff');},
  cart(it,out){const L=it.w,W=it.d,T=Math.min(it.h,8),c=it.color||'#3b3f45';sl(out,0,0,0,L,W,T,it.retro?2:1.4,.4,'satin',c);sl(out,-L*.08,0,T-.05,L*.62,W*.84,.1,1,0,'satin',pick(CASEART,(it.seed||0)%8));bx(out,L*.4,0,T-.1,L*.12,W*.8,.12,'satin',shade(c,-.2));},
  headset(it,out){const L=it.w,W=it.d,H=Math.min(it.h,80),cr=Math.min(W*.3,L*.24);for(const s of [-1,1]){cyl(out,s*(L/2-cr-4),-W*.12,0,cr,H*.32,'satin','#2b2d31',48);P(out,'dp:tor0.22',()=>torT(.22),'rubber',mtx(s*(L/2-cr-4),-W*.12,H*.34,0,0,0,cr*.82,cr*.82,cr*.9),'#3a3d42');cyl(out,s*(L/2-cr-4),-W*.12,H*.32,cr*.6,1,'rubber','#1b1b1d',40);}
   const pts=[];for(let i=0;i<=24;i++){const t=i/24*PI;pts.push([-(L/2-cr-4)*Math.cos(t),-W*.12+W*.55*Math.sin(t),H*.16]);}tube(out,`hs:${k1(L)}:${k1(W)}`,pts,5,'satin','#2b2d31',mtx(),false,10);},
  earbuds(it,out){const L=it.w,W=it.d,H=Math.min(it.h,25);sl(out,0,0,0,L,W,H,W*.45,H*.4,'plastic','#f7f8f9');bx(out,0,0,H*.68,L*1.004,W*1.004,.25,'satin','#d8dadd');cyl(out,0,-W/2+1,H*.4,.8,.4,'light','#7cffb0',10,PI/2);},
  handheld(it,out){const L=it.w,W=it.d,T=Math.min(it.h,14),jl=L*.16;sl(out,0,0,0,L-2*jl,W,T,2,1,'satin','#26282c');sl(out,0,0,T-.3,L-2*jl-6,W-8,.5,1.4,.2,'screen');for(const s of [-1,1]){sl(out,s*(L/2-jl/2),0,0,jl,W,T,s<0?6:6,2,'satin',s<0?'#00a5d9':'#ff3c28');cyl(out,s*(L/2-jl/2),s*W*.22,T-.2,jl*.3,3.4,'rubber','#26282c',28);for(let i=0;i<4;i++){const a=i*PI/2;cyl(out,s*(L/2-jl/2)+Math.cos(a)*jl*.2,-s*W*.18+Math.sin(a)*jl*.2,T-.3,jl*.08,1.4,'plastic','#26282c',14);}}},
  // Medicine.
  pillBottle(it,out){const w=Math.min(it.w,it.d),H=it.h||75,r=w/2,bh=H*.8;cyl(out,0,0,0,r*.97,bh,'gem',it.white?'#f4f5f6':'#d9822b',40);cyl(out,0,0,bh*.15,r*.985,bh*.6,'paper','#ffffff',40);bx(out,0,-r*.97,bh*.3,r*.7,.3,bh*.12,'paper','#1e88e5');cyl(out,0,0,bh,r,H-bh,'plastic','#f7f8fa',40);for(let i=0;i<20;i++){const a=i/20*2*PI;bx(out,Math.cos(a)*r,Math.sin(a)*r,bh+1,.8,.8,H-bh-2,'plastic','#eceef1',a);}},
  blister(it,out){const W=it.w,T=Math.min(it.d,6),H=it.h||70;bx(out,0,0,0,W,.6,H,'chrome',null);for(let i=0;i<4;i++)for(let j=0;j<2;j++)ball(out,-W*.3+i*W*.2,.3,H*.3+j*H*.32,W*.07,2.4,W*.07,'glass',null);for(let i=0;i<4;i++)for(let j=0;j<2;j++)ball(out,-W*.3+i*W*.2,.4,H*.3+j*H*.32,W*.045,1.6,W*.045,'plastic',j?'#ffffff':'#e57373');},
  box(it,out){sl(out,0,0,0,it.w,it.d,it.h,1,.4,'paper',it.color||'#e9f1f7');sl(out,0,0,it.h-.1,it.w*.6,it.d*.4,.2,1,0,'paper',it.label||'#d32f2f');bx(out,-it.w*.15,0,it.h+.06,it.w*.1,it.d*.12,.1,'paper','#ffffff');bx(out,-it.w*.15,0,it.h+.06,it.d*.12,it.w*.1,.1,'paper','#ffffff');},
  thermometer(it,out){const L=it.w,W=it.d,H=Math.min(it.h,12),x0=-L/2;lo(out,`th:${k1(L)}`,roundRows(x0,x0+L*.75,W/2,H/2,14,.7).map(q=>[q[0],q[1],q[2]*.75,q[3]]),'plastic','#f5f6f7',28,2.6);fruX(out,x0+L*.75,L*.22,W*.22,.4,H/2,'plastic','#f5f6f7');rodX(out,x0+L*.96,L*.04,W*.09,H/2,'chrome',null,0,16);sl(out,x0+L*.35,0,H*.86,L*.22,W*.55,.6,1.4,.2,'screen');cyl(out,x0+L*.15,0,H*.82,W*.15,1.2,'rubber','#1e88e5',20);},
  pillOrganizer(it,out){const L=it.w,W=it.d,H=Math.min(it.h,22),n=7,cw=L/n;sl(out,0,0,0,L,W,H*.8,3,1,'clear','#ffffff');for(let i=0;i<n;i++)sl(out,-L/2+cw*(i+.5),0,H*.8,cw-1.2,W-.6,H*.2,2,.6,'plastic',['#e53935','#fb8c00','#fdd835','#43a047','#1e88e5','#5e35b1','#d81b60'][i]);},
  // Crafts.
  paintBottle(it,out){const w=Math.min(it.w,it.d),H=it.h||100,r=w/2,bh=H*.78,c=it.color||'#e53935';lathe(out,`pb:${k1(w)}:${k1(bh)}`,[[0,0],[r-2,0],[r,2.4],[r,bh-8],[r*.82,bh-2],[r*.42,bh],[0,bh]],'plastic','#f7f8fa',mtx(),40);cyl(out,0,0,bh*.1,r*1.005,bh*.62,'paper',c,40);cyl(out,0,0,bh*.18,r*1.01,bh*.2,'paper','#ffffff',40);fruZ(out,0,0,bh,r*.44,H-bh-3,.42,'plastic',c);ball(out,0,0,H-3.2,r*.2,r*.2,2.6,'plastic',c);},
  paintPot(it,out){const w=Math.min(it.w,it.d),H=it.h||45,r=w/2;cyl(out,0,0,0,r*.98,H*.72,'glass',null,36);cyl(out,0,0,.8,r*.88,H*.55,'gem',it.color||'#e53935',32);cyl(out,0,0,H*.72,r,H*.28,'plastic','#1b1b1d',36);},
  dropper(it,out){const w=Math.min(it.w,it.d),H=it.h||90,r=w/2,bh=H*.55;lathe(out,`dr:${k1(w)}:${k1(bh)}`,[[0,0],[r-1.4,0],[r,1.4],[r,bh-6],[r*.5,bh],[0,bh]],'glass','#ffffff',mtx(),36);cyl(out,0,0,1,r*.86,bh*.55,'gem',it.color||'#1e88e5',28);cyl(out,0,0,bh,r*.55,H*.18,'plastic','#1b1b1d',28);fruZ(out,0,0,bh+H*.18,r*.5,H*.27-r*.4,.7,'rubber','#1b1b1d');ball(out,0,0,H-r*.4,r*.38,r*.38,r*.4,'rubber','#1b1b1d');},
  bobbin(it,out){const r=it.w/2,H=it.h||11.7;cyl(out,0,0,0,r,1.1,'clear','#f0f0f0',40);cyl(out,0,0,H-1.1,r,1.1,'clear','#f0f0f0',40);cyl(out,0,0,1.1,r*.82,H-2.2,'floss',it.color||'#e53935',36);},
  needleCase(it,out){const L=it.w,r=Math.min(it.d,it.h)/2;rodX(out,-L/2,L,r,r,'wood','#c79a63',0,24);for(let i=0;i<3;i++){const y=(i-1)*(r*.4);ball(out,-L*.3+i*L*.2,y,r*2+1.6,1.8,1.8,1.8,'plastic',pick(MARKER,i));}},
  teaBag(it,out){const W=it.w,T=Math.min(it.d,8),H=it.h||70;sl(out,0,0,0,W,T,H,1,.3,'paper',it.color||'#2e7d32');bx(out,0,-T/2-.01,H*.5,W*.6,.1,H*.25,'paper','#ffffff');},
 };
 return R;}
function shade(hex,a){const n=parseInt(String(hex).slice(1),16);let r=n>>16&255,g=n>>8&255,b=n&255;const f=v=>Math.round(a>=0?v+(255-v)*a:v*(1+a));return '#'+[f(r),f(g),f(b)].map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('');}
api.recipes=recipes;api.shade=shade;
if(typeof module!=='undefined'&&module.exports)module.exports=api;else G.GPDrawerProps=api;
})(typeof globalThis!=='undefined'?globalThis:this);
