#!/usr/bin/env python3
"""Rebuild bundled data offline from the attributed source snapshots. Stdlib only."""
import csv
import gzip
import io
import json
from pathlib import Path
import xml.etree.ElementTree as ET
ROOT = Path(__file__).resolve().parents[1]
NS = {'t':'http://www.tei-c.org/ns/1.0'}

def gloss_key(text):
    return text.lower().removeprefix('to ').strip()

def entries():
    tree = ET.fromstring(gzip.decompress((ROOT/'dictionary/sources/por-eng.tei.gz').read_bytes()))
    out = {}
    for entry in tree.findall('.//t:entry',NS):
        words = [e.text.strip().lower() for e in entry.findall('./t:form/t:orth',NS) if e.text]
        glosses = [' '.join(''.join(e.itertext()).split()) for e in entry.findall('.//t:cit[@type="trans"]/t:quote',NS)]
        for word in words:
            out.setdefault(word,[])
            out[word] = list(dict.fromkeys(out[word]+glosses))
    return out

def build():
    words=entries()
    with gzip.open(ROOT/'dictionary/sources/ecdict-subset.csv.gz','rt',encoding='utf-8',newline='') as f:
        chinese={r['word']:r['translation'] for r in csv.DictReader(f)}
    data={}
    for word,glosses in words.items():
        if not glosses: continue
        translated=[]
        for gloss in glosses[:5]:
            value=chinese.get(gloss_key(gloss),'')
            if value:
                text=value.replace('\\n','；').replace('\n','；')[:160]
                translated.append(f'{gloss}：{text}')
            if len(translated)>=2:break
        data[word]=['；'.join(translated),'; '.join(glosses[:8])]
    body='/* FreeDict por-eng GPL-2.0-or-later data; Chinese pivot from ECDICT MIT. See dictionary/NOTICE.md. */\nwindow.OFFLINE_DICTIONARY='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n'
    (ROOT/'dictionary.js').write_text(body)
    print(f'{len(data)} headwords; {sum(bool(v[0]) for v in data.values())} with Chinese pivot; {len(body.encode())} bytes')
if __name__=='__main__':build()
