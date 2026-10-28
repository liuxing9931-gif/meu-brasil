"""Reading, offline word lookup, and speech cancellation regressions."""
import json
import os
from pathlib import Path
import re
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parent))
import test_server as fixtures
from playwright.sync_api import sync_playwright

class Reading(unittest.TestCase):
    setUp=fixtures.API.setUp
    tearDown=fixtures.API.tearDown

    def test_reading_and_silent_review(self):
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
            c=browser.new_context(viewport={'width':1200,'height':850})
            c.add_init_script('''
              window.spoken=[];window.speechEvents=[];window.playing=false;
              window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
              Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{voiceURI:'pt',name:'Daniel',lang:'pt-BR'}],
               cancel:()=>{playing=false;speechEvents.push('cancel')},speak:u=>{playing=true;spoken.push({text:u.text,rate:u.rate});speechEvents.push('speak')}}});
            ''')
            page=c.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(self.url)
            # Preserve an existing user's card, progress, check-in and data key.
            page.evaluate('''()=>{state.cards=[{id:'old-card',pt:'Bom dia.',zh:'早上好',en:'Good morning',type:'sentence',source:'旧收藏',due:0,started:false}];state.completed=['hello'];save()}''')
            page.locator('[data-route="reading"]').first.click()
            self.assertEqual(page.locator('.reading-level').count(),4)
            self.assertEqual(page.locator('.reading-card').count(),3)
            page.locator('[data-reading-level="B1"]').click();self.assertIn('内容',page.locator('[data-reading-level="B1"]').inner_text())
            self.assertEqual(page.locator('.reading-card').count(),0)
            page.locator('[data-reading-level="A1"]').click();page.locator('[data-reading-article]').first.click()
            self.assertEqual(page.locator('.reading-translations:not([hidden])').count(),0)
            page.locator('[data-reading-translation="0"]').click()
            self.assertEqual(page.locator('.reading-translations:not([hidden])').count(),1)
            self.assertIn('我叫李',page.locator('#translation-0').inner_text())
            self.assertIn('My name',page.locator('#translation-0').inner_text())
            # Every requested rate is passed to the speech engine, and the setting persists.
            for value in ['0.5','0.8','1','1.5','2']:
                page.locator('#reading-rate').select_option(value);page.locator('[data-reading-speak="0"]').click()
                self.assertEqual(page.evaluate('spoken.at(-1).rate'),float(value))
            page.locator('.reading-line [data-word="vizinha"]').click()
            self.assertEqual(page.locator('#word-form [name="zh"]').input_value(),'女邻居')
            page.locator('#word-form button[type="submit"]').click()
            self.assertTrue(page.evaluate('state.cards.some(c=>c.id==="word:vizinha")'))
            self.assertIn('hello',page.evaluate('state.completed'))
            # Verify article structure, word count and lookup coverage in the real runtime.
            results=page.evaluate('''()=>READINGS.map(a=>({id:a.id,level:a.level,count:a.sentences.map(s=>s.pt).join(' ').match(/[\\p{L}]+(?:[-’'][\\p{L}]+)*/gu).length,notes:a.notes.length,allTranslated:a.sentences.every(s=>s.zh&&s.en),unknown:a.sentences.flatMap(s=>s.pt.match(/[\\p{L}]+(?:[-’'][\\p{L}]+)*/gu)).filter(w=>!FalaLexicon.lookup(w))}))''')
            self.assertEqual(len(results),6)
            for a in results:
                self.assertTrue(100<=a['count']<=200,a)
                self.assertLessEqual(a['notes'],15);self.assertTrue(a['allTranslated']);self.assertEqual(a['unknown'],[])
            # External dictionary fallback, not just the original small learning dictionary.
            result=page.evaluate('FalaLexicon.lookup("elefante")')
            self.assertIn('elephant',result['en']);self.assertIn('FreeDict',result['source'])
            self.assertTrue(result['pivot'])
            page.evaluate('wordModal("elefante")');self.assertIn('英文中转',page.locator('#modal').inner_text())
            page.locator('[data-action="close-modal"]').click()
            # All four grading buttons cancel a currently playing utterance, and do not speak next card.
            page.locator('[data-route="review"]').first.click()
            for grade in ['again','hard','good','easy']:
                page.evaluate('''()=>{state.cards=Array.from({length:2},(_,i)=>({id:'test'+i,pt:'Uma frase longa para ouvir com calma.',zh:'测试句',en:'Test',type:'sentence',source:'测试',due:0,started:false}));state.days[dayKey()]={seconds:0,newIds:[],reviewIds:[],ratings:0};reviewCard=null;render()}''')
                page.locator('[data-action="reveal"]').click();self.assertTrue(page.evaluate('playing'))
                before=page.evaluate('spoken.length');page.locator('[data-grade="'+grade+'"]').click()
                self.assertFalse(page.evaluate('playing'));self.assertEqual(page.evaluate('spoken.length'),before)
                self.assertEqual(page.locator('.answer').count(),0)
                page.locator('[data-action="reveal"]').click();self.assertEqual(page.evaluate('spoken.length'),before+1)
            # Offline reload includes the entire dictionary and readings.
            page.evaluate('navigator.serviceWorker.ready');page.wait_for_function('navigator.serviceWorker.controller!==null')
            c.set_offline(True);page.reload();page.locator('[data-route="reading"]').first.click()
            page.locator('[data-reading-level="A2"]').click();page.locator('[data-reading-article]').first.click()
            page.evaluate('wordModal("elefante")');self.assertIn('elephant',page.locator('#modal').inner_text())
            page.locator('[data-action="close-modal"]').click()
            page.set_viewport_size({'width':390,'height':844})
            self.assertTrue(page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            self.assertTrue(page.locator('[data-reading-speak="0"]').is_visible())
            page.screenshot(path='/tmp/fala-reading-mobile.png',full_page=True)
            self.assertEqual(errors,[])
            browser.close()

if __name__=='__main__':unittest.main()
