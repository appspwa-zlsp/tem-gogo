/* Captura dedicada antes de bibliotecas externas; não persiste o token. */
(function(){'use strict';const m=/^#tg115-invite=([0-9a-f]{64})$/.exec(location.hash);if(!m)return;let t=m[1];try{const u=new URL(location.href);u.hash='';history.replaceState(history.state,'',u.href);}catch{return;}Object.defineProperty(window,'TG115_TAKE_INVITE',{value:()=>{const v=t;t=null;return v;}});})();
