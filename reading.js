/* Graded reading; reuses the app's speech, word modal and review cards. */
window.FalaReading=(()=>{
 const levels=[['A1','入门','500–1,000','自我介绍、价格、地址与简单日常'],['A2','基础','1,000–2,000','购物、交通、点餐与熟悉的职场情景'],['B1','中级','2,000–3,500','需求、经历与日常问题'],['B2','中高级','3,500–6,000','工作讨论、产品说明与沟通']];
 let level='A1',articleId=null;
 const expanded=new Set();
 const selected=()=>READINGS.find(a=>a.id===articleId);
 function rate(){return [0.5,0.8,1,1.5,2].includes(state.settings.readingRate)?state.settings.readingRate:0.8;}
 function view(){
  const a=selected();
  if(!a)return `${heading('LER UM POUCO, DESCOBRIR MAIS','葡语小读本','每次读一小篇，把生活里的葡语慢慢读懂。')}<div class="reading-levels">${levels.map(([key,title,vocab,desc])=>`<button class="reading-level ${level===key?'selected':''}" data-reading-level="${key}" aria-pressed="${level===key}"><b>${key} · ${title}</b><span>参考词汇量 ${vocab}</span><small>${desc}</small>${['B1','B2'].includes(key)?'<small>内容待扩充</small>':''}</button>`).join('')}</div><p class="helper">词汇量是你的学习参考，并非官方 CEFR 硬性标准。本文按情景、句式和长度分级，少量拓展词已标出。</p><div class="course-grid reading-grid">${READINGS.filter(r=>r.level===level).map(r=>`<button class="reading-card" data-reading-article="${r.id}"><span class="eyebrow">${r.level} · ${r.wordCount} 词</span><h2>${esc(r.title)}</h2><p lang="pt-BR">${esc(r.pt)}</p><small>${esc(r.topic)}</small><p class="helper">少量拓展：${r.newWords.map(esc).join(' · ')}</p><span class="text-button">开始阅读 →</span></button>`).join('')||'<section class="empty-state"><h2>这一等级，留给未来的你</h2><p>目前先准备 A1、A2。提升后可添加 B1、B2 文章，不必重新设计模块。</p></section>'}</div>`;
  return `<div class="reading-toolbar"><button class="text-button" data-reading-back>← 全部短文</button><label>朗读语速 <select id="reading-rate" aria-label="阅读朗读语速">${[0.5,0.8,1,1.5,2].map(v=>`<option value="${v}" ${rate()===v?'selected':''}>${v.toFixed(1)}×</option>`).join('')}</select></label></div>${heading('LEITURA · '+a.level,a.title,a.topic,`<span class="date-chip">${a.wordCount} 词</span>`)}<article class="reading-article panel"><h2 lang="pt-BR">${esc(a.pt)}</h2><p class="helper">逐句聆听，试着先不看译文。点单词可查释义并收藏；点每句的“显示译文”可展开中英对照。</p><div class="reading-new"><b>本篇少量拓展词：</b>${a.newWords.map(w=>`<button class="word" data-word="${esc(w)}">${esc(w)}</button>`).join(' · ')}</div>${a.sentences.map((s,i)=>{const key=a.id+':'+i,open=expanded.has(key);return `<section class="reading-sentence"><div class="reading-line"><span class="reading-number">${i+1}</span><p lang="pt-BR">${tokenize(s.pt)}</p><button class="icon-button" data-reading-speak="${i}" aria-label="朗读第 ${i+1} 句">${icon('sound')}</button></div><button class="text-button reading-toggle" data-reading-translation="${i}" aria-expanded="${open}" aria-controls="translation-${i}">${open?'隐藏译文':'显示译文 · 中 / EN'}</button><div id="translation-${i}" class="reading-translations" ${open?'':'hidden'}><p lang="zh-CN">${esc(s.zh)}</p><p lang="en" class="en">${esc(s.en)}</p></div></section>`;}).join('')}</article><section class="panel reading-notes"><span class="eyebrow">LEVAR COM VOCÊ · 读后带走</span><h2>重要短语与语法 · ${a.notes.length} 项</h2>${a.notes.map((n,i)=>`<div class="reading-note"><h3 lang="pt-BR">${i+1}. ${tokenize(n.pt)}</h3><p>${esc(n.zh)}</p><p class="en" lang="en">${esc(n.en)}</p></div>`).join('')}<p class="helper">先选两三条用起来，不需要一次记住全部。</p></section>`;
 }
 document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.readingLevel){window.speechSynthesis?.cancel();level=b.dataset.readingLevel;articleId=null;render();}
  if(b.dataset.readingArticle){window.speechSynthesis?.cancel();articleId=b.dataset.readingArticle;render();window.scrollTo({top:0});}
  if(b.hasAttribute('data-reading-back')){window.speechSynthesis?.cancel();articleId=null;render();}
  if(b.dataset.readingSpeak!==undefined){const s=selected()?.sentences[Number(b.dataset.readingSpeak)];if(s)speak(s.pt,rate());}
  if(b.dataset.readingTranslation!==undefined){const key=articleId+':'+b.dataset.readingTranslation;if(expanded.has(key))expanded.delete(key);else expanded.add(key);const y=window.scrollY;render();window.scrollTo({top:y});}
 });
 document.addEventListener('change',e=>{if(e.target.id==='reading-rate'){const v=Number(e.target.value);if([0.5,0.8,1,1.5,2].includes(v)){window.speechSynthesis?.cancel();state.settings.readingRate=v;save();}}});
 return {view};
})();
