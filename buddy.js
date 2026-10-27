/* AI UI: API credentials stay on the server; the access password is memory-only. */
window.FalaBuddy=(()=>{
 let messages=[],pending=false,error='',draft='',recognition=null,listening=false,controller=null;
 let endpoint='',password='',status=null;try{endpoint=localStorage.getItem('fala-ai-endpoint')||'';}catch{}
 let language='pt-BR',inputLanguage='zh-CN',gender='male',voiceURI='',autoSpeak=true;
 const vocabulary=new Map();
 const languages=[['pt-BR','巴西葡语'],['zh-CN','中文'],['en-US','英语']];
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const options=(items,value)=>items.map(([k,v])=>`<option value="${escape(k)}" ${k===value?'selected':''}>${escape(v)}</option>`).join('');
 function base(){return endpoint?endpoint.replace(/\/$/,'')+'/':new URL('./',location.href).href;}
 async function request(path,body){
  const abort=new AbortController();controller=abort;const timeout=setTimeout(()=>abort.abort(),50000);
  try{
   const r=await fetch(new URL('api/'+path,base()),{method:body?'POST':'GET',cache:'no-store',signal:abort.signal,headers:body?{'Content-Type':'application/json',...(password?{'X-Fala-Password':password}:{})}:{},...(body?{body:JSON.stringify(body)}:{})});
   const data=await r.json().catch(()=>({error:'接口没有返回 JSON。请检查后端地址，GitHub Pages 本身不能运行 AI 接口。'}));
   if(!r.ok)throw Error(data.error||'请求失败，请检查后端配置。');return data;
  }catch(e){if(e.name==='AbortError')throw Error('请求已取消或超时，请重试。');if(e instanceof TypeError)throw Error('无法连接 AI 后端。请检查服务是否启动、HTTPS 地址及后端允许的网站来源。');throw e;}
  finally{clearTimeout(timeout);if(controller===abort)controller=null;}
 }
 function voices(){return window.speechSynthesis?.getVoices().filter(v=>v.lang.toLowerCase()===language.toLowerCase())||[];}
 function view(){
  return `<button class="text-button" data-route="home">← 学习首页</button><div class="page-heading"><div><span class="eyebrow">CONVERSAR COM CONFIANÇA</span><h1>AI 口语搭子 · Lucas</h1><p>不会的表达，用中文或英语问；搭子帮你纠正，再接着聊。</p></div></div>
  <details class="panel ai-connection" ${!status?.configured?'open':''}><summary>连接 AI 后端${status?.configured?' · 已就绪':' · 尚未连接'}</summary><form id="buddy-connection"><label>后端网址（与网站同一服务时留空）<input id="buddy-endpoint" type="url" placeholder="https://your-ai-server.example" value="${escape(endpoint)}"></label><label>后端访问密码（本次页面有效，不是 AI API Key）<input id="buddy-password" type="password" autocomplete="off" ></label><button class="secondary" type="submit">保存地址并检查连接</button></form><p class="helper">GitHub Pages 需要单独部署本项目的 server.py，再填写 HTTPS 后端地址。API Key 只在服务器环境变量中配置。浏览器语音功能免费；AI 服务额度和收费由服务商决定。</p></details>
  <section class="panel buddy-controls"><label>搭子回答语言<select id="buddy-language">${options(languages,language)}</select></label><label>语音输入语言<select id="buddy-input-language">${options(languages,inputLanguage)}</select></label><label>声音偏好<select id="buddy-gender">${options([['female','女声'],['male','男声']],gender)}</select></label><label>设备实际语音<select id="buddy-voice"><option value="">自动匹配声音偏好</option>${options(voices().map(v=>[v.voiceURI,v.name]),voiceURI)}</select></label><label class="switch-label"><input id="buddy-autospeak" type="checkbox" ${autoSpeak?'checked':''}>自动朗读搭子回复</label><p class="helper">男女声按设备语音名称尽力匹配，无法保证。可在“设备实际语音”中试听选择；缺少语言时请安装对应语音包。识别文字发送前可修改，语音识别服务可能需要联网。</p></section>
  <section class="panel buddy-chat"><div class="section-title"><h2>今天聊点什么？</h2><button class="text-button" data-buddy="clear" ${pending?'disabled':''}>清空对话</button></div><div class="search-tags">${['在巴西餐厅点餐','和同事讨论项目进度','聊聊今天的心情'].map(t=>`<button data-topic="${escape(t)}" ${pending?'disabled':''}>${escape(t)}</button>`).join('')}</div><p class="helper">对话仅保留在当前页面；收藏的生词保存在本机。发送时，文字和最近对话会交给所配置的 AI 服务。AI 释义和纠错可能有误。</p>
  <div id="buddy-messages" class="buddy-messages" aria-live="polite">${messages.length?messages.map((m,i)=>`<article class="buddy-message ${m.role==='user'?'mine':''}"><b>${m.role==='user'?'你':'Lucas'}</b><div lang="${escape(m.language||language)}">${m.role==='assistant'&&m.language==='pt-BR'?tokenize(m.content):escape(m.content)}</div>${m.role==='assistant'?`<p>${escape(m.zh)}</p><p class="en">${escape(m.en)}</p>${m.correction?`<aside class="buddy-correction"><b>表达建议</b><p>${escape(m.correction)}</p></aside>`:''}<button class="text-button" data-buddy-speak="${i}">听这一句</button>${m.words?.length?`<div class="search-tags">${m.words.map(w=>`<button data-word="${escape(w.pt)}">${escape(w.pt)} · ${escape(w.zh)}</button>`).join('')}</div>`:''}`:''}</article>`).join(''):'<p class="muted">可以说：“我想表达不加糖，该怎么说？”或选择一个话题开始。</p>'}</div>
  ${error?`<p class="buddy-error" role="alert">${escape(error)}</p>`:''}${pending?'<p role="status">搭子正在思考……</p>':''}<form id="buddy-form"><label for="buddy-text">给搭子的话</label><textarea id="buddy-text" maxlength="2000" rows="3" required placeholder="输入中文、Português ou English…" ${pending?'disabled':''}>${escape(draft)}</textarea><div class="backup-buttons"><button class="secondary" type="button" data-buddy="mic" ${pending?'disabled':''}>${listening?'停止识别':'🎙 语音输入'}</button><button class="primary" type="submit" ${pending?'disabled':''}>发送</button><button class="text-button" type="button" data-buddy="stop">停止朗读</button></div></form><p class="helper">语音输入需要支持 SpeechRecognition 的浏览器及麦克风权限；不支持时仍可打字。葡语单词可点击查看释义并加入收藏复习。</p></section>`;
 }
 function update(){if(route==='buddy')render();}
 function mounted(){const box=document.querySelector('#buddy-messages');if(box)box.scrollTop=box.scrollHeight;}
 function stop(){recognition?.abort();recognition=null;listening=false;window.speechSynthesis?.cancel();}
 function speakText(text,lang=language){
  const synth=window.speechSynthesis;if(!synth){toast('此浏览器不支持朗读。');return;}
  const list=synth.getVoices().filter(v=>v.lang.toLowerCase()===lang.toLowerCase());
  const patterns=gender==='female'?/female|feminina|feminino|女|Luciana|Francisca|Maria|Xiaoxiao|Samantha|Zira|Jenny/i:/\bmale\b|masculin|男|Daniel|Antonio|Antônio|Yunxi|David|Guy/i;
  const voice=list.find(v=>v.voiceURI===voiceURI)||list.find(v=>patterns.test(v.name));
  const selected=voice||list[0];if(!selected){toast('未找到该语言的语音，请先安装语音包。');return;}
  if(!voice)toast('设备未匹配到该声音偏好，使用 '+selected.name+'；可手动选择语音。');
  synth.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.voice=selected;u.rate=state.settings.rate;
  u.onerror=e=>{if(!['canceled','interrupted'].includes(e.error))toast('朗读失败，请检查设备语音包。');};synth.speak(u);
 }
 async function send(text){
  if(pending||!text.trim())return;stop();text=text.trim().slice(0,2000);draft='';error='';pending=true;
  const lang=language;messages.push({role:'user',content:text});update();
  try{
   const data=await request('chat',{language:lang,messages:messages.slice(-20).map(m=>({role:m.role,content:m.content}))});
   if(typeof data.reply!=='string'||!data.reply.trim())throw Error('搭子未返回有效回答，请重试。');
   for(const w of data.words||[])vocabulary.set(w.pt.toLocaleLowerCase('pt-BR'),[w.zh,w.en]);
   messages.push({role:'assistant',content:data.reply,language:lang,zh:data.zh,en:data.en,correction:data.correction,words:data.words});
   if(autoSpeak&&route==='buddy')speakText(data.reply,lang);
  }catch(e){messages.pop();draft=text;error=e.message;}finally{pending=false;update();}
 }
 function mic(){
  if(listening){recognition?.stop();return;}
  const API=window.SpeechRecognition||window.webkitSpeechRecognition;if(!API){toast('此浏览器不支持语音转文字，请使用 Chrome/Edge 或直接打字。');return;}
  window.speechSynthesis?.cancel();recognition=new API();recognition.lang=inputLanguage;recognition.interimResults=false;recognition.continuous=false;
  recognition.onresult=e=>{draft=(draft+' '+Array.from(e.results).map(r=>r[0].transcript).join(' ')).trim().slice(0,2000);const input=document.querySelector('#buddy-text');if(input)input.value=draft;};
  recognition.onerror=e=>{error=e.error==='not-allowed'?'请允许麦克风权限后重试。':'语音识别失败（'+e.error+'），可改用打字。';};
  recognition.onend=()=>{recognition=null;listening=false;update();};
  try{recognition.start();listening=true;error='';update();}catch{recognition=null;listening=false;toast('无法开始语音识别，请重试。');}
 }
 document.addEventListener('input',e=>{if(e.target.id==='buddy-text')draft=e.target.value;});
 document.addEventListener('change',e=>{
  const id=e.target.id,v=e.target.value;
  if(id==='buddy-language'){stop();language=v;voiceURI='';update();}
  if(id==='buddy-input-language'){stop();inputLanguage=v;update();}
  if(id==='buddy-gender'){gender=v;voiceURI='';update();}
  if(id==='buddy-voice'){voiceURI=v;speakText(language==='pt-BR'?'Olá! Vamos conversar?':language==='zh-CN'?'你好，我们聊聊吧。':'Hello! Let’s chat.');}
  if(id==='buddy-autospeak')autoSpeak=e.target.checked;
 });
 document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.topic)send('请和我练习这个话题：'+b.dataset.topic+'。先用简单的话提一个问题。');
  if(b.dataset.buddySpeak!==undefined){const m=messages[Number(b.dataset.buddySpeak)];if(m)speakText(m.content,m.language);}
  if(b.dataset.buddy==='mic')mic();if(b.dataset.buddy==='stop')stop();
  if(b.dataset.buddy==='clear'&&!pending){stop();messages=[];vocabulary.clear();error='';draft='';update();}
 });
 document.addEventListener('submit',async e=>{
  if(e.target.id==='buddy-form'){e.preventDefault();send(document.querySelector('#buddy-text').value);}
  if(e.target.id==='buddy-connection'){
   e.preventDefault();const value=document.querySelector('#buddy-endpoint').value.trim();
   try{if(value){const u=new URL(value);if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))throw Error();if(u.username||u.password||u.search||u.hash)throw Error();}endpoint=value.replace(/\/$/,'');password=document.querySelector('#buddy-password').value||password;localStorage.setItem('fala-ai-endpoint',endpoint);}catch{error='请输入有效 HTTPS 后端地址（本地测试可用 http://127.0.0.1:8001）。';update();return;}
   try{status=await request('status');error=status.configured?'':'后端已连接，但尚未配置模型或 API Key，请按 README 设置。';if(status.configured)toast('后端已就绪，可以开始对话。');}catch(e){status=null;error=e.message;}update();
  }
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 async function translateWord(word){
  try{const data=await request('chat',{language:'pt-BR',messages:[{role:'user',content:'请解释巴西葡语单词 '+word.slice(0,60)+'，在 words 数组中包含这个单词原形写法的中文和英文释义，pt 使用我提供的拼写。'}]});
   const entry=data.words?.find(w=>w.pt.toLocaleLowerCase('pt-BR')===word.toLocaleLowerCase('pt-BR'));
   if(!entry)throw Error('没有得到该单词的明确释义，可使用 Google 查询。');
   vocabulary.set(entry.pt.toLocaleLowerCase('pt-BR'),[entry.zh,entry.en]);
   const form=document.querySelector('#word-form');if(form?.dataset.word===word.toLocaleLowerCase('pt-BR'))wordModal(word);
  }catch(e){toast(e.message);}finally{const b=document.querySelector('[data-buddy-translate]');if(b){b.disabled=false;b.textContent='AI 查询释义';}}
 }
 document.addEventListener('click',e=>{const b=e.target.closest('[data-buddy-translate]');if(b){b.disabled=true;b.textContent='查询中…';translateWord(b.dataset.buddyTranslate);}});
 return {view,mounted,stop,lookup:key=>vocabulary.get(key)};
})();
