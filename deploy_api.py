#!/usr/bin/env python3
"""Deploy to Vercel using their REST API"""
import urllib.request
import urllib.error
import json
import os
import zipfile
import io

# Create deployment package
print("Creating deployment package...")
os.chdir(r'j:\123pan\13998416173\NanoNoPort\ai-video-batch')

# Files to include (exclude node_modules, .git, etc.)
exclude_dirs = {'node_modules', '.git', '.claude', '_clean_deploy', '_tmp_js', 'screenshots'}
exclude_files = {'.env', '.env.local'}

buffer = io.BytesIO()
with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk('.'):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
        
        for file in files:
            if file in exclude_files or file.startswith('.'):
                continue
            filepath = os.path.join(root, file)
            try:
                zf.write(filepath)
            except Exception as e:
                print(f"Warning: Could not add {filepath}: {e}")

# Get file size
deployment_size = buffer.tell()
print(f"Deployment package size: {deployment_size / 1024 / 1024:.2f} MB")

# Note: This requires a Vercel token which we don't have
print("\nNote: API deployment requires VERCEL_TOKEN environment variable.")
print("Please set it with: set VERCEL_TOKEN=your_token_here")
print("\nAlternative: Use 'vercel --prod' command if available.")
