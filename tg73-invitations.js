/* Tem Gogo V7.3 -- estado de convite local, testavel sem Supabase. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TG73_INVITES=api;})(typeof window!=='undefined'?window:null,function(){'use strict';
  const KEY='tem-gogo-pending-room';
  function normalizeRoom(value){return String(value||'').trim().toUpperCase().replace(/[^A-F0-9]/g,'').slice(0,12);}
  function validRoom(code){return /^(?:[A-F0-9]{8}|[A-F0-9]{12})$/.test(String(code||''));}
  function remember(storage,raw){const code=normalizeRoom(raw);if(validRoom(code))storage.setItem(KEY,code);return code;}
  function forget(storage,expected){const previous=normalizeRoom(storage.getItem(KEY));if(!expected||previous===normalizeRoom(expected))storage.removeItem(KEY);}
  function initial({linkRoom,savedRoom,recoveryIntent=false,remoteIntent=false}={}){
    if(recoveryIntent||remoteIntent)return null;
    const link=normalizeRoom(linkRoom),saved=normalizeRoom(savedRoom);
    return validRoom(link)?link:(validRoom(saved)?saved:null);
  }
  return Object.freeze({normalizeRoom,validRoom,remember,forget,initial,KEY});
});
