"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Mosaic from "./Mosaic";
import QuestionRow from "./QuestionRow";
import { ChevronIcon } from "./icons";
import { isProgressState, snapshotState, useProgress } from "@/lib/progress";
import { type Difficulty, ITEMS, type Item, STEPS, itemKey, subKey } from "@/lib/sheet";

type StatusFilter = "all" | "todo" | "done";
type DiffFilter = "all" | Exclude<Difficulty, "">;

const STEP_KEY = "a2z-ui-step";
const SUBS_KEY = "a2z-ui-subs";

function readStorage<T>(key: string, fallback: T, valid: (v: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const v: unknown = JSON.parse(raw);
      if (valid(v)) return v as T;
    }
  } catch {}
  return fallback;
}

export default function Tracker() {
  const { state, toggle, replace } = useProgress();
  // Safe to read storage in initializers: only the loading placeholder renders until progress loads on the client.
  const [stepNo, setStepNo] = useState(() =>
    readStorage(STEP_KEY, 1, (v) => typeof v === "number" && v >= 1 && v <= STEPS.length),
  );
  // Sub-steps the user explicitly opened (true) or closed (false); others fall back to "open while unsolved".
  const [subOpen, setSubOpen] = useState<Record<string, boolean>>(() =>
    readStorage(SUBS_KEY, {}, (v) => !!v && typeof v === "object" && !Array.isArray(v)),
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [diff, setDiff] = useState<DiffFilter>("all");
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STEP_KEY, JSON.stringify(stepNo));
      localStorage.setItem(SUBS_KEY, JSON.stringify(subOpen));
    } catch {}
  }, [stepNo, subOpen]);

  const done = useMemo(() => state?.done ?? {}, [state]);
  const isDone = useCallback((it: Item) => String(it.id) in done, [done]);
  const count = (items: Item[]) => ({ done: items.filter(isDone).length, total: items.length });

  const q = query.trim().toLowerCase();
  const matches = (it: Item) =>
    (status === "all" || (status === "done") === isDone(it)) &&
    (diff === "all" || it.diff === diff) &&
    (!q ||
      it.title.toLowerCase().includes(q) ||
      it.sub.toLowerCase().includes(q) ||
      it.tags.some((t) => t.toLowerCase().includes(q)) ||
      it.patterns.some((t) => t.toLowerCase().includes(q)));

  const jumpTo = (it: Item) => {
    setQuery("");
    setStatus("all");
    setDiff("all");
    setStepNo(it.step);
    setSubOpen((o) => ({ ...o, [subKey(it.step, it.sub)]: true }));
    setFlashKey(itemKey(it));
  };

  useEffect(() => {
    if (!flashKey) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(`q-${flashKey}`)
      ?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    const t = setTimeout(() => setFlashKey(null), 1600);
    return () => clearTimeout(t);
  }, [flashKey]);

  const selectStep = (no: number) => {
    setQuery("");
    setStepNo(no);
    document.getElementById("step-top")?.scrollIntoView({ block: "start" });
  };

  const exportProgress = () => {
    if (!state) return;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `a2z-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importProgress = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isProgressState(parsed)) throw new Error();
      replace(parsed);
    } catch {
      alert("That file isn't a progress export from this tracker.");
    }
  };

  const resetToSnapshot = () => {
    if (confirm("Replace your progress with the takeUforward snapshot? Ticks made here will be lost.")) {
      replace(snapshotState());
    }
  };

  if (!state) return <div className="loading" aria-busy="true" />;

  const overall = count(ITEMS);
  const byDiff = (["Easy", "Medium", "Hard"] as const).map((d) => ({
    d,
    ...count(ITEMS.filter((it) => it.diff === d)),
  }));
  const upNext = ITEMS.find((it) => it.kind === "practice" && !isDone(it));
  const step = STEPS[stepNo - 1];
  const stepCount = count(step.items);

  // Searching looks across the whole sheet; otherwise show the selected step's sub-steps.
  const sections = q
    ? STEPS.map((s) => ({ key: `s${s.no}`, title: `Step ${s.no}: ${s.name}`, all: s.items }))
    : step.subs.map((sub) => ({ key: subKey(step.no, sub.name), title: sub.name, all: sub.items }));
  const visible = sections
    .map((s) => ({ ...s, items: s.all.filter(matches) }))
    .filter((s) => s.items.length > 0);
  const filtered = q !== "" || status !== "all" || diff !== "all";

  const isOpen = (key: string, items: Item[]) => !!q || (subOpen[key] ?? !items.every(isDone));
  const setAllSubs = (open: boolean) =>
    setSubOpen((o) => ({ ...o, ...Object.fromEntries(step.subs.map((s) => [subKey(step.no, s.name), open])) }));

  return (
    <div className="shell">
      <aside className="rail" aria-label="Steps">
        <p className="brand">A2Z Tracker</p>
        <ol>
          {STEPS.map((s) => {
            const c = count(s.items);
            return (
              <li key={s.no}>
                <button
                  type="button"
                  className="rail-step"
                  aria-current={!q && s.no === stepNo ? "step" : undefined}
                  data-complete={c.done === c.total || undefined}
                  onClick={() => selectStep(s.no)}
                >
                  <span className="rail-no">{s.no}</span>
                  <span className="rail-name">{s.name}</span>
                  <span className="rail-count">
                    {c.done}/{c.total}
                  </span>
                  <span className="bar" aria-hidden="true">
                    <span style={{ width: `${(c.done / c.total) * 100}%` }} />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>

      <main className="main">
        <header className="overview">
          <h1>
            {overall.done} of {overall.total} done
          </h1>
          <div className="diff-summary">
            {byDiff.map(({ d, done, total }) => (
              <span key={d} className={`diff diff-${d.toLowerCase()}`}>
                {d} {done}/{total}
              </span>
            ))}
          </div>
          <Mosaic done={done} currentStep={q ? 0 : stepNo} onPick={jumpTo} />
          <p className="mosaic-key muted">
            Squares are problems, circles are lectures. Click any one to jump to it.
          </p>
          {upNext && (
            <p className="up-next">
              Next unsolved:{" "}
              <button type="button" className="link" onClick={() => jumpTo(upNext)}>
                {upNext.title}
              </button>{" "}
              <span className="muted">in {STEPS[upNext.step - 1].name}</span>
            </p>
          )}
        </header>

        <div className="toolbar" id="step-top">
          <label className="step-picker">
            <span className="sr-only">Step</span>
            <select value={stepNo} onChange={(e) => selectStep(Number(e.target.value))}>
              {STEPS.map((s) => {
                const c = count(s.items);
                return (
                  <option key={s.no} value={s.no}>
                    {s.no}. {s.name} ({c.done}/{c.total})
                  </option>
                );
              })}
            </select>
          </label>
          <input
            type="search"
            className="search"
            placeholder="Search all questions, topics, patterns"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Segmented
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              ["all", "All"],
              ["todo", "To do"],
              ["done", "Done"],
            ]}
          />
          <Segmented
            label="Difficulty"
            value={diff}
            onChange={setDiff}
            options={[
              ["all", "Any"],
              ["Easy", "Easy"],
              ["Medium", "Medium"],
              ["Hard", "Hard"],
            ]}
          />
        </div>

        {q ? (
          <h2 className="step-title">
            {visible.reduce((n, s) => n + s.items.length, 0)} results for “{query.trim()}”
          </h2>
        ) : (
          <div className="step-head">
            <span className="step-no">Step {step.no}</span>
            <h2 className="step-title">{step.name}</h2>
            <span className="step-count">
              {stepCount.done} of {stepCount.total} done
            </span>
            <span className="step-tools">
              <button type="button" className="link" onClick={() => setAllSubs(true)}>
                Expand all
              </button>
              <button type="button" className="link" onClick={() => setAllSubs(false)}>
                Collapse all
              </button>
            </span>
          </div>
        )}

        {visible.length === 0 ? (
          <div className="empty">
            <p>No questions match these filters.</p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setQuery("");
                setStatus("all");
                setDiff("all");
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          visible.map((sec) => {
            const c = count(sec.all);
            const open = isOpen(sec.key, sec.all);
            return (
              <section key={sec.key} className="sub" data-open={open || undefined}>
                <h3>
                  <button
                    type="button"
                    className="sub-toggle"
                    aria-expanded={open}
                    disabled={!!q}
                    onClick={() => setSubOpen((o) => ({ ...o, [sec.key]: !open }))}
                  >
                    <ChevronIcon className="chev" />
                    <span>{sec.title}</span>
                    <span className="sub-count" data-complete={c.done === c.total || undefined}>
                      {filtered ? `${sec.items.length} shown` : `${c.done}/${c.total}`}
                    </span>
                  </button>
                </h3>
                {open && (
                  <ul>
                    {sec.items.map((it) => (
                      <QuestionRow
                        key={itemKey(it)}
                        item={it}
                        done={isDone(it)}
                        flash={flashKey === itemKey(it)}
                        showStep={!!q}
                        onToggle={toggle}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })
        )}

        {!q && (
          <nav className="pager" aria-label="Step navigation">
            {stepNo > 1 ? (
              <button type="button" className="btn" onClick={() => selectStep(stepNo - 1)}>
                Previous: {STEPS[stepNo - 2].name}
              </button>
            ) : (
              <span />
            )}
            {stepNo < STEPS.length && (
              <button type="button" className="btn" onClick={() => selectStep(stepNo + 1)}>
                Next: {STEPS[stepNo].name}
              </button>
            )}
          </nav>
        )}

        <footer className="foot">
          <p className="muted">Progress is saved in this browser.</p>
          <div className="foot-actions">
            <button type="button" className="link" onClick={exportProgress}>
              Export progress
            </button>
            <button type="button" className="link" onClick={() => fileInput.current?.click()}>
              Import progress
            </button>
            <button type="button" className="link" onClick={resetToSnapshot}>
              Reset to takeUforward snapshot
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importProgress(f);
                e.target.value = "";
              }}
            />
          </div>
        </footer>
      </main>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}
