#!/usr/bin/env python3
"""Testes para dashboard_aprendizado.py.

Testa geracao de HTML, placeholders, dados vazios, e load().
Uso: python -m pytest scripts/tests/test_dashboard.py -v
"""

import sys, json, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from scripts.dashboard_aprendizado import to_html, load


class TestDashboard:
    def setup_method(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.logs = [
            {
                "date": "2026-06-28T12:00:00",
                "results": {
                    "scripts_checked": 12,
                    "workflows_checked": 3,
                    "issues_found": 2,
                    "fixes_applied": 1,
                    "learnings": ["Corrigido bare except em bot.py"]
                }
            },
            {
                "date": "2026-06-29T12:00:00",
                "results": {
                    "scripts_checked": 15,
                    "workflows_checked": 4,
                    "issues_found": 0,
                    "fixes_applied": 0,
                    "learnings": ["Tudo limpo"],
                    "ai_suggestions": "Alguma sugestao"
                }
            }
        ]
        self.pats = [
            {"module": "twitter-bot.py", "times_fixed": 3, "last_fixed": "2026-06-28"},
            {"module": "telegram-bot.py", "times_fixed": 1, "last_fixed": "2026-06-27"}
        ]

    def test_to_html_returns_path(self):
        out = to_html(self.logs, self.pats)
        assert isinstance(out, Path)
        assert out.exists()
        assert out.name == "dashboard_aprendizado.html"

    def test_to_html_contains_data(self):
        out = to_html(self.logs, self.pats)
        html = out.read_text(encoding="utf-8")
        assert "CYCLES" not in html
        assert "TBODY" not in html
        assert "PBODY" not in html
        assert "2" in html
        assert "15" in html
        assert "0" in html

    def test_to_html_empty_data(self):
        out = to_html([], [])
        html = out.read_text(encoding="utf-8")
        assert "Sem dados" in html
        assert "Sem padroes" in html
        assert "CYCLES" not in html
        assert "Nunca" in html

    def test_to_html_single_cycle(self):
        single = [{
            "date": "2026-06-29T12:00:00",
            "results": {
                "scripts_checked": 5,
                "workflows_checked": 1,
                "issues_found": 3,
                "fixes_applied": 2,
                "learnings": []
            }
        }]
        out = to_html(single, [])
        html = out.read_text(encoding="utf-8")
        assert "5" in html
        assert "3" in html
        assert "2" in html

    def test_to_html_template_override(self):
        (self.tmp / "scripts").mkdir(parents=True, exist_ok=True)
        tmpl = self.tmp / "scripts" / "dashboard_template.html"
        tmpl.write_text("CUSTOM_TEMPLATE")
        import scripts.dashboard_aprendizado as d
        original_prj = d.PRJ
        d.PRJ = self.tmp
        try:
            out = d.to_html(self.logs, self.pats)
            html = out.read_text(encoding="utf-8")
            assert "CUSTOM_TEMPLATE" in html
        finally:
            d.PRJ = original_prj

    def test_load_existing_file(self):
        f = self.tmp / "data.json"
        f.write_text(json.dumps([{"key": "val"}]))
        result = load(f)
        assert result == [{"key": "val"}]

    def test_load_missing_file(self):
        result = load(self.tmp / "nonexistent.json")
        assert result == []

    def test_to_html_now_placeholder(self):
        from datetime import datetime
        out = to_html(self.logs, self.pats)
        html = out.read_text(encoding="utf-8")
        assert "NOW" not in html
        today = datetime.now().strftime("%d/%m/%Y")
        assert today in html
