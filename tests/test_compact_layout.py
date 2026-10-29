"""Compact reader across viewport/zoom changes; persistent, visible course completion."""
import os
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parent))
import test_server as fixtures
import test_reader_player as player
from playwright.sync_api import sync_playwright

class CompactLayout(unittest.TestCase):
    setUp=fixtures.API.setUp
    tearDown=fixtures.API.tearDown

    def test_reader_adapts_and_fits_more_text(self):
        with sync_playwright() as p:
            b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
            page=b.new_page(viewport={'width':1920,'height':1080});page.add_init_script(player.SPEECH_STUB)
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(self.url);page.locator('[data-route="reading"]:visible').first.click();page.locator('[data-reading-article]').first.click()
            self.assertFalse(page.locator('.breadcrumb').is_visible())
            self.assertEqual(page.locator('.reading-text>.helper').count(),0)
            self.assertEqual(page.locator('.reading-scroll-hint').count(),0)
            visible=page.evaluate('''()=>{const t=document.querySelector('.reading-text').getBoundingClientRect();return [...document.querySelectorAll('.reading-sentence')].filter(e=>{const r=e.getBoundingClientRect();return r.top>=t.top&&r.bottom<=t.bottom}).length}''')
            self.assertGreaterEqual(visible,4)
            for width,height in [(1920,1080),(1280,900),(1024,720),(853,600),(640,450),(390,844),(844,430)]:
                page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(100)
                layout=page.evaluate('''()=>{const work=document.querySelector('.reading-workspace').getBoundingClientRect(),app=document.querySelector('#app').getBoundingClientRect(),p=document.querySelector('.reading-player').getBoundingClientRect(),nav=document.querySelector('#mobile-nav');return {gap:app.width-work.width,bottom:p.bottom,edge:getComputedStyle(nav).display==='none'?innerHeight:nav.getBoundingClientRect().top,top:p.top,wide:document.documentElement.scrollWidth>innerWidth}}''')
                self.assertLessEqual(layout['gap'],45);self.assertLessEqual(layout['bottom'],layout['edge']);self.assertGreater(layout['top'],0);self.assertFalse(layout['wide'])
            # Embedded-app CSS zoom as well as browser-style changes to the CSS viewport.
            page.set_viewport_size({'width':1280,'height':900})
            for zoom in [1.25,1.5,1]:
                page.evaluate('(z)=>document.documentElement.style.zoom=String(z)',zoom);page.wait_for_timeout(150)
                bottom=page.locator('.reading-player').bounding_box()
                self.assertLessEqual(bottom['y']+bottom['height'],901)
            page.set_viewport_size({'width':1600,'height':900});page.wait_for_timeout(100)
            page.screenshot(path='/tmp/fala-compact-desktop.png',full_page=True)
            page.locator('[data-reading-control="toggle"]').click();self.assertIsNotNone(page.evaluate('currentSpeech'))
            page.locator('[data-reading-paper="notes"]').click();self.assertIsNone(page.evaluate('currentSpeech'))
            self.assertEqual(page.locator('#reading-notes-paper .reading-player').count(),0)
            self.assertEqual(errors,[]);b.close()

    def test_course_marks_survive_refresh(self):
        with sync_playwright() as p:
            b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
            page=b.new_page();page.goto(self.url)
            # Existing completion records must be shown without relearning.
            page.evaluate('state.completed=["hello"];save()')
            page.locator('[data-route="courses"]:visible').first.click()
            self.assertEqual(page.locator('[data-course="hello"] .course-progress').inner_text(),'✓ 已学习')
            self.assertEqual(page.locator('[data-course="shop"] .course-progress').inner_text(),'未学习')
            page.locator('[data-course="shop"]').click()
            self.assertIn('未学习',page.locator('.page-heading .date-chip').inner_text())
            page.locator('[data-action="complete"]').click()
            page.reload();page.locator('[data-route="courses"]:visible').first.click()
            self.assertEqual(page.locator('[data-course="shop"] .course-progress').inner_text(),'✓ 已学习')
            self.assertEqual(page.locator('[data-course="shop"] .complete-tag').inner_text(),'已学习')
            page.locator('[data-course="shop"]').click()
            self.assertIn('已学习',page.locator('.page-heading .date-chip').inner_text())
            self.assertEqual(page.evaluate('state.completed'),['hello','shop'])
            page.set_viewport_size({'width':390,'height':844});page.locator('[data-route="courses"]:visible').first.click()
            self.assertTrue(page.locator('[data-course="shop"] .course-progress').is_visible())
            self.assertFalse(page.evaluate('document.documentElement.scrollWidth>innerWidth'))
            b.close()

if __name__=='__main__':unittest.main()
