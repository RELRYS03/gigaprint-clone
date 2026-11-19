/* Organizer inserts: real, printable fixtures fused into a drawer bin (pockets, slots, pegs, dividers, tiers).
 * Every insert is a set of vertical solids and vertical cavities stacked on the bin floor, so it prints
 * open-side-up with no overhangs. Sizes are nominal item sizes plus an adjustable fit clearance. */
(function(G){'use strict';
const FL=G.GPFitLib||(typeof require==='function'?require('./fit-library'):null),T=G.StudioTools||require('./tools'),C=G.SplitCore||require('./core'),MD=G.MeshDoctor||(typeof require==='function'?(()=>{try{return require('./repair');}catch(_){return null;}})():null);
const xform=(polys,f)=>polys.map(P=>({outer:P.outer.map(f),holes:P.holes.map(h=>h.map(f))})),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),poly=outer=>({outer,holes:[]}),rect=(x0,y0,x1,y1,r=0)=>T.roundRect(x0,y0,x1,y1,r,12);
const CATEGORIES=[['home','Home'],['office','Desk & office'],['garage','Garage'],['bathroom','Bathroom'],['makeup','Makeup'],['medicine','Medicine'],['crafts','Crafts'],['kitchen','Kitchen'],['gaming','Gaming'],['general','Dividers & risers']];
// a/b: nominal item footprint (mm). itemH: item height used for headroom checks. sizes: graded columns.
const LIB=[
 {id:'aa',cat:'home',name:'AA battery holder',kind:'pockets',shape:'circle',a:14.5,depth:16,block:18,fit:.6,web:2,itemH:50.5,item:'AA cells (14.5 \u00d7 50.5 mm)'},
 {id:'aaa',cat:'home',name:'AAA battery holder',kind:'pockets',shape:'circle',a:10.5,depth:14,block:16,fit:.6,web:2,itemH:44.5,item:'AAA cells (10.5 \u00d7 44.5 mm)'},
 {id:'cd',cat:'home',name:'C and D battery holder',kind:'pockets',shape:'circle',a:26.2,sizes:[26.2,34.2],depth:18,block:20,fit:.8,web:2.4,itemH:61.5,item:'C (26.2 mm) and D (34.2 mm) cells in alternating columns'},
 {id:'9v',cat:'home',name:'9V battery holder',kind:'pockets',shape:'rect',a:26.5,b:17.5,depth:18,block:20,fit:.7,web:2.4,itemH:48.5,item:'9V batteries (26.5 \u00d7 17.5 mm)'},
 {id:'coincell',cat:'home',name:'Coin cell tray (CR2032)',kind:'pockets',shape:'circle',a:20,depth:3.6,block:6,fit:.6,web:2.4,notch:true,itemH:3.2,item:'CR2032 / CR2025 coin cells (20 mm)'},
 {id:'coins',cat:'home',name:'US coin sorter',kind:'pockets',shape:'circle',a:24.26,sizes:[24.26,17.91,21.21,19.05],depth:14,block:16,fit:.8,web:2.4,notch:true,itemH:14,item:'quarter, dime, nickel and penny stacks'},
 {id:'keypegs',cat:'home',name:'Peg grid',kind:'pegs',a:8,pegH:30,web:22,item:'pegs for spools, hair ties or keys'},
 {id:'cups',cat:'home',name:'Small-parts cups',kind:'pockets',shape:'rect',a:30,b:30,depth:16,block:18,fit:0,web:2,radius:5,itemH:0,item:'rounded cups for screws, clips and earrings'},
 {id:'pens',cat:'office',name:'Pen and pencil holes',kind:'pockets',shape:'circle',a:11,depth:28,block:30,fit:1,web:3,itemH:150,item:'pens and pencils standing upright'},
 {id:'crayons',cat:'office',name:'Crayon holes',kind:'pockets',shape:'circle',a:8.4,depth:20,block:22,fit:.6,web:2.4,itemH:92,item:'standard crayons standing upright, tips up (\u22488 \u00d7 92 mm)'},
 {id:'penTray',cat:'office',name:'Pen and pencil tray',kind:'channels',a:14,depth:8,block:10,web:3,item:'pens lying flat in rounded lanes'},
 {id:'sd',cat:'office',name:'SD card slots',kind:'pockets',shape:'rect',a:24,b:2.1,depth:16,block:18,fit:.6,web:3,itemH:32,item:'full-size SD cards (24 \u00d7 32 \u00d7 2.1 mm)'},
 {id:'microsd',cat:'office',name:'microSD slots',kind:'pockets',shape:'rect',a:11,b:1,depth:8,block:10,fit:.5,web:2.6,itemH:15,item:'microSD cards (11 \u00d7 15 \u00d7 1 mm)'},
 {id:'usb',cat:'office',name:'USB stick slots',kind:'pockets',shape:'rect',a:12,b:4.5,depth:11,block:13,fit:.5,web:3,itemH:55,item:'USB-A plugs (12 \u00d7 4.5 mm)'},
 {id:'cards',cat:'office',name:'Business card holder',kind:'pockets',shape:'rect',a:89,b:12,depth:16,block:18,fit:1.5,web:3,itemH:51,item:'business cards on edge (3.5 \u00d7 2 in)'},
 {id:'sticky',cat:'office',name:'Sticky-note well',kind:'pockets',shape:'rect',a:76,b:76,depth:10,block:12,fit:2,web:3,notch:true,itemH:20,item:'3 \u00d7 3 in sticky-note pads'},
 {id:'label',cat:'office',name:'Label card ledge',kind:'label',a:1.2,depth:8,block:12,web:10,item:'paper or card label (1.2 mm slot) along the front'},
 {id:'smallPartsDividers',cat:'garage',name:'Small parts bin \u00b7 removable dividers',kind:'removable',nx:3,ny:2,t:1.6,hFrac:1,cups:0,item:'screws, nuts, washers, springs and tiny jets, in a grid of slide-in divider plates that interlock and lift out'},
 {id:'smallPartsCups',cat:'garage',name:'Small parts bin \u00b7 dividers and scoop cups',kind:'removable',nx:2,ny:1,t:1.6,hFrac:1,cups:1,item:'tiny parts in drop-in cups with a rounded floor, one per compartment, so they lift out and pour easily'},
 {id:'bits',cat:'garage',name:'Hex bit grid (1/4 in)',kind:'pockets',shape:'hex',a:6.35,depth:10,block:12,fit:.3,web:3.2,itemH:25,item:'1/4 in hex driver bits'},
 {id:'hexkeys',cat:'garage',name:'Hex key stand',kind:'pockets',shape:'hex',a:2,sizes:[1.5,2,2.5,3,4,5,6,8,10],depth:18,block:20,fit:.4,web:4,itemH:70,item:'metric hex keys 1.5\u201310 mm, long arm down'},
 {id:'drill',cat:'garage',name:'Drill bit index',kind:'pockets',shape:'circle',a:1,sizes:[1,1.5,2,2.5,3,3.5,4,4.5,5,6,7,8,10],depth:22,block:24,fit:.4,web:3.5,itemH:90,item:'drill bits 1\u201310 mm, shank down'},
 {id:'screwdrivers',cat:'garage',name:'Screwdriver rack',kind:'pockets',shape:'circle',a:7,depth:26,block:28,fit:1,web:12,itemH:200,item:'screwdriver shafts standing upright'},
 {id:'lipstick',cat:'bathroom',name:'Lipstick tubes',kind:'pockets',shape:'circle',a:22,depth:22,block:24,fit:1,web:2.4,itemH:80,item:'lipstick and balm tubes (\u224822 mm)'},
 {id:'polish',cat:'bathroom',name:'Nail polish bottles',kind:'pockets',shape:'circle',a:34,depth:12,block:14,fit:1.2,web:2.4,itemH:70,item:'nail polish bottles (\u224834 mm)'},
 {id:'brushes',cat:'bathroom',name:'Brush and toothbrush holes',kind:'pockets',shape:'circle',a:14,depth:30,block:32,fit:1.2,web:4,itemH:170,item:'makeup brushes and toothbrush handles'},
 {id:'rings',cat:'bathroom',name:'Ring and jewelry slots',kind:'pockets',shape:'stadium',a:0,b:3.6,depth:16,block:20,fit:0,web:10,full:true,itemH:22,item:'rings held in long slots between ridges'},
 {id:'earrings',cat:'bathroom',name:'Stud earring holes',kind:'pockets',shape:'circle',a:2.6,depth:8,block:10,fit:0,web:7,itemH:0,item:'stud earring posts pushed through, pairs side by side'},
 {id:'razor',cat:'bathroom',name:'Razor cradles',kind:'pockets',shape:'stadium',a:120,b:24,depth:10,block:12,fit:2,web:4,itemH:0,item:'razor handles lying flat (\u2248120 \u00d7 24 mm)'},
 {id:'swabs',cat:'bathroom',name:'Cotton swab cubby',kind:'cups',shape:'squircle',a:50,b:50,t:2,pegH:46,web:6,count:1,itemH:76,item:'standard 3 in (76 mm) cotton swabs standing upright in a rounded-square cubby'},
 {id:'swabTray',cat:'bathroom',name:'Cotton swab tray (lying flat)',kind:'pockets',shape:'rect',a:82,b:44,depth:12,block:14,fit:0,web:4,radius:8,count:1,itemH:0,notch:true,item:'3 in (76 mm) cotton swabs lying flat, for shallow drawers'},
 {id:'pads',cat:'bathroom',name:'Cotton round holder',kind:'cups',shape:'circle',a:62,t:2,pegH:40,web:6,count:1,itemH:0,item:'stacked cotton rounds and makeup pads (\u224857 mm)'},
 {id:'toothbrush',cat:'bathroom',name:'Toothbrush cradles',kind:'brush',testBin:[270,90],model:0,count:2,fit:1.5,web:6,notch:1,item:'electric or manual toothbrushes lying flat in a cutout shaped to the model, so they cannot roll'},
 {id:'toothpaste',cat:'bathroom',name:'Toothpaste tube lanes',kind:'channels',a:52,depth:12,block:14,web:3,item:'full-size toothpaste tubes (\u224850 mm wide) lying flat'},
 {id:'toothpasteTravel',cat:'bathroom',name:'Travel toothpaste lanes',kind:'channels',a:32,depth:10,block:12,web:3,item:'travel-size toothpaste tubes (\u224830 mm wide) lying flat'},
 {id:'floss',cat:'bathroom',name:'Floss container slots',kind:'pockets',shape:'rect',a:48,b:18,depth:14,block:16,fit:1,web:3,radius:4,itemH:44,item:'dental floss containers standing on edge (\u224848 \u00d7 18 mm)'},
 {id:'flossPicks',cat:'bathroom',name:'Floss pick tray',kind:'pockets',shape:'rect',a:66,b:30,depth:10,block:12,fit:0,web:4,radius:6,count:1,itemH:0,item:'loose floss picks and interdental brushes'},
 {id:'comb',cat:'bathroom',name:'Comb and brush lanes',kind:'channels',a:36,depth:8,block:10,web:3,item:'combs and slim hair brushes lying flat'},
 {id:'hairties',cat:'bathroom',name:'Hair tie and bobby pin cups',kind:'pockets',shape:'rect',a:38,b:38,depth:14,block:16,fit:0,web:3,radius:9,itemH:0,item:'rounded cups for hair ties, bobby pins and clips'},
 {id:'clippers',cat:'bathroom',name:'Nail clipper and tweezer slots',kind:'pockets',shape:'stadium',a:96,b:17,depth:9,block:11,fit:1,web:4,itemH:0,item:'nail clippers, tweezers and files lying flat (\u224896 \u00d7 17 mm)'},
 {id:'balm',cat:'bathroom',name:'Lip balm and makeup wells',kind:'pockets',shape:'circle',a:17,depth:14,block:16,fit:1,web:3,itemH:68,item:'lip balm sticks and slim makeup standing upright (\u224817 mm)'},
 {id:'deodorant',cat:'bathroom',name:'Deodorant stick cradle',kind:'pockets',shape:'stadium',a:124,b:46,depth:12,block:14,fit:2,web:4,itemH:0,item:'deodorant sticks lying flat (\u2248124 \u00d7 46 mm)'},
 {id:'lens',cat:'bathroom',name:'Contact lens case pocket',kind:'pockets',shape:'rect',a:54,b:24,depth:10,block:12,fit:1,web:4,radius:8,itemH:0,item:'two-cup contact lens cases (\u224854 \u00d7 24 mm)'},
 {id:'bladebank',cat:'bathroom',name:'Used blade bank',kind:'bladebank',blade:0,fit:.6,pegH:0,item:'a closed box with a narrow slot for used razor blades; its body and snap lid print as separate parts'},
 {id:'palette',cat:'makeup',name:'Eyeshadow palette pockets',kind:'pockets',shape:'rect',a:102,b:70,depth:10,block:12,fit:2,web:4,radius:6,itemH:0,notch:true,item:'eyeshadow and blush palettes lying flat (\u2248100 \u00d7 70 mm)'},
 {id:'compact',cat:'makeup',name:'Compact and powder wells',kind:'pockets',shape:'circle',a:72,depth:10,block:12,fit:1.5,web:4,itemH:0,item:'round compacts and pressed powders lying flat (\u224872 mm)'},
 {id:'mascara',cat:'makeup',name:'Mascara and eyeliner lanes',kind:'channels',a:20,depth:9,block:11,web:3,item:'mascara, eyeliner and brow pencils lying flat (\u224818 mm)'},
 {id:'foundation',cat:'makeup',name:'Foundation bottle wells',kind:'pockets',shape:'circle',a:40,depth:14,block:16,fit:1.2,web:3,itemH:110,item:'foundation and serum bottles standing upright (\u224840 mm)'},
 {id:'sponges',cat:'makeup',name:'Makeup sponge cups',kind:'pockets',shape:'circle',a:48,depth:16,block:18,fit:1,web:3,itemH:0,item:'beauty sponges and powder puffs (\u224845 mm)'},
 {id:'makeupBrushes',cat:'makeup',name:'Makeup brush lanes',kind:'channels',a:24,depth:10,block:12,web:3,item:'makeup brushes lying flat (handles up to 22 mm)'},
 {id:'pillBottle',cat:'medicine',name:'Pill bottle wells',kind:'pockets',shape:'circle',a:36,depth:14,block:16,fit:1.5,web:3,itemH:75,item:'standard pill bottles standing upright (\u224835 mm, label facing up)'},
 {id:'pillBottleFlat',cat:'medicine',name:'Pill bottle cradles (lying flat)',kind:'pockets',shape:'stadium',a:78,b:38,depth:12,block:14,fit:1.5,web:4,itemH:0,item:'pill bottles lying flat, for shallow drawers (\u224875 \u00d7 36 mm)'},
 {id:'pillBottleLarge',cat:'medicine',name:'Large bottle wells',kind:'pockets',shape:'circle',a:50,depth:14,block:16,fit:1.5,web:3,itemH:95,item:'vitamin and large pill bottles standing upright (\u224850 mm)'},
 {id:'blister',cat:'medicine',name:'Blister pack slots',kind:'pockets',shape:'rect',a:104,b:8,depth:16,block:18,fit:1,web:5,radius:2,itemH:70,item:'blister cards standing on edge, easy to flip through (\u2248100 mm wide)'},
 {id:'bandages',cat:'medicine',name:'Bandage box pocket',kind:'pockets',shape:'rect',a:84,b:52,depth:10,block:12,fit:1.5,web:4,radius:6,itemH:0,notch:true,item:'boxes of adhesive bandages and gauze lying flat (\u224884 \u00d7 52 mm)'},
 {id:'thermometer',testBin:[170,110],cat:'medicine',name:'Thermometer cradle',kind:'pockets',shape:'stadium',a:140,b:24,depth:10,block:12,fit:1.5,web:4,itemH:0,item:'digital stick thermometers lying flat (\u2248140 \u00d7 22 mm)'},
 {id:'ointment',cat:'medicine',name:'Ointment tube lanes',kind:'channels',a:32,depth:10,block:12,web:3,item:'ointment and cream tubes lying flat (\u224830 mm wide)'},
 {id:'pillOrganizer',testBin:[220,110],cat:'medicine',name:'Weekly pill organizer pocket',kind:'pockets',shape:'rect',a:196,b:40,depth:10,block:12,fit:2,web:4,radius:6,count:1,itemH:0,item:'a 7-day pill organizer lying flat (\u2248195 \u00d7 38 mm)'},
 {id:'medCups',cat:'medicine',name:'Dosing cup and small item cups',kind:'pockets',shape:'rect',a:40,b:40,depth:14,block:16,fit:0,web:3,radius:9,itemH:0,item:'rounded cups for dosing cups, syringes, tweezers and small items'},
 {id:'cables',cat:'office',name:'Coiled cable and charger cups',kind:'pockets',shape:'circle',a:62,depth:18,block:20,fit:0,web:3,itemH:0,item:'coiled cables, wall chargers and earbuds'},
 {id:'cableLanes',cat:'office',name:'Charging cable lanes',kind:'channels',a:12,depth:10,block:12,web:3,item:'straight cables and adapters laid in rounded lanes'},
 {id:'scissors',cat:'crafts',name:'Scissors and rotary cutter cradles',kind:'pockets',shape:'stadium',a:130,b:34,depth:10,block:12,fit:2,web:4,itemH:0,item:'scissors and rotary cutters lying flat (\u2248130 \u00d7 34 mm; lengthen for bigger shears)'},
 {id:'needles',cat:'crafts',name:'Needle and pin slots',kind:'pockets',shape:'stadium',a:60,b:4,depth:6,block:8,fit:0,web:4,itemH:0,item:'needle cases, pins and seam rippers'},
 {id:'spools',cat:'crafts',name:'Thread spool pegs',kind:'pegs',a:6,pegH:36,web:30,item:'standard thread spools on 6 mm pegs'},
 {id:'bobbins',cat:'crafts',name:'Bobbin pockets',kind:'pockets',shape:'circle',a:20.5,depth:9,block:11,fit:.8,web:2.4,notch:true,itemH:11.7,item:'Class 15 bobbins (20.5 \u00d7 11.7 mm)'},
 {id:'paint',cat:'crafts',name:'Craft paint bottles (2 oz)',kind:'pockets',shape:'circle',a:39,depth:14,block:16,fit:1.2,web:2.4,itemH:100,item:'2 fl oz craft paint bottles standing upright (\u224839 mm)'},
 {id:'paintMini',cat:'crafts',name:'Mini paint pots',kind:'pockets',shape:'circle',a:28,depth:12,block:14,fit:1,web:2.2,itemH:45,item:'mini craft paint pots standing upright (\u224828 mm)'},
 {id:'paintDropper',cat:'crafts',name:'Dropper bottles',kind:'pockets',shape:'circle',a:25,depth:18,block:20,fit:1,web:2.2,itemH:90,item:'dropper and ink bottles standing upright (\u224825 mm)'},
 {id:'paintTube',cat:'crafts',name:'Acrylic paint tubes',kind:'channels',a:36,depth:12,block:14,web:3,item:'acrylic paint tubes lying flat in rounded lanes (\u224836 mm wide)'},
 {id:'markers',cat:'crafts',name:'Marker and brush pen tray',kind:'channels',a:18,depth:10,block:12,web:3,item:'markers and brush pens lying flat in rounded lanes'},
 {id:'erasers',cat:'crafts',name:'Eraser and clip cups',kind:'pockets',shape:'rect',a:26,b:26,depth:14,block:16,fit:0,web:2,radius:5,itemH:0,item:'rounded cups for erasers, clips and small craft bits'},
 {id:'beads',cat:'crafts',name:'Bead and charm tray',kind:'pockets',shape:'rect',a:24,b:24,depth:10,block:12,fit:0,web:2,radius:6,itemH:0,item:'shallow rounded wells for beads'},
 {id:'tea',cat:'kitchen',name:'Tea bag file',kind:'pockets',shape:'rect',a:76,b:10,depth:18,block:20,fit:2,web:3,itemH:70,item:'tea bag envelopes on edge'},
 {id:'spiceStep',cat:'kitchen',name:'Spice step riser',kind:'tiers',steps:3,a:14,item:'stepped shelves so back rows are visible'},
 {id:'measure',cat:'kitchen',name:'Measuring spoon slots',kind:'pockets',shape:'stadium',a:48,b:9,depth:12,block:14,fit:1,web:4,itemH:30,item:'measuring spoons nested on edge'},
 {id:'fitkit',testBin:[300,220],cat:'general',name:'Form-fit kit \u00b7 pick your items',kind:'fit',items:[{k:'tape25',n:1},{k:'pliersNeedle',n:1},{k:'sdMedium',n:1},{k:'utilityKnife',n:1}],fit:1,depth:20,block:0,web:5,notch:1,pack:1,item:'choose items from a library of 130+ real-size tools, controllers, toothbrushes and more; each gets a matching form-fit pocket, auto-packed into the bin'},
 {id:'gameKit',testBin:[400,300],cat:'gaming',name:'Video game drawer \u00b7 controllers',kind:'fit',items:[{k:'xboxSeries',n:1},{k:'dualsense',n:1},{k:'switchPro',n:1},{k:'joycon',n:2},{k:'switchCart',n:6}],fit:1.2,depth:24,block:0,web:5,notch:1,pack:1,item:'form-fit pockets for controllers (Xbox, PlayStation, Switch Pro, Joy-Con) plus game card slots'},
 {id:'gameCases',testBin:[200,150],cat:'gaming',name:'Switch game case slots',kind:'pockets',shape:'rect',a:106,b:11.5,depth:22,block:24,fit:0,web:3,radius:1,itemH:170,item:'Switch game cases standing on edge, spines up (105 \u00d7 170 \u00d7 11 mm)'},
 {id:'discCases',testBin:[200,150],cat:'gaming',name:'Disc game case slots',kind:'pockets',shape:'rect',a:136,b:15,depth:24,block:26,fit:0,web:3,radius:1,itemH:171,item:'Blu-ray and DVD style game cases standing on edge (135 mm wide, up to 14 mm thick)'},
 {id:'gameCards',cat:'gaming',name:'Game card slots',kind:'pockets',shape:'rect',a:22,b:3.4,depth:14,block:16,fit:.4,web:3,itemH:31,item:'Switch game cards on edge (31 \u00d7 21.5 \u00d7 3.3 mm)'},
 {id:'chargeKit',testBin:[360,250],cat:'office',name:'Charging station drawer',kind:'fit',items:[{k:'phone67',n:1},{k:'phone61',n:1},{k:'chargerUsbc',n:2},{k:'powerBank',n:1},{k:'earbudsCase',n:1},{k:'smartwatch',n:1},{k:'cableTie',n:2}],fit:1,depth:14,block:0,web:5,notch:1,pack:1,item:'phones, chargers, a power bank, earbuds and a watch, each in its own pocket'},
 {id:'remoteKit',testBin:[280,230],cat:'home',name:'Remote control holder',kind:'fit',items:[{k:'tvRemote',n:1},{k:'streamRemote',n:1},{k:'acRemote',n:1},{k:'uniRemote',n:1},{k:'aaa',n:4}],fit:1.2,depth:14,block:0,web:5,notch:1,pack:1,item:'TV, streaming, air conditioner and universal remotes with spare AAA batteries'},
 {id:'socketKit',testBin:[300,220],cat:'garage',name:'Socket set tray',kind:'fit',items:[{k:'ratchet38',n:1},{k:'ratchet14',n:1},{k:'extBar',n:1},{k:'socket38',n:8},{k:'socket14',n:8}],fit:.6,depth:18,block:0,web:4,notch:1,pack:1,item:'ratchets, an extension bar and sockets standing upright'},
 {id:'toolKit',testBin:[440,320],cat:'garage',name:'Hand tool drawer',kind:'fit',items:[{k:'pliersSlip',n:1},{k:'pliersNeedle',n:1},{k:'cutters',n:1},{k:'wrenchAdj',n:1},{k:'sdMedium',n:2},{k:'sdSmall',n:2},{k:'utilityKnife',n:1},{k:'tape25',n:1}],fit:1,depth:18,block:0,web:5,notch:1,pack:1,item:'pliers, cutters, wrench, screwdrivers, utility knife and tape measure shadowboard'},
 {id:'wrenchKit',testBin:[260,220],cat:'garage',name:'Wrench set tray',kind:'fit',items:[{k:'wrench8',n:1},{k:'wrench10',n:1},{k:'wrench13',n:1},{k:'wrench17',n:1}],fit:.8,depth:8,block:0,web:4,notch:1,pack:1,item:'combination wrenches 8\u201317 mm lying flat'},
 {id:'sewKit',testBin:[290,220],cat:'crafts',name:'Craft and sewing kit',kind:'fit',items:[{k:'scissors8',n:1},{k:'tweezers',n:1},{k:'utilityKnife',n:1},{k:'pencil',n:2},{k:'marker',n:2}],fit:1,depth:12,block:0,web:5,notch:1,pack:1,item:'fabric scissors, a cutter, tweezers, pencils and markers in fitted pockets'},
 {id:'bathKit',testBin:[300,240],cat:'bathroom',name:'Bathroom form-fit kit',kind:'fit',items:[{k:'tbElectric',n:1},{k:'tbManual',n:1},{k:'paste',n:1},{k:'razorCart',n:1},{k:'floss',n:1},{k:'clipper',n:1}],fit:1.2,depth:16,block:0,web:5,notch:1,pack:1,item:'electric and manual toothbrushes, toothpaste, razor, floss and nail clipper'},
 {id:'utensilKit',testBin:[320,260],cat:'kitchen',name:'Utensil form-fit kit',kind:'fit',items:[{k:'tablespoon',n:2},{k:'teaspoon',n:2},{k:'fork',n:2},{k:'knife',n:2},{k:'mSpoons',n:1}],fit:1.2,depth:10,block:0,web:5,notch:0,pack:1,item:'spoons, forks, knives and measuring spoons in shaped pockets'},
 {id:'makeupKit',testBin:[290,220],cat:'makeup',name:'Makeup form-fit kit',kind:'fit',items:[{k:'palette',n:1},{k:'compact',n:1},{k:'mascara',n:2},{k:'lipstick',n:3},{k:'mkBrush',n:2}],fit:1,depth:12,block:0,web:4,notch:1,pack:1,item:'palette, compact, mascara, lipsticks and brushes in fitted pockets'},
 {id:'batteryKit',testBin:[200,150],cat:'home',name:'Battery station',kind:'fit',items:[{k:'aaUp',n:12},{k:'aaaUp',n:12},{k:'9v',n:2},{k:'cr2032',n:4}],fit:.6,depth:16,block:0,web:2.5,notch:0,pack:1,item:'AA and AAA standing, 9V and coin cells lying flat'},
 {id:'artKit',testBin:[360,260],cat:'crafts',name:'Kids art kit \u00b7 crayons and markers',kind:'fit',items:[{k:'crayon',n:8},{k:'marker',n:4},{k:'coloredPencil',n:4},{k:'scissorsKids',n:1},{k:'glueStick',n:1},{k:'eraser',n:1}],fit:1,depth:10,block:0,web:3,notch:1,pack:1,item:'crayons, markers, colored pencils, kids scissors, a glue stick and an eraser, each in its own fitted pocket'},
 {id:'deskKit',testBin:[310,240],cat:'office',name:'Desk form-fit kit',kind:'fit',items:[{k:'scissors8',n:1},{k:'sticky3',n:1},{k:'pen',n:3},{k:'highlighter',n:2},{k:'usbStick',n:2},{k:'sdCard',n:2}],fit:1,depth:12,block:0,web:4,notch:1,pack:1,item:'scissors, sticky notes, pens, highlighters, USB drives and SD cards'},
 {id:'dividers',cat:'general',name:'Dividers',kind:'dividers',nx:2,ny:0,t:1.6,hFrac:1,item:'thin dividing walls across the bin'},
 {id:'grid',cat:'general',name:'Sub-divider grid',kind:'dividers',nx:2,ny:2,t:1.2,hFrac:.7,item:'a lower grid of small compartments'},
 {id:'tiers',cat:'general',name:'Tiered riser',kind:'tiers',steps:2,a:18,item:'stadium-style steps across the bin'},
 {id:'outline',cat:'general',name:'Tool cutout from a photo',kind:'outline',a:110,depth:14,block:17,fit:1,notch:1,itemH:0,item:'a pocket shaped like your tool, traced from a photo or outline you upload'},
 {id:'tablet',cat:'general',name:'Phone and tablet stand slots',kind:'pockets',shape:'rect',a:0,b:13,depth:18,block:22,fit:0,web:18,full:true,itemH:160,item:'phones or tablets standing on edge in cushioned slots'}
];
const byId=Object.fromEntries(LIB.map(x=>[x.id,x]));
// Toothbrush outlines (top-down, lying on the back). Handle length, overall length with the brush head, handle width and
// thickness come from published size guides (see docs/bathroom-drawer.md); necks and heads get generous channels.
function brushModel(id,name,handle,length,w,thick,x={}){
 const wb=x.base||w,top=x.top??.85,neck=x.neck||11,head=x.head||16,headLen=x.headLen||20,hs=length-headLen;
 const profile=[[0,wb*.8],[1.5,wb*.94],[4,wb],[Math.max(5,handle*.72),w],[handle,w*top],[handle+4,Math.min(w*top,neck+4)],[handle+10,neck],[hs-3,neck],[hs,head*.9],[hs+3,head],[length-4,head],[length-1,head*.78],[length,head*.45]].filter((q,i,a)=>!i||q[0]>a[i-1][0]+1e-6);
 const at=xq=>{for(let i=1;i<profile.length;i++)if(xq<=profile[i][0]){const [x0,w0]=profile[i-1],[x1,w1]=profile[i];return w0+(w1-w0)*(xq-x0)/(x1-x0);}return profile.at(-1)[1];};
 return {id,name,handle,length,width:w,thick,profile,at,src:x.src||''};
}
const BRUSHES=[
 brushModel('io','Oral-B iO (Series 2\u201310)',184,240,28,30,{top:.82,neck:12,head:17,headLen:20}),
 brushModel('geniusx','Oral-B Genius X',205,235,27,32,{top:.85,neck:11,head:16,headLen:18}),
 brushModel('pro','Oral-B Pro 1000 / Smart 1500',195,232,25,29,{top:.9,neck:11,head:16,headLen:18}),
 brushModel('vitality','Oral-B Vitality',180,220,25,32,{base:32,top:.95,neck:11,head:16,headLen:18}),
 brushModel('sonicare4100','Philips Sonicare 4100',173,234,25,27,{top:.9,neck:10,head:14,headLen:26}),
 brushModel('protectiveclean','Philips Sonicare ProtectiveClean 5100 / 6100',190,250,28,30,{top:.85,neck:10,head:14,headLen:26}),
 brushModel('diamondclean','Philips Sonicare DiamondClean Smart',190,255,27,30,{top:.85,neck:10,head:14,headLen:26}),
 brushModel('quip','quip (battery or rechargeable)',130,193,15,15,{top:1,neck:8,head:12,headLen:30}),
 brushModel('manual','Manual toothbrush (handles up to 20 mm)',120,195,20,20,{top:.8,neck:8,head:15,headLen:32})
];
// Display-only toothbrush for the preview (never exported): elliptical rings along the outline, lying on its back.
function ghostBrush(B,seg=28){
 const xs=[...new Set([...Array.from({length:Math.ceil(B.length/3)+1},(_,i)=>Math.min(B.length,i*3)),...B.profile.map(q=>q[0])].map(v=>+v.toFixed(3)))].sort((a,b)=>a-b).filter(x=>x>.2&&x<B.length-.2);
 const hz=x=>x<=B.handle?B.thick/2:x<B.length-(B.profile.at(-4)[0]>0?B.length-B.profile.at(-5)[0]:20)?Math.min(B.thick/2,B.at(x)*.42):Math.min(B.thick/2,B.at(x)*.38);
 const rings=xs.map(x=>{const a=B.at(x)/2*.96,b=hz(x),zc=B.thick/2;return Array.from({length:seg},(_,j)=>{const t=2*Math.PI*j/seg;return [x,a*Math.cos(t),zc+b*Math.sin(t)];});});
 const out=[],tri=(p,q,r)=>out.push(...p,...q,...r);
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<seg;j++){const a=rings[i][j],b=rings[i][(j+1)%seg],c=rings[i+1][(j+1)%seg],d=rings[i+1][j];tri(a,b,c);tri(a,c,d);}
 const c0=[0,0,B.thick/2],c1=[B.length,0,B.thick/2];for(let j=0;j<seg;j++){tri(c0,rings[0][(j+1)%seg],rings[0][j]);const L=rings.at(-1);tri(c1,L[j],L[(j+1)%seg]);}
 let m=Float64Array.from(out);if(C.signedVolume(m)<0){for(let k=0;k<m.length;k+=9)for(let q=0;q<3;q++){const t=m[k+3+q];m[k+3+q]=m[k+6+q];m[k+6+q]=t;}}return m;
}
// Used-blade bank: slot sizes for common safety-razor blades (double-edge \u2248 43 \u00d7 22 \u00d7 0.1 mm, single-edge \u2248 38 \u00d7 19 mm with a folded spine).
const BLADES=[{id:'de',name:'Double-edge blades',slot:[47,1.3],inner:[59,30]},{id:'se',name:'Single-edge blades',slot:[42,1.8],inner:[54,28]},{id:'both',name:'Double- and single-edge blades',slot:[47,1.8],inner:[59,30]}];
const BANK={wall:2.4,floor:2,plate:2.4,skirt:8,skirtT:1.6,clear:.25,bead:.5,catchAt:3,chimney:12,r:5};
function bankDims(K){return {W:K.inner[0]+2*BANK.wall,D:K.inner[1]+2*BANK.wall,r:BANK.r};}
/* bladeBank(blade, totalHeight): two closed solids in print orientation.
 * Body prints upright (open top) with an inside snap groove and an entry chamfer at the rim.
 * Lid prints top-down: plate on the bed, plug skirt up with a one-way snap bead, and a chute around the slot that
 * reaches 12 mm into the box so blades cannot shake back out. Once snapped it does not come apart. */
function bladeBank(blade=0,H=60){
 const K=typeof blade==='object'?blade:BLADES[clamp(Math.round(+blade||0),0,BLADES.length-1)],{W,D,r}=bankDims(K),B=BANK,bodyH=Math.max(24,H-B.plate);
 const O=T.roundRect(0,0,W,D,r,32),rr=r-B.wall,hole=g=>T.roundRect(B.wall-g,B.wall-g,W-B.wall+g,D-B.wall+g,Math.max(.5,rr+g),32),ring=(A,Bh)=>({outer:A,holes:[Bh.slice().reverse()]});
 const g1=bodyH-B.catchAt+.1,g0=bodyH-B.catchAt-2.8;
 const bodyLayers=[{z0:0,z1:B.floor,polys:[poly(O)]},{z0:B.floor,z1:g0,polys:[ring(O,hole(0))]},{z0:g0,z1:g0+.3,polys:[ring(O,hole(.3))]},{z0:g0+.3,z1:g1,polys:[ring(O,hole(.6))]},{z0:g1,z1:bodyH-.6,polys:[ring(O,hole(0))]},{z0:bodyH-.6,z1:bodyH-.3,polys:[ring(O,hole(.3))]},{z0:bodyH-.3,z1:bodyH,polys:[ring(O,hole(.6))]}];
 const sk=g=>T.roundRect(B.wall+B.clear-g,B.wall+B.clear-g,W-B.wall-B.clear+g,D-B.wall-B.clear+g,Math.max(.5,rr-B.clear+g),32),SI=sk(-B.skirtT);
 const [sl,sw]=K.slot,cx=W/2,cy=D/2,slot=T.roundRect(cx-sl/2,cy-sw/2,cx+sl/2,cy+sw/2,sw/2-.02,6),chim=T.roundRect(cx-sl/2-1.2,cy-sw/2-1.2,cx+sl/2+1.2,cy+sw/2+1.2,sw/2+1.18,8),chute=ring(chim,slot);
 const P=B.plate,c=P+B.catchAt,skirtAt=g=>[ring(sk(g),SI),chute];
 const lidLayers=[{z0:0,z1:P,polys:[ring(O,slot)]},{z0:P,z1:c,polys:skirtAt(0)},{z0:c,z1:c+.5,polys:skirtAt(B.bead)},{z0:c+.5,z1:c+1,polys:skirtAt(B.bead*.75)},{z0:c+1,z1:c+1.5,polys:skirtAt(B.bead*.5)},{z0:c+1.5,z1:c+2,polys:skirtAt(B.bead*.25)},{z0:c+2,z1:P+B.skirt,polys:skirtAt(0)},{z0:P+B.skirt,z1:P+B.chimney,polys:[chute]}];
 const solid=(layers,what)=>{let m=T.steppedExtrude(layers);for(let i=0;i<m.length;i++)m[i]=Math.round(m[i]*1e5)/1e5;if(!C.checkClosed(m).closed&&C.fixTJunctions){for(const tol of [1e-4,1e-3,5e-3]){m=Float64Array.from(C.fixTJunctions(m,new Array(m.length/9).fill(0),tol).p);if(C.checkClosed(m).closed)break;}}if(!C.checkClosed(m).closed)throw Error(`The blade bank ${what} could not form a closed solid.`);return m;};
 const body=solid(bodyLayers,'body'),lid=solid(lidLayers,'lid');
 // Assembled view: lid turned over (180\u00b0 about the X axis) and snapped onto the rim.
 const worn=Float64Array.from(lid,(v,k)=>k%3===1?D-v:k%3===2?bodyH+P-v:v);
 return {blade:K,W,D,bodyH,height:bodyH+P,body:{local:body,w:W,d:D,h:bodyH},lid:{local:lid,w:W,d:D,h:P+B.chimney,worn},note:`Print the body open side up and the lid top-down, both without supports. Press the lid on until it clicks; the snap is permanent. Drop used blades through the slot; when full, tape over the slot and recycle or dispose of it as your local rules require.`};
}

// Which number controls apply to each kind.
const CONTROLS={pockets:['count','a','b','depth','block','fit','web'],channels:['count','a','depth','block','web'],pegs:['count','a','pegH','web'],dividers:['nx','ny','t','hFrac'],removable:['nx','ny','t','hFrac'],tiers:['steps','a'],label:['a','depth','block','web'],cups:['count','a','pegH','t','web'],brush:['model','count','fit','web','notch'],bladebank:['blade','pegH','fit'],outline:['a','depth','block','fit','notch'],fit:['items','fit','depth','block','web','notch','pack']};
// Built-in example outline (an open-end wrench) until a photo is uploaded; longest side normalized to 1.
let WRENCH=null;function wrench(){if(WRENCH)return WRENCH;const head=(x,r,dir)=>T.diffPolys([poly(T.circle(x,0,r,40))],[poly([[x,-r*.42],[x+dir*r*1.4,-r*.55],[x+dir*r*1.4,r*.55],[x,r*.42]])]);let P=T.unionPolys([poly(T.roundRect(-.36,-.045,.36,.045,.044,12)),...head(.4,.1,1),...head(-.41,.085,-1)]);const L=P.sort((a,b)=>Math.abs(T.polysArea([b]))-Math.abs(T.polysArea([a])))[0].outer;let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const [x,y] of L){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}const k=Math.max(x1-x0,y1-y0);WRENCH=L.map(([x,y])=>[+((x-(x0+x1)/2)/k).toFixed(4),+((y-(y0+y1)/2)/k).toFixed(4)]);return WRENCH;}
function spec(ins){const base=byId[ins?.id];if(!base)throw Error('Choose an organizer object from the library.');const o={...base,...Object.fromEntries(Object.entries(ins).filter(([k,v])=>k!=='id'&&v!=null&&v!==''&&Number.isFinite(+v)).map(([k,v])=>[k,+v]))};if(base.kind==='outline')o.outline=Array.isArray(ins.outline)&&ins.outline.length>=3?ins.outline:wrench();if(base.kind==='fit')o.items=fitItems(Array.isArray(ins.items)?ins.items:base.items);if(ins.outlineName)o.outlineName=String(ins.outlineName).slice(0,40);if(base.sizes&&!ins.a)o.sizes=base.sizes;else if(base.sizes&&ins.a&&ins.a!==base.a)o.sizes=null;else o.sizes=base.sizes||null;return o;}
function shapeAt(shape,cx,cy,sx,sy,radius=0){
 if(shape==='circle')return T.circle(cx,cy,sx/2,segs(sx));
 if(shape==='hex'){const R=sx/Math.sqrt(3);return Array.from({length:6},(_,j)=>[cx+R*Math.cos(j*Math.PI/3+Math.PI/6),cy+R*Math.sin(j*Math.PI/3+Math.PI/6)]);}
 if(shape==='stadium')return T.roundRect(cx-sx/2,cy-sy/2,cx+sx/2,cy+sy/2,Math.min(sx,sy)/2-.02,16);
 return rect(cx-sx/2,cy-sy/2,cx+sx/2,cy+sy/2,Math.min(radius||.6,Math.min(sx,sy)/2-.05));
}
// Finger-notch edges pass exactly through circle vertices, so pocket walls and notch caps share vertices.
const segs=d=>Math.max(32,Math.min(96,Math.round(d*3)));
function notchHalf(d,target,vertical){const n=segs(d),r=d/2;let best=null;for(let i=0;i<n;i++){const t=2*Math.PI*i/n,v=vertical?r*Math.cos(t):r*Math.sin(t);if(v>.8&&v<r*.8&&(!best||Math.abs(v-target)<Math.abs(best-target)))best=v;}return best;}
const footprint=(shape,size)=>shape==='hex'?[size*2/Math.sqrt(3),size]:[size,size];
function fitItems(list){const out=[];for(const e of list||[]){const k=e&&e.k;if(!FL||!FL.byId[k])continue;const n=clamp(Math.round(+e.n||1),1,48),r=e.r?1:0;const prev=out.find(x=>x.k===k&&x.r===r);if(prev)prev.n=Math.min(48,prev.n+n);else out.push({k,n,r});}return out.slice(0,40);}
/* Form-fit kit: every chosen item gets a pocket shaped like it (outline + fit clearance), auto-packed in shelves along
 * the bin's long side. Pockets keep 0.8 mm of rim clearance, rounded corners from the fit offset and optional finger notches; flat items sit 65% deep,
 * standing items 50%, capped by the depth setting. */
function fitPlan(o,iw,id,room,inS,warnings,info,solids,cavities,m,wallHint){
 if(!FL)throw Error('The item library did not load. Reload the page.');
 const fit=clamp(o.fit,0,4),web=clamp(o.web,2,40),maxD=clamp(o.depth,2,80),nr=8,chf=.8,pad=chf;
 const list=[];for(const e of o.items)for(let i=0;i<e.n;i++)list.push(e);if(!list.length)throw Error('Add at least one item to this kit.');
 const shapes=new Map();const shape=(e)=>{const key=e.k+':'+e.r;if(shapes.has(key))return shapes.get(key);const it=FL.byId[e.k];let P=FL.outline(e.k);if(fit>0)P=T.offset(P,fit);if(e.r)P=xform(P,([x,y])=>[-y,x]);const B=T.polysBBox(P);const dep=Math.max(1.5,Math.min(maxD,it.H*(it.up?.5:.65)));const notch=o.notch&&!it.up&&it.W>=12;const v={it,P,B,dep,notch,w:B.w+2*pad,h:B.h+2*pad+(notch?2*nr:0)};shapes.set(key,v);return v;};
 const long=iw>=id,W=long?iw:id,H=long?id:iw,avail=W-2*m;
 const items=list.map((e,i)=>({e,i,s:shape(e)}));
 // turn items so their long side runs along the bin's long side unless that is too long
 for(const q of items){const a=q.s;if(a.w>avail&&a.h<=avail&&!q.e.r){q.e={...q.e,r:1};q.s=shape(q.e);}}
 if(o.pack)items.sort((a,b)=>b.s.w*b.s.h-a.s.w*a.s.h||a.i-b.i);
 // Skyline bottom-left packing: each item goes where its top edge ends lowest; both turns are tried when packing.
 let sky=[{x:0,w:avail,y:0}];const skipped=[],placedQ=[],HH=H-2*m;
 const fitAt=(i,w)=>{let x=sky[i].x,y=0,rem=w,j=i;if(x+w>avail+1e-9)return null;while(rem>1e-9){if(j>=sky.length)return null;y=Math.max(y,sky[j].y);rem-=sky[j].w-(j===i?0:0);j++;}return y;};
 const put=(x,w,y)=>{const out=[];for(const g of sky){const g1=g.x+g.w;if(g1<=x+1e-9||g.x>=x+w-1e-9){out.push(g);continue;}if(g.x<x)out.push({x:g.x,w:x-g.x,y:g.y});if(g1>x+w)out.push({x:x+w,w:g1-x-w,y:g.y});}out.push({x,w,y});out.sort((a,b)=>a.x-b.x);sky=[];for(const g of out){const l=sky.at(-1);if(l&&Math.abs(l.y-g.y)<1e-9)l.w+=g.w;else sky.push({...g});}};
 for(const q of items){const opts=[q.e];if(o.pack&&!q.s.it.up)opts.push({...q.e,r:q.e.r?0:1});let best=null;
  for(const e of opts){const a=shape(e),w=a.w+web,h=a.h;for(let i=0;i<sky.length;i++){const y=fitAt(i,Math.min(w,avail-sky[i].x>=a.w?w:a.w));if(y==null)continue;if(y+h>HH+1e-9)continue;const sc=y+h;if(!best||sc<best.sc-1e-9||(Math.abs(sc-best.sc)<1e-9&&sky[i].x<best.x))best={sc,x:sky[i].x,y,e,a,w:Math.min(w,avail-sky[i].x)};}}
  if(!best){skipped.push(q);continue;}q.e=best.e;q.s=best.a;q.x=best.x;q.y=best.y;put(best.x,Math.max(best.w,best.a.w),best.y+best.a.h+web);placedQ.push(q);}
 if(!placedQ.length){const q=skipped[0],need=[q.s.w+2*m+2*wallHint,q.s.h+2*m+2*wallHint];throw Error(`${q.s.it.name} needs at least ${need[0].toFixed(0)} \u00d7 ${need[1].toFixed(0)} mm of bin; this bin is ${(iw+2*wallHint).toFixed(0)} \u00d7 ${(id+2*wallHint).toFixed(0)} mm. Merge bins or enlarge the bin.`);}
 const usedW=Math.max(...placedQ.map(q=>q.x+q.s.w)),used=Math.max(...placedQ.map(q=>q.y+q.s.h));
 const rows=[{y:0,h:0,x:0,items:placedQ}];
 const y0=m+(H-2*m-used)/2,xs0=m+(avail-usedW)/2,pockets=new Map(),notches=[],places=[];let placed=0,dmax=0;const miss=new Map();
 const toBin=(x,y)=>long?[x,y]:[y,x];
 for(const r of rows){for(const q of r.items){const a=q.s,cx=xs0+q.x+a.w/2,cy=y0+q.y+a.h/2;
  const ox=cx-(a.B.x0+a.B.x1)/2,oy=cy-(a.B.y0+a.B.y1)/2;let P=xform(a.P,([x,y])=>toBin(x+ox,y+oy));
  const nc=a.notch?[toBin(cx,cy+a.B.h/2),toBin(cx,cy-a.B.h/2)]:[];const top=T.unionPolys([...T.offset(P,chf),...P]);
  if(!top.every(Q=>Q.outer.every(inS))||nc.some(c=>!inS([c[0]+(long?0:nr),c[1]+(long?nr:0)])||!inS([c[0]-(long?0:nr),c[1]-(long?nr:0)]))){miss.set(a.it.name,(miss.get(a.it.name)||0)+1);continue;}
  const d=+a.dep.toFixed(2);if(!pockets.has(d))pockets.set(d,{P:[],top:[]});pockets.get(d).P.push(...P);pockets.get(d).top.push(...top);dmax=Math.max(dmax,d);
  for(const c of nc)pockets.get(d).P.push(poly(T.circle(c[0],c[1],nr,48)));notches.push(...nc);placed++;const bb=T.polysBBox(P);const ang=q.e.r?Math.PI/2:0;places.push({x:(bb.x0+bb.x1)/2,y:(bb.y0+bb.y1)/2,w:bb.w-2*fit,d:bb.h-2*fit,z:0,depth:d,k:a.it.id,name:a.it.name,rot:long?ang:Math.atan2(Math.cos(ang),Math.sin(ang)),rotX:long?ang:Math.atan2(-Math.cos(ang),-Math.sin(ang))});}}
 if(G.FITDEBUG)console.log(JSON.stringify({n:placedQ.length,skipped:skipped.length,H,W,used,placed}));for(const q of skipped)miss.set(q.s.it.name,(miss.get(q.s.it.name)||0)+1);
 if(!placed)throw Error('None of these items fit: the kit needs at least one item clear of the rounded corners. Merge bins or enlarge the bin.');
 let block=o.block>0?o.block:dmax+2.4;if(block>room){warnings.push(`Insert lowered to the bin rim (${room.toFixed(1)} mm).`);block=room;}if(block<dmax+1.2){const s=(block-1.2)/dmax;for(const [d,v]of [...pockets]){pockets.delete(d);const nd=+Math.max(1,d*s).toFixed(2);if(!pockets.has(nd))pockets.set(nd,{P:[],top:[]});pockets.get(nd).P.push(...v.P);pockets.get(nd).top.push(...v.top);}warnings.push('Pockets made shallower to fit this bin height. Use a taller bin for deeper pockets.');}
 solids.push({polys:[poly(rect(-.01,-.01,iw+.01,id+.01))],z0:0,z1:block});
 {const sc=block<dmax+1.2?(block-1.2)/dmax:1;for(const p of places){const dd=Math.min(Math.max(1,p.depth*sc),block-1.2);p.z=block-dd;}}
 for(const [d,v]of pockets){const dd=Math.min(d,block-1.2);cavities.push({polys:T.unionPolys(v.P),z0:block-dd,z1:block+1});}
 for(const [n,c]of miss)warnings.push(`${c} \u00d7 ${n} did not fit. Merge bins, enlarge the bin or remove items.`);
 const names=new Map();for(const p of places)names.set(p.name,(names.get(p.name)||0)+1);
 info.count=placed;info.places=places;info.items=[...names].map(([n,c])=>c>1?`${c} \u00d7 ${n}`:n);info.summary=`${placed} form-fit pocket${placed===1?'':'s'} (${info.items.join(', ')}), up to ${Math.min(dmax,block-1.2).toFixed(1)} mm deep in a ${block.toFixed(1)} mm insert, +${fit.toFixed(1)} mm fit`;
 return {solids,cavities,info};
}
/* plan(ins, iw, id, room, headroom): inner coordinates 0..iw \u00d7 0..id, z measured from the bin floor top.
 * room = wall height above the floor; headroom = drawer clearance above the floor. */
function plan(ins,iw,id,room,headroom=Infinity,R=0,wallHint=0){
 if(byId[ins?.id]?.kind==='removable'){const q=spec(ins),p=plan({id:'grid',nx:Math.max(0,q.nx),ny:Math.max(0,q.ny),t:q.t,hFrac:q.hFrac},iw,id,room,headroom,R,wallHint);Object.assign(p.info,{id:q.id,name:q.name,kind:'removable',item:q.item});return p;}
 const o=spec(ins),warnings=[],solids=[],cavities=[],m=2,info={id:o.id,name:o.name,category:o.cat,kind:o.kind,item:o.item,warnings};R=clamp(+R||0,0,Math.min(iw,id)/2);
 // Free-standing features stay inside the rounded interior (inset by m); wall-touching features meet straight walls only.
 const inS=([x,y])=>{if(x<m-1e-9||y<m-1e-9||x>iw-m+1e-9||y>id-m+1e-9)return false;if(R<=m)return true;const cx=x<R?R:x>iw-R?iw-R:x,cy=y<R?R:y>id-R?id-R:y;return Math.hypot(x-cx,y-cy)<=R-m+1e-9;},fits=L=>L.every(inS);
 const spanX=(ya,yb)=>{let a=m,b=iw-m;if(R>m)for(const y of [ya,yb]){const dy=y<R?R-y:y>id-R?y-(id-R):0;if(dy>0){const dx=Math.sqrt(Math.max(0,(R-m)**2-dy*dy));a=Math.max(a,R-dx);b=Math.min(b,iw-R+dx);}}return [a,b];};
 const straightX=v=>clamp(v,Math.min(iw/2,R+1),Math.max(iw/2,iw-R-1)),straightY=v=>clamp(v,Math.min(id/2,R+1),Math.max(id/2,id-R-1));
 const inner=[poly(rect(-.01,-.01,iw+.01,id+.01))];
 if(o.kind==='dividers'){
  const t=clamp(o.t,.8,4),h=clamp(o.hFrac,.15,1)*room,nx=clamp(Math.round(o.nx),0,12),ny=clamp(Math.round(o.ny),0,12);if(!nx&&!ny)throw Error('Add at least one divider across or along the bin.');
  if((iw-nx*t)/(nx+1)<12||(id-ny*t)/(ny+1)<12)throw Error(`Too many dividers: each compartment must stay at least 12 mm wide. Use fewer dividers or a larger bin.`);
  if(R>0&&(iw-2*R-2<t||id-2*R-2<t))throw Error('Corners are too rounded for dividers in this bin. Reduce the corner radius or enlarge the bin.');const ribs=[];for(let i=1;i<=nx;i++){const x=straightX(iw*i/(nx+1));ribs.push(poly(rect(x-t/2,-.5,x+t/2,id+.5)));}for(let j=1;j<=ny;j++){const y=straightY(id*j/(ny+1));ribs.push(poly(rect(-.5,y-t/2,iw+.5,y+t/2)));}
  solids.push({polys:T.unionPolys(ribs),z0:0,z1:h});info.count=(nx+1)*(ny+1);info.summary=`${info.count} compartments, ${t.toFixed(1)} mm walls ${h.toFixed(1)} mm tall`;return {solids,cavities,info};
 }
 if(o.kind==='fit')return fitPlan(o,iw,id,room,inS,warnings,info,solids,cavities,m,wallHint);
 if(o.kind==='outline'){
  // Pocket shaped like the traced outline: scaled so the longest side is a, grown by the fit clearance, turned to
  // run along the bin's long side, centered. Optional finger notches (\u00d822) on both long edges at the middle.
  const L=clamp(o.a,10,800),fit=clamp(o.fit,0,4),block=clamp(Math.min(o.block,room),3,room),depth=clamp(Math.min(o.depth,block-1.2),1,block);if(o.block>room+1e-6)warnings.push(`Insert lowered to the bin rim (${room.toFixed(1)} mm).`);
  let P=o.outline.map(([x,y])=>[x*L,y*L]);let bx0=Math.min(...P.map(p=>p[0])),bx1=Math.max(...P.map(p=>p[0])),by0=Math.min(...P.map(p=>p[1])),by1=Math.max(...P.map(p=>p[1]));
  if(((bx1-bx0)>=(by1-by0))!==(iw>=id)){P=P.map(([x,y])=>[-y,x]);[bx0,bx1,by0,by1]=[-by1,-by0,bx0,bx1];}
  const cx0=(bx0+bx1)/2,cy0=(by0+by1)/2;P=P.map(([x,y])=>[x-cx0+iw/2,y-cy0+id/2]);
  let pocket=T.unionPolys([poly(P)]);if(fit>0)pocket=T.offset(pocket,fit);if(!pocket.length)throw Error('The traced outline is empty. Upload a clearer photo.');
  const B=T.polysBBox(pocket);if(B.w>iw-2*m+1e-6||B.h>id-2*m+1e-6)throw Error(`This cutout needs ${(B.w+2*m+2*wallHint).toFixed(0)} \u00d7 ${(B.h+2*m+2*wallHint).toFixed(0)} mm of bin; this bin is ${(iw+2*wallHint).toFixed(0)} \u00d7 ${(id+2*wallHint).toFixed(0)} mm. Merge bins, enlarge the bin or reduce the tool length.`);
  if(!pocket.every(Q=>fits(Q.outer)))throw Error('The cutout runs into the rounded corners. Reduce the corner roundness or enlarge the bin.');
  const cuts=[...pocket];let notches=0;
  if(o.notch){const long=iw>=id,c=long?iw/2:id/2;const hits=[];for(const Q of pocket)for(let i=0,j=Q.outer.length-1;i<Q.outer.length;j=i++){const a=Q.outer[i],b=Q.outer[j],u=long?0:1,v=1-u;if((a[u]>c)!==(b[u]>c)){hits.push(a[v]+(c-a[u])*(b[v]-a[v])/(b[u]-a[u]));}}
   if(hits.length>=2){const lo=Math.min(...hits),hi=Math.max(...hits);for(const t of [lo,hi]){cuts.push(poly(long?T.circle(c,t,11,48):T.circle(t,c,11,48)));notches++;}}}
  solids.push({polys:inner,z0:0,z1:block});cavities.push({polys:T.unionPolys(cuts),z0:block-depth,z1:block+1});
  info.count=1;info.size=[+(B.w-2*fit).toFixed(1),+(B.h-2*fit).toFixed(1)];info.notches=notches;info.summary=`${o.outlineName?o.outlineName+' \u00b7 ':''}${info.size[0].toFixed(0)} \u00d7 ${info.size[1].toFixed(0)} mm cutout, +${fit.toFixed(1)} mm clearance, ${depth.toFixed(1)} mm deep${notches?', finger notches':''}`;return {solids,cavities,info};
 }
 if(o.kind==='tiers'){
  const steps=clamp(Math.round(o.steps),1,6),sh=clamp(o.a,4,60),depth=id/steps;if(depth<20)throw Error('Tier shelves would be shallower than 20 mm. Use fewer steps or a deeper bin.');let top=sh*steps;if(top>room-4){warnings.push(`Top step lowered to fit under the rim (${(room-4).toFixed(1)} mm).`);top=room-4;}const step=top/steps;if(step<3)throw Error('This bin is too short for a tiered riser. Use a taller bin.');
  const cut=i=>i<=0?-.5:i>=steps?id+.5:straightY(id*i/steps);for(let i=0;i<steps;i++)solids.push({polys:[poly(rect(-.5,cut(i),iw+.5,cut(i+1)))],z0:0,z1:step*(i+1)});info.count=steps;info.summary=`${steps} steps, ${step.toFixed(1)} mm rise, ${depth.toFixed(1)} mm deep`;return {solids,cavities,info};
 }
 if(o.kind==='pegs'){
  const d=clamp(o.a,3,30),pitch=d+clamp(o.web,4,80),h=clamp(o.pegH,6,200),cols=Math.floor((iw-2*m-d)/pitch)+1,rows=Math.floor((id-2*m-d)/pitch)+1;if(cols<1||rows<1||iw<d+2*m||id<d+2*m)throw Error(`A ${d.toFixed(1)} mm peg needs at least ${(d+2*m).toFixed(1)} mm inside this bin.`);
  const cap=cols*rows,count=o.count?Math.min(cap,Math.round(o.count)):cap;if(o.count>cap)warnings.push(`Only ${cap} of ${Math.round(o.count)} pegs fit; widen the bin or reduce spacing.`);
  const pegs=[],x0=(iw-(cols-1)*pitch)/2,y0=(id-(rows-1)*pitch)/2;for(let i=0;i<cols*rows&&pegs.length<count;i++){const L=shapeAt('circle',x0+(i%cols)*pitch,y0+Math.floor(i/cols)*pitch,d,d);if(fits(L))pegs.push(poly(L));}if(!pegs.length)throw Error(`No ${d.toFixed(1)} mm pegs fit inside these rounded corners. Reduce the corner radius or enlarge the bin.`);
  const placed=pegs.length;solids.push({polys:pegs,z0:0,z1:h});if(h>room)warnings.push(`Pegs rise ${(h-room).toFixed(1)} mm above the rim.`);if(h>headroom)warnings.push(`Pegs are ${(h-headroom).toFixed(1)} mm taller than the drawer clearance; the drawer may not close.`);
  info.count=placed;info.capacity=cap;info.summary=`${placed} pegs, ${d.toFixed(1)} mm \u00d7 ${h.toFixed(1)} mm tall`;return {solids,cavities,info};
 }
 if(o.kind==='cups'){
  // Upright cubbies: free-standing rounded walls rising from the bin floor (swabs, cotton rounds). Open around them.
  const a=clamp(o.a,8,160),b=clamp(o.b||o.a,8,160),t=clamp(o.t||2,1.2,6),web=clamp(o.web,2,80),h=clamp(o.pegH,6,250),ow=a+2*t,od=b+2*t;
  const cols=Math.floor((iw-2*m+web)/(ow+web)),rows=Math.floor((id-2*m+web)/(od+web)),cap=Math.max(0,cols)*Math.max(0,rows);
  if(cap<1)throw Error(`${o.name} needs at least ${(ow+2*m+2*wallHint).toFixed(0)} \u00d7 ${(od+2*m+2*wallHint).toFixed(0)} mm of bin; this bin is ${(iw+2*wallHint).toFixed(0)} \u00d7 ${(id+2*wallHint).toFixed(0)} mm. Merge bins, enlarge the bin or reduce the cubby size.`);
  const count=o.count?Math.min(cap,Math.round(o.count)):cap;if(o.count>cap)warnings.push(`Only ${cap} of ${Math.round(o.count)} fit in this bin; widen it or reduce spacing.`);
  const nc=Math.min(cols,count),nr=Math.ceil(count/nc),x0=(iw-(nc*ow+(nc-1)*web))/2,y0=(id-(nr*od+(nr-1)*web))/2,rings=[];
  const shapeOf=(cx,cy,sx,sy)=>o.shape==='circle'?T.circle(cx,cy,sx/2,segs(sx)):rect(cx-sx/2,cy-sy/2,cx+sx/2,cy+sy/2,Math.min(sx,sy)*.32);
  const places=[];for(let k=0;k<count;k++){const cx=x0+(k%nc)*(ow+web)+ow/2,cy=y0+Math.floor(k/nc)*(od+web)+od/2,L=shapeOf(cx,cy,ow,od);if(!fits(L))continue;rings.push({outer:L,holes:[shapeOf(cx,cy,a,b).slice().reverse()]});places.push({x:cx,y:cy,w:a,d:b,z:0,h,round:o.shape==='circle'});}info.places=places;
  if(!rings.length)throw Error(`${o.name} does not fit inside these rounded corners. Reduce the corner radius or enlarge the bin.`);
  solids.push({polys:rings,z0:0,z1:h});if(h>headroom)warnings.push(`The cubby walls are ${(h-headroom).toFixed(1)} mm taller than the drawer clearance; lower them.`);
  if(o.itemH&&o.itemH>headroom)warnings.push(`Items standing upright are ${(o.itemH-headroom).toFixed(1)} mm taller than the drawer clearance; the drawer may not close. Use the lying-flat tray or a deeper drawer.`);
  info.count=rings.length;info.capacity=cap;info.summary=`${rings.length} ${o.shape==='circle'?'round':'rounded-square'} cubb${rings.length===1?'y':'ies'}, ${a.toFixed(0)}${o.shape==='circle'?' mm across':` \u00d7 ${b.toFixed(0)} mm inside`}, walls ${h.toFixed(1)} mm tall`;return {solids,cavities,info};
 }
 if(o.kind==='brush'){
  // Toothbrush cradles: the brush lies on its back in a cutout traced from its top-down outline. Three stepped
  // depths make a rounded trough (narrower toward the bottom) so the handle can't roll; prints without supports.
  const B=BRUSHES[clamp(Math.round(o.model||0),0,BRUSHES.length-1)],fit=clamp(o.fit,0,4),web=clamp(o.web,2,60);
  const maxW=Math.max(...B.profile.map(q=>q[1])),pitch=maxW+2*fit,long=iw>=id,LL=(long?iw:id)-2*m,SS=(long?id:iw)-2*m;
  if(B.length+2*fit>LL+1e-6)throw Error(`The ${B.name} is ${B.length} mm long; this bin fits ${(LL-2*fit).toFixed(0)} mm. The bin needs at least ${(B.length+2*fit+2*m+2*wallHint).toFixed(0)} mm of length: merge bins or widen the column.`);
  const cap=Math.floor((SS+web)/(pitch+web));if(cap<1)throw Error(`A ${B.name} cradle needs at least ${(pitch+2*m+2*wallHint).toFixed(0)} mm of bin width; this bin has ${((long?id:iw)+2*wallHint).toFixed(0)} mm.`);
  const count=o.count?Math.min(cap,Math.round(o.count)):cap;if(o.count>cap)warnings.push(`Only ${cap} of ${Math.round(o.count)} toothbrushes fit side by side; widen the bin.`);
  const th=B.thick,dFull=th*.34,dMid=th*.46,dLow=th*.56,blockH=clamp(Math.min(room,dLow+2.4),3,room),need=dLow+1.2;if(blockH<need)throw Error('This bin is too short for toothbrush cradles. Use a taller bin.');
  const top=blockH-dLow+th;if(top>headroom)warnings.push(`The toothbrush sits ${(top-headroom).toFixed(1)} mm above the drawer clearance; the drawer may not close.`);
  const outline=(scale)=>{const up=B.profile.map(([x,w])=>[x,w*scale/2]),pts=up.concat(up.slice().reverse().map(([x,y])=>[x,-y]));return T.unionPolys([poly(pts)]);};
  const place=(polys,j)=>{const off=-(count-1)*(pitch+web)/2+j*(pitch+web),L=(long?iw:id),x0=(L-B.length)/2;return xform(polys,([x,y])=>long?[x0+x,id/2+off+y]:[iw/2+off-y,x0+x]);};
  const full=[],mid=[],low=[],notchC=[],ends=[];
  for(let j=0;j<count;j++){
   const F=T.offset(outline(1),fit,true),Mi=T.offset(outline(.78),fit*.5,true),Lo=outline(.5);full.push(...place(F,j));mid.push(...place(Mi,j));low.push(...place(Lo,j));
   if(o.notch!==0){const xh=B.handle*.55,w2=B.at(xh)/2+fit;notchC.push(...place([poly(T.circle(xh,w2,8.5,40)),poly(T.circle(xh,-w2,8.5,40))],j));}
  }
  const notches=notchC.length?T.interPolys(T.unionPolys(notchC),[poly(rect(m+.5,m+.5,iw-m-.5,id-m-.5))]):[];
  const cutsFull=T.unionPolys(full.concat(notches));if(!cutsFull.every(Q=>fits(Q.outer)))throw Error('The toothbrush cutout runs into the rounded corners. Reduce the corner roundness or enlarge the bin.');
  solids.push({polys:inner,z0:0,z1:blockH});cavities.push({polys:T.unionPolys(low),z0:blockH-dLow,z1:blockH+1},{polys:T.unionPolys(mid),z0:blockH-dMid,z1:blockH+1},{polys:cutsFull,z0:blockH-dFull,z1:blockH+1});
  info.innerW=iw;info.innerD=id;  info.ghost={model:BRUSHES.indexOf(B),z0:blockH-dLow,long,x0:((long?iw:id)-B.length)/2,offs:Array.from({length:count},(_,j)=>-(count-1)*(pitch+web)/2+j*(pitch+web))};
  info.model=B.id;info.modelName=B.name;info.count=count;info.capacity=cap;info.summary=`${count} \u00d7 ${B.name} (${B.length} mm long, handle ${maxW.toFixed(0)} mm), +${fit.toFixed(1)} mm fit, ${dLow.toFixed(1)} mm deep cradle`;return {solids,cavities,info};
 }
 if(o.kind==='bladebank'){
  // A pocket that holds the separate blade bank upright so it can't slide; the bank body and lid export as extra parts.
  const K=BLADES[clamp(Math.round(o.blade||0),0,BLADES.length-1)],dims=bankDims(K),fit=clamp(o.fit,0,3),depth=Math.min(10,room-1.6),blockH=Math.min(room,depth+2);
  if(depth<4)throw Error('This bin is too short to hold the blade bank. Use a taller bin.');
  const rot=iw<id,sx=(rot?dims.D:dims.W)+2*fit,sy=(rot?dims.W:dims.D)+2*fit;if(sx>iw-2*m+1e-6||sy>id-2*m+1e-6)throw Error(`The blade bank needs at least ${(dims.W+2*fit+2*m+2*wallHint).toFixed(0)} \u00d7 ${(dims.D+2*fit+2*m+2*wallHint).toFixed(0)} mm of bin; this bin is ${(iw+2*wallHint).toFixed(0)} \u00d7 ${(id+2*wallHint).toFixed(0)} mm.`);
  const L=rect(iw/2-sx/2,id/2-sy/2,iw/2+sx/2,id/2+sy/2,dims.r+fit);if(!fits(L))throw Error('The blade bank runs into the rounded corners. Reduce the corner roundness or enlarge the bin.');
  const finger=[poly(T.circle(iw/2,id/2+sy/2,8,40)),poly(T.circle(iw/2,id/2-sy/2,8,40))].filter(P=>fits(P.outer));
  solids.push({polys:inner,z0:0,z1:blockH});cavities.push({polys:T.unionPolys([poly(L),...finger]),z0:blockH-depth,z1:blockH+1});
  const avail=headroom-(blockH-depth)-.5,H=clamp(o.pegH>0?o.pegH:Math.min(70,avail),30,avail<30?30:avail);if(avail<30)warnings.push('The drawer is too shallow for a 30 mm blade bank standing in this bin; it will stick out.');
  info.bank={blade:K.id,cx:iw/2,cy:id/2,z0:blockH-depth,rot,height:H};info.count=1;info.summary=`${K.name} slot (${K.slot[0]} \u00d7 ${K.slot[1]} mm), bank ${dims.W.toFixed(0)} \u00d7 ${dims.D.toFixed(0)} \u00d7 ${H.toFixed(0)} mm, snap lid`;return {solids,cavities,info};
 }
 const block=clamp(Math.min(o.block,room),2,room);if(o.block>room+1e-6)warnings.push(`Insert lowered to the bin rim (${room.toFixed(1)} mm).`);
 const depth=clamp(Math.min(o.depth,block-(o.kind==='label'?1:.6)),.6,block);
 if(o.kind==='label'){
  const ledge=clamp(o.web,6,30),slot=clamp(o.a,.6,4);if(id<ledge+20)throw Error('This bin is too shallow for a label ledge.');const lx0=R>0?R+1:-.5,lx1=R>0?iw-R-1:iw+.5;if(lx1-lx0<30)throw Error('Corners are too rounded for a label ledge. Reduce the corner radius or widen the bin.');solids.push({polys:[poly(rect(lx0,-.5,lx1,ledge))],z0:0,z1:block});cavities.push({polys:[poly(rect(Math.max(lx0,0)+m+2,ledge/2-slot/2,Math.min(lx1,iw)-m-2,ledge/2+slot/2))],z0:block-depth,z1:block+1});info.count=1;info.summary=`${slot.toFixed(1)} mm label slot, ${depth.toFixed(1)} mm deep`;return {solids,cavities,info};
 }
 if(o.kind==='channels'){
  const w=clamp(o.a,4,60),web=clamp(o.web,1.6,30),long=iw>=id,L=(long?iw:id)-2*m,S=(long?id:iw)-2*m,cap=Math.floor((S+web)/(w+web));if(cap<1||L<30)throw Error(`A ${w.toFixed(1)} mm lane needs at least ${(w+2*m).toFixed(1)} \u00d7 ${(30+2*m).toFixed(1)} mm inside this bin.`);
  const count=o.count?Math.min(cap,Math.round(o.count)):cap;if(o.count>cap)warnings.push(`Only ${cap} lanes fit.`);const start=m+(S-count*w-(count-1)*web)/2,lanes=[],places=[];
  for(let i=0;i<count;i++){const a=start+i*(w+web)+w/2;if(long){const [x0,x1]=spanX(a-w/2,a+w/2);if(x1-x0>=30){lanes.push(poly(shapeAt('stadium',(x0+x1)/2,a,x1-x0,w)));places.push({x:(x0+x1)/2,y:a,w:x1-x0,d:w,z:block-depth,long:true});}}else{const lane=shapeAt('stadium',a,id/2,w,L);let k=0;while(!fits(lane.map(q=>[q[0],id/2+(q[1]-id/2)*(1-k/100)]))&&k<70)k++;const L2=lane.map(q=>[q[0],id/2+(q[1]-id/2)*(1-k/100)]);if(k<70){lanes.push(poly(L2));places.push({x:a,y:id/2,w,d:L*(1-k/100),z:block-depth,long:false});}}}info.places=places;if(!lanes.length)throw Error('No lanes fit inside these rounded corners. Reduce the corner radius or enlarge the bin.');
  solids.push({polys:inner,z0:0,z1:block});cavities.push({polys:lanes,z0:block-depth,z1:block+1});info.count=lanes.length;info.capacity=cap;info.summary=`${lanes.length} lanes, ${w.toFixed(1)} mm wide \u00d7 ${L.toFixed(1)} mm long, ${depth.toFixed(1)} mm deep`;return {solids,cavities,info};
 }
 // Pockets. Graded sets place one size per column; otherwise choose the orientation that fits more.
 const fit=clamp(o.fit,0,4),web=clamp(o.web,1.2,80),shape=o.shape;let sizes,orient=null;
 const dims=(sx,sy)=>[sx,sy];let sx,sy;
 if(o.sizes){sizes=o.sizes.map(s=>s+fit);}else{
  const A=o.full?iw-2*m-(shape==='stadium'?0:0):o.a+fit,B=(o.b||o.a)+fit;
  if(shape==='rect'||shape==='stadium'){const a1=o.full?iw-2*m:A,b1=B,cap1=Math.floor((iw-2*m+web)/(a1+web))*Math.floor((id-2*m+web)/(b1+web)),a2=o.full?id-2*m:A,cap2=o.full?0:Math.floor((iw-2*m+web)/(B+web))*Math.floor((id-2*m+web)/(A+web));
   if(o.full){[sx,sy]=[a1,b1];}else if(cap2>cap1){[sx,sy]=[B,A];orient='rotated';}else[sx,sy]=[A,B];}
  else[sx,sy]=footprint(shape,A);
 }
 const pockets=[],notches=[],places=[];let count=0,cap=0;
 if(sizes){
  const fp=sizes.map(s=>footprint(shape,s)),colW=[],rowsPer=[];let used=0,cols=0;for(const [w]of fp){if(used+w+(cols?web:0)>iw-2*m+1e-9)break;used+=w+(cols?web:0);cols++;}
  if(!cols)throw Error(`The smallest ${o.name.toLowerCase()} pocket needs at least ${(fp[0][0]+2*m).toFixed(1)} mm inside this bin.`);if(cols<sizes.length)warnings.push(`Only ${cols} of ${sizes.length} sizes fit across; widen the bin for the rest.`);
  let x=m+(iw-2*m-used)/2;for(let c=0;c<cols;c++){const [w,h]=fp[c],rows=Math.max(0,Math.floor((id-2*m+web)/(h+web))),want=o.count?Math.max(1,Math.round(o.count)):rows,n=Math.min(rows,want);if(!rows)throw Error(`A ${sizes[c].toFixed(1)} mm pocket needs at least ${(h+2*m).toFixed(1)} mm of bin depth.`);const y0=(id-(n*h+(n-1)*web))/2;const ys=[];for(let r=0;r<n;r++){const L=shapeAt(shape,x+w/2,y0+r*(h+web)+h/2,shape==='hex'?sizes[c]:w,h,o.radius);if(fits(L)){pockets.push(poly(L));ys.push(y0+r*(h+web)+h/2);places.push({x:x+w/2,y:y0+r*(h+web)+h/2,w:(shape==='hex'?sizes[c]:w)-fit,d:h-fit,z:block-depth,depth,size:sizes[c],col:c});}}count+=ys.length;cap+=rows;if(o.notch&&ys.length>1){const cx=x+w/2,hw=shape==='circle'?notchHalf(w,Math.min(w*.21,7),true):Math.min(w*.21,7),ya=ys[0],yb=ys.at(-1);if(hw)notches.push(poly([[cx-hw,ya],[cx+hw,ya],[cx+hw,yb],[cx-hw,yb]]));}x+=w+web;}
  if(o.count>Math.floor(cap/cols))warnings.push(`Only ${Math.floor(cap/cols)} per size fit along the bin.`);
 }else{
  const fw=shape==='hex'?sx:sx,fh=sy,cols=Math.floor((iw-2*m+web)/(fw+web)),rows=Math.floor((id-2*m+web)/(fh+web));cap=Math.max(0,cols)*Math.max(0,rows);
  if(cap<1)throw Error(`${o.name} needs at least ${(fw+2*m).toFixed(1)} \u00d7 ${(fh+2*m).toFixed(1)} mm inside; this bin has ${iw.toFixed(1)} \u00d7 ${id.toFixed(1)} mm. Enlarge or merge bins, or reduce the item size.`);
  count=o.count?Math.min(cap,Math.round(o.count)):cap;if(o.count>cap)warnings.push(`Only ${cap} of ${Math.round(o.count)} fit in this bin; widen it or reduce spacing.`);
  // Candidate grid, then drop positions that would cut into rounded corners.
  const footSize=shape==='hex'?o.a+fit:sx,x0=(iw-(cols*fw+(cols-1)*web))/2+fw/2,y0=(id-(rows*fh+(rows-1)*web))/2+fh/2,rowsUsed=new Map();
  const full=o.full;let placed=0;for(let r=0;r<rows&&placed<count;r++)for(let c=0;c<cols&&placed<count;c++){const cx=x0+c*(fw+web),cy=y0+r*(fh+web);let L=shapeAt(shape,cx,cy,footSize,fh,o.radius);
   if(full&&!fits(L)){const [a,b]=spanX(cy-fh/2,cy+fh/2);if(b-a<20)continue;L=shapeAt(shape,(a+b)/2,cy,b-a,fh,o.radius);}
   if(!fits(L))continue;pockets.push(poly(L));placed++;places.push({x:cx,y:cy,w:full?Math.min(fw,iw-2*m):fw-fit,d:fh-fit,z:block-depth,depth});if(!rowsUsed.has(r))rowsUsed.set(r,[]);rowsUsed.get(r).push(cx);}
  if(!placed)throw Error(`${o.name} does not fit inside these rounded corners. Reduce the corner radius or enlarge the bin.`);if(placed<count&&!o.count)cap=placed;if(placed<count&&o.count)warnings.push(`Rounded corners leave room for ${placed} of ${count}.`);count=placed;
  if(o.notch)for(const [r,xs]of rowsUsed){const cy=y0+r*(fh+web),xa=Math.min(...xs),xb=Math.max(...xs);if(shape==='circle'){const hw=notchHalf(footSize,Math.min(fh*.21,7),false);if(xs.length>1&&hw)notches.push(poly([[xa,cy-hw],[xb,cy-hw],[xb,cy+hw],[xa,cy+hw]]));}else{const hw=Math.min(fh*.21,7),[a,b]=spanX(cy-hw,cy+hw);notches.push(poly(rect(Math.max(a,xa-fw/2-m-.01),cy-hw,Math.min(b,xb+fw/2+m+.01),cy+hw)));}}
 }
 solids.push({polys:inner,z0:0,z1:block});cavities.push({polys:T.unionPolys(pockets),z0:block-depth,z1:block+1});if(notches.length)cavities.push({polys:T.unionPolys(notches),z0:block-Math.max(depth*.55,Math.min(depth,2.2)),z1:block+1});
 if(o.itemH){const top=block-depth+o.itemH;if(top>headroom)warnings.push(`Items stand ${(top-headroom).toFixed(1)} mm taller than the drawer clearance; the drawer may not close. Use a deeper insert or lay them flat.`);}
 if(o.full&&count)info.slots=count;if(places.length)info.places=places;info.count=count;info.capacity=cap;info.orient=orient;info.summary=`${count} ${o.sizes?'graded ':''}pocket${count===1?'':'s'}, ${depth.toFixed(1)} mm deep in a ${block.toFixed(1)} mm insert${fit?`, +${fit.toFixed(1)} mm fit`:''}`;
 return {solids,cavities,info};
}
// Bin + insert as one closed solid: interval slices between every feature height.
function insertLayers(outer,ring,wall,floor,h,p){
 const shift=polys=>polys.map(P=>({outer:P.outer.map(([x,y])=>[x+wall,y+wall]),holes:P.holes.map(H=>H.map(([x,y])=>[x+wall,y+wall]))})),S=p.solids.map(s=>({...s,polys:shift(s.polys)})),Cv=p.cavities.map(s=>({...s,polys:shift(s.polys)}));
 const top=Math.max(h,...S.map(s=>floor+s.z1)),zs=[...new Set([floor,h,top,...S.flatMap(s=>[floor+s.z0,floor+s.z1]),...Cv.flatMap(c=>[floor+c.z0,Math.min(top,floor+c.z1)])].map(z=>Math.round(clamp(z,floor,top)*1e5)/1e5))].sort((a,b)=>a-b);
 const innerClip=[{outer:ring[0].holes[0].slice().reverse(),holes:[]}],layers=[{z0:0,z1:floor,polys:[poly(outer)]}];
 for(let i=0;i<zs.length-1;i++){const a=zs[i],b=zs[i+1],mid=(a+b)/2;const act=S.filter(s=>floor+s.z0<mid&&floor+s.z1>mid).flatMap(s=>s.polys),cut=Cv.filter(c=>floor+c.z0<mid&&floor+c.z1>mid).flatMap(c=>c.polys);let fill=act.length?T.interPolys(T.unionPolys(act),innerClip):[];if(cut.length&&fill.length)fill=T.diffPolys(fill,cut);
  const polys=(b<=h+1e-9?ring:[]).concat(fill);if(polys.length)layers.push({z0:a,z1:b,polys});}
 return layers;
}
function insertBin(w,d,h,wall,floor,radius,ins,headroom,innerRadius,extra={}){
 const BF=G.GPBinFeatures;const innerR=BF&&BF.clampInnerRadius?BF.clampInnerRadius(innerRadius,w,d,wall,radius):Math.min(Math.max(0,innerRadius==null?Math.max(0,radius-wall):+innerRadius),Math.max(0,Math.min(w-2*wall,d-2*wall)/2-.01));
 const outer=T.roundRect(0,0,w,d,radius,32),inner=T.roundRect(wall,wall,w-wall,d-wall,innerR,32),ring=[{outer,holes:[inner.slice().reverse()]}],p=plan(ins,w-2*wall,d-2*wall,h-floor,headroom-floor,innerR,wall);
 const layers=insertLayers(outer,ring,wall,floor,h,p),DX=G.GPDrawerX||(typeof require==='function'?require('./drawer-extras'):null);let front=null;
 // Front-wall label text: the bin's top band is solid wall above any insert block, so cut it in the band above the floor.
 if(extra.frontLabel&&extra.frontLabel!=='none'&&DX)front=DX.frontLabel(layers,{w,d,radius,wall,zLow:floor+1.5,zHigh:h-2,text:extra.frontText,style:extra.frontLabel});
 let mesh=T.steppedExtrude(layers);for(let i=0;i<mesh.length;i++)mesh[i]=Math.round(mesh[i]*1e5)/1e5;
 if(!C.checkClosed(mesh).closed&&C.fixTJunctions){for(const tol of [1e-4,1e-3,5e-3,2e-2]){mesh=Float64Array.from(C.fixTJunctions(mesh,new Array(mesh.length/9).fill(0),tol).p);if(C.checkClosed(mesh).closed)break;}}
 if(!C.checkClosed(mesh).closed&&MD&&MD.repair)mesh=MD.repair(mesh,{}).p;
 if(!C.checkClosed(mesh).closed)throw Error(`${p.info.name} could not form a closed solid in this bin. Adjust its size or spacing slightly and try again.`);if(front)p.info.front=front;return {mesh,info:p.info};
}
function preview(id,iw=96,ih=72){const p=plan({id},iw,ih,30);return p;}
/* A removable-divider object is a plain bin with slotted walls (and optional drop-in cups), so it keeps every bin
 * extra: nx plates front to back (at x positions), ny plates left to right (at y positions); both = interlocking grid. */
function removableStyle(ins){const q=spec(ins),nx=clamp(Math.round(q.nx||0),0,8),ny=clamp(Math.round(q.ny||0),0,8);if(!nx&&!ny)throw Error('Add at least one removable divider across or along the bin.');
 return {slots:nx&&ny?'grid':nx?'along':'across',slotCount:ny||nx,slotCountY:nx||1,slotT:clamp(q.t||1.6,1.2,3),slotH:clamp(q.hFrac||1,.2,1),cups:q.cups?1:0,slotTab:q.tab?1:0,name:q.name,item:q.item,id:q.id,category:q.cat};}
const api={removableStyle,LIB,CATEGORIES,CONTROLS,byId,spec,plan,insertLayers,insertBin,preview,BRUSHES,BLADES,BANK,bankDims,bladeBank,ghostBrush};if(typeof module!=='undefined'&&module.exports)module.exports=api;else G.GPInserts=api;
})(typeof globalThis!=='undefined'?globalThis:this);
