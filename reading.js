/* Reading has one scrollable text sheet with a persistent player, followed by a notes sheet. */
window.FalaReading=(()=>{
 const levels=[['A1','入门','500–1,000','自我介绍、价格、地址与简单日常'],['A2','基础','1,000–2,000','购物、交通、点餐与熟悉的职场情景'],['B1','中级','2,000–3,500','需求、经历与日常问题'],['B2','中高级','3,500–6,000','工作讨论、产品说明与沟通']];
 let level='A1',articleId=null,paper='article',generation=0,utterance=null,index=0,status='idle';
 const expanded=new Set(),selected=()=>READINGS.find(a=>a.id===articleId);
 function rate(){return [0.5,0.8,1,1.5,2].includes(state.settings.readingRate)?state.settings.readingRate:0.8;}
 function glyph(type){const paths={prev:'M6 5h2v14H6zM20 5 9 12l11 7z',next:'M16 5h2v14h-2zM4 5v14l11-7z',play:'M7 4v16l15-8z',pause:'M6 4h4v16H6zM14 4h4v16h-4z'};return `<svg viewBox="0 0 24 24" width="23" height="23" fill="currentColor" aria-hidden="true"><path d="${paths[type]}"/></svg>`;}
 function player(){const total=selected()?.sentences.length||0;return `<div class="reading-player" role="group" aria-label="全文朗读播放器"><div class="reading-player-status" aria-live="polite">第 ${index+1} / ${total} 句 · ${{idle:'待播放',playing:'朗读中',paused:'已暂停',ended:'全文播放完毕'}[status]}</div><div class="reading-player-buttons"><button type="button" data-reading-control="prev" aria-label="上一句" ${index===0?'disabled':''}>${glyph('prev')}</button><button type="button" class="reading-play" data-reading-control="toggle" aria-label="${status==='playing'?'暂停朗读':status==='paused'?'继续朗读':'播放全文'}">${glyph(status==='playing'?'pause':'play')}</button><button type="button" data-reading-control="next" aria-label="下一句" ${index>=total-1?'disabled':''}>${glyph('next')}</button></div></div>`;}
 function items(){return READINGS.flatMap(a=>a.notes.map((n,i)=>({id:'reading:'+a.id+':note:'+i,pt:n.pt,zh:n.zh,en:n.en||'',type:'sentence',source:'短文 · '+a.title})));}
 function translationControl(){const a=selected(),all=a.sentences.every((_,i)=>expanded.has(a.id+':'+i));return '<button class="text-button" data-reading-translations aria-pressed="'+all+'">'+(all?'隐藏全部译文':'显示全部译文')+'</button>';}
 function view(){
  const a=selected();
  if(!a)return `${heading('LER UM POUCO, DESCOBRIR MAIS','葡语小读本','每次读一小篇，把生活里的葡语慢慢读懂。')}<div class="reading-levels">${levels.map(([key,title,vocab,desc])=>`<button class="reading-level ${level===key?'selected':''}" data-reading-level="${key}" aria-pressed="${level===key}"><b>${key} · ${title}</b><span>参考词汇量 ${vocab}</span><small>${desc}</small>${['B1','B2'].includes(key)?'<small>内容待扩充</small>':''}</button>`).join('')}</div><p class="helper">词汇量是你的学习参考，并非官方 CEFR 硬性标准。本文按情景、句式和长度分级，少量拓展词已标出。</p><div class="course-grid reading-grid">${READINGS.filter(r=>r.level===level).map(r=>`<button class="reading-card" data-reading-article="${r.id}"><img class="reading-cover" src="./assets/scenes/${({"a1-new-neighbor":"hello","a1-market":"shop","a1-bus":"transport","a2-lunch":"restaurant","a2-team":"collaboration","a2-appointment":"work"})[r.id]||"hello"}.jpg" alt="" loading="lazy" decoding="async"><div class="reading-card-body"><span class="eyebrow">${r.level} · ${r.wordCount} 词</span><h2>${esc(r.title)}</h2><p lang="pt-BR">${esc(r.pt)}</p><small>${esc(r.topic)}</small><p class="helper">少量拓展：${r.newWords.map(esc).join(' · ')}</p><span class="text-button">开始阅读 →</span></div></button>`).join('')||'<section class="empty-state"><h2>这一等级，留给未来的你</h2><p>目前先准备 A1、A2。提升后可添加 B1、B2 文章，不必重新设计模块。</p></section>'}</div>`;  return `<div class="reading-workspace"><div class="reading-toolbar"><button class="text-button" data-reading-back>← 全部短文</button>${translationControl()}<label>朗读语速 <select id="reading-rate" aria-label="阅读朗读语速">${[0.5,0.8,1,1.5,2].map(v=>`<option value="${v}" ${rate()===v?'selected':''}>${v.toFixed(1)}×</option>`).join('')}</select></label></div><div class="reading-paper-tabs" role="group" aria-label="切换纸张"><button class="text-button" data-reading-paper="article" aria-pressed="${paper==='article'}">01 · 短文阅读</button><button class="text-button" data-reading-paper="notes" aria-pressed="${paper==='notes'}">02 · 重要短语与语法</button></div><div class="reading-book" data-reading-id="${a.id}" tabindex="0" aria-label="两张学习纸，外侧滚动切换"><article class="reading-article reading-paper panel" id="reading-article-paper" aria-label="第一张纸：短文阅读"><div class="reading-text reading-paper-scroll" tabindex="0" aria-label="短文正文，独立滚动"><span class="eyebrow">01 · ${a.level} · ${a.wordCount} 词</span><h1>${esc(a.title)}</h1><h2 lang="pt-BR">${esc(a.pt)}</h2><div class="reading-new"><b>少量拓展词：</b>${a.newWords.map(w=>`<button class="word" data-word="${esc(w)}">${esc(w)}</button>`).join(' · ')}</div>${a.sentences.map((s,i)=>{const open=expanded.has(a.id+':'+i);return `<section class="reading-sentence" data-reading-index="${i}"><div class="reading-line"><span class="reading-number">${i+1}</span><p lang="pt-BR">${tokenize(s.pt)}</p><button class="icon-button" data-reading-speak="${i}" aria-label="朗读第 ${i+1} 句">${icon('sound')}</button></div><button class="text-button reading-toggle" data-reading-translation="${i}" aria-expanded="${open}" aria-controls="translation-${i}">${open?'隐藏译文':'显示译文 · 中 / EN'}</button><div id="translation-${i}" class="reading-translations" ${open?'':'hidden'}><p lang="zh-CN">${esc(s.zh)}</p><p lang="en" class="en">${esc(s.en)}</p></div></section>`;}).join('')}</div>${player()}</article><section class="reading-notes reading-paper panel" id="reading-notes-paper" aria-label="第二张纸：重要短语与语法"><div class="reading-note-scroll reading-paper-scroll" tabindex="0" aria-label="短语与语法，独立滚动"><span class="eyebrow">02 · LEVAR COM VOCÊ</span><h2>重要短语与语法 · ${a.notes.length} 项</h2>${a.notes.map((n,i)=>`<div class="reading-note"><div class="reading-note-heading"><h3 lang="pt-BR">${i+1}. ${tokenize(n.pt)}</h3><button class="icon-button" data-reading-note="${i}" aria-label="朗读第 ${i+1} 条短语或例子">${icon('sound')}</button></div><p>${esc(n.zh)}</p><p class="en" lang="en">${esc(n.en)}</p>${actions(items().find(item=>item.id==='reading:'+a.id+':note:'+i))}</div>`).join('')}<p class="helper">先选两三条用起来，不需要一次记住全部。耳机按钮朗读本条葡语表达，使用上方语速。</p></div></section></div></div>`;
 }
 function paint(follow=false){
  const box=document.querySelector('.reading-player'),focused=document.activeElement?.dataset.readingControl;if(box){box.outerHTML=player();if(focused)document.querySelector(`[data-reading-control="${focused}"]`)?.focus({preventScroll:true});}
  document.querySelectorAll('[data-reading-index]').forEach(el=>{const active=Number(el.dataset.readingIndex)===index;el.classList.toggle('reading-current',active);if(active)el.setAttribute('aria-current','true');else el.removeAttribute('aria-current');});
  if(follow){const text=document.querySelector('.reading-text'),row=document.querySelector(`[data-reading-index="${index}"]`);if(text&&row){const r=row.getBoundingClientRect(),t=text.getBoundingClientRect();if(r.top<t.top||r.bottom>t.bottom)text.scrollTop+=r.top-t.top-12;}}
 }
 function stop(){generation++;utterance=null;status='idle';window.speechSynthesis?.cancel();paint();}
 function play(target=index,mode='full'){
  const a=selected();if(!a||target<0||target>=a.sentences.length)return;
  stop();index=target;status='playing';const ticket=generation;
  utterance=speak(a.sentences[index].pt,rate(),{reading:true,end:()=>{
   if(ticket!==generation)return;utterance=null;
   if(mode==='full'&&index<a.sentences.length-1){if(status==='paused'){index++;paint();}else play(index+1,'full');}
   else{status=mode==='full'?'ended':'idle';paint();}
  },error:()=>{if(ticket===generation){status='idle';utterance=null;paint();}}});
  if(!utterance)status='idle';paint(true);
 }
 function toggle(){
  if(status==='playing'&&utterance){try{window.speechSynthesis.pause();status='paused';paint();}catch{stop();toast('设备无法暂停朗读，请重新播放当前句。');}}
  else if(status==='paused'&&utterance){try{window.speechSynthesis.resume();status='playing';paint();}catch{play(index);}}
  else play(status==='ended'?0:index);
 }
 function capture(){
  const book=document.querySelector('.reading-book');
  if(!book||book.dataset.readingId!==articleId)return null;
  return {book:book.scrollTop,text:document.querySelector('.reading-text')?.scrollTop||0,notes:document.querySelector('.reading-note-scroll')?.scrollTop||0};
 }
 function fit(){
  const work=document.querySelector('.reading-workspace');if(!work)return;
  const nav=document.querySelector('#mobile-nav'),navHeight=nav&&getComputedStyle(nav).display!=='none'?nav.getBoundingClientRect().height:0;
  const viewport=window.visualViewport,rect=work.getBoundingClientRect(),scale=work.offsetWidth?rect.width/work.offsetWidth:1;
  work.style.setProperty('--reading-height',Math.max(140,((viewport?.height||innerHeight)+(viewport?.offsetTop||0)-rect.top-navHeight-8)/scale)+'px');
 }
 function trackPaper(){
  const book=document.querySelector('.reading-book'),notes=document.querySelector('#reading-notes-paper');if(!book||!notes)return;
  const next=book.scrollTop>=notes.offsetTop-book.clientHeight/2?'notes':'article';
  if(next!==paper){paper=next;stop();}
  document.querySelectorAll('[data-reading-paper]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.readingPaper===paper)));
 }
 function mounted(previous){
  const book=document.querySelector('.reading-book');if(!book)return;fit();
  if(previous){book.scrollTop=previous.book;document.querySelector('.reading-text').scrollTop=previous.text;document.querySelector('.reading-note-scroll').scrollTop=previous.notes;}
  book.addEventListener('scroll',trackPaper,{passive:true});trackPaper();paint();
 }
 function switchPaper(next){
  const book=document.querySelector('.reading-book'),sheet=document.getElementById(next==='notes'?'reading-notes-paper':'reading-article-paper');if(!book||!sheet)return;
  if(next!==paper)stop();paper=next;book.scrollTop=sheet.offsetTop;trackPaper();
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-reading-translations')){const a=selected();if(a){const all=a.sentences.every((_,i)=>expanded.has(a.id+':'+i));a.sentences.forEach((_,i)=>{const key=a.id+':'+i;if(all)expanded.delete(key);else expanded.add(key);});render();}return;}
  if(b.dataset.readingLevel){stop();level=b.dataset.readingLevel;articleId=null;render();}
  if(b.dataset.readingArticle){stop();articleId=b.dataset.readingArticle;index=0;paper='article';window.scrollTo({top:0});render();}
  if(b.hasAttribute('data-reading-back')){stop();articleId=null;render();}
  if(b.dataset.readingSpeak!==undefined)play(Number(b.dataset.readingSpeak),'single');
  if(b.dataset.readingNote!==undefined){const note=selected()?.notes[Number(b.dataset.readingNote)];if(note){stop();speak(note.pt,rate());}}
  if(b.dataset.readingControl==='toggle')toggle();
  if(b.dataset.readingControl==='prev')play(index-1);
  if(b.dataset.readingControl==='next')play(index+1);
  if(b.dataset.readingPaper)switchPaper(b.dataset.readingPaper);
  if(b.dataset.readingTranslation!==undefined){
   const key=articleId+':'+b.dataset.readingTranslation,open=!expanded.has(key);if(open)expanded.add(key);else expanded.delete(key);
   const box=document.getElementById('translation-'+b.dataset.readingTranslation);if(box)box.hidden=!open;b.setAttribute('aria-expanded',String(open));b.textContent=open?'隐藏译文':'显示译文 · 中 / EN';const control=document.querySelector('[data-reading-translations]');if(control){const a=selected(),all=a.sentences.every((_,i)=>expanded.has(a.id+':'+i));control.textContent=all?'隐藏全部译文':'显示全部译文';control.setAttribute('aria-pressed',String(all));}
  }
 });
 document.addEventListener('change',e=>{if(e.target.id==='reading-rate'){const v=Number(e.target.value);if([0.5,0.8,1,1.5,2].includes(v)){stop();state.settings.readingRate=v;save();}}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit);
 const layoutObserver=new ResizeObserver(fit);
 for(const el of [document.querySelector('#topbar'),document.querySelector('#mobile-nav')])if(el)layoutObserver.observe(el);
 return {view,stop,items,capture,mounted,isOpen:()=>!!selected()};
})();
