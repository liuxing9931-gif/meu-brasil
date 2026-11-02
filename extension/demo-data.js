/* Explicit sample data; never imported into chrome.storage or a user's PWA. */
window.FalaDemo=()=>{
 const now=Date.now(),items=[
 ['sauce','Pode trazer o molho separado?','酱汁可以分开放吗？','Could you bring the sauce on the side?','word','餐厅点餐'],
 ['jeito','jeito','办法；方式','way; manner','word','生词本'],
 ['saudade','saudade','想念；思念','a feeling of missing someone or something','word','生词本'],
 ['prazo','prazo','期限；截止时间','deadline','word','工作协作'],
 ['calm','tranquilo','平静的；没问题的','calm; all right','word','生词本'],
 ['agree','combinar','约定；商量','arrange; agree','word','生词本'],
 ['deadline','Qual é o prazo?','截止日期是什么时候？','What is the deadline?','word','工作协作'],
 ['repeat','Pode repetir, por favor?','可以再说一遍吗？','Could you repeat that, please?','word','初次见面'],
 ['slow','um pouco mais devagar','再慢一点','a little more slowly','word','初次见面'],
 ['bus','Onde fica o ponto de ônibus?','公交站在哪里？','Where is the bus stop?','sentence','城市出行'],
 ['team','Vamos alinhar as prioridades.','我们来对齐优先事项吧。','Let’s align the priorities.','sentence','工作协作'],
 ['day','Hoje quero aprender uma expressão nova.','今天我想学一个新表达。','Today I want to learn a new expression.','sentence','每日一句']
 ];
 const cards=items.map((r,i)=>({id:'demo:'+r[0],pt:r[1],zh:r[2],en:r[3],type:r[4],source:r[5],created:now-86400000,due:i>=11?now+86400000:now-120000+i*1000,started:i===0,reps:i===0?1:0,ease:2.5,interval:i===0?1:0}));
 return {state:{version:1,cards,settings:{newLimit:10,reviewLimit:30,rate:.85,voice:''},days:{[FalaCore.dayKey()]:{seconds:0,newIds:['demo-seen-1','demo-seen-2'],reviewIds:['demo-seen-3'],ratings:3}},completed:[],checkins:[],sessions:[]},pending:[],conflicts:[],lastSync:null,source:'预览示例',prefs:{autoSpeak:false,rate:.85,voice:''}};
};
