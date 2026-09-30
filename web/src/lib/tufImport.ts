/**
 * Reads solved status out of a saved takeUforward A2Z sheet page.
 * Runs entirely in the browser: the saved page includes the user's session data, so it must never be uploaded.
 */

export const TUF_SHEET_URL = "https://takeuforward.org/prep-hub/strivers-a2z-dsa-sheet?page=sheet";

export interface TufImport {
  /** Item ids marked solved on takeUforward. */
  solved: number[];
  /** Every item id in that copy of the sheet. */
  total: number;
}

/** Index just past the JSON value that starts at `start` (object or array). */
function jsonEnd(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
    } else if (c === "{" || c === "[") {
      depth++;
    } else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

export function parseTufPage(html: string): TufImport {
  // The page embeds its data as a Next.js stream: self.__next_f.push([1, "..."]).
  let payload = "";
  for (const m of html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)) {
    try {
      const arr = JSON.parse(m[1]);
      if (typeof arr[1] === "string") payload += arr[1];
    } catch {
      // Other script chunks aren't JSON arrays; skip them.
    }
  }

  const key = '"sheet_syllabus":';
  const at = payload.indexOf(key);
  if (at === -1) {
    throw new Error(
      html.includes("takeuforward")
        ? "This page doesn't include the sheet. Save it from the A2Z sheet page while signed in."
        : "This doesn't look like a saved takeUforward page.",
    );
  }
  const start = at + key.length;
  const end = jsonEnd(payload, start);
  if (end === -1) throw new Error("The saved page looks incomplete. Try saving it again.");

  const syllabus = JSON.parse(payload.slice(start, end)) as { fields: string[][]; rows: unknown[][] };
  const solved: number[] = [];
  let total = 0;
  for (const row of syllabus.rows) {
    const names = syllabus.fields[row[0] as number];
    const node = Object.fromEntries(names.map((n, i) => [n, row[i + 1]]));
    if (node.type !== "item") continue;
    total++;
    if (node.status === "solved") solved.push(node.id as number);
  }
  if (total === 0) throw new Error("No questions found in this page.");
  return { solved: [...new Set(solved)], total };
}
