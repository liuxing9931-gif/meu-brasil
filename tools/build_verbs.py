#!/usr/bin/env python3
"""Build offline conjugation tables from the bundled UniMorph CC-BY-SA-3.0 snapshot."""
import gzip
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
rows=[]
for line in gzip.decompress((ROOT/'dictionary/sources/unimorph-por.tsv.gz').read_bytes()).decode().splitlines():
    fields=line.split('\t')
    if len(fields)==3 and fields[2].startswith('V'):
        rows.append(fields)
tags=sorted({r[2] for r in rows});ids={tag:i for i,tag in enumerate(tags)}
verbs={};supplements=[]
for lemma,form,tag in rows:
    slots=verbs.setdefault(lemma,['']*len(tags));i=ids[tag]
    forms=slots[i].split('|') if slots[i] else []
    if form not in forms:forms.append(form)
    # Brazilian Portuguese uses -amos for this past-tense 1st-person plural form.
    # Keep the upstream European -ámos spelling too, not a global accent-stripping rule.
    if tag=='V;1;PL;IND;PST;PFV' and form.endswith('ámos'):
        brazilian=form[:-4]+'amos'
        if brazilian not in forms:forms.append(brazilian);supplements.append([lemma,brazilian,tag])
    slots[i]='|'.join(forms)
data={'tags':tags,'verbs':verbs}
(ROOT/'verb-data.js').write_text('/* UniMorph Portuguese, CC-BY-SA-3.0; Brazilian spelling additions. See dictionary/VERBS-NOTICE.md. */\nwindow.PORTUGUESE_VERBS='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
print(len(verbs),'lemmas;',len(rows),'source rows;',len(supplements),'Brazilian spelling additions; bytes:',(ROOT/'verb-data.js').stat().st_size)
