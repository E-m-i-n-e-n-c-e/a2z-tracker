import raw from "@/data/sheet.json";

export type Difficulty = "Easy" | "Medium" | "Hard" | "";

export interface Item {
  id: number;
  step: number;
  sub: string;
  title: string;
  kind: "practice" | "learning";
  diff: Difficulty;
  dur: string;
  tuf: string;
  yt: string;
  article: string;
  lc: string;
  /** GeeksforGeeks problem, from the old sheet; the practice link when there's no LeetCode one. */
  gfg: string;
  /** When one question maps to several GfG problems (e.g. floor and ceil separately). */
  gfgOptions?: GfgOption[];
  tags: string[];
  patterns: string[];
}

export interface GfgOption {
  title: string;
  url: string;
}

export interface SubStep {
  name: string;
  items: Item[];
}

export interface Step {
  no: number;
  name: string;
  items: Item[];
  subs: SubStep[];
}

const data = raw as unknown as { steps: string[]; items: Item[] };

export const ITEMS: Item[] = data.items;

export const STEPS: Step[] = data.steps.map((name, i) => {
  const items = ITEMS.filter((it) => it.step === i + 1);
  const subs: SubStep[] = [];
  for (const it of items) {
    let sub = subs.at(-1);
    if (!sub || sub.name !== it.sub) {
      sub = { name: it.sub, items: [] };
      subs.push(sub);
    }
    sub.items.push(it);
  }
  return { no: i + 1, name, items, subs };
});

/** Items can appear in more than one step (e.g. "Basic Hashing"), so ids alone aren't unique in the list. */
export const itemKey = (it: Item) => `${it.step}-${it.id}`;

/** Done count as the sheet shows it: per row, so an item listed in two steps counts in both. */
export const countDone = (done: Record<string, unknown>) => ITEMS.filter((it) => String(it.id) in done).length;

export const subKey = (step: number, sub: string) => `${step}:${sub}`;
