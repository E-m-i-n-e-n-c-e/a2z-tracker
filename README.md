# A2Z Tracker

Personal tracker for Striver's A2Z DSA sheet.

- `scripts/extract.py` reads a saved takeUforward sheet page (`*.html`, not committed) and writes `data/a2z.csv`, `data/a2z.json` and `web/src/data/sheet.json`.
- `web/` is the Next.js app. Progress is stored in localStorage behind the `ProgressStore` interface in `web/src/lib/progress.ts`, so a Firebase-backed store can replace it later.

```sh
python3 scripts/extract.py "Striver's A2Z DSA Sheet & Course _ takeUforward.html"
cd web && npm install && npm run dev
```

Difficulty: takeUforward's basic/core/pro are shown as Easy/Medium/Hard.
