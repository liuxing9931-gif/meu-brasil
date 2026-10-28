/* Shared offline lookup; human glosses precede mechanically pivoted definitions. */
window.FalaLexicon=(()=>{
 const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key)?obj[key]:null;
 const aliases={};
 const groups={
  ser:'sou é somos são era eram foi foram fui fomos seja sejam',estar:'estou está estamos estão estava estavam esteve estiveram',ter:'tenho tem temos têm tinha tínhamos tinham teve tiveram',ir:'vou vai vamos vão ia iam foi foram fui fomos',fazer:'faço faz fazemos fazem fiz fez fizemos fizeram',poder:'posso pode podemos podem podia podiam pôde puderam',querer:'quero quer queremos querem queria queriam',saber:'sei sabe sabemos sabem soube sabia sabiam',dizer:'digo diz dizemos dizem disse disseram dizia',trazer:'trago traz trazemos trazem trouxe trouxeram',ver:'vejo vê vemos veem vi viu vimos viram',vir:'venho vem vimos vêm veio vieram',pedir:'peço pede pedimos pedem pedi pediu pediram',preferir:'prefiro prefere preferimos preferem',conseguir:'consigo consegue conseguimos conseguem consegui conseguiu conseguiram',ler:'leio lê lemos leem li leu leram',receber:'recebo recebe recebemos recebem recebi recebeu receberam',conhecer:'conheço conhece conhecemos conhecem conhecia conheciam',perceber:'percebo percebe percebemos percebem percebi percebeu perceberam',escolher:'escolho escolhe escolhemos escolhem escolhi escolheu escolheram',corrigir:'corrijo corrige corrigimos corrigem corrigi corrigiu corrigiram',haver:'há havia haviam houve',dever:'devo deve devemos devem deveria deveriam',levar:'levaria levariam',confirmar:'confirmasse confirmassem',ficar:'fico fica ficamos ficam fiquei ficou ficaram',começar:'começo começa começamos começam comecei começou começaram',chegar:'chego chega chegamos chegam cheguei chegou chegaram',pagar:'pago paga pagamos pagam paguei pagou pagaram',agradecer:'agradeço agradece agradecemos agradecem agradeci agradeceu',descer:'desço desce descemos descem desci desceu',repetir:'repito repete repetimos repetem',sair:'saio sai saímos saem saiu saíram'
 };
 for(const [lemma,forms] of Object.entries(groups))for(const form of forms.split(' '))if(!aliases[form])aliases[form]=lemma;
 const regular='morar trabalhar gostar conversar falar perguntar tomar mostrar voltar anotar levar comprar custar esperar preparar visitar caminhar ajudar passar responder sentar olhar aceitar verificar oferecer almoçar combinar precisar participar ligar explicar procurar confirmar lembrar colocar faltar mandar terminar trocar deixar enviar melhorar organizar editar compartilhar estudar usar dividir abrir receber entender aprender vender escrever'.split(' ');
 for(const lemma of regular){
  const stem=lemma.slice(0,-2),end=lemma.slice(-2);
  const endings=end==='ar'?['o','a','amos','am','ei','ou','aram','ava','avam','ando']:end==='er'?['o','e','emos','em','i','eu','eram','ia','iam','endo']:['o','e','imos','em','i','iu','iram','ia','iam','indo'];
  for(const ending of endings)if(!aliases[stem+ending])aliases[stem+ending]=lemma;
 }
 function exact(w){
  const hand=own(window.READING_VOCABULARY,w)||own(window.DICTIONARY,w);
  if(hand)return {zh:hand[0],en:hand[1],source:'本地学习词库',lemma:w,pivot:false};
  const row=own(window.OFFLINE_DICTIONARY,w);
  return row?{zh:row[0],en:row[1],source:row[0]?'FreeDict 葡英 + ECDICT 英汉参考（英文中转，非语境翻译）':'FreeDict 葡英离线词典',lemma:w,pivot:!!row[0]}:null;
 }
 function lookup(word){
  const w=word.normalize('NFC').toLocaleLowerCase('pt-BR').trim();
  // Human definitions and exact dictionary entries always win over derived candidates.
  let result=exact(w);if(result)return result;
  if(aliases[w]){result=exact(aliases[w]);if(result)return {...result,source:result.source+' · 词形参考：'+aliases[w]};}
  const candidates=[];
  if(w.endsWith('ões'))candidates.push(w.slice(0,-3)+'ão');
  if(w.endsWith('s')&&w.length>3)candidates.push(w.slice(0,-1));
  if(w.endsWith('as'))candidates.push(w.slice(0,-2)+'o');
  if(w.endsWith('a')&&w.length>3)candidates.push(w.slice(0,-1)+'o');
  for(const candidate of candidates){result=exact(candidate);if(result)return {...result,source:result.source+' · 可能原形：'+candidate};}
  return null;
 }
 return {lookup};
})();
