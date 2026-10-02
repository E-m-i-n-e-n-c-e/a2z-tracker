"""Rebuild web/src/data/sheet.json from a saved takeUforward A2Z sheet page.

Usage: python3 scripts/update_sheet.py "<saved page>.html"

Save the sheet (https://takeuforward.org/prep-hub/strivers-a2z-dsa-sheet?page=sheet) with Cmd/Ctrl+S.
Only question data is written (titles, links, difficulty, tags); solved status is ignored,
so it doesn't matter whose account the page was saved from.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "src" / "data" / "sheet.json"
BASE = "https://takeuforward.org"
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


def main(path: str):
    syl = load_syllabus(Path(path).read_text(encoding="utf-8"))
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
                "yt": n.get("yt_video") or "",
                "article": abs_url(n.get("free_blog_link")),
                "lc": n.get("leetcode_link") or "",
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

    OUT.write_text(json.dumps({"steps": steps, "items": items}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    with_article = sum(1 for it in items if it["article"])
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(steps)} steps, {len(items)} items, {with_article} with articles")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
