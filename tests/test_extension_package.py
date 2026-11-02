"""The exact preview/download archive contains local code, notices and no credentials."""
import importlib.util
import json
from pathlib import Path
import re
import tempfile
import unittest
import zipfile
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('extension_build',ROOT/'tools/build_extension.py')
package=importlib.util.module_from_spec(spec);spec.loader.exec_module(package)

class ExtensionPackage(unittest.TestCase):
    def test_self_contained_minimal_permissions(self):
        with tempfile.TemporaryDirectory(prefix='fala-package-') as tmp:
            out=Path(tmp)/'out';z=Path(tmp)/'preview.zip';package.build(out,z)
            # An output directory can contain an unrelated file; rebuild must not distribute it.
            (out/'.env').write_text('NOT_A_REAL_SECRET=must_not_be_packaged')
            package.build(out,z)
            with zipfile.ZipFile(z) as archive:
                self.assertIsNone(archive.testzip());names=set(archive.namelist())
                self.assertNotIn('.env',names);self.assertFalse(any(n.startswith('.git/') for n in names))
                for name in ['manifest.json','background.js','sidepanel.html','preview.html','shared/core.js','shared/dictionary/NOTICE.md','shared/dictionary/licenses/CC-BY-SA-3.0.txt']:
                    self.assertIn(name,names)
            manifest=json.loads((out/'manifest.json').read_text())
            self.assertEqual(manifest['manifest_version'],3)
            self.assertEqual(set(manifest['permissions']),{'sidePanel','storage','scripting'})
            self.assertEqual(manifest['host_permissions'],['https://liuxing9931-gif.github.io/*'])
            self.assertNotIn('externally_connectable',manifest)
            self.assertNotIn('web_accessible_resources',manifest)
            for name in ['sidepanel.html','preview.html']:
                text=(out/name).read_text()
                for src in re.findall(r'(?:src|href)="([^"]+)"',text):
                    clean=src.split('?',1)[0];self.assertFalse(clean.startswith(('http:','https:')));self.assertTrue((out/clean).is_file(),clean)
            self.assertEqual((out/'shared/core.js').read_bytes(),(ROOT/'core.js').read_bytes())
