"""Build a static team site from deliberately curated public fields only."""
import html
import json
import os
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {"id", "nickname", "role", "characters", "rank", "intro", "alias", "survivorPeak", "hunterPeak"}
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
        game_extra = {key: record.get(key, "") for key in ("alias", "survivorPeak", "hunterPeak")}
        if any(not isinstance(value, str) or len(value) > 80 for value in game_extra.values()):
            raise ValueError(f"Record {i + 1}: invalid game alias or historical rank.")
        if not isinstance(rank, str) or len(rank) > 80 or not isinstance(intro, str) or len(intro) > 400:
            raise ValueError(f"Record {i + 1}: invalid public description.")
        if PRIVATE.search(json.dumps(record, ensure_ascii=False)):
            raise ValueError(f"Record {i + 1}: looks like private contact information; review this record.")
        seen.add(pid)
        clean.append({"id": pid, "nickname": nickname.strip(), "role": record["role"],
                      "characters": [x.strip() for x in chars], "rank": rank.strip(), "intro": intro.strip(),
                      **{key: value.strip() for key, value in game_extra.items()}})
    return clean

def profile_html(template, record):
    # All generated player pages are actual HTML routes, with independent titles.
    page = template.replace('data-player-id=""', 'data-player-id="' + record["id"] + '"')
    page = page.replace("<title>队员档案", "<title>" + html.escape(record["nickname"]) + " · 队员档案")
    for filename in ("styles.css", "app.js", "favicon.svg", "data/team-roster.js", "assets/"):
        page = page.replace('"' + filename, '"../../' + filename)
    for filename in ("index.html", "roster.html", "join.html", "privacy.html", "sources.html"):
        page = page.replace('"' + filename, '"../../' + filename)
    # Server-render the core game identity so each page is useful before JavaScript loads.
    safe_nickname = html.escape(record["nickname"])
    safe_alias = html.escape(record.get("alias", ""))
    label = {"survivor": "求生者", "hunter": "监管者", "flex": "双阵营", "support": "队员"}[record["role"]]
    summary = f'<p class="eyebrow">HNUST / {label}</p><h1>{safe_nickname}</h1>'
    if safe_alias:
        summary += f'<p class="lead">队内网名：{safe_alias}</p>'
    for label, key in (("求生者 · 历史最高", "survivorPeak"), ("监管者 · 历史最高", "hunterPeak")):
        summary += f'<p>{label}：{html.escape(record.get(key, "") or "暂未公开")}</p>'
    summary += '<p>历史段位来自队员提供的记录，不代表当前赛季段位。</p>'
    page = page.replace('<!-- PROFILE_FALLBACK -->', summary)
    return page

def build():
    repository = os.environ.get("GITHUB_REPOSITORY", "Starlevin/qinghan-site")
    base_path = os.environ.get("SITE_BASE_PATH", "/" + repository.rsplit("/", 1)[-1]).rstrip("/")
    if base_path and not re.fullmatch(r"/[A-Za-z0-9_.-]+", base_path):
        raise ValueError("Invalid site base path.")
    players = validate_players(json.loads((ROOT / "data/team-roster.json").read_text(encoding="utf-8")))
    out = ROOT / "dist"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir()
    # Only listed public files go into the hosted artifact. No source workbook or uploads.
    for name in ("index.html", "roster.html", "join.html", "privacy.html", "player.html",
                 "404.html", "sources.html", "styles.css", "app.js", "favicon.svg", ".nojekyll", "robots.txt"):
        shutil.copyfile(ROOT / name, out / name)
    # Error pages need absolute links at any depth. Derive the repository prefix
    # at build time so renaming the repository does not leave old asset paths.
    for name in ("404.html", "robots.txt"):
        target = out / name
        target.write_text(target.read_text(encoding="utf-8").replace("/qinghan-site/", base_path + "/"), encoding="utf-8")
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
    editor = out / "tools/roster-editor.html"
    editor.write_text(editor.read_text(encoding="utf-8").replace("github.com/Starlevin/qinghan-site/", "github.com/" + repository + "/"), encoding="utf-8")
    (out / "assets").mkdir()
    for name in ("team-badge", "community-qr"):
        for suffix in (".jpg", ".png", ".webp"):
            source = ROOT / "assets" / (name + suffix)
            if source.exists():
                if source.stat().st_size > 12 * 1024 * 1024:
                    raise ValueError("An image exceeds the site asset size limit.")
                shutil.copyfile(source, out / "assets" / source.name)
    game_art = ("manor-background.jpg", "manor-hall.jpg", "character-scene.jpg", "game-logo.png", "mercenary.png", "bloody-queen.png")
    (out / "assets/game").mkdir()
    for name in game_art:
        source = ROOT / "assets/game" / name
        if not source.is_file() or source.stat().st_size > 12 * 1024 * 1024:
            raise ValueError("An official artwork is missing or exceeds the site asset size limit.")
        shutil.copyfile(source, out / "assets/game" / name)
    print(f"Static build complete: {len(players)} curated public player profiles.")
    return out

if __name__ == "__main__":
    build()
