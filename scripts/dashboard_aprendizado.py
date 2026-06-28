#!/usr/bin/env python3
"""Dashboard HTML do aprendizado do AI Supervisor."
"""
import json, sys
from datetime import datetime
from pathlib import Path

PRJ = Path(__file__).resolve().parent.parent
LOGS = PRJ / "scripts" / ".self_improve_log.json"
PATS = PRJ / "scripts" / ".fix_patterns.json"

def load(path):
    if path.exists(): return json.loads(path.read_text(encoding="utf-8"))
    return []

def to_html(logs, pats):
    cycles = len(logs)
    issues = sum(l.get("results",{}).get("issues_found",0) for l in logs)
    fixes = sum(l.get("results",{}).get("fixes_applied",0) for l in logs)
    scripts = logs[-1]["results"]["scripts_checked"] if logs else 0
    last = logs[-1]["date"][:16] if logs else "Nunca"
    now = datetime.now().strftime("%d/%m/%Y %H:%M")

    # Table rows
    trs = ""
    for e in reversed(logs[-20:]):
        r = e.get("results",{})
        d = e.get("date","?")[:16]
        ok = r.get("issues_found",0) == 0
        fa = "🟢" if ok else "🔴"
        ai = "🤖" if r.get("ai_suggestions") else ""
        ls = "<br>".join("• "+x[:60] for x in r.get("learnings",[])[:2])
        trs += "<tr><td>" + str(fa) + "</td><td>" + str(d) + "</td><td>" + str(r.get("scripts_checked",0)) + "</td><td>" + str(r.get("workflows_checked",0)) + "</td><td>" + str(r.get("issues_found",0)) + "</td><td>" + str(r.get("fixes_applied",0)) + "</td><td>" + str(ai) + "</td><td>" + str(ls) + "</td></tr>"
    if not trs: trs = "<tr><td colspan=8>Sem dados</td></tr>"

    # Pattern rows
    prs = ""
    for p in pats:
        prs += "<tr><td>" + str(p.get("module","?")) + "</td><td>" + str(p.get("times_fixed",0)) + "x</td><td>" + str(p.get("last_fixed","?")[:10]) + "</td></tr>"
    if not prs: prs = "<tr><td colspan=3>Sem padroes</td></tr>"

    # Build chart data
    dates = [e.get("date","?")[:10] for e in logs[-30:]]
    chart_issues = [e.get("results",{}).get("issues_found",0) for e in logs[-30:]]
    chart_fixes = [e.get("results",{}).get("fixes_applied",0) for e in logs[-30:]]

    # HTML template (simple replace, no f-string conflicts)
    html = open(PRJ / 'scripts' / 'dashboard_template.html').read() if (PRJ / 'scripts' / 'dashboard_template.html').exists() else ''
    if not html:
        html = """<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>GeoLeads - Dashboard</title><script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0f172a;color:#e2e8f0;padding:2rem;font-size:14px}
.container{max-width:1200px;margin:0 auto}
h1{color:#38bdf8;font-size:1.3rem}
.sub{color:#64748b;font-size:.85rem}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.8rem}
.card{background:#1e293b;border-radius:10px;padding:1rem;border:1px solid #334155}
.card .l{font-size:.7rem;color:#64748b;text-transform:uppercase}
.card .v{font-size:1.5rem;font-weight:700;color:#38bdf8}
.card .v.g{color:#4ade80}
.card .v.y{color:#fbbf24}
table{width:100%;border-collapse:collapse;font-size:.8rem}
th,td{padding:.5rem;text-align:left;border-bottom:1px solid #334155}
th{color:#94a3b8;font-weight:600;font-size:.7rem;text-transform:uppercase}
tr:hover{background:#1e293b}
.ft{color:#475569;font-size:.75rem;text-align:center}
</style></head><body>
<div class=container>
<h1>🧠 Dashboard de Aprendizado</h1>
<p class=sub>AI Supervisor - Auto-Aprimoramento 12:00 BRT</p>
<div class=cards>
<div class=card><div class=l>🔄 Ciclos</div><div class=v>CYCLES</div></div>
<div class=card><div class=l>💾 Scripts</div><div class=v>SCRIPTS</div></div>
<div class=card><div class=l>🚨 Issues</div><div class=v y>ISSUES</div></div>
<div class=card><div class=l>🔧 Fixes</div><div class=v g>FIXES</div></div>
<div class=card><div class=l>📦 Padroes</div><div class=v>PATS</div></div>
<div class=card><div class=l>📅 Ultimo</div><div class=v style="font-size:.9rem">LAST</div></div>
</div>
<h2>📋 Historico</h2>
<table><thead><tr><th></th><th>Data</th><th>Scripts</th><th>WFs</th><th>Issues</th><th>Fixes</th><th>IA</th><th>Aprendizados</th></tr></thead>
<tbody>TBODY</tbody></table>
<h2>📈 Tendencias</h2><div id="chartData" style="display:none">{"dates":CHART_DATES,"issues":CHART_ISSUES,"fixes":CHART_FIXES}</div><canvas id="trendChart" height="80"></canvas><h2>📦 Padroes de Fix</h2>
<table><thead><tr><th>Modulo</th><th>Vezes</th><th>Ultimo</th></tr></thead>
<tbody>PBODY</tbody></table>
<div class=ft>GeoLeads AI - Gerado em NOW</div><script>const d=JSON.parse(document.getElementById("chartData").textContent);new Chart(document.getElementById("trendChart"),{type:"line",data:{labels:d.dates,datasets:[{label:"Issues",data:d.issues,borderColor:"#fbbf24",backgroundColor:"rgba(251,191,36,0.1)",tension:0.3},{label:"Fixes",data:d.fixes,borderColor:"#4ade80",backgroundColor:"rgba(74,222,128,0.1)",tension:0.3}]},options:{responsive:true,plugins:{legend:{labels:{color:"#94a3b8"}}},scales:{x:{ticks:{color:"#64748b"}},y:{ticks:{color:"#64748b"},beginAtZero:true}}} });</script>
</div></body></html>"""

    # Simple replacement (no f-string conflicts)
    for k, v in {"CYCLES": str(cycles), "SCRIPTS": str(scripts), "ISSUES": str(issues),
        "FIXES": str(fixes), "PATS": str(len(pats)), "LAST": last,
        "TBODY": trs, "PBODY": prs, "NOW": now, "CHART_DATES": json.dumps(dates), "CHART_ISSUES": json.dumps(chart_issues), "CHART_FIXES": json.dumps(chart_fixes)}.items():
        html = html.replace(k, v)

    out = PRJ / "scripts" / "dashboard_aprendizado.html"
    out.write_text(html, encoding="utf-8")
    print(f"Dashboard: {out}")
    return out

if __name__ == "__main__":
    p = to_html(load(LOGS), load(PATS))
    print(f"file://{p}")
    if "--port" in sys.argv:
        i = sys.argv.index("--port")
        import http.server
        d = http.server.SimpleHTTPRequestHandler
        with http.server.HTTPServer(("",int(sys.argv[i+1])), d) as h:
            print(f"http://localhost:{sys.argv[i+1]}/"); h.serve_forever()

