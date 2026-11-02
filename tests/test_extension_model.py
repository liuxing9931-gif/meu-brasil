"""Deterministic sync tests: retries, conflicts, deletion, preservation and stale panels."""
from pathlib import Path
import subprocess
import unittest
ROOT=Path(__file__).resolve().parents[1]

class ExtensionModel(unittest.TestCase):
    def test_event_sync_contract(self):
        script=r'''
const assert=require('node:assert/strict');
require('./core.js');require('./extension/sync-model.js');
const M=globalThis.FalaSync,now=new Date(2026,10,2,10).getTime(),day=FalaCore.dayKey(new Date(now));
const card={id:'c1',pt:'Pode repetir?',zh:'再说一次？',en:'Repeat?',type:'word',source:'旧收藏',created:1,due:0,started:false};
const initial=()=>({version:1,cards:[{...card}],settings:{newLimit:10,reviewLimit:30,goal:15,readingRate:1.5,theme:'spring'},days:{[day]:{seconds:143,newIds:[],reviewIds:[],ratings:0}},completed:['hello'],checkins:[day],sessions:[{id:'old-session'}],futureField:{keep:true}});
const bundle=s=>({state:M.snapshot(s),pending:[],conflicts:[],prefs:{autoSpeak:false},lastSync:null});
for(const grade of ['again','hard','good','easy']){
 const input=initial(),ev=M.makeEvent(M.snapshot(input),'c1',grade,now,'ev-'+grade);
 const out=M.applyEvents(input,[ev]);
 assert.equal(input.cards[0].started,false);assert.equal(out.state.cards[0].started,true);
 assert.deepEqual(out.state.completed,['hello']);assert.deepEqual(out.state.sessions,[{id:'old-session'}]);
 assert.deepEqual(out.state.futureField,{keep:true});assert.equal(out.state.settings.readingRate,1.5);
 assert.equal(out.state.days[day].seconds,143);assert.equal(out.state.days[day].ratings,1);
 assert.deepEqual(out.state.days[day].newIds,['c1']);
 assert.equal(M.applyEvents(out.state,[ev]).state.days[day].ratings,1);
 assert.deepEqual(out.acknowledged,['ev-'+grade]);
}
let local=bundle(initial());const oldFingerprint=M.fingerprint(local.state.cards[0]);
local=M.queueGrade(local,'c1','again',now,'e1',oldFingerprint);
assert.throws(()=>M.queueGrade(local,'c1','good',now,'stale',oldFingerprint),/其他侧栏/);
local=M.queueGrade(local,'c1','good',now+61000,'e2',M.fingerprint(local.state.cards[0]));
const applied=M.applyEvents(initial(),local.pending);
assert.equal(applied.state.days[day].ratings,2);assert.deepEqual(applied.state.days[day].newIds,['c1']);
assert.deepEqual(applied.state.days[day].reviewIds,[]);
// Lost acknowledgment/retry is still idempotent.
const retry=M.applyEvents(applied.state,local.pending);assert.equal(retry.state.days[day].ratings,2);
const acknowledged=M.mergeSnapshot(local,retry);assert.equal(acknowledged.pending.length,0);
// Changed schedule: do not overwrite or silently discard a conflicting review.
let fresh=initial();fresh.cards[0]=FalaCore.schedule(fresh.cards[0],'easy',now+1000);
const conflict=M.applyEvents(fresh,local.pending);
assert.equal(conflict.conflicts.length,2);assert.equal(conflict.acknowledged.length,0);
assert.deepEqual(conflict.state.cards,fresh.cards);
assert.equal(M.mergeSnapshot(local,conflict).pending.length,2);
// Deleted card is never recreated by a grade.
fresh=initial();fresh.cards=[];assert.equal(M.applyEvents(fresh,local.pending).state.cards.length,0);
// Definition updates on the website survive an offline grade because only schedule fields change.
fresh=initial();fresh.cards[0].zh='网站更新的释义';
assert.equal(M.applyEvents(fresh,local.pending).state.cards[0].zh,'网站更新的释义');
// An intentional new-word add is acknowledged without overwriting an existing card or schedule.
const add={kind:'add',eventId:'add-1',card:{...card,id:'word:teste',pt:'teste',zh:'测试'}};
let added=M.applyEvents(initial(),[add]);assert.equal(added.state.cards.length,2);
added.state.cards[1].zh='保留网站释义';added.state.cards[1].due=999;
assert.equal(M.applyEvents(added.state,[add]).state.cards[1].zh,'保留网站释义');
assert.equal(M.applyEvents(added.state,[add]).state.cards[1].due,999);
assert.throws(()=>M.snapshot({...initial(),cards:[card,card]}),/重复/);
assert.throws(()=>M.snapshot({...initial(),cards:[{...card,due:Infinity}]}),/格式/);
assert.throws(()=>M.applyEvents(initial(),[{...local.pending[0],grade:'unsafe'}]),/格式/);
const atLimit=initial();atLimit.settings.newLimit=0;
assert.throws(()=>M.makeEvent(M.snapshot(atLimit),'c1','good',now,'limit'),/上限/);
console.log('Sync invariants passed');
'''
        result=subprocess.run(['node','-e',script],cwd=ROOT,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
