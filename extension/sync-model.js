/* Shared deterministic model: sidebar and injected PWA bridge. No Chrome APIs. */
(function(root){
 'use strict';
 const core=root.FalaCore;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const dayPattern=/^\d{4}-\d{2}-\d{2}$/;
 const grades=new Set(['again','hard','good','easy']);
 const scheduleFields=['started','reps','ease','interval','due','last'];
 function cleanCard(card){
  if(!card||typeof card.id!=='string'||!card.id||card.id.length>240||typeof card.pt!=='string'||!card.pt.trim()||card.pt.length>1000||!['word','sentence'].includes(card.type)||!finite(card.due))throw Error('收藏数据格式不正确。');
  const out={id:card.id,pt:card.pt,zh:typeof card.zh==='string'?card.zh.slice(0,4000):'',en:typeof card.en==='string'?card.en.slice(0,4000):'',type:card.type,source:typeof card.source==='string'?card.source.slice(0,240):'我的收藏',created:finite(card.created)?card.created:0,due:card.due,started:!!card.started};
  for(const key of ['reps','ease','interval','last'])if(card[key]!==undefined){if(!finite(card[key])||card[key]<0)throw Error('复习进度格式不正确。');out[key]=card[key];}
  return out;
 }
 function snapshot(value){
  if(!value||value.version!==1||!Array.isArray(value.cards)||value.cards.length>20000)throw Error('这不是有效的 Fala v1 学习备份。');
  const cards=value.cards.map(cleanCard);if(new Set(cards.map(c=>c.id)).size!==cards.length)throw Error('收藏中有重复编号，请先检查备份。');
  const s=value.settings||{},days={};
  for(const [key,d] of Object.entries(value.days||{})){
   if(!dayPattern.test(key)||!d||!finite(d.seconds)||d.seconds<0||!Array.isArray(d.newIds)||!Array.isArray(d.reviewIds)||!finite(d.ratings)||d.ratings<0)throw Error('每日学习记录格式不正确。');
   days[key]={seconds:d.seconds,newIds:d.newIds.filter(x=>typeof x==='string'),reviewIds:d.reviewIds.filter(x=>typeof x==='string'),ratings:d.ratings};
  }
  const limit=(v,f,max)=>finite(v)&&v>=0&&v<=max?Math.floor(v):f;
  return {version:1,cards,settings:{newLimit:limit(s.newLimit,10,200),reviewLimit:limit(s.reviewLimit,30,1000),goal:limit(s.goal,15,240),rate:finite(s.rate)&&s.rate>=.5&&s.rate<=2?s.rate:.85,voice:typeof s.voice==='string'?s.voice:''},days,completed:Array.isArray(value.completed)?value.completed.filter(x=>typeof x==='string'):[],sessions:[],checkins:Array.isArray(value.checkins)?value.checkins.filter(x=>typeof x==='string'&&dayPattern.test(x)):[]};
 }
 function fingerprint(card){return JSON.stringify([card.id,card.pt,card.type,card.due,!!card.started,card.reps||0,card.ease||2.5,card.interval||0,card.last||0]);}
 function daily(state,key){return state.days[key]||(state.days[key]={seconds:0,newIds:[],reviewIds:[],ratings:0});}
 function account(state,base,result,day){
  const d=daily(state,day),key=base.started?'reviewIds':'newIds';
  if(!d[key].includes(base.id)&&!(key==='reviewIds'&&d.newIds.includes(base.id)))d[key].push(base.id);
  d.ratings++;
  const card=state.cards.find(c=>c.id===base.id);
  for(const field of scheduleFields)if(result[field]!==undefined)card[field]=result[field];
 }
 function makeEvent(state,cardId,grade,at,eventId){
  if(!grades.has(grade)||!finite(at)||typeof eventId!=='string')throw Error('无效的评分。');
  const base=state.cards.find(c=>c.id===cardId),day=core.dayKey(new Date(at));
  if(!base||!core.eligible(state.cards,state.settings,daily(state,day),null,at).some(c=>c.id===cardId))throw Error('这张卡暂未到期，或已达到今天的学习上限。');
  return {eventId,kind:'grade',cardId,base:clone(base),grade,at,day};
 }
 function validateEvent(event){
  if(event?.kind==='add'){if(typeof event.eventId!=='string'||!event.eventId||event.eventId.length>100)throw Error('待同步收藏格式不正确。');return {...event,card:cleanCard(event.card)};}
  if(!event||typeof event.eventId!=='string'||event.eventId.length>100||!event.eventId||event.kind!=='grade'||!grades.has(event.grade)||!finite(event.at)||!dayPattern.test(event.day||'')||event.cardId!==event.base?.id)throw Error('待同步评分格式不正确。');
  return {...event,base:cleanCard(event.base)};
 }
 function applyEvents(input,events){
  snapshot(input);if(!Array.isArray(events)||events.length>5000)throw Error('待同步记录过多或格式无效，请先导出侧栏备份。');
  const state=clone(input),applied=new Set(Array.isArray(state._falaSidepanelApplied)?state._falaSidepanelApplied:[]),acknowledged=[],conflicts=[];
  for(const raw of events){
   const event=validateEvent(raw);
   if(applied.has(event.eventId)){acknowledged.push(event.eventId);continue;}
   if(event.kind==='add'){if(!state.cards.some(c=>c.id===event.card.id))state.cards.push(clone(event.card));applied.add(event.eventId);acknowledged.push(event.eventId);continue;}
   const card=state.cards.find(c=>c.id===event.cardId),result=core.schedule(event.base,event.grade,event.at);
   if(!card){conflicts.push({eventId:event.eventId,cardId:event.cardId,pt:event.base.pt,reason:'这张收藏已从 Fala 删除，侧栏不会恢复它。'});continue;}
   if(fingerprint(card)===fingerprint(result)){applied.add(event.eventId);acknowledged.push(event.eventId);continue;}
   if(fingerprint(card)!==fingerprint(event.base)){conflicts.push({eventId:event.eventId,cardId:event.cardId,pt:event.base.pt,reason:'Fala 里的这张卡也有新进度，已保留两边记录等待你处理。'});continue;}
   account(state,event.base,result,event.day);applied.add(event.eventId);acknowledged.push(event.eventId);
  }
  // The full PWA object is retained: unrelated settings, sessions, courses and future fields survive.
  state._falaSidepanelApplied=[...applied].slice(-5000);
  return {state,acknowledged,conflicts};
 }
 function queueGrade(bundle,cardId,grade,at,eventId,expected){
  const out=clone(bundle),card=out.state.cards.find(c=>c.id===cardId);
  if(!card||fingerprint(card)!==expected)throw Error('这张卡已在其他侧栏发生变化，请重新查看后评分。');
  const event=makeEvent(out.state,cardId,grade,at,eventId);
  if(out.pending.length>=5000)throw Error('待同步记录已达上限，请先同步或导出备份。');
  out.state=applyEvents(out.state,[event]).state;out.pending.push(event);return out;
 }
 function mergeSnapshot(bundle,response){
  const out=clone(bundle),ack=new Set(response.acknowledged||[]);out.pending=out.pending.filter(e=>!ack.has(e.eventId));
  const projected=applyEvents(snapshot(response.state),out.pending);
  out.state=projected.state;out.conflicts=response.conflicts||[];out.lastSync=Date.now();return out;
 }
 root.FalaSync={validateEvent,snapshot,fingerprint,makeEvent,applyEvents,queueGrade,mergeSnapshot};
})(typeof self!=='undefined'?self:globalThis);
