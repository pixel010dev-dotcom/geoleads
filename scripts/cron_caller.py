#!/usr/bin/env python3
import subprocess, sys, time

def run():
    url = 'https://geoleads-production-6583.up.railway.app/api/cron'
    secret = 'gl-dev-2026'
    result = subprocess.run(
        ['curl', '-s', '-w', 'HTTP:%{http_code}', '-o', '/dev/null',
         '-H', f'x-cron-secret: {secret}',
         f'{url}?secret={secret}', '--max-time', '30'],
        capture_output=True, text=True, timeout=35
    )
    print(f"[{time.strftime('%H:%M')}] {result.stdout}")

if __name__ == '__main__':
    run()
