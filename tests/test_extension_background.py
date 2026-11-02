"""Run the real MV3 background/bridge scripts in isolated Chrome API and page simulators."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('extension_build',ROOT/'tools/build_extension.py')
package=importlib.util.module_from_spec(spec);spec.loader.exec_module(package)

class BackgroundBridge(unittest.TestCase):
    def test_background_bridge_transactions(self):
        with tempfile.TemporaryDirectory(prefix='fala-messages-') as tmp:
            out=package.build(Path(tmp)/'out',Path(tmp)/'package.zip')
            script=r'''
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const base=process.argv[1],siteURL='https://liuxing9931-gif.github.io/meu-brasil/';
const site=vm.createContext({console,location:{origin:'https://liuxing9931-gif.github.io',pathname:'/meu-brasil/'}});
site.window=site;site.self=site;vm.runInContext(fs.readFileSync(base+'/shared/core.js','utf8'),site);
let saved='';let fail=false;
site.localStorage={setItem:(k,v)=>{if(fail)throw Error('QuotaExceededError');saved=v},getItem:k=>saved};
const fixture={version:1,cards:[{id:'one',pt:'Pode repetir?',zh:'再说一次',en:'Repeat?',type:'word',source:'test',due:0,started:false}],settings:{newLimit:10,reviewLimit:30,readingRate:1.5},days:{},completed:['hello'],sessions:[{id:'keep'}],checkins:[],other:{preserve:true}};
vm.runInContext('let state='+JSON.stringify(fixture)+';let route="review",reviewCard=null,revealed=false;function save(){};let renders=0;function render(){renders++}',site);
const store={};let listener,tabList=[],behaviour;
const chrome={
 runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener:f=>listener=f},onInstalled:{addListener:()=>{}},onStartup:{addListener:()=>{}}},
 storage:{local:{get:async k=>structuredClone(store),set:async d=>Object.assign(store,structuredClone(d))}},
 tabs:{query:async()=>tabList,create:async()=>{const t={id:1,url:siteURL,status:'complete',windowId:1};tabList.push(t);return t},get:async id=>tabList.find(t=>t.id===id),update:async()=>{}},
 windows:{update:async()=>{}},sidePanel:{setPanelBehavior:async x=>{behaviour=x}},
 scripting:{executeScript:async opts=>{
  if(opts.files){for(const file of opts.files)vm.runInContext(fs.readFileSync(base+'/'+file,'utf8'),site);return [{result:null}]}
  const call='('+opts.func.toString()+')(...'+JSON.stringify(opts.args)+')';return [{result:vm.runInContext(call,site)}];
 }}
};
const worker=vm.createContext({chrome,console,setTimeout,URL,crypto:require('node:crypto').webcrypto});worker.self=worker;
worker.importScripts=(...files)=>{for(const f of files)vm.runInContext(fs.readFileSync(base+'/'+f,'utf8'),worker)};
vm.runInContext(fs.readFileSync(base+'/background.js','utf8'),worker);
const message=(type,data={})=>new Promise(resolve=>listener({type,...data},{id:'test',url:'chrome-extension://test/sidepanel.html'},resolve));
(async()=>{
 assert.equal(behaviour.openPanelOnActionClick,true);
 let response=await message('READ');assert.equal(response.ok,true);assert.equal(response.value.state,null);
 response=await message('SYNC');assert.equal(response.ok,true,response.error);assert.equal(response.value.state.cards.length,1);
 const expected=vm.runInContext('FalaSync.fingerprint(state.cards[0])',site);
 const race=await Promise.all([message('GRADE',{cardId:'one',grade:'good',expected}),message('GRADE',{cardId:'one',grade:'easy',expected})]);
 assert.equal(race.filter(x=>x.ok).length,1);assert.equal(race.filter(x=>!x.ok).length,1);
 assert.equal(store.falaSidepanel.pending.length,1);
 // Failed persistence must neither mutate live PWA memory nor acknowledge the event.
 fail=true;response=await message('SYNC');assert.equal(response.ok,false);
 assert.equal(vm.runInContext('state.cards[0].started',site),false);assert.equal(store.falaSidepanel.pending.length,1);
 fail=false;response=await message('SYNC');assert.equal(response.ok,true);assert.equal(store.falaSidepanel.pending.length,0);
 assert.equal(vm.runInContext('state.cards[0].started',site),true);
 assert.equal(vm.runInContext('state.completed[0]',site),'hello');assert.equal(vm.runInContext('state.sessions[0].id',site),'keep');
 assert.equal(vm.runInContext('state.settings.readingRate',site),1.5);assert.equal(vm.runInContext('state.other.preserve',site),true);
 const ratings=vm.runInContext('Object.values(state.days)[0].ratings',site);
 await message('SYNC');assert.equal(vm.runInContext('Object.values(state.days)[0].ratings',site),ratings);
 // New vocabulary is added without replacing courses or existing progress.
 response=await message('ADD_CARD',{pt:'molho',zh:'酱汁',en:'sauce'});assert.equal(response.ok,true);
 await message('SYNC');assert.equal(vm.runInContext('state.cards.some(c=>c.id==="word:molho")',site),true);
 // Two matching tabs are a safe stop, not a blind overwrite.
 tabList.push({id:2,url:siteURL,status:'complete',windowId:2});response=await message('SYNC');assert.equal(response.ok,false);assert.match(response.error,/多个/);
 tabList.pop();
 // Keep pending conflict records and require explicit resolution.
 const target=store.falaSidepanel.state.cards.find(c=>c.id==='word:molho');
 const fp=vm.runInContext('FalaSync.fingerprint(state.cards.find(c=>c.id==="word:molho"))',site);
 await message('GRADE',{cardId:'word:molho',grade:'good',expected:fp});
 vm.runInContext('state.cards.find(c=>c.id==="word:molho").due=Date.now()+99999999',site);
 response=await message('SYNC');assert.equal(response.ok,true);assert.equal(response.value.conflicts.length,1);assert.equal(response.value.pending.length,1);
 response=await message('DISCARD_CONFLICTS');assert.equal(response.ok,true);assert.equal(response.value.pending.length,0);
 assert.equal(response.value.conflicts.length,0);
 // Import cannot erase unsynced grades, and unrelated source pages are rejected.
 await message('ADD_CARD',{pt:'prazo',zh:'期限',en:'deadline'});
 response=await message('IMPORT',{state:fixture});assert.equal(response.ok,false);
 await message('SYNC');
 const imported={...fixture,cards:[{...fixture.cards[0],id:'from-another-profile'}]};
 response=await message('IMPORT',{state:imported});assert.equal(response.ok,true);
 response=await message('SYNC');assert.equal(response.ok,false);assert.match(response.error,/不一致/);
 assert.equal(store.falaSidepanel.state.cards[0].id,'from-another-profile');
 site.location.pathname='/other-project/';response=await message('SYNC');assert.equal(response.ok,false);
 console.log('Background and bridge transaction tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
'''
            result=subprocess.run(['node','-e',script,str(out)],cwd=ROOT,capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
