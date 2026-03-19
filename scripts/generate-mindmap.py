"""
RollRoll AI Platform - Neon Genesis Mindmap
High-precision visual artwork
"""

import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, Circle, Wedge, FancyArrowPatch
import numpy as np
from matplotlib.collections import LineCollection
import matplotlib.lines as mlines
import warnings
warnings.filterwarnings('ignore')

# Create figure
fig, ax = plt.subplots(1, 1, figsize=(24, 16), facecolor='#0a0e1a')
ax.set_facecolor('#0a0e1a')
ax.set_xlim(0, 24)
ax.set_ylim(0, 16)
ax.set_aspect('equal')
ax.axis('off')

# Color palette - Neon Genesis
COLORS = {
    'primary': '#00D4FF',      # Electric cyan
    'secondary': '#FF006E',     # Magenta
    'accent1': '#8338EC',       # Violet
    'accent2': '#3A86FF',       # Cobalt blue
    'accent3': '#FFBE0B',       # Gold
    'accent4': '#06D6A0',       # Mint
    'accent5': '#FB5607',       # Orange-red
    'dark': '#0a0e1a',          # Deep space
    'grid': '#1a1f35',          # Grid lines
    'text': '#ffffff',          # White text
    'text_dim': '#64748B'       # Dim text
}

# Draw grid background
for i in range(0, 25, 2):
    ax.plot([i, i], [0, 16], color=COLORS['grid'], alpha=0.3, linewidth=0.5)
for i in range(0, 17, 2):
    ax.plot([0, 24], [i, i], color=COLORS['grid'], alpha=0.3, linewidth=0.5)

# Center node - RollRoll Core
center_x, center_y = 12, 8
core_radius = 1.8

# Outer glow
for r, alpha in [(3.5, 0.05), (3.0, 0.08), (2.6, 0.12)]:
    circle = Circle((center_x, center_y), r, facecolor=COLORS['primary'], 
                     alpha=alpha, edgecolor='none')
    ax.add_patch(circle)

# Core circle
core = Circle((center_x, center_y), core_radius, facecolor=COLORS['dark'],
              edgecolor=COLORS['primary'], linewidth=3)
ax.add_patch(core)

# Inner decorative ring
inner_ring = Circle((center_x, center_y), 1.2, facecolor='none',
                    edgecolor=COLORS['primary'], linewidth=1, alpha=0.6)
ax.add_patch(inner_ring)

# Center text
ax.text(center_x, center_y - 0.3, 'RollRoll', fontsize=22, fontweight='bold',
         color=COLORS['primary'], ha='center', va='center', family='DejaVu Sans')
ax.text(center_x, center_y - 0.8, 'AI Platform', fontsize=11,
         color=COLORS['text'], ha='center', va='center', family='DejaVu Sans')

# Skill category nodes
categories = [
    {'name': 'VIDEO', 'label': 'Video', 'color': COLORS['accent2'], 'angle': 90, 'count': '6 skills'},
    {'name': 'IMAGE', 'label': 'Image', 'color': COLORS['accent1'], 'angle': 45, 'count': '10 skills'},
    {'name': 'CONTENT', 'label': 'Content', 'color': COLORS['accent3'], 'angle': 0, 'count': '5 skills'},
    {'name': 'AUDIO', 'label': 'Audio', 'color': COLORS['secondary'], 'angle': -45, 'count': '2 skills'},
    {'name': 'DESIGN', 'label': 'Design', 'color': COLORS['accent4'], 'angle': -90, 'count': '4 skills'},
    {'name': 'TOOLS', 'label': 'Tools', 'color': COLORS['accent5'], 'angle': -135, 'count': '3 skills'},
    {'name': 'PROMPT', 'label': 'Prompt', 'color': COLORS['accent5'], 'angle': 135, 'count': '4 skills'},
    {'name': 'AUTO', 'label': 'Auto', 'color': COLORS['accent4'], 'angle': 180, 'count': '2 skills'},
]

orbit_r = 5.5
for cat in categories:
    angle = np.radians(cat['angle'])
    x = center_x + orbit_r * np.cos(angle)
    y = center_y + orbit_r * np.sin(angle)
    
    # Node glow
    for r, alpha in [(1.3, 0.1), (1.1, 0.15)]:
        glow = Circle((x, y), r, facecolor=cat['color'], alpha=alpha, edgecolor='none')
        ax.add_patch(glow)
    
    # Node
    node = Circle((x, y), 0.9, facecolor=COLORS['dark'],
                  edgecolor=cat['color'], linewidth=2)
    ax.add_patch(node)
    
    # Text
    ax.text(x, y + 0.1, cat['name'], fontsize=11, ha='center', va='center',
            color=cat['color'], fontweight='bold', family='DejaVu Sans')
    ax.text(x, y - 0.35, cat['label'], fontsize=8, ha='center', va='center',
            color=COLORS['text'], family='DejaVu Sans')
    ax.text(x, y - 0.65, cat['count'], fontsize=7, ha='center', va='center',
            color=COLORS['text_dim'], family='DejaVu Sans')
    
    # Connecting lines
    line_x = [center_x + core_radius * np.cos(angle), x - 0.9 * np.cos(angle)]
    line_y = [center_y + core_radius * np.sin(angle), y - 0.9 * np.sin(angle)]
    ax.plot(line_x, line_y, color=cat['color'], alpha=0.4, linewidth=1.5)

# Agent Team - Right side
agent_x, agent_y = 20, 8
ax.text(agent_x, agent_y + 4.5, 'Agent Team', fontsize=14, fontweight='bold',
        color=COLORS['primary'], ha='center', va='center', family='DejaVu Sans')

agents = [
    {'name': 'Coordinator', 'label': 'Project Lead', 'color': COLORS['primary']},
    {'name': 'Copywriter', 'label': 'Content Writer', 'color': COLORS['accent2']},
    {'name': 'Visual Artist', 'label': 'Designer', 'color': COLORS['accent1']},
    {'name': 'Video Producer', 'label': 'Video Maker', 'color': COLORS['accent3']},
    {'name': 'Brand Strategist', 'label': 'Marketing', 'color': COLORS['accent4']},
    {'name': 'Director', 'label': 'Film Director', 'color': COLORS['secondary']},
]

for i, agent in enumerate(agents):
    row = i // 2
    col = i % 2
    x = agent_x - 1.2 + col * 2.4
    y = agent_y + 3 - row * 1.2
    
    # Card background
    card = FancyBboxPatch((x - 1, y - 0.4), 2.2, 0.9,
                          boxstyle="round,pad=0.05,rounding_size=0.1",
                          facecolor=COLORS['dark'], edgecolor=agent['color'],
                          linewidth=1.5, alpha=0.9)
    ax.add_patch(card)
    
    ax.text(x, y + 0.15, agent['name'], fontsize=9, ha='center', va='center',
            color=agent['color'], fontweight='bold', family='DejaVu Sans')
    ax.text(x, y - 0.15, agent['label'], fontsize=7, ha='center', va='center',
            color=COLORS['text_dim'], family='DejaVu Sans')

ax.text(agent_x, agent_y - 2.5, '21 Roles | 12 Team Templates', fontsize=9,
        ha='center', va='center', color=COLORS['text_dim'], family='DejaVu Sans')

# Tech Architecture - Left side
tech_x, tech_y = 4, 8
ax.text(tech_x, tech_y + 4.5, 'Tech Architecture', fontsize=14, fontweight='bold',
        color=COLORS['primary'], ha='center', va='center', family='DejaVu Sans')

layers = [
    {'name': 'Frontend', 'items': ['index.html', 'mobile.html', 'chat.html', 'banana.html'], 'color': COLORS['accent2']},
    {'name': 'API Layer', 'items': ['sora2.js', 'banana2.js', 'yunwu.js', 'writer-llm.js'], 'color': COLORS['accent4']},
    {'name': 'Data Layer', 'items': ['Supabase Auth', 'PostgreSQL', 'Storage', 'Realtime'], 'color': COLORS['accent1']},
]

for i, layer in enumerate(layers):
    y = tech_y + 2.5 - i * 1.8
    
    # Layer label
    label_box = FancyBboxPatch((tech_x - 1.8, y + 0.3), 1.2, 0.5,
                               boxstyle="round,pad=0.02,rounding_size=0.05",
                               facecolor=layer['color'], edgecolor='none', alpha=0.8)
    ax.add_patch(label_box)
    ax.text(tech_x - 1.2, y + 0.55, layer['name'], fontsize=9, ha='center', va='center',
            color='white', fontweight='bold', family='DejaVu Sans')
    
    # Connection line
    ax.plot([tech_x - 0.6, tech_x + 0.2], [y + 0.55, y + 0.55], 
            color=layer['color'], linewidth=1, alpha=0.5)

# Feature highlights - Bottom
features = [
    {'name': 'Resilient API', 'desc': 'Multi-node Load Balance'},
    {'name': 'Task Scheduler', 'desc': 'Smart Retry + Resume'},
    {'name': 'Billing System', 'desc': 'Two-Phase Deduction'},
    {'name': 'Concurrency', 'desc': 'Max 3 Tasks Parallel'},
]

feat_y = 1.8
for i, feat in enumerate(features):
    x = 4 + i * 4
    
    # Background box
    box = FancyBboxPatch((x - 1.5, feat_y - 0.6), 3, 1.2,
                         boxstyle="round,pad=0.05,rounding_size=0.1",
                         facecolor='#1a1f35', edgecolor=COLORS['grid'],
                         linewidth=1, alpha=0.8)
    ax.add_patch(box)
    
    ax.text(x, feat_y + 0.15, feat['name'], fontsize=10, ha='center', va='center',
            color=COLORS['primary'], fontweight='bold', family='DejaVu Sans')
    ax.text(x, feat_y - 0.2, feat['desc'], fontsize=8, ha='center', va='center',
            color=COLORS['text_dim'], family='DejaVu Sans')

# Title
ax.text(12, 15.2, 'RollRoll AI Creation Platform', fontsize=26, fontweight='bold',
        color='white', ha='center', va='center', family='DejaVu Sans')
ax.text(12, 14.6, 'Feature Overview Mindmap | 36 Skills x 21 Roles x Multi-Agent Collaboration', 
        fontsize=11, color=COLORS['text_dim'], ha='center', va='center', family='DejaVu Sans')

# Border decoration
rect = patches.Rectangle((0.3, 0.3), 23.4, 15.4, linewidth=2, 
                          edgecolor=COLORS['primary'], facecolor='none', alpha=0.3)
ax.add_patch(rect)

# Corner decorations
corners = [(0.3, 0.3), (23.7, 0.3), (0.3, 15.7), (23.7, 15.7)]
for cx, cy in corners:
    corner = Circle((cx, cy), 0.15, facecolor=COLORS['primary'], alpha=0.5)
    ax.add_patch(corner)

# Bottom info
ax.text(12, 0.8, 'lossloop.cn  |  rollroll.art', fontsize=10,
        color=COLORS['text_dim'], ha='center', va='center', alpha=0.6, family='DejaVu Sans')

plt.tight_layout(pad=0)
plt.savefig('j:/123pan/13998416173/NanoNoPort/ai-video-batch/RollRoll-Neon-Genesis-Mindmap.png', 
            dpi=200, facecolor='#0a0e1a', edgecolor='none', bbox_inches='tight')
print("Mindmap generated: RollRoll-Neon-Genesis-Mindmap.png")
plt.close()
