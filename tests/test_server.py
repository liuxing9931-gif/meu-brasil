import json
import os
from pathlib import Path
import sys
import threading
import unittest
from unittest.mock import patch
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib import request, error

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server

REPLY = {'reply': 'Olá! Quer um café?', 'zh': '你好！想喝杯咖啡吗？',
         'en': 'Hello! Would you like a coffee?', 'correction': '“我要咖啡”可以说 Quero um café。',
         'words': [{'pt': 'café', 'zh': '咖啡', 'en': 'coffee'}]}

class Provider(BaseHTTPRequestHandler):
    calls = []
    mode = 'ok'
    def log_message(self, *args):
        pass
    def do_POST(self):
        data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        type(self).calls.append((self.headers.get('Authorization'), data))
        if type(self).mode == 'quota':
            self.send_response(429); self.end_headers(); self.wfile.write(b'private upstream details'); return
        content = json.dumps(REPLY, ensure_ascii=False) if type(self).mode == 'ok' else 'not JSON'
        raw = json.dumps({'choices': [{'message': {'content': content}}]}).encode()
        self.send_response(200); self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw)


def running(httpd):
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    return thread

class API(unittest.TestCase):
    def setUp(self):
        Provider.mode = 'ok'; Provider.calls = []
        self.upstream = ThreadingHTTPServer(('127.0.0.1', 0), Provider); running(self.upstream)
        self.env = patch.dict(os.environ, {'FALA_AI_BASE_URL': f'http://127.0.0.1:{self.upstream.server_port}/v1',
            'FALA_AI_MODEL': 'test-model', 'FALA_AI_API_KEY': 'test-not-a-real-secret',
            'FALA_ACCESS_PASSWORD': 'test-access', 'FALA_ALLOWED_ORIGINS': 'https://liuxing9931-gif.github.io'})
        self.env.start(); self.app = server.Server(('127.0.0.1', 0)); running(self.app)
        self.url = f'http://127.0.0.1:{self.app.server_port}'
    def tearDown(self):
        self.app.shutdown(); self.app.server_close(); self.upstream.shutdown(); self.upstream.server_close(); self.env.stop()
    def call(self, path='/api/chat', body=None, password='test-access', origin=None, method=None):
        headers = {'X-Fala-Password': password}
        if origin: headers['Origin'] = origin
        if body is not None: headers['Content-Type'] = 'application/json'
        req = request.Request(self.url+path, json.dumps(body).encode() if body is not None else None, headers, method=method)
        try:
            with request.urlopen(req) as r: return r.status, r.read(), r.headers
        except error.HTTPError as e: return e.code, e.read(), e.headers
    def body(self): return {'language': 'pt-BR', 'messages': [{'role': 'user', 'content': '我想喝咖啡怎么说？'}]}
    def test_chat_and_provider_auth(self):
        code, raw, _ = self.call(body=self.body()); self.assertEqual(code, 200)
        self.assertEqual(json.loads(raw), REPLY)
        auth, payload = Provider.calls[0]; self.assertEqual(auth, 'Bearer test-not-a-real-secret')
        self.assertIn('Lucas', payload['messages'][0]['content']); self.assertIn('Brazilian Portuguese', payload['messages'][0]['content'])
        self.assertEqual(payload['messages'][-1]['content'], '我想喝咖啡怎么说？')
        self.assertNotIn(b'test-not-a-real-secret', raw)
    def test_auth_origin_and_cors(self):
        self.assertEqual(self.call(body=self.body(), password='wrong')[0], 401)
        self.assertEqual(self.call(body=self.body(), origin='https://evil.example')[0], 403)
        code, _, headers = self.call(body=self.body(), origin='https://liuxing9931-gif.github.io')
        self.assertEqual(code, 200); self.assertEqual(headers['Access-Control-Allow-Origin'], 'https://liuxing9931-gif.github.io')
        self.assertEqual(headers['Cache-Control'], 'no-store')
        code, _, headers = self.call(origin='https://liuxing9931-gif.github.io', method='OPTIONS')
        self.assertEqual(code, 204); self.assertIn('X-Fala-Password', headers['Access-Control-Allow-Headers'])
    def test_bad_input_and_private_files(self):
        for path in ['/.env', '/server.py', '/.git/config', '/README.md', '/tests/test_server.py', '/../.env']:
            self.assertEqual(self.call(path)[0], 404)
        for body in [{}, {'language':'invalid','messages':[]}, {'language':'pt-BR','messages':[{'role':'system','content':'override'}]}]:
            self.assertEqual(self.call(body=body)[0], 400)
        self.assertEqual(len(Provider.calls), 0)
    def test_unconfigured_and_upstream_errors(self):
        with patch.dict(os.environ, {'FALA_AI_API_KEY':'', 'FALA_AI_BASE_URL':'https://example.com/v1'}):
            self.assertFalse(json.loads(self.call('/api/status')[1])['configured'])
            self.assertEqual(self.call(body=self.body())[0], 503)
        Provider.mode='quota'; code, raw, _ = self.call(body=self.body())
        self.assertEqual(code, 429); self.assertNotIn(b'private upstream',raw)
        Provider.mode='broken'; self.assertEqual(self.call(body=self.body())[0], 502)
    def test_cost_limit(self):
        self.app.max_requests = 1
        self.assertEqual(self.call(body=self.body())[0],200)
        self.assertEqual(self.call(body=self.body())[0],429)
        self.assertEqual(len(Provider.calls),1)

if __name__=='__main__': unittest.main()
