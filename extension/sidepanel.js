'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const preview=!globalThis.chrome?.runtime?.id||new URLSearchParams(location.search).get('preview')==='1';
let bundle=preview?FalaDemo():null,filter='all',cardId=null,revealed=false,shownFingerprint='',busy=false,toastTimer;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3400);}
function tokenize(text){return text.split(/([\p{L}]+(?:[-’'][\p{L}]+)*)/u).map(t=>/\p{L}/u.test(t)?`<button class="word" data-word="${esc(t)}">${esc(t)}</button>`:esc(t)).join('');}
function stopSpeech(){window.speechSynthesis?.cancel();}
function speak(text){
 const synth=window.speechSynthesis;if(!synth){toast('浏览器不支持朗读。');return;}
 const choices=synth.getVoices().filter(v=>v.lang.toLowerCase()==='pt-br'),voice=choices.find(v=>v.voiceURI===bundle.prefs.voice)||choices[0];
 if(!voice){toast('没有可用的巴葡语音，请在设备安装 pt-BR 语音包。');return;}
 synth.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='pt-BR';u.voice=voice;u.rate=bundle.prefs.rate;
 u.onerror=e=>{if(!['canceled','interrupted'].includes(e.error))toast('朗读未成功，请检查设备语音。');};synth.speak(u);
}
function category(card){return card.type==='sentence'?'sentence':/[\s]/u.test(card.pt.trim())?'phrase':'word';}
function today(){const key=FalaCore.dayKey();return bundle.state?.days[key]||{seconds:0,newIds:[],reviewIds:[],ratings:0};}
function eligible(){if(!bundle?.state)return [];const s=bundle.state,blocked=new Set(bundle.conflicts.map(c=>c.cardId));return FalaCore.eligible(s.cards,s.settings,today(),null).filter(c=>!blocked.has(c.id)&&(filter==='all'||category(c)===filter));}
function current(){return eligible().find(c=>c.id===cardId)||null;}
async function request(type,payload={}){
 if(!preview){const response=await chrome.runtime.sendMessage({type,...payload});if(!response?.ok)throw Error(response?.error||'插件后台未响应，请重新打开侧栏。');return response.value;}
 switch(type){
  case 'READ':return bundle;
  case 'GRADE':return FalaSync.queueGrade(bundle,payload.cardId,payload.grade,Date.now(),crypto.randomUUID(),payload.expected);
  case 'PREFS':return {...bundle,prefs:payload.prefs};
  case 'ADD_CARD':{
   const pt=payload.pt.toLocaleLowerCase('pt-BR'),id='word:'+pt;if(bundle.state.cards.some(c=>c.id===id))return bundle;
   const now=Date.now(),event={kind:'add',eventId:crypto.randomUUID(),card:{id,pt,zh:payload.zh||'【英文释义】'+payload.en,en:payload.en,type:'word',source:'侧栏生词本',created:now,due:now,started:false}},out=JSON.parse(JSON.stringify(bundle));
   out.state=FalaSync.applyEvents(out.state,[event]).state;out.pending.push(event);return out;
  }
  default:throw Error('这是示例预览，不会连接或更改真实 Fala。');
 }
}
async function command(type,payload={}){
 if(busy)return null;busy=true;render();
 try{const value=await request(type,payload);if(value?.state!==undefined)bundle=value;return value;}
 catch(e){toast(e.message);return null;}finally{busy=false;render();}
}
function render(){
 if(!bundle)return;
 $('#preview-note').hidden=!preview;
 $('#sound-toggle').textContent=bundle.prefs.autoSpeak?'♫':'静音';$('#sound-toggle').classList.toggle('is-on',bundle.prefs.autoSpeak);$('#sound-toggle').setAttribute('aria-label',bundle.prefs.autoSpeak?'关闭自动朗读':'开启自动朗读');
 $('#daily-count').textContent=today().ratings;
 document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
 const list=eligible();let card=list.find(c=>c.id===cardId)||list[0]||null;
 if(card?.id!==cardId||card&&FalaSync.fingerprint(card)!==shownFingerprint){revealed=false;cardId=card?.id||null;shownFingerprint=card?FalaSync.fingerprint(card):'';}
 $('#queue-count').textContent=bundle.state?`当前可学 ${list.length} 张 · 收藏 ${bundle.state.cards.length} 张`:'尚未同步收藏';
 if(!bundle.state){
  $('#card-area').innerHTML='<section class="empty-state"><span class="eyebrow">LEVAR COM VOCÊ</span><h2>把收藏带在身边。</h2><p>从同一个 Chrome 里的 Fala 同步，<br>或导入已有学习备份。</p><button class="primary" data-action="sync">从 Fala 同步</button><p><button class="text-button" data-action="settings">导入备份 / 设置</button></p></section>';
 }else if(!card){
  $('#card-area').innerHTML=`<section class="empty-state"><span class="eyebrow">UM PASSO DE CADA VEZ</span><h2>${bundle.state.cards.length?'这一轮，完成啦。':'从一句喜欢的葡语开始。'}</h2><p>${bundle.conflicts.length?'有待处理的同步冲突，请到设置中查看。':bundle.state.cards.length?'当前分类没有到期卡片，或已达今日上限。稍后回来也可以。':'在 Fala 收藏单词或句子，再同步到侧栏。'}</p><button class="secondary" data-action="settings">同步与设置</button></section>`;
 }else{
  $('#card-area').innerHTML=`<article class="flashcard"><div class="card-top"><span>${esc(card.source)}</span><span class="pill">${card.started?'到期复习':'新卡学习'}</span></div><div class="card-content"><span class="prompt">用葡语怎么说？</span><h2>${esc(card.zh||card.en)}</h2>${revealed?`<div class="answer"><div class="portuguese" lang="pt-BR">${tokenize(card.pt)}</div><p class="en" lang="en">${esc(card.en)}</p><button class="listen-button" data-speak="${esc(card.pt)}">♫ 听这一句</button></div>`:'<p class="hint">先想一想，再看答案。<br>一点点，也是在向前。</p>'}</div>${!revealed?'<div class="reveal-wrap"><button class="primary" data-action="reveal">显示葡语答案 <span>→</span></button></div>':''}<div class="ratings">${[['again','忘记了'],['hard','有点难'],['good','记住了'],['easy','很轻松']].map(([g,label])=>`<button class="rating ${g}" data-grade="${g}" ${!revealed||busy?'disabled':''}>${label}<small>${g==='again'?'1 分钟':FalaCore.schedule(card,g).interval+' 天'}</small></button>`).join('')}</div></article>`;
 }
 const source=preview?'示例数据 · 操作仅在预览内生效':bundle.conflicts.length?`${bundle.conflicts.length} 条冲突待处理`:bundle.pending.length?`本地已保存 · ${bundle.pending.length} 条待同步`:bundle.lastSync?'上次同步 '+new Date(bundle.lastSync).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):bundle.state?'备份已导入 · 尚未与 Fala 同步':'仅在本机保存';
 $('#sync-line').innerHTML=`<i class="status-dot"></i><span>${esc(source)}</span>`;
 $('#sync-button').textContent=busy?'正在处理…':'↻ 从 Fala 同步';$('#sync-button').disabled=busy;
}
function modal(html){$('#modal-content').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();}
function voices(){return window.speechSynthesis?.getVoices().filter(v=>v.lang.toLowerCase()==='pt-br')||[];}
function settings(){
 if(!bundle)return;
 const prefs=bundle.prefs;
 modal(`<h2>同步与设置</h2>${preview?'<p class="conflict-note">当前是示例预览。复习、查词、筛选可以操作，不会读取 Chrome 收藏，也不会更改真实 Fala。</p>':''}<div class="modal-actions"><button class="primary" data-action="sync">从 Fala 同步</button><button class="secondary" data-action="open">打开 Fala ↗</button></div><p class="helper">同步只访问 liuxing9931-gif.github.io/meu-brasil。会读取收藏和学习进度，将侧栏评分合并回去；不会读取其他网页。需在同一 Chrome 用户配置使用，同步时只保留一个 Fala 窗口。</p>${bundle.conflicts.length?`<div class="conflict-note"><b>${bundle.conflicts.length} 条记录有冲突</b><p>Fala 中的同一张卡也有改动，或已经删除。没有强制覆盖。</p><ul>${bundle.conflicts.slice(0,10).map(c=>`<li>${esc(c.pt)}：${esc(c.reason)}</li>`).join('')}</ul><button class="secondary danger" data-action="resolve">以 Fala 为准，放弃冲突评分</button><p>处理前可先导出侧栏备份，保留这些评分记录。</p></div>`:''}<form id="prefs-form"><label class="check"><input name="autoSpeak" type="checkbox" ${prefs.autoSpeak?'checked':''}>显示答案后自动朗读</label><label>朗读语速<select name="rate">${[.5,.8,.85,1,1.5,2].map(v=>`<option value="${v}" ${v===prefs.rate?'selected':''}>${v}×</option>`).join('')}</select></label><label>巴葡语音<select name="voice"><option value="">自动选择 pt-BR</option>${voices().map(v=>`<option value="${esc(v.voiceURI)}" ${v.voiceURI===prefs.voice?'selected':''}>${esc(v.name)}</option>`).join('')}</select></label><p class="helper">默认静音，声音来自设备语音包。侧栏只统计答题次数，不累计 Fala 的学习分钟数。</p><button class="secondary" type="submit">保存设置</button></form><hr><h3>本地备份</h3><label class="file-label">导入 Fala / 侧栏备份<input id="import-file" type="file" accept=".json,application/json" hidden></label><div class="modal-actions"><button class="secondary" data-action="export">导出侧栏备份</button></div><p class="helper">侧栏备份保留待同步评分。它不是 Fala 完整备份的替代品；尚未同步的评分应先同步，或导出保留。第一版不在侧栏删除收藏。</p>`);
}
function wordModal(word){
 stopSpeech();const key=word.normalize('NFC').toLocaleLowerCase('pt-BR'),saved=bundle.state?.cards.find(c=>c.id==='word:'+key),entry=saved?{zh:saved.zh,en:saved.en,source:'你的收藏释义'}:FalaLexicon.lookup(key);
 modal(`<span class="eyebrow">PALAVRA · 离线查词</span><h2 lang="pt-BR">${esc(word)}</h2>${entry?`<p>${esc(entry.zh||'暂无中文，可参考英文。')}</p><p class="en">${esc(entry.en)}</p><p class="helper">${esc(entry.source)}</p>`:'<p class="helper">离线词库暂无此词，可填写含义后收藏。</p>'}<button class="listen-button" data-speak="${esc(word)}">♫ 听发音</button>${FalaVerbs.analyze(key).length?FalaVerbs.view(key):''}<form id="word-form" data-word="${esc(key)}"><label>中文含义<input name="zh" maxlength="500" value="${esc(entry?.zh||'')}"></label><label>英文含义<input name="en" maxlength="500" value="${esc(entry?.en||'')}"></label><button class="primary" type="submit" ${saved?'disabled':''}>${saved?'已在生词收藏中':'加入生词收藏'}</button><p class="helper">加入后先存在侧栏，下次同步带回 Fala。中英至少填写一项；离线参考释义请结合语境核对。</p></form>`);
}
function collection(query=''){
 if(!bundle)return;
 const cards=(bundle.state?.cards||[]).filter(c=>[c.pt,c.zh,c.en].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase()));
 modal(`<h2>我的收藏 · ${cards.length}</h2><label>搜索收藏<input id="collection-search" type="search" value="${esc(query)}" placeholder="葡语 / 中文 / 英文"></label><div id="collection-list">${cards.slice(0,100).map(c=>`<div class="collection-row"><b lang="pt-BR">${esc(c.pt)}</b><p>${esc(c.zh||c.en)}</p><p>${esc(c.source)} · ${c.started?'下次 '+new Date(c.due).toLocaleDateString('zh-CN'):'尚未学习'}</p></div>`).join('')||'<p class="helper">没有匹配的收藏。</p>'}</div>${cards.length>100?'<p class="helper">先显示前 100 张，请输入关键词缩小范围。</p>':''}`);
}
async function sync(){stopSpeech();const result=await command('SYNC');if(result){cardId=null;revealed=false;render();if($('#modal').open)settings();toast(result.conflicts.length?'同步完成，有冲突需要处理。':'已与 Fala 合并，收藏和进度已更新。');}}
function exportBackup(){
 if(preview){toast('预览不导出示例数据，安装后可导出自己的侧栏备份。');return;}
 const raw=JSON.stringify({format:'fala-sidepanel-backup-v1',createdAt:new Date().toISOString(),bundle},null,2),url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='fala-sidepanel-'+FalaCore.dayKey()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function importFile(file){
 if(preview){toast('预览不导入真实学习数据，安装后可以导入。');return;}
 if(!file)return;
 try{if(file.size>10*1024*1024)throw Error('备份超过 10 MB，请在 Fala 中检查后再导入。');const data=JSON.parse(await file.text());if(bundle.state&&!confirm('导入将替换侧栏当前快照，不会修改 Fala 网站。确定导入吗？'))return;const result=await command(data.format==='fala-sidepanel-backup-v1'?'RESTORE':'IMPORT',data.format==='fala-sidepanel-backup-v1'?{backup:data}:{state:data});if(result){cardId=null;revealed=false;render();$('#modal').close();toast('已导入侧栏本地收藏。');}}catch(e){toast(e.message||'备份文件无效。');}
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.filter){stopSpeech();filter=b.dataset.filter;cardId=null;revealed=false;render();return;}
 if(b.dataset.word){wordModal(b.dataset.word);return;}if(b.dataset.speak){speak(b.dataset.speak);return;}
 if(b.dataset.grade){
  const card=current();if(!card||!revealed||busy)return;stopSpeech();const result=await command('GRADE',{cardId:card.id,grade:b.dataset.grade,expected:FalaSync.fingerprint(card)});if(result){cardId=null;revealed=false;render();}return;
 }
 const action=b.dataset.action;
 if(action==='reveal'){const card=current();if(card){revealed=true;render();if(bundle.prefs.autoSpeak)speak(card.pt);}return;}
 if(action==='sync')return sync();if(action==='settings')return settings();if(action==='open')return command('OPEN_SITE');if(action==='export')return exportBackup();
 if(action==='resolve'&&confirm('确定以 Fala 为准，放弃列表中的冲突评分吗？其他未同步记录会保留。')){const result=await command('DISCARD_CONFLICTS');if(result){settings();toast('已采用 Fala 进度。');}}
});
$('#settings-open').addEventListener('click',settings);$('#collection-open').addEventListener('click',()=>collection());$('#sync-button').addEventListener('click',sync);$('#open-fala').addEventListener('click',()=>command('OPEN_SITE'));
$('#sound-toggle').addEventListener('click',async()=>{if(!bundle)return;stopSpeech();const result=await command('PREFS',{prefs:{...bundle.prefs,autoSpeak:!bundle.prefs.autoSpeak}});if(result)toast(bundle.prefs.autoSpeak?'已开启翻面后自动朗读。':'已静音。');});
$('#modal-close').addEventListener('click',()=>{stopSpeech();$('#modal').close();});
document.addEventListener('submit',async e=>{
 if(e.target.id==='prefs-form'){e.preventDefault();const d=new FormData(e.target);stopSpeech();const result=await command('PREFS',{prefs:{autoSpeak:d.has('autoSpeak'),rate:Number(d.get('rate')),voice:d.get('voice')}});if(result){$('#modal').close();toast('设置已保存。');}}
 if(e.target.id==='word-form'){e.preventDefault();const d=new FormData(e.target),zh=d.get('zh').trim(),en=d.get('en').trim();if(!zh&&!en){toast('请填写中文或英文含义。');return;}const result=await command('ADD_CARD',{pt:e.target.dataset.word,zh,en});if(result){$('#modal').close();toast('已加入生词收藏，下次同步到 Fala。');}}
});
document.addEventListener('change',e=>{if(e.target.id==='import-file')importFile(e.target.files[0]);});
document.addEventListener('input',e=>{if(e.target.id==='collection-search'){const text=e.target.value,start=e.target.selectionStart;collection(text);$('#collection-search').focus();$('#collection-search').setSelectionRange?.(start,start);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSpeech();else render();});window.addEventListener('pagehide',stopSpeech);
if(!preview)chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.falaSidepanel?.newValue){bundle=changes.falaSidepanel.newValue;render();}});
setInterval(()=>{if(!document.hidden&&bundle&&!busy)render();},15000);
(async()=>{try{bundle=await request('READ');render();}catch(e){$('#card-area').innerHTML='<section class="empty-state"><h2>侧栏暂未加载</h2><p>请关闭后重新打开，或查看插件错误。</p></section>';toast(e.message);}})();
