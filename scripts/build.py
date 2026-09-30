"""Build a static team site from deliberately curated public fields only."""
import html
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {"id", "nickname", "role", "characters", "rank", "intro"}
ROLES = {"survivor", "hunter", "flex", "support"}
PRIVATE = re.compile(r"(?:\d[\s-]*){11,}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|身份证|手机号|学号|微信|真实姓名|联系电话|住址|(?:个人)?QQ\s*[:：]", re.I)

def validate_players(records):
    if not isinstance(records, list):
        raise ValueError("Public roster must be an array.")
    seen = set()
    clean = []
    for i, record in enumerate(records):
        # Reject unexpected fields. Never silently publish arbitrary spreadsheet columns.
        if not isinstance(record, dict) or not set(record).issubset(ALLOWED):
            raise ValueError(f"Record {i + 1}: contains fields outside the public schema.")
        required = {"id", "nickname", "role", "characters"}
        if not required.issubset(record):
            raise ValueError(f"Record {i + 1}: missing required public fields.")
        pid, nickname = record["id"], record["nickname"]
        if not isinstance(pid, str) or not re.fullmatch(r"p[0-9]{4,8}", pid) or pid in seen:
            raise ValueError(f"Record {i + 1}: invalid or duplicated profile id.")
        if not isinstance(nickname, str) or not 1 <= len(nickname.strip()) <= 32 or nickname.strip().isdigit():
            raise ValueError(f"Record {i + 1}: use a game nickname, not a numeric account.")
        if record["role"] not in ROLES:
            raise ValueError(f"Record {i + 1}: invalid game role.")
        chars = record["characters"]
        if not isinstance(chars, list) or len(chars) > 20 or any(not isinstance(x, str) or not 1 <= len(x.strip()) <= 40 for x in chars):
            raise ValueError(f"Record {i + 1}: invalid character pool.")
        rank, intro = record.get("rank", ""), record.get("intro", "")
        if not isinstance(rank, str) or len(rank) > 80 or not isinstance(intro, str) or len(intro) > 400:
            raise ValueError(f"Record {i + 1}: invalid public description.")
        if PRIVATE.search(json.dumps(record, ensure_ascii=False)):
            raise ValueError(f"Record {i + 1}: looks like private contact information; review this record.")
        seen.add(pid)
        clean.append({"id": pid, "nickname": nickname.strip(), "role": record["role"],
                      "characters": [x.strip() for x in chars], "rank": rank.strip(), "intro": intro.strip()})
    return clean

def profile_html(template, record):
    # All generated player pages are actual HTML routes, with independent titles.
    page = template.replace('data-player-id=""', 'data-player-id="' + record["id"] + '"')
    page = page.replace("<title>队员档案", "<title>" + html.escape(record["nickname"]) + " · 队员档案")
    for filename in ("styles.css", "app.js", "favicon.svg", "data/team-roster.js"):
        page = page.replace('"' + filename + '"', '"../../' + filename + '"')
    for filename in ("index.html", "roster.html", "join.html", "privacy.html"):
        page = page.replace('"' + filename, '"../../' + filename)
    return page

def build():
    players = validate_players(json.loads((ROOT / "data/team-roster.json").read_text(encoding="utf-8")))
    out = ROOT / "dist"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir()
    # Only listed public files go into the hosted artifact. No source workbook or uploads.
    for name in ("index.html", "roster.html", "join.html", "privacy.html", "player.html",
                 "404.html", "styles.css", "app.js", "favicon.svg", ".nojekyll", "robots.txt"):
        shutil.copyfile(ROOT / name, out / name)
    (out / "data").mkdir()
    public_json = json.dumps(players, ensure_ascii=True, indent=2)
    (out / "data/team-roster.js").write_text("window.HNUST_ROSTER = " + public_json + ";\n", encoding="utf-8")
    (out / "data/team-roster.json").write_text(public_json + "\n", encoding="utf-8")
    template = (ROOT / "player.html").read_text(encoding="utf-8")
    for player in players:
        target = out / "players" / player["id"]
        target.mkdir(parents=True)
        (target / "index.html").write_text(profile_html(template, player), encoding="utf-8")
    (out / "tools").mkdir()
    for name in ("roster-editor.html", "roster-editor.js", "public-fields.js"):
        shutil.copyfile(ROOT / "tools" / name, out / "tools" / name)
    (out / "assets").mkdir()
    for name in ("team-badge", "community-qr"):
        for suffix in (".jpg", ".png", ".webp"):
            source = ROOT / "assets" / (name + suffix)
            if source.exists():
                if source.stat().st_size > 12 * 1024 * 1024:
                    raise ValueError("An image exceeds the site asset size limit.")
                shutil.copyfile(source, out / "assets" / source.name)
    print(f"Static build complete: {len(players)} curated public player profiles.")
    return out

if __name__ == "__main__":
    build()
