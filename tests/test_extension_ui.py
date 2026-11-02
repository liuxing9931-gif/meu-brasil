"""Interactive no-install preview, plus actual MV3 APIs in a temporary Chromium profile."""
import functools
import importlib.util
import json
import os
import mimetypes
from urllib.parse import urlsplit
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('extension_build',ROOT/'tools/build_extension.py')
package=importlib.util.module_from_spec(spec);spec.loader.exec_module(package)

STUB='''
window.spoken=[];window.stopped=0;
window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{voiceURI:'pt',name:'Daniel',lang:'pt-BR'}],speak:u=>spoken.push(u.text),cancel:()=>stopped++}});
'''

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

class ExtensionUI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory(prefix='fala-panel-package-');cls.out=Path(cls.tmp.name)/'package'
        package.build(cls.out,Path(cls.tmp.name)/'panel.zip')
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(cls.out)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.url=f'http://127.0.0.1:{cls.server.server_port}'
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.tmp.cleanup()

    def test_interactive_preview(self):
        with sync_playwright() as p:
            b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            c=b.new_context(viewport={'width':380,'height':900});c.add_init_script(STUB)
            page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(self.url+'/sidepanel.html');page.wait_for_selector('.flashcard')
            self.assertIn('预览模式',page.locator('#preview-note').inner_text())
            self.assertEqual(page.locator('[data-grade]:disabled').count(),4)
            self.assertEqual(page.evaluate('spoken.length'),0)
            screenshots=ROOT/'extension/previews';screenshots.mkdir(exist_ok=True)
            page.screenshot(path=str(screenshots/'question.png'),full_page=True)
            page.locator('[data-action="reveal"]').click()
            self.assertEqual(page.locator('[data-grade]:disabled').count(),0)
            self.assertIn('Pode trazer',page.locator('.portuguese').inner_text())
            self.assertEqual(page.evaluate('spoken.length'),0)  # default quiet
            page.screenshot(path=str(screenshots/'answer.png'),full_page=True)
            page.locator('[data-word="molho"]').click();self.assertTrue(page.locator('#modal').is_visible())
            self.assertTrue(page.locator('#word-form [name="en"]').input_value())
            page.locator('#word-form [type="submit"]').click()
            self.assertTrue(page.evaluate('bundle.state.cards.some(c=>c.id==="word:molho")'))
            page.locator('#sound-toggle').click()
            page.locator('.listen-button:visible').click();self.assertEqual(page.evaluate('spoken.length'),1)
            before=page.evaluate('stopped');page.locator('[data-grade="good"]').click()
            self.assertGreater(page.evaluate('stopped'),before)
            self.assertEqual(page.locator('#daily-count').inner_text(),'4')
            self.assertEqual(page.locator('.answer').count(),0)
            for filter in ['word','phrase','sentence']:
                page.locator('[data-filter="'+filter+'"]').click();self.assertEqual(page.locator('.flashcard').count(),1)
            page.locator('#settings-open').click();self.assertIn('不会读取',page.locator('#modal-content').inner_text())
            page.locator('#modal-close').click();page.locator('#sync-button').click()
            self.assertIn('示例预览',page.locator('#toast').inner_text())
            for width in [300,360,420]:
                page.set_viewport_size({'width':width,'height':900});self.assertFalse(page.evaluate('document.documentElement.scrollWidth>innerWidth'))
            page.set_viewport_size({'width':1440,'height':960});page.goto(self.url+'/preview.html')
            frame=page.frame_locator('iframe');frame.locator('[data-action="reveal"]').click()
            page.screenshot(path=str(screenshots/'desktop.png'),full_page=True)
            page.locator('#toggle-panel').click();self.assertFalse(page.locator('.preview-panel').is_visible())
            page.locator('#toggle-panel').click();self.assertTrue(page.locator('.preview-panel').is_visible())
            self.assertEqual(errors,[]);b.close()

    @unittest.skipUnless(os.environ.get("FALA_TEST_FILE_PREVIEW")=="1", "Local file preview is opt-in: file:// navigation is blocked by this development browser's administrator policy.")
    def test_local_file_preview(self):
        with sync_playwright() as p:
            b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            page=b.new_page();page.goto((self.out/'preview.html').as_uri())
            page.frame_locator('iframe').locator('[data-action="reveal"]').click()
            self.assertEqual(page.frame_locator('iframe').locator('[data-grade]:disabled').count(),0)
            b.close()

    def test_live_pwa_main_world_bridge(self):
        site='https://liuxing9931-gif.github.io/meu-brasil/'
        def serve(route):
            relative=urlsplit(route.request.url).path.removeprefix('/meu-brasil/') or 'index.html'
            file=(ROOT/relative).resolve()
            if file.is_relative_to(ROOT) and file.is_file():
                route.fulfill(status=200,content_type=mimetypes.guess_type(file.name)[0] or 'application/octet-stream',body=file.read_bytes())
            else:route.fulfill(status=404,body='not found')
        with sync_playwright() as p:
            b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            c=b.new_context(service_workers='block');c.route(site+'**',serve)
            page=c.new_page();page.goto(site);page.wait_for_selector('#app')
            page.wait_for_function('typeof state!=="undefined" && typeof render==="function"')
            page.evaluate('''()=>{state.cards=[{id:'bridge-test',pt:'Pode repetir?',zh:'再说一次',en:'Repeat?',type:'word',source:'测试',due:0,started:false}];state.completed=['hello'];state.settings.readingRate=1.5;state.extensionTestPreserve='keep';save();route='review';render()}''')
            page.add_script_tag(content=(ROOT/'extension/sync-model.js').read_text())
            page.add_script_tag(content=(ROOT/'extension/pwa-bridge.js').read_text())
            result=page.evaluate('''()=>{const event=FalaSync.makeEvent(FalaSync.snapshot(state),'bridge-test','good',Date.now(),'live-test-1');const a=FalaSidepanelBridge.sync([event]);const b=FalaSidepanelBridge.sync([event]);return {a,b,stored:JSON.parse(localStorage.getItem('fala-v1'))}}''')
            self.assertEqual(result['a']['acknowledged'],['live-test-1'])
            self.assertTrue(result['stored']['cards'][0]['started'])
            self.assertEqual(result['stored']['completed'],['hello'])
            self.assertEqual(result['stored']['extensionTestPreserve'],'keep')
            self.assertEqual(result['stored']['settings']['readingRate'],1.5)
            self.assertEqual(sum(d['ratings'] for d in result['b']['state']['days'].values()),1)
            self.assertTrue(page.evaluate('state.cards[0].started'))
            b.close()

    @unittest.skipUnless(os.environ.get("FALA_TEST_NATIVE_EXTENSION")=="1", "Native extension test not run: this managed Chromium blocks custom extensions (ExtensionInstallBlocklist=*). Run only on an authorized test machine.")
    def test_packaged_mv3_sync(self):
        # Never use an existing Chrome user profile. Network for Fala is mocked at the allowed origin.
        fixture={'version':1,'cards':[{'id':'x','pt':'Pode repetir?','zh':'再说一次？','en':'Repeat?','type':'word','source':'测试收藏','due':0,'started':False}],
                 'settings':{'newLimit':10,'reviewLimit':30,'readingRate':1.5},'days':{},'completed':['hello'],'checkins':[],'sessions':[{'id':'keep'}],'futureField':'preserved'}
        site='https://liuxing9931-gif.github.io/meu-brasil/'
        html='''<!doctype html><title>Fala sync test fixture</title><p id="status">Ready</p><script>
let state=JSON.parse(localStorage.getItem('fala-v1'))||FIXTURE;
let route='review',reviewCard=null,revealed=false;window.renderCount=0;
function save(){localStorage.setItem('fala-v1',JSON.stringify(state))}
function render(){renderCount++}save();
</script>'''.replace('FIXTURE',json.dumps(fixture,ensure_ascii=False))
        html=html.replace('<script>','<script>'+ (ROOT/'core.js').read_text()+'\n',1)
        with tempfile.TemporaryDirectory(prefix='fala-mv3-isolated-') as profile:
            with sync_playwright() as p:
                executable=os.environ.get('EXTENSION_CHROMIUM_PATH','/usr/lib/chromium/chromium')
                c=p.chromium.launch_persistent_context(profile,executable_path=executable,headless=True,ignore_default_args=['--disable-extensions'],args=['--no-sandbox','--enable-unsafe-extension-debugging','--disable-extensions-except='+str(self.out),'--load-extension='+str(self.out)])
                c.route(site+'**',lambda route:route.fulfill(status=200,content_type='text/html',body=html))
                sw=c.service_workers[0] if c.service_workers else c.wait_for_event('serviceworker',timeout=15000)
                base=sw.url.rsplit('/',1)[0]+'/'
                page=c.new_page();page.add_init_script(STUB);page.goto(base+'sidepanel.html');page.wait_for_selector('.empty-state')
                self.assertTrue(page.locator('#preview-note').is_hidden())
                page.locator('#sync-button').click();page.wait_for_selector('.flashcard')
                self.assertIn('再说一次',page.locator('.card-content').inner_text())
                page.locator('[data-action="reveal"]').click();page.locator('[data-grade="good"]').click()
                page.wait_for_selector('.empty-state');self.assertIn('1 条待同步',page.locator('#sync-line').inner_text())
                page.locator('#sync-button').click();page.wait_for_function('document.querySelector("#sync-line").textContent.includes("上次同步")')
                web=next(x for x in c.pages if x.url==site)
                self.assertTrue(web.evaluate('state.cards[0].started'))
                self.assertEqual(web.evaluate('state.sessions'),[{'id':'keep'}]);self.assertEqual(web.evaluate('state.completed'),['hello'])
                self.assertEqual(web.evaluate('state.settings.readingRate'),1.5)
                self.assertEqual(web.evaluate('Object.values(state.days)[0].ratings'),1)
                page.locator('#sync-button').click();page.wait_for_function('!document.querySelector("#sync-button").disabled')
                self.assertEqual(web.evaluate('Object.values(state.days)[0].ratings'),1)  # retry does not re-rate
                page.reload();page.wait_for_selector('.empty-state');self.assertEqual(page.locator('#daily-count').inner_text(),'1')
                stored=sw.evaluate('(async()=> (await chrome.storage.local.get("falaSidepanel")).falaSidepanel)()')
                self.assertEqual(stored['pending'],[]);self.assertTrue(stored['state']['cards'][0]['started'])
                # A second Fala tab is blocked, so stale memory cannot silently replace the first.
                other=c.new_page();other.goto(site)
                page.bring_to_front();page.locator('#sync-button').click();page.wait_for_function('!document.querySelector("#sync-button").disabled')
                self.assertIn('多个 Fala',page.locator('#toast').inner_text())
                c.close()
