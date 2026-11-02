/* All extension writes are serialized here, including writes from multiple side panels. */
importScripts('shared/core.js','sync-model.js');
const SITE='https://liuxing9931-gif.github.io/meu-brasil/';
let queue=Promise.resolve();
const empty=()=>({state:null,pending:[],conflicts:[],lastSync:null,source:'',prefs:{autoSpeak:false,rate:.85,voice:''}});
async function read(){return (await chrome.storage.local.get('falaSidepanel')).falaSidepanel||empty();}
async function write(bundle){await chrome.storage.local.set({falaSidepanel:bundle});return bundle;}
function isSite(tab){try{const u=new URL(tab.url);return u.origin===new URL(SITE).origin&&/^\/meu-brasil(?:\/|$)/.test(u.pathname);}catch{return false;}}
async function siteTab(){
 const matches=(await chrome.tabs.query({url:'https://liuxing9931-gif.github.io/*'})).filter(isSite);
 if(matches.length>1)throw Error('检测到多个 Fala 窗口。请只保留一个 Fala 网站或桌面应用窗口，再同步。');
 return matches[0]||chrome.tabs.create({url:SITE,active:false});
}
async function ready(tabId){
 for(let i=0;i<40;i++){
  const tab=await chrome.tabs.get(tabId);if(!isSite(tab))throw Error('同步页面已离开 Fala，请重试。');
  if(tab.status==='complete')return;
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw Error('Fala 页面加载超时，请手动打开网站后重试。');
}
async function sync(bundle){
 const tab=await siteTab();await ready(tab.id);
 await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',files:['sync-model.js','pwa-bridge.js']});
 const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:events=>{
  try{return {ok:true,value:window.FalaSidepanelBridge.sync(events)};}catch(e){return {ok:false,error:e.message};}
 },args:[bundle.pending]});
 if(!result?.result?.ok)throw Error(result?.result?.error||'无法读取 Fala 学习记录，请检查网站是否正常打开。');
 bundle=FalaSync.mergeSnapshot(bundle,result.result.value);bundle.source='Fala 网站';return write(bundle);
}
async function handle(message){
 let bundle=await read();
 switch(message.type){
  case 'READ':return bundle;
  case 'GRADE':
   if(!bundle.state)throw Error('请先同步或导入 Fala 收藏。');
   return write(FalaSync.queueGrade(bundle,message.cardId,message.grade,Date.now(),crypto.randomUUID(),message.expected));
  case 'ADD_CARD':{
   if(!bundle.state)throw Error('请先同步或导入 Fala 收藏。');
   const pt=String(message.pt||'').normalize('NFC').trim().toLocaleLowerCase('pt-BR'),zh=String(message.zh||'').trim(),en=String(message.en||'').trim();
   if(!pt||pt.length>60||!/[\p{L}]/u.test(pt)||(!zh&&!en)||zh.length>500||en.length>500)throw Error('请填写单词及至少一种释义。');
   const id='word:'+pt;if(bundle.state.cards.some(c=>c.id===id))return bundle;
   if(bundle.pending.length>=5000)throw Error('待同步记录已达上限，请先同步。');
   const now=Date.now(),event={kind:'add',eventId:crypto.randomUUID(),card:{id,pt,zh:zh||'【英文释义】'+en,en,type:'word',source:'侧栏生词本',created:now,due:now,started:false}};
   bundle.state=FalaSync.applyEvents(bundle.state,[event]).state;bundle.pending.push(event);return write(bundle);
  }
  case 'RESTORE':{
   if(bundle.pending.length)throw Error('还有未同步记录，请先同步或保留导出的备份。');
   const raw=message.backup;if(raw?.format!=='fala-sidepanel-backup-v1'||!Array.isArray(raw.bundle?.pending)||raw.bundle.pending.length>5000)throw Error('无效的侧栏备份。');
   const state=FalaSync.snapshot(raw.bundle.state),pending=raw.bundle.pending.map(FalaSync.validateEvent);
   return write({...empty(),state,pending,source:'侧栏备份'});
  }
  case 'PREFS':{
   const p=message.prefs||{};bundle.prefs={autoSpeak:!!p.autoSpeak,rate:[.5,.8,.85,1,1.5,2].includes(p.rate)?p.rate:.85,voice:typeof p.voice==='string'?p.voice.slice(0,300):''};return write(bundle);
  }
  case 'IMPORT':
   if(bundle.pending.length)throw Error('还有未同步评分，请先同步或导出侧栏备份，避免覆盖。');
   bundle.state=FalaSync.snapshot(message.state);bundle.lastSync=null;bundle.conflicts=[];bundle.source='导入的 Fala 备份';return write(bundle);
  case 'SYNC':return sync(bundle);
  case 'DISCARD_CONFLICTS':{
   const ids=new Set(bundle.conflicts.map(c=>c.eventId));bundle.pending=bundle.pending.filter(e=>!ids.has(e.eventId));bundle.conflicts=[];
   // Refetch the current website before allowing further reviews of the conflicted cards.
   await write(bundle);return sync(bundle);
  }
  case 'OPEN_SITE':{
   const matches=(await chrome.tabs.query({url:'https://liuxing9931-gif.github.io/*'})).filter(isSite);
   if(matches[0]){await chrome.tabs.update(matches[0].id,{active:true});await chrome.windows.update(matches[0].windowId,{focused:true});}
   else await chrome.tabs.create({url:SITE});return {opened:true};
  }
  default:throw Error('不支持的操作。');
 }
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id||!sender.url?.startsWith(chrome.runtime.getURL('')))return false;
 const task=queue.then(()=>handle(message));queue=task.catch(()=>{});
 task.then(value=>respond({ok:true,value}),e=>respond({ok:false,error:e.message||'操作未完成，请重试。'}));return true;
});
const enablePanel=()=>chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>{});
chrome.runtime.onInstalled.addListener(enablePanel);chrome.runtime.onStartup.addListener(enablePanel);enablePanel();
