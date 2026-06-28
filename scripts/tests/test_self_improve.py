#!/usr/bin/env python3
import sys,tempfile,shutil
from pathlib import Path
from unittest.mock import MagicMock
sys.path.insert(0,str(Path(__file__).resolve().parent.parent.parent))
import scripts.ai_supervisor as sup

class TestSelfImprove:
    def setup_method(self):
        self.tmp = Path(tempfile.mkdtemp())
        sd = self.tmp / 'scripts'
        sd.mkdir(parents=True)
        wd = self.tmp / '.github' / 'workflows'
        wd.mkdir(parents=True)
        (sd/'buggy.py').write_text("""def main():
    try:
        pass
    except:
        pass
""")
        (sd/'clean.py').write_text("""def main():
    try:
        pass
    except Exception:
        pass
""")
        (sd/'broken.py').write_text("""def main(:
    pass
""")
        (wd/'valid.yml').write_text("""name: Test
on: [push]
jobs:
  test:
    runs-on: ubuntu
""")
        (wd/'broken.yml').write_text('corrompido')
        (self.tmp/'.env.example').write_text('TELEGRAM_BOT_TOKEN=\nSUPABASE_URL=\n')
        self._orig = sup.PROJECT_DIR
        sup.PROJECT_DIR = self.tmp
        self.s = sup.AISupervisor()
        self.s.vault = MagicMock()
        self.s.vault.has.return_value = False
        self.s.brain = MagicMock()
        self.s.brain.think.return_value = 'ok'
        self.s.reporter = MagicMock()
        self.s.fixer = MagicMock()
        self.s.fixer.auto_fix.return_value = True

    def teardown_method(self):
        sup.PROJECT_DIR = self._orig
        shutil.rmtree(str(self.tmp), ignore_errors=True)

    def test_scan(self):
        r = self.s.self_improve()
        assert r['scripts_checked'] >= 3

    def test_bare_except(self):
        r = self.s.self_improve()
        assert r['issues_found'] >= 1
        t = (self.tmp/'scripts'/'buggy.py').read_text()
        assert 'except Exception:' in t
        assert 'except:' not in t

    def test_workflows(self):
        r = self.s.self_improve()
        assert r['workflows_checked'] >= 2

    def test_log(self):
        self.s.self_improve()
        log = self.tmp/'scripts'/'.self_improve_log.json'
        assert log.exists()

    def test_report(self):
        self.s.self_improve()
        self.s.reporter.send_to_admin.assert_called_once()
