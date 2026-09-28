"""Extract Striver's A2Z sheet (with completion status) from a saved takeUforward HTML page.

Usage: python3 scripts/extract.py "<saved page>.html"
Writes data/a2z.csv and data/a2z.json.
"""
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://takeuforward.org"
# takeUforward now labels problems basic/core/pro; the classic sheet used Easy/Medium/Hard.
DIFFICULTY = {"basic": "Easy", "core": "Medium", "pro": "Hard"}


def load_syllabus(html: str) -> dict:
    # The page embeds its data as a Next.js RSC stream in self.__next_f.push([1, "..."]) calls.
    payload = ""
    for chunk in re.findall(r"self\.__next_f\.push\((\[.*?\])\)</script>", html, re.S):
        arr = json.loads(chunk)
        if len(arr) > 1 and isinstance(arr[1], str):
            payload += arr[1]
    key = '"sheet_syllabus":'
    start = payload.index(key) + len(key)
    syllabus, _ = json.JSONDecoder().raw_decode(payload, start)
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
    return "|".join(t["name"] for t in resolve(value or [], syl))


def abs_url(u):
    if not u:
        return ""
    return u if u.startswith("http") else BASE + u


def main(path: str):
    html = Path(path).read_text(encoding="utf-8")
    syl = load_syllabus(html)
    fields, rows = syl["fields"], syl["rows"]
    # Each row is [schemaIndex, ...values]; fields[schemaIndex] names the values.
    nodes = [dict(zip(fields[r[0]], r[1:])) for r in rows]

    steps, items = [], []

    def walk(idx, path_labels, step_no):
        n = nodes[idx]
        if n["type"] == "item":
            rt = n.get("redirectTo") or {}
            items.append({
                "id": n["id"],
                "step_no": step_no,
                "step": path_labels[0],
                "sub_step": " > ".join(path_labels[1:]),
                "title": n["label"].strip(),
                "slug": n["slug"],
                "kind": n.get("layoutType", ""),
                "difficulty": DIFFICULTY.get(n.get("difficulty") or "", "") if n.get("layoutType") == "practice" else "",
                "tuf_level": n.get("difficulty") or "",
                "status": n.get("status", ""),
                "done": n.get("status") == "solved",
                "duration": n.get("duration") or "",
                "tuf_url": f"{BASE}/strivers-a2z-dsa-sheet/{rt.get('category', '')}/{n['slug']}",
                "youtube": n.get("yt_video") or "",
                "article": abs_url(n.get("free_blog_link")),
                "leetcode": n.get("leetcode_link") or "",
                "topic_tags": tag_names(n.get("topic_tags"), syl),
                "pattern_tags": tag_names(n.get("pattern_tags"), syl),
            })
        elif n["type"] == "category":
            for c in n.get("children", []):
                walk(c, path_labels + [n["label"].strip()], step_no)
        # contests are skipped: they aren't checkable questions

    for i, r in enumerate(syl["roots"], 1):
        steps.append(nodes[r]["label"].strip())
        n = nodes[r]
        for c in n.get("children", []):
            walk(c, [n["label"].strip()], i)

    for i, it in enumerate(items, 1):
        it["index"] = i

    out = ROOT / "data"
    out.mkdir(exist_ok=True)
    cols = ["index", "id", "step_no", "step", "sub_step", "title", "kind", "difficulty", "tuf_level", "done",
            "duration", "tuf_url", "youtube", "article", "leetcode", "topic_tags", "pattern_tags", "slug"]
    with open(out / "a2z.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(items)
    (out / "a2z.json").write_text(json.dumps(items, indent=1, ensure_ascii=False), encoding="utf-8")

    # Compact copy for the Next.js app (web/). "done" here only seeds first-visit progress.
    app_items = [{
        "id": it["id"], "step": it["step_no"], "sub": it["sub_step"], "title": it["title"],
        "kind": it["kind"], "diff": it["difficulty"], "done": it["done"], "dur": it["duration"],
        "tuf": it["tuf_url"], "yt": it["youtube"], "article": it["article"], "lc": it["leetcode"],
        "tags": [t for t in it["topic_tags"].split("|") if t],
        "patterns": [t for t in it["pattern_tags"].split("|") if t],
    } for it in items]
    app_data = ROOT / "web" / "src" / "data"
    app_data.mkdir(parents=True, exist_ok=True)
    (app_data / "sheet.json").write_text(
        json.dumps({"steps": steps, "items": app_items}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8")

    done = sum(it["done"] for it in items)
    print(f"{len(items)} items, {done} done")
    for i, s in enumerate(steps, 1):
        its = [it for it in items if it["step_no"] == i]
        print(f"  Step {i:2}: {s:<30} {sum(x['done'] for x in its):>3}/{len(its)}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(next(ROOT.glob("*.html"))))
