"use client";

import Link from "next/link";
import { useState } from "react";
import { ConflictDialog } from "./Account";
import { ChevronIcon } from "./icons";
import { useProgress } from "@/lib/progress";
import { ITEMS, countDone } from "@/lib/sheet";
import { TUF_SHEET_URL, type TufImport, parseTufPage } from "@/lib/tufImport";

const KNOWN_IDS = new Set(ITEMS.map((it) => it.id));

export default function RestorePage() {
  const { state, replace, conflict, resolveConflict, cancelConflict } = useProgress();
  const [found, setFound] = useState<TufImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const read = (html: string) => {
    setApplied(null);
    try {
      setFound(parseTufPage(html));
      setError(null);
    } catch (e) {
      setFound(null);
      setError(e instanceof Error ? e.message : "Couldn't read that page.");
    }
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.html?$/i.test(file.name)) {
      setFound(null);
      setApplied(null);
      setError("Choose the .html file your browser saved, not a screenshot or other file.");
      return;
    }
    read(await file.text());
  };
  const current = state ? countDone(state.done) : 0;
  const matched = found ? found.solved.filter((id) => KNOWN_IDS.has(id)) : [];
  const fromTuf = Object.fromEntries(matched.map((id) => [String(id), null]));
  const merged = state ? countDone({ ...fromTuf, ...state.done }) : 0;
  const incoming = countDone(fromTuf);

  const apply = (mode: "replace" | "merge") => {
    if (!state) return;
    const done = mode === "replace" ? fromTuf : { ...fromTuf, ...state.done };
    replace({ done });
    setApplied(mode === "replace" ? `Replaced. ${incoming} done.` : `Merged. ${countDone(done)} done.`);
    setFound(null);
  };

  return (
    <div className="account-page">
      <Link href="/" className="back">
        <ChevronIcon className="back-icon" />
        Back to the sheet
      </Link>

      <h1>Restore from takeUforward</h1>
      <p className="lede">
        Bring over the questions you&rsquo;ve marked solved on takeUforward. The page is read here in your browser and
        never uploaded.
      </p>

      <ol className="steps-howto">
        <li>
          Open{" "}
          <a href={TUF_SHEET_URL} target="_blank" rel="noreferrer">
            your A2Z sheet on takeUforward
          </a>{" "}
          and make sure you&rsquo;re signed in.
        </li>
        <li>
          Save the page with <kbd>⌘</kbd> <kbd>S</kbd> (Mac) or <kbd>Ctrl</kbd> <kbd>S</kbd> (Windows), as
          &ldquo;Webpage, Complete&rdquo; or &ldquo;HTML only&rdquo;.
        </li>
        <li>Choose the saved .html file below.</li>
      </ol>

      <label
        className="dropzone"
        data-dragging={dragging || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          readFile(e.dataTransfer.files[0]);
        }}
      >
        <input
          type="file"
          accept=".html,.htm,text/html"
          className="sr-only"
          onChange={(e) => {
            readFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <strong>Choose the saved .html file</strong>
        <span className="muted">or drop it here</span>
      </label>

      {error && <p className="fact-error restore-msg">{error}</p>}
      {applied && (
        <p className="restore-msg restore-ok">
          {applied}{" "}
          <Link href="/" className="link">
            Back to the sheet
          </Link>
        </p>
      )}

      {found && state && (
        <section className="restore-result" aria-live="polite">
          <dl className="facts">
            <div>
              <dt>takeUforward</dt>
              <dd>
                {incoming} of {ITEMS.length} done
              </dd>
            </div>
            <div>
              <dt>This tracker</dt>
              <dd>
                {current} of {ITEMS.length} done
              </dd>
            </div>
          </dl>
          {found.solved.length > matched.length && (
            <p className="muted restore-note">
              {found.solved.length - matched.length} solved questions on takeUforward aren&rsquo;t in this tracker&rsquo;s
              copy of the sheet, so they&rsquo;re skipped.
            </p>
          )}
          <div className="choices">
            <button type="button" className="choice" onClick={() => apply("merge")}>
              <strong>Merge</strong>
              <span>Keep everything done in either place: {merged} done.</span>
            </button>
            <button type="button" className="choice" onClick={() => apply("replace")}>
              <strong>Replace</strong>
              <span>
                Match takeUforward exactly: {incoming} done. Questions ticked only here get unticked.
              </span>
            </button>
          </div>
        </section>
      )}

      {conflict && <ConflictDialog conflict={conflict} onChoose={resolveConflict} onCancel={cancelConflict} />}
    </div>
  );
}
