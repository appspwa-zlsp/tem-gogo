/* Tem Gogo V7.3 - Contrato de integracao, desativado por design.
 * SQL 04-12: funcoes privadas, sem EXECUTE para anon/authenticated.
 * NUNCA chamar tg_battle_internal diretamente pelo navegador. */
(function(){'use strict';
 const STATUS=Object.freeze({stage:'aguardando_gateway_seguro',enabled:false,publicAccess:false,sqlConfirmedThrough:'12'});
 function unavailable(){return Object.freeze({ok:false,reason:'BATALHA_EM_PREPARACAO',message:'A Batalha esta em preparacao. O Modo Classico continua disponivel.'});}
 Object.defineProperty(window,'TG_BATTLE_INTEGRATION',{value:Object.freeze({status:STATUS,create:unavailable,join:unavailable,vote:unavailable,control:unavailable}),writable:false,configurable:false});
})();
