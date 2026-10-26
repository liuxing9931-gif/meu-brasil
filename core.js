(function(root){
 const dayKey=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 function schedule(card,grade,now=Date.now()){
  const c={...card}, ef=c.ease||2.5, n=c.reps||0, old=c.interval||0;
  if(grade==='again'){c.reps=0;c.interval=0;c.ease=Math.max(1.3,ef-.2);c.due=now+60000;}
  else {c.reps=n+1;c.ease=Math.max(1.3,ef+(grade==='easy'?.15:grade==='hard'?-.15:0));c.interval=grade==='hard'?(n?Math.max(1,Math.round(old*1.2)):1):grade==='easy'?(n?Math.max(4,Math.round(old*ef*1.3)):4):(n===0?1:n===1?6:Math.max(1,Math.round(old*ef)));c.due=now+c.interval*86400000;}
  c.started=true;c.last=now;return c;
 }
 function eligible(cards,settings,daily,type,now=Date.now()){
  const done=daily.reviewIds||[], fresh=daily.newIds||[];
  return cards.filter(c=>(!type||c.type===type)&&c.due<=now&&(c.started?(done.includes(c.id)||fresh.includes(c.id)||done.length<settings.reviewLimit):(fresh.includes(c.id)||fresh.length<settings.newLimit))).sort((a,b)=>Number(b.started)-Number(a.started)||a.due-b.due);
 }
 const api={dayKey,schedule,eligible};root.FalaCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
