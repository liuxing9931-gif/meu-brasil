/* Executed only by the extension in the permitted Fala page's MAIN world. */
(function(){
 'use strict';
 window.FalaSidepanelBridge={sync(events){
  if(location.origin!=='https://liuxing9931-gif.github.io'||!/^\/meu-brasil(?:\/|$)/.test(location.pathname))throw Error('只允许连接指定的 Fala 网站。');
  if(typeof state==='undefined'||typeof save!=='function'||state?.version!==1||!window.FalaCore||typeof render!=='function')throw Error('Fala 尚未加载完成，请打开网站后再同步。');
  const result=window.FalaSync.applyEvents(state,events);
  // Persist first; a quota/error must not acknowledge an unsaved review.
  if(events.length&&result.acknowledged.length){
   localStorage.setItem('fala-v1',JSON.stringify(result.state));state=result.state;
   if(['home','review','stats'].includes(route)){reviewCard=null;revealed=false;window.speechSynthesis?.cancel();render();}
  }
  return {state:window.FalaSync.snapshot(state),acknowledged:result.acknowledged,conflicts:result.conflicts};
 }};
})();
