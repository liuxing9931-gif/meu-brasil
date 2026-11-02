#!/usr/bin/env python3
"""Build a self-contained MV3 sidebar + no-install preview; no npm/build dependencies."""
import argparse
from pathlib import Path
import shutil
import zipfile
ROOT=Path(__file__).resolve().parents[1]
SHARED=['core.js','data.js','reading-vocabulary.js','dictionary.js','verb-data.js','verbs.js','lexicon.js','icon.svg','icon-192.png']

def build(out,zip_path):
    out=Path(out).resolve();out.mkdir(parents=True,exist_ok=True);files=[]
    def copy(src,relative):
        target=out/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,target);files.append(relative)
    for src in sorted((ROOT/'extension').iterdir()):
        if src.is_file() and (src.suffix in {'.js','.html','.css','.md'} or src.name=='manifest.json'):
            copy(src,src.name)
    for name in SHARED:copy(ROOT/name,'shared/'+name)
    for src in sorted((ROOT/'dictionary').rglob('*')):
        if src.is_file() and src.suffix in {'.md','.txt','.gz','.json'}:copy(src,'shared/'+str(src.relative_to(ROOT)))
    for name in ['build_dictionary.py','build_verbs.py']:copy(ROOT/'tools'/name,'shared/tools/'+name)
    # Explicit allowlist: never archive unrelated files already present in an output directory.
    with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
        for relative in files:z.write(out/relative,relative)
    print(f'Built {len(files)} files at {out}; ZIP: {zip_path}')
    return out

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',default='/tmp/fala-sidepanel-preview')
    parser.add_argument('--zip',default='/tmp/fala-sidepanel-preview.zip')
    args=parser.parse_args();build(args.out,Path(args.zip).resolve())
