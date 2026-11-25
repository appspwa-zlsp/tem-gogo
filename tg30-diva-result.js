/* C30: decisão de feedback a partir de leituras oficiais; não calcula pontuação. */
(function(root){'use strict';
function decide(song,singers,submitted,rows){
 if(typeof song!=='string'||!song||!Array.isArray(singers)||singers.length<1||singers.length>4||new Set(singers).size!==singers.length||singers.some(x=>typeof x!=='string'||!x)||!Array.isArray(submitted)||!Array.isArray(rows))return null;
 const actual=rows.filter(x=>x?.song_id===song), ids=new Set(singers);
 const valid=x=>x&&ids.has(x.user_id)&&x.score!==null&&x.score!==''&&typeof x.score==='number'&&Number.isFinite(x.score)&&x.score>=0&&x.score<=100;
 if(actual.some(x=>!valid(x))||submitted.some(x=>!valid(x))||new Set(actual.map(x=>x.user_id)).size!==actual.length||new Set(submitted.map(x=>x.user_id)).size!==submitted.length||actual.length!==submitted.length||submitted.some(x=>!actual.some(y=>y.user_id===x.user_id&&y.score===x.score)))return null;
 return Object.freeze({event:actual.length?'avaliacao':'sem_sinal',praise:actual.length===singers.length&&actual.every(x=>x.score>=80),count:actual.length});
}
const api=Object.freeze({decide});if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TG30DivaResult=api;
})(typeof window==='undefined'?globalThis:window);
