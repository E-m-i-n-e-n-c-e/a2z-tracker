import raw from "@/data/sheet.json";

export type Difficulty = "Easy" | "Medium" | "Hard" | "";

export interface Item {
  id: number;
  step: number;
  sub: string;
  title: string;
  kind: "practice" | "learning";
  diff: Difficulty;
  /** Completion state in the takeUforward snapshot; only used to seed progress. */
  done: boolean;
  dur: string;
  tuf: string;
  yt: string;
  article: string;
  lc: string;
  tags: string[];
  patterns: string[];
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

export const SNAPSHOT_DONE: number[] = [...new Set(ITEMS.filter((it) => it.done).map((it) => it.id))];

/** Items can appear in more than one step (e.g. "Basic Hashing"), so ids alone aren't unique in the list. */
export const itemKey = (it: Item) => `${it.step}-${it.id}`;

export const subKey = (step: number, sub: string) => `${step}:${sub}`;
