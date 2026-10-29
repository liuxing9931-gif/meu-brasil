"""Run with: python3 -m unittest discover -s tests -p test_ui.py -v
Requires Python Playwright and Chromium. No real AI calls are made.
"""
import json
import os
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parent))
import test_server as fixtures
Provider = fixtures.Provider
from playwright.sync_api import sync_playwright

class Browser(unittest.TestCase):
    setUp = fixtures.API.setUp
    tearDown = fixtures.API.tearDown
    def test_cross_origin_pages_connection(self):
        static = fixtures.server.Server(('127.0.0.1',0)); fixtures.running(static)
        origin = f'http://127.0.0.1:{static.server_port}'
        self.app.allowed_origins.add(origin)
        try:
            with sync_playwright() as p:
                b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
                page=b.new_page();page.goto(origin);page.locator('[data-action="ai"]').click()
                page.locator('#buddy-endpoint').fill(self.url);page.locator('#buddy-password').fill('test-access')
                page.locator('#buddy-connection button').click()
                page.wait_for_function('document.querySelector(".ai-connection summary").textContent.includes("已就绪")')
                page.locator('#buddy-autospeak').uncheck()
                page.locator('#buddy-text').fill('Olá');page.locator('#buddy-form button[type="submit"]').click()
                page.wait_for_selector('.buddy-message:not(.mine)')
                self.assertEqual(len(Provider.calls),1)
                b.close()
        finally:
            static.shutdown();static.server_close()

    def test_learning_and_ai(self):
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'), args=['--no-sandbox'])
            context = browser.new_context(viewport={'width':1280,'height':900})
            context.add_init_script('''
              window.spoken=[];window.SpeechSynthesisUtterance=class {constructor(text){this.text=text}};
              Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[
                {voiceURI:'pt-male',name:'Daniel',lang:'pt-BR'},
                {voiceURI:'pt-female',name:'Luciana',lang:'pt-BR'},
                {voiceURI:'en-male',name:'David',lang:'en-US'},
                {voiceURI:'zh-male',name:'Yunxi',lang:'zh-CN'}],
                speak:u=>window.spoken.push({text:u.text,lang:u.lang,voice:u.voice.voiceURI}),cancel:()=>{}}});
              window.SpeechRecognition=class {
                start(){setTimeout(()=>{this.onresult({results:[[{transcript:'Quero café'}]]});this.onend();},100)}
                stop(){this.onend?.()} abort(){}
              };
            ''')
            page=context.new_page(); errors=[]; page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(self.url)
            self.assertIn('连续打卡 1 天',page.locator('.checkin-banner').inner_text())
            page.reload(); self.assertEqual(page.evaluate('state.checkins.length'),1)
            self.assertEqual(page.locator('.checkin-week>span').count(),7)
            page.locator('[data-action="start"]').first.click(); page.locator('[data-save]').first.click()
            page.locator('[data-route="review"]').first.click(); page.locator('[data-action="reveal"]').click()
            self.assertEqual(page.evaluate('spoken.at(-1).text'),'Oi! Tudo bem?')
            page.locator('[data-grade="good"]').click(); self.assertEqual(page.evaluate('state.cards[0].reps'),1)
            page.locator('[data-route="stats"]').first.click(); self.assertEqual(page.locator('.session-panel').count(),0)
            self.assertEqual(page.locator('.bar-col').count(),7)
            page.evaluate('today().seconds=150;render()')
            self.assertEqual(page.locator('.bar-col').last.locator('span').inner_text(),'2.5')
            self.assertEqual(page.evaluate('state.sessions.length'),0)
            page.locator('[data-route="courses"]').first.click()
            for cid in ['restaurant','collaboration']:
                card=page.locator('[data-course="'+cid+'"]'); self.assertIn('20 句对话 · 5 组短语',card.inner_text())
                card.click();self.assertEqual(page.locator('.message').count(),20);self.assertEqual(page.locator('.phrase-card').count(),5)
                page.locator('[data-action="complete"]').click();self.assertIn('1 / 10',page.locator('.practice-progress').inner_text())
                page.locator('[data-route="courses"]').first.click()
            page.locator('[data-route="home"]').first.click();page.locator('[data-action="ai"]').click()
            self.assertEqual(page.locator('#buddy-gender').input_value(),'male')
            page.locator('#buddy-password').fill('test-access');page.locator('#buddy-connection button').click()
            page.wait_for_function('document.querySelector(".ai-connection summary").textContent.includes("已就绪")')
            page.locator('#buddy-text').fill('我想喝咖啡怎么说？');page.locator('#buddy-form button[type="submit"]').click()
            page.wait_for_selector('.buddy-message:not(.mine)')
            self.assertIn('Olá!',page.locator('.buddy-message:not(.mine)').inner_text())
            self.assertEqual(page.evaluate('spoken.at(-1).voice'),'pt-male')
            page.locator('.buddy-message [data-word="café"]').first.click()
            self.assertEqual(page.locator('#word-form [name="zh"]').input_value(),'咖啡')
            page.locator('#word-form button[type="submit"]').click()
            self.assertTrue(page.evaluate('state.cards.some(c=>c.id==="word:café")'))
            page.locator('[data-buddy="mic"]').click();page.wait_for_function('document.querySelector("#buddy-text").value.includes("Quero café")')
            page.locator('#buddy-language').select_option('en-US');page.locator('#buddy-form button[type="submit"]').click()
            page.wait_for_function('document.querySelectorAll(".buddy-message:not(.mine)").length===2')
            self.assertIn('English',Provider.calls[-1][1]['messages'][0]['content'])
            self.assertEqual(page.evaluate('spoken.at(-1).lang'),'en-US')
            # Authentication errors retain draft and do not leave a phantom user message.
            page.locator('.ai-connection summary').click();page.locator('#buddy-password').fill('wrong');page.locator('#buddy-connection button').click()
            page.locator('#buddy-text').fill('请帮我纠错');page.locator('#buddy-form button[type="submit"]').click()
            page.wait_for_selector('.buddy-error');page.wait_for_function('!document.querySelector("#buddy-text").disabled')
            self.assertEqual(page.locator('#buddy-text').input_value(),'请帮我纠错')
            self.assertEqual(page.locator('.buddy-message.mine').count(),2)
            # Old state compatibility and break-in-streak encouragement.
            page.evaluate('''()=>{const d=new Date();d.setDate(d.getDate()-3);state.checkins=[dayKey(d)];save()}''')
            page.reload();self.assertIn('欢迎回来',page.locator('.checkin-banner').inner_text())
            page.evaluate('''()=>{state.checkins=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return dayKey(d)});save();render()}''')
            self.assertIn('一周坚持徽章',page.locator('.checkin-banner').inner_text())
            # Import an older v1 backup without checkins; existing cards and checkins survive.
            page.locator('[data-action="settings"]').first.click()
            old={'version':1,'cards':[],'completed':['hello'],'days':{},'sessions':[]}
            page.locator('#import-file').set_input_files({'name':'old.json','mimeType':'application/json','buffer':json.dumps(old).encode()})
            page.wait_for_function('!document.querySelector("#modal").open')
            self.assertEqual(page.evaluate('state.checkins.length'),7)
            self.assertTrue(page.evaluate('state.cards.some(c=>c.id==="word:café")'))
            page.set_viewport_size({'width':390,'height':844});page.locator('[data-action="ai"]').click()
            self.assertTrue(page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            page.screenshot(path='/tmp/fala-mobile.png',full_page=True)
            page.evaluate('navigator.serviceWorker.ready');page.wait_for_function('navigator.serviceWorker.controller!==null')
            cached=page.evaluate('caches.open("fala-v1.3.1").then(c=>c.keys()).then(a=>a.map(r=>new URL(r.url).pathname))')
            self.assertEqual(len(cached),18);self.assertFalse(any('/api/' in path for path in cached))
            context.set_offline(True);page.reload();page.wait_for_selector('.checkin-banner')
            self.assertTrue(page.evaluate('state.cards.some(c=>c.id==="word:café")'))
            self.assertEqual(errors,[])
            browser.close()

if __name__=='__main__':unittest.main()
