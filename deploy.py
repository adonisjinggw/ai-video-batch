#!/usr/bin/env python3
import subprocess
import os
import sys

os.chdir(r'j:\123pan\13998416173\NanoNoPort\ai-video-batch')
os.environ['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

# Try to find npm/node
npm_paths = [
    r'C:\Program Files\nodejs\npm.cmd',
    r'C:\Program Files (x86)\nodejs\npm.cmd',
    r'C:\Users\Administrator\AppData\Roaming\npm\npm.cmd',
    r'C:\Users\Administrator\AppData\Local\Programs\nodejs\npm.cmd',
]

for npm_path in npm_paths:
    if os.path.exists(npm_path):
        print(f"Found npm at: {npm_path}")
        result = subprocess.run([npm_path, 'run', 'deploy'], capture_output=True, text=True)
        print(result.stdout)
        print(result.stderr)
        sys.exit(result.returncode)

print("npm not found in common locations")
print("Trying npx vercel directly...")

# Try npx
result = subprocess.run(['npx', 'vercel', '--prod'], capture_output=True, text=True, shell=True)
print(result.stdout)
print(result.stderr)
