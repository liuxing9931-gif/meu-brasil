"""User-facing translation, morphology and two-sheet player regression checks.
No live AI or real speech service is required; speech callbacks are controlled explicitly.
"""
import os
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parent))
import test_server as fixtures
from playwright.sync_api import sync_playwright

SPEECH_STUB='''
window.spoken=[];window.currentSpeech=null;window.lastCancelled=null;window.nativePaused=false;
window.ptVoices=[{voiceURI:'pt',name:'Daniel',lang:'pt-BR'}];
window.SpeechSynthesisUtterance=class {constructor(text){this.text=text}};
Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>ptVoices,
 cancel:()=>{lastCancelled=currentSpeech;currentSpeech=null;nativePaused=false},
 pause:()=>{nativePaused=true},resume:()=>{nativePaused=false},
 speak:u=>{currentSpeech=u;spoken.push(u)}}});
window.finishSpeech=()=>{const u=currentSpeech;currentSpeech=null;u?.onend?.()};
'''

class ReaderPlayer(unittest.TestCase):
    setUp=fixtures.API.setUp
    tearDown=fixtures.API.tearDown

    def test_lesson_translation_and_verbs(self):
        with sync_playwright() as p:
            b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
            page=b.new_page();page.add_init_script(SPEECH_STUB);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(self.url);page.locator('[data-action="start"]').first.click()
            self.assertEqual(page.locator('[data-action="toggle-trans"]').count(),0)
            self.assertEqual(page.locator('.lesson-translation:not([hidden])').count(),0)
            page.locator('[data-lesson-translation="hello:0"]').click()
            self.assertEqual(page.locator('.lesson-translation:not([hidden])').count(),1)
            self.assertIn('嗨！',page.locator('[id="lesson-translation-hello:0"]').inner_text())
            self.assertIn('Hi!',page.locator('[id="lesson-translation-hello:0"]').inner_text())
            page.locator('[data-lesson-translation="hello:1"]').click()
            page.locator('[data-lesson-translation="hello:0"]').click()
            self.assertEqual(page.locator('[data-lesson-translation="hello:0"]').get_attribute('aria-expanded'),'false')
            page.locator('.message [data-save]').first.click()
            self.assertEqual(page.locator('[data-lesson-translation="hello:1"]').get_attribute('aria-expanded'),'true')
            self.assertTrue(page.evaluate('state.cards.some(c=>c.id==="hello:0")'))
            page.locator('[data-lesson-translation="hello:p0"]').click()
            self.assertEqual(page.locator('[data-lesson-translation="hello:p0"]').get_attribute('aria-expanded'),'true')
            page.evaluate('wordModal("estou")')
            self.assertEqual(page.locator('.verb-lemma h4 [lang]').inner_text(),'estar')
            self.assertIn('第一人称单数',page.locator('.verb-analysis').inner_text())
            self.assertIn('现在时',page.locator('.verb-analysis').inner_text())
            page.evaluate('wordModal("foi")')
            self.assertEqual(page.locator('.verb-lemma').count(),2)
            self.assertIn('ir',page.locator('.verb-lemma h4 [lang]').all_inner_texts())
            self.assertIn('ser',page.locator('.verb-lemma h4 [lang]').all_inner_texts())
            page.evaluate('wordModal("trabalhamos")')
            matches=page.evaluate('FalaVerbs.analyze("trabalhamos")')
            self.assertEqual({m['tag'] for m in matches},{'V;1;PL;IND;PRS','V;1;PL;IND;PST;PFV'})
            page.locator('.verb-lemma summary').click()
            page.locator('[data-verb-tense]').select_option('V;IND;PST;PFV')
            self.assertIn('trabalhamos',page.locator('.verb-table').inner_text())
            self.assertIn('trabalhámos',page.locator('.verb-table').inner_text())
            subj=page.evaluate('FalaVerbs.analyze("confirmasse")')
            self.assertEqual({m['person'] for m in subj},{'第一人称单数 · eu','第三人称单数 · ele/ela/você'})
            self.assertTrue(all('虚拟式' in m['tense'] for m in subj))
            self.assertEqual(page.evaluate('FalaVerbs.analyze("xyznotaverb")'),[])
            page.locator('[data-action="close-modal"]').click()
            page.locator('[data-route="review"]').first.click()
            self.assertEqual(page.locator('[data-lesson-translation]').count(),0)
            self.assertEqual(errors,[]);b.close()

    def test_player_and_two_sheet_layout(self):
        with sync_playwright() as p:
            b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
            c=b.new_context(viewport={'width':1280,'height':900});c.add_init_script(SPEECH_STUB)
            page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(self.url);page.locator('[data-route="reading"]:visible').first.click();page.locator('[data-reading-article]').first.click()
            self.assertEqual(page.locator('.reading-player button').count(),3)
            self.assertTrue(page.evaluate('document.querySelector(".reading-text").scrollHeight>document.querySelector(".reading-text").clientHeight'))
            page.locator('[data-reading-control="toggle"]').click()
            self.assertEqual(page.evaluate('spoken.length'),1)
            first=page.evaluate('currentSpeech.text')
            page.evaluate('finishSpeech()')
            self.assertEqual(page.evaluate('spoken.length'),2)
            self.assertNotEqual(page.evaluate('currentSpeech.text'),first)
            second=page.evaluate('currentSpeech.text')
            page.locator('[data-reading-control="toggle"]').click()
            self.assertTrue(page.evaluate('nativePaused'));self.assertIn('已暂停',page.locator('.reading-player-status').inner_text())
            page.locator('[data-reading-translation="1"]').click()
            self.assertIn('已暂停',page.locator('.reading-player-status').inner_text())
            page.locator('[data-reading-control="toggle"]').click()
            self.assertFalse(page.evaluate('nativePaused'));self.assertEqual(page.evaluate('spoken.length'),2)
            self.assertEqual(page.evaluate('currentSpeech.text'),second)
            page.evaluate('window.staleSpeech=currentSpeech')
            page.locator('[data-reading-control="next"]').click()
            target=page.evaluate('currentSpeech.text');count=page.evaluate('spoken.length')
            page.evaluate('staleSpeech.onend()')
            self.assertEqual(page.evaluate('spoken.length'),count);self.assertEqual(page.evaluate('currentSpeech.text'),target)
            page.locator('[data-reading-control="prev"]').click();self.assertEqual(page.evaluate('currentSpeech.text'),second)
            # End of article stops; play after completion restarts the whole text.
            last=page.locator('[data-reading-speak]').count()-1
            page.locator('[data-reading-speak="'+str(last)+'"]').click()
            page.evaluate('finishSpeech()')  # standalone sentence must not auto-advance
            self.assertIn('待播放',page.locator('.reading-player-status').inner_text())
            page.locator('[data-reading-control="toggle"]').click();page.evaluate('finishSpeech()')
            self.assertIn('全文播放完毕',page.locator('.reading-player-status').inner_text())
            page.locator('[data-reading-control="toggle"]').click();self.assertEqual(page.evaluate('currentSpeech.text'),first)
            page.locator('#reading-rate').select_option('1.5')
            self.assertIsNone(page.evaluate('currentSpeech'))
            page.locator('[data-reading-control="toggle"]').click();self.assertEqual(page.evaluate('currentSpeech.rate'),1.5)
            # Explicit page switch and native outer scrollbar both stop article playback.
            page.locator('[data-reading-paper="notes"]').click()
            self.assertIsNone(page.evaluate('currentSpeech'))
            self.assertEqual(page.locator('#reading-notes-paper .reading-player').count(),0)
            self.assertEqual(page.locator('[data-reading-note]').count(),page.evaluate('READINGS[0].notes.length'))
            page.screenshot(path='/tmp/fala-reader-notes.png',full_page=True)
            page.locator('[data-reading-note="0"]').click()
            self.assertEqual(page.evaluate('currentSpeech.text'),page.evaluate('READINGS[0].notes[0].pt'))
            self.assertEqual(page.evaluate('currentSpeech.rate'),1.5)
            page.locator('[data-reading-paper="article"]').click()
            page.locator('[data-reading-control="toggle"]').click()
            page.evaluate('document.querySelector(".reading-book").scrollTop=document.querySelector("#reading-notes-paper").offsetTop')
            page.wait_for_function('document.querySelector("[data-reading-paper=notes]").getAttribute("aria-pressed")==="true"')
            self.assertIsNone(page.evaluate('currentSpeech'))
            page.locator('[data-reading-paper="article"]').click()
            # Word lookup / save rerenders must preserve inner paper scroll position.
            page.evaluate('document.querySelector(".reading-text").scrollTop=240')
            before=page.evaluate('document.querySelector(".reading-text").scrollTop')
            page.evaluate('wordModal("estou")');page.locator('#word-form button[type="submit"]').click()
            self.assertAlmostEqual(page.evaluate('document.querySelector(".reading-text").scrollTop'),before,delta=2)
            # Controls remain within the viewport and above the mobile app navigation.
            for width,height in [(1280,900),(390,844),(844,430)]:
                page.set_viewport_size({'width':width,'height':height})
                page.wait_for_timeout(120)
                geometry=page.evaluate('''()=>{const p=document.querySelector('.reading-player').getBoundingClientRect(),n=document.querySelector('#mobile-nav'),edge=getComputedStyle(n).display==='none'?innerHeight:n.getBoundingClientRect().top;return {bottom:p.bottom,top:p.top,edge,wide:document.documentElement.scrollWidth>innerWidth}}''')
                self.assertLessEqual(geometry['bottom'],geometry['edge']);self.assertGreaterEqual(geometry['top'],0);self.assertFalse(geometry['wide'])
            page.set_viewport_size({'width':1280,'height':900});page.wait_for_timeout(120)
            page.screenshot(path='/tmp/fala-player-desktop.png',full_page=True)
            page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(120)
            page.screenshot(path='/tmp/fala-player-mobile.png',full_page=True)
            # No voice is an actionable error, never a fake playing indicator.
            page.evaluate('ptVoices=[]');page.locator('[data-reading-control="toggle"]').click()
            self.assertIn('待播放',page.locator('.reading-player-status').inner_text())
            page.evaluate('ptVoices=[{voiceURI:"pt",name:"Daniel",lang:"pt-BR"}]')
            # Offline refresh retains both definitions and the new morphology dataset.
            page.evaluate('navigator.serviceWorker.ready');page.wait_for_function('navigator.serviceWorker.controller!==null')
            c.set_offline(True);page.reload();page.evaluate('wordModal("foi")')
            self.assertEqual(page.locator('.verb-lemma').count(),2)
            page.locator('[data-action="close-modal"]').click()
            page.locator('[data-route="reading"]:visible').first.click();page.locator('[data-reading-article]').first.click()
            page.locator('[data-reading-control="toggle"]').click();self.assertIsNotNone(page.evaluate('currentSpeech.text'))
            page.locator('[data-route="home"]:visible').first.click();self.assertIsNone(page.evaluate('currentSpeech'))
            self.assertEqual(errors,[]);b.close()

if __name__=='__main__':unittest.main()
