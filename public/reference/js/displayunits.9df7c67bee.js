/* Display conversion only. STL/3MF and all generator parameters remain millimeters. */
(function(G){'use strict';
// Two choices in the app: Metric (mm) and Imperial (inches). 'cm' stays readable for old saved settings but is never offered.
const MODES=['mm','cm','imperial'],CHOICES=['mm','imperial'];
const factor=mode=>mode==='imperial'?25.4:mode==='cm'?10:1;
const unitLabel=mode=>mode==='imperial'?'in':mode==='cm'?'cm':'mm';
function initial(locale,stored){
 if(CHOICES.includes(stored))return stored;
 // Legacy persisted values: the old mm/imperial toggle and the removed cm choice.
 if(stored==='metric'||stored==='cm')return 'mm';
 try{return new Intl.Locale(locale||'').region==='US'?'imperial':'mm';}catch(_){return /[-_]US(?:-|$)/i.test(locale||'')?'imperial':'mm';}
}
function decimals(mm,mode,fine){if(mode==='imperial')return fine||Math.abs(mm)<10?3:2;if(mode==='cm')return fine||Math.abs(mm)<100?2:1;return fine||Math.abs(mm)<10?2:1;}
function number(mm,mode,fine=false){return String(+(mm/factor(mode)).toFixed(decimals(mm,mode,fine)));}
// Metric reads in mm, switching to cm for long sizes (1 m and up), where a string of digits is harder to read. Inputs stay in mm.
const readable=(mm,mode)=>mode==='mm'&&Math.abs(mm)>=1000?'cm':mode;
function text(mm,mode,fine=false){const m=fine?mode:readable(mm,mode);return number(mm,m,fine)+' '+unitLabel(m);}
function dimensions(values,mode){const m=readable(Math.max(0,...values.map(Math.abs)),mode);return values.map(v=>number(v,m)).join(' \u00d7 ')+' '+unitLabel(m);}
const api={MODES,CHOICES,factor,unitLabel,initial,number,text,dimensions,decimals};if(typeof module!=='undefined'&&module.exports)module.exports=api;else G.GPDisplayUnits=api;
})(typeof globalThis!=='undefined'?globalThis:this);
