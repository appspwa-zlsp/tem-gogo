/* C06: telemetria experimental 1 Hz, sem áudio, sem efeito sobre nota oficial. */
(function(root){'use strict';
const VERSION='shadow-v2.1', PERIOD=1000, SEND=6000, LIMIT=7200;
const metrics=()=>({frames:0,periodic:0,clipped:0,intensity_milli:0,confidence_milli:0});
function make(profile,capture){return {profile:root.TG30Voice.normalize(profile),capture,lastAt:null,lastAttempt:-Infinity,noise:.002,metrics:metrics(),acked:0,seq:0,pending:null,busy:null,disabled:false};}
function add(a,measurement,now){
 if(a.disabled||!Number.isFinite(now)||a.metrics.frames>=LIMIT||(a.lastAt!==null&&now-a.lastAt<PERIOD)||!measurement||!Number.isFinite(measurement.rms)||measurement.rms<0)return false;
 a.lastAt=now; const m=a.metrics; m.frames++;
 if(measurement.clipped){m.clipped++;return true;}
 const periodic=Number.isFinite(measurement.frequency)&&measurement.frequency>=55&&measurement.frequency<=1000&&measurement.confidence>=.82;
 if(!periodic){a.noise=Math.max(.001,Math.min(.06,a.noise*.95+Math.min(.06,measurement.rms)*.05));return true;}
 // Margem em relação ao piso estimado; compressão logarítmica reduz vantagem de ganho alto.
 const snr=20*Math.log10(Math.max(measurement.rms,.0001)/Math.max(a.noise,.001));
 if(snr<6)return true;
 m.periodic++;m.intensity_milli+=Math.round(1000*Math.min(1,Math.max(0,(snr-6)/24)));
 m.confidence_milli+=Math.round(1000*Math.min(1,Math.max(0,measurement.confidence)));
 return true;
}
function sample(a,analyser,sr,now){if(!a||!analyser||a.disabled||(a.lastAt!==null&&now-a.lastAt<PERIOD))return false;try{const x=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(x);return add(a,root.TG30Voice.analyze(x,sr,a.profile),now);}catch{return false;}}
function payload(a){if(a.pending)return a.pending;if(a.metrics.frames<=a.acked)return null;return a.pending=Object.freeze({p_capture:a.capture,p_seq:a.seq+1,p_profile:Object.freeze({category:a.profile.category,position:a.profile.position}),p_metrics:Object.freeze({...a.metrics})});}
async function sync(a,send,now,force=false){
 if(!a||a.disabled)return false;if(a.busy)return a.busy;if(!force&&now-a.lastAttempt<SEND)return false;
 const p=payload(a);if(!p)return true;a.lastAttempt=now;
 a.busy=(async()=>{try{const r=await send(p);if(r?.accepted!==true||r.seq!==p.p_seq)throw Error('Confirmação experimental inválida');a.seq=p.p_seq;a.acked=p.p_metrics.frames;a.pending=null;return true;}catch(e){if(['42501','22023'].includes(e?.code)||e?.code==='PGRST202')a.disabled=true;return false;}})();
 try{return await a.busy;}finally{a.busy=null;}
}
const api={VERSION,make,add,sample,payload,sync};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TG30VoiceShadow=Object.freeze(api);
})(typeof window==='undefined'?globalThis:window);
