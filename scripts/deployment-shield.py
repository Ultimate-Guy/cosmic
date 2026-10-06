#!/usr/bin/env python3
import json,sys
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else "_site")
required=["index.html","pages/lessons/lessons.html","pages/lessons/game-shell.html","apps/apps.html","youtube/youtube.html","settings/settings.html","scripts/cosmic-runtime.js","scripts/cosmic-spaces.js","scripts/cosmic-cloud-profile.js","scripts/cosmic-foundry.js","scripts/cosmic-compatibility.js","scripts/cosmic-deployment-shield.js","scripts/cosmic-events.js","scripts/cosmic-rooms.js","scripts/cosmic-runtime-manifest.js","scripts/cosmic-platform.js","worker.js"]
missing=[p for p in required if not (root/p).is_file()]
if missing: raise SystemExit("Deployment Shield FAIL: missing "+", ".join(missing))
def load(p):
    try:
        x=json.loads((root/p).read_text(encoding="utf-8"))
        if not isinstance(x,list): raise ValueError("not an array")
        return x
    except Exception as e: raise SystemExit(f"Deployment Shield FAIL: {p}: {e}")
games=load("pages/lessons/games.json"); ugs=load("pages/lessons/ugs-games.json")
if not games or not ugs: raise SystemExit("Deployment Shield FAIL: empty game catalog")
for i,x in enumerate(games):
    if not isinstance(x,dict) or not x.get("name") or not x.get("path"): raise SystemExit(f"Deployment Shield FAIL: invalid local game entry {i}")
for i,x in enumerate(ugs):
    if not isinstance(x,dict) or not x.get("name") or not x.get("path"): raise SystemExit(f"Deployment Shield FAIL: invalid UGS game entry {i}")
lessons=(root/"pages/lessons/lessons.html").read_text(encoding="utf-8")
for name in ["cosmic-runtime.js","cosmic-spaces.js","cosmic-cloud-profile.js","cosmic-foundry.js","cosmic-compatibility.js","cosmic-deployment-shield.js","cosmic-events.js","cosmic-rooms.js","cosmic-platform.js"]:
    if name not in lessons: raise SystemExit("Deployment Shield FAIL: lessons missing "+name)
print(f"Deployment Shield PASS: local={len(games)} UGS={len(ugs)} total={len(games)+len(ugs)}")
