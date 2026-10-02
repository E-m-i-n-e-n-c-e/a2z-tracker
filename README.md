# A2Z Tracker

Personal tracker for Striver's A2Z DSA sheet, built with Next.js in `web/`.

- `web/src/data/sheet.json` is the question list (titles, links, difficulty), with no one's progress in it.
- Progress is saved in the browser (localStorage) and starts empty. Signing in with Google is optional and syncs it through Firestore (`firestore.rules`: each user can only read and write their own document).
- `/restore` imports solved questions from a saved takeUforward sheet page. The file is parsed in the browser and never uploaded.

```sh
cd web && npm install && npm run dev
```

To refresh the question list (new links, articles), save the [A2Z sheet page](https://takeuforward.org/prep-hub/strivers-a2z-dsa-sheet?page=sheet) with Cmd/Ctrl+S and run:

```sh
python3 scripts/update_sheet.py "Striver's A2Z DSA Sheet & Course _ takeUforward.html"
```

It only reads question data, never solved status. The saved page stays local (`*.html` is gitignored).

Difficulty: takeUforward's basic/core/pro are shown as Easy/Medium/Hard.
