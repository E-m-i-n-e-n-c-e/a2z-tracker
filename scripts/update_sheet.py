"""Rebuild web/src/data/sheet.json from takeUforward's A2Z sheet.

Usage:
  python3 scripts/update_sheet.py                  # fetch the live sheet page
  python3 scripts/update_sheet.py "<saved>.html"   # or read a page saved with Cmd/Ctrl+S

The public page (no login) carries the full sheet data. Only question data is written
(titles, links, difficulty, tags); solved status is ignored.
"""

import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "src" / "data" / "sheet.json"
# GeeksforGeeks links aren't on takeUforward anymore; they come from the old sheet (see the file's _source).
GFG = json.loads((ROOT / "scripts" / "gfg_links.json").read_text(encoding="utf-8"))["links"]
# Our own LeetCode links, only for questions where takeUforward has none. Never overrides theirs.
LC_FALLBACK = json.loads((ROOT / "scripts" / "lc_links.json").read_text(encoding="utf-8"))["links"]
# Same idea for videos: only fills questions where takeUforward has no video.
YT_FALLBACK = json.loads((ROOT / "scripts" / "yt_links.json").read_text(encoding="utf-8"))["links"]


def gfg_fields(qid: str) -> dict:
    """A GfG entry is a URL, or a list of {title, url} when one question maps to several GfG problems."""
    entry = GFG.get(qid, "")
    if isinstance(entry, list):
        return {"gfg": entry[0]["url"], "gfgOptions": entry}
    return {"gfg": entry}
BASE = "https://takeuforward.org"
SHEET_URL = f"{BASE}/prep-hub/strivers-a2z-dsa-sheet?page=sheet"
# takeUforward labels problems basic/core/pro; the tracker shows Easy/Medium/Hard.
DIFFICULTY = {"basic": "Easy", "core": "Medium", "pro": "Hard"}


def load_syllabus(html: str) -> dict:
    # The page embeds its data as a Next.js stream in self.__next_f.push([1, "..."]) calls.
    payload = ""
    for chunk in re.findall(r"self\.__next_f\.push\((\[.*?\])\)</script>", html, re.S):
        try:
            arr = json.loads(chunk)
        except json.JSONDecodeError:
            continue
        if len(arr) > 1 and isinstance(arr[1], str):
            payload += arr[1]
    key = '"sheet_syllabus":'
    if key not in payload:
        sys.exit("No sheet data found. Save the page from the A2Z sheet itself.")
    syllabus, _ = json.JSONDecoder().raw_decode(payload, payload.index(key) + len(key))
    return syllabus


def fetch_page() -> str:
    req = urllib.request.Request(SHEET_URL, headers={"User-Agent": "Mozilla/5.0 (a2z-tracker sheet update)"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.read().decode("utf-8")


def summarize(old: dict, new: dict):
    """Print what changed compared with the current sheet.json."""
    if old["steps"] != new["steps"]:
        print("  steps changed:", old["steps"], "->", new["steps"])
    oi = {(i["step"], i["id"]): i for i in old["items"]}
    ni = {(i["step"], i["id"]): i for i in new["items"]}
    for key in ni.keys() - oi.keys():
        print(f"  added: {ni[key]['title']} (step {key[0]})")
    for key in oi.keys() - ni.keys():
        print(f"  removed: {oi[key]['title']} (step {key[0]})")
    changed = 0
    for key in sorted(oi.keys() & ni.keys()):
        for field, value in ni[key].items():
            if oi[key].get(field) != value:
                changed += 1
                print(f"  {ni[key]['title']}: {field} {oi[key].get(field)!r} -> {value!r}")
    if old == new:
        print("  no changes")
    elif changed == 0 and oi.keys() == ni.keys() and old["steps"] == new["steps"]:
        print("  only ordering changed")


def resolve(value, syl):
    """Follow RSC dedup references like "$29:props:...:sheet_syllabus:rows:62:17:1" back into syl."""
    if isinstance(value, str) and value.startswith("$") and ":sheet_syllabus:" in value:
        target = syl
        for part in value.split(":sheet_syllabus:", 1)[1].split(":"):
            target = target[int(part)] if isinstance(target, list) else target[part]
        return resolve(target, syl)
    if isinstance(value, list):
        return [resolve(v, syl) for v in value]
    return value


def tag_names(value, syl):
    return [t["name"] for t in resolve(value or [], syl)]


def abs_url(u):
    if not u:
        return ""
    return u if u.startswith("http") else BASE + u


def main(path: str | None):
    html = Path(path).read_text(encoding="utf-8") if path else fetch_page()
    syl = load_syllabus(html)
    # Each row is [schemaIndex, ...values]; fields[schemaIndex] names the values.
    nodes = [dict(zip(syl["fields"][r[0]], r[1:])) for r in syl["rows"]]

    steps, items = [], []

    def walk(idx, labels, step_no):
        n = nodes[idx]
        if n["type"] == "item":
            rt = n.get("redirectTo") or {}
            kind = n.get("layoutType", "")
            items.append({
                "id": n["id"],
                "step": step_no,
                "sub": " > ".join(labels[1:]),
                "title": n["label"].strip(),
                "kind": kind,
                "diff": DIFFICULTY.get(n.get("difficulty") or "", "") if kind == "practice" else "",
                "dur": n.get("duration") or "",
                # Site routes are /{layoutType}/{contentType}/{slug}, e.g. /practice/dsa/two-sum
                "tuf": f"{BASE}/{rt.get('layoutType', kind)}/{rt.get('contentType', 'dsa')}/{rt.get('itemSlug', n['slug'])}",
                "yt": n.get("yt_video") or YT_FALLBACK.get(str(n["id"]), ""),
                "article": abs_url(n.get("free_blog_link")),
                "lc": n.get("leetcode_link") or (LC_FALLBACK.get(str(n["id"]), "") if kind == "practice" else ""),
                **(gfg_fields(str(n["id"])) if kind == "practice" else {"gfg": ""}),
                "tags": tag_names(n.get("topic_tags"), syl),
                "patterns": tag_names(n.get("pattern_tags"), syl),
            })
        elif n["type"] == "category":
            for c in n.get("children", []):
                walk(c, labels + [n["label"].strip()], step_no)
        # Contests are skipped: they aren't checkable questions.

    for step_no, root in enumerate(syl["roots"], 1):
        n = nodes[root]
        steps.append(n["label"].strip())
        for c in n.get("children", []):
            walk(c, [n["label"].strip()], step_no)

    new = {"steps": steps, "items": items}
    if OUT.exists():
        summarize(json.loads(OUT.read_text(encoding="utf-8")), new)
    OUT.write_text(json.dumps(new, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    for field, fallback, name in (("lc", LC_FALLBACK, "lc_links.json"), ("yt", YT_FALLBACK, "yt_links.json")):
        for qid, url in fallback.items():
            if any(str(it["id"]) == qid and it[field] != url for it in items):
                print(f"  note: takeUforward now has its own {field} link for {qid}; {name} entry is unused")
    with_article = sum(1 for it in items if it["article"])
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(steps)} steps, {len(items)} items, {with_article} with articles")


if __name__ == "__main__":
    if len(sys.argv) > 2:
        sys.exit(__doc__)
    main(sys.argv[1] if len(sys.argv) == 2 else None)
