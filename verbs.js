/* Offline morphology viewer; all matching analyses are retained, not guessed from context. */
window.FalaVerbs=(()=>{
 const {tags,verbs}=PORTUGUESE_VERBS,cache=new Map();
 const personNames={'1;SG':'第一人称单数 · eu','2;SG':'第二人称单数 · tu','3;SG':'第三人称单数 · ele/ela/você','1;PL':'第一人称复数 · nós','2;PL':'第二人称复数 · vós','3;PL':'第三人称复数 · eles/elas/vocês'};
 function group(tag){return tag.split(';').filter(t=>!['1','2','3','SG','PL','FEM','MASC'].includes(t)).join(';');}
 const names={'V;IND;PRS':'直陈式 · 现在时','V;IND;PST;PFV':'直陈式 · 简单过去时（pretérito perfeito）','V;IND;PST;IPFV':'直陈式 · 过去未完成时','V;IND;PST;PRF':'直陈式 · 愈过去时（简单式）','V;IND;FUT':'直陈式 · 将来时','V;COND':'条件式 · 将来过去时','V;SBJV;PRS':'虚拟式 · 现在时','V;SBJV;PST;IPFV':'虚拟式 · 过去未完成时','V;SBJV;FUT':'虚拟式 · 将来时','V;IMP;POS':'命令式 · 肯定','V;IMP;NEG':'命令式 · 否定','V;NFIN':'不定式（含人称不定式）','V.PTCP;PRS':'副动词（gerúndio）','V.PTCP;PST':'过去分词'};
 function person(tag){
  const t=tag.split(';'),p=t.find(x=>['1','2','3'].includes(x)),n=t.includes('PL')?'PL':'SG';
  if(p)return personNames[p+';'+n];
  if(t.includes('FEM')||t.includes('MASC'))return (t.includes('FEM')?'阴性':'阳性')+' · '+(n==='PL'?'复数':'单数')+'（分词无固定人称）';
  return '无固定人称';
 }
 function analyze(word){
  const key=word.normalize('NFC').toLocaleLowerCase('pt-BR');if(cache.has(key))return cache.get(key);
  const matches=[];
  for(const [lemma,forms] of Object.entries(verbs))for(let i=0;i<forms.length;i++)if(forms[i]===key||(forms[i].includes('|')&&forms[i].split('|').includes(key)))matches.push({lemma,tag:tags[i],tense:names[group(tags[i])]||tags[i],person:person(tags[i])});
  cache.set(key,matches);return matches;
 }
 function table(lemma,category){
  const forms=verbs[lemma];if(!forms)return '';
  return `<table class="verb-table"><thead><tr><th>人称 / 形式</th><th>变位</th></tr></thead><tbody>${forms.map((form,i)=>form&&group(tags[i])===category?`<tr><td>${esc(person(tags[i]))}</td><td lang="pt-BR">${esc(form.split('|').join(' / '))}</td></tr>`:'').join('')}</tbody></table>`;
 }
 function view(word){
  const matches=analyze(word),lemmas=[...new Set(matches.map(m=>m.lemma))];
  if(!matches.length)return '<p class="helper">本词形未在动词变位库中匹配到；它可能不是动词，也可能暂未收录。</p>';
  return `<section class="verb-analysis"><h3>可能的动词原形与变位</h3><p class="helper">以下按词形匹配，不能仅凭单词确定句中用法；有多种解释时请结合原句判断。</p>${lemmas.map(lemma=>`<div class="verb-lemma"><h4>原形：<span lang="pt-BR">${esc(lemma)}</span><button type="button" class="text-button" data-speak="${esc(lemma)}">听原形</button></h4><ul>${matches.filter(m=>m.lemma===lemma).map(m=>`<li><b>${esc(m.tense)}</b><br>${esc(m.person)}</li>`).join('')}</ul><details><summary>展开 ${esc(lemma)} 的变位表</summary><label>语式 / 时态 <select data-verb-tense="${esc(lemma)}">${[...new Set(tags.filter((t,i)=>verbs[lemma][i]).map(group))].map(g=>`<option value="${esc(g)}" ${g==='V;IND;PRS'?'selected':''}>${esc(names[g]||g)}</option>`).join('')}</select></label><div class="verb-table-wrap">${table(lemma,'V;IND;PRS')}</div></details></div>`).join('')}<p class="helper">巴葡中 você 使用第三人称单数，vocês 使用第三人称复数；a gente 通常配第三人称单数。tu 在部分地区使用，vós 在巴西日常交流少用。来源：UniMorph 葡语（CC BY-SA 3.0），保留欧葡变体并补充巴葡 -amos 拼写；复合时态需结合整句分析。</p></section>`;
 }
 document.addEventListener('change',e=>{if(e.target.dataset.verbTense)e.target.closest('details').querySelector('.verb-table-wrap').innerHTML=table(e.target.dataset.verbTense,e.target.value);});
 return {analyze,view};
})();
