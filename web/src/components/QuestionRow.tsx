import { memo, useEffect, useRef, useState } from "react";
import { ArticleIcon, CodeIcon, GfgIcon, LeetCodeIcon, YouTubeIcon } from "./icons";
import { type GfgOption, type Item, itemKey } from "@/lib/sheet";

interface Props {
  item: Item;
  done: boolean;
  flash: boolean;
  /** In search results rows are grouped by step, so name the sub-step. */
  showSub?: boolean;
  onToggle: (id: number) => void;
}

function IconLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  if (!href) return <span className="icon-slot" aria-hidden="true" />;
  return (
    <a className="icon-link" href={href} target="_blank" rel="noreferrer" title={label} aria-label={label}>
      {children}
    </a>
  );
}

/** One question covered by several GfG problems (e.g. floor and ceil): pick which one to open. */
function GfgMenu({ options }: { options: GfgOption[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="link-menu" ref={ref}>
      <button
        type="button"
        className="icon-link"
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Solve on GeeksforGeeks (${options.length} problems)`}
        aria-label={`Solve on GeeksforGeeks, choose from ${options.length} problems`}
        onClick={() => setOpen((o) => !o)}
      >
        <GfgIcon className="icon icon-gfg" />
      </button>
      {open && (
        <div className="link-menu-list" role="menu">
          {options.map((o) => (
            <a key={o.url} role="menuitem" href={o.url} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
              {o.title}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionRow({ item, done, flash, showSub, onToggle }: Props) {
  return (
    <li id={`q-${itemKey(item)}`} className="q" data-done={done || undefined} data-flash={flash || undefined}>
      <label className="check">
        <input
          type="checkbox"
          checked={done}
          onChange={() => onToggle(item.id)}
          aria-label={`Mark ${item.title} ${done ? "not done" : "done"}`}
        />
        <span className="box" aria-hidden="true">
          <svg viewBox="0 0 16 16">
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
        </span>
      </label>

      <div className="q-main">
        <a className="q-title" href={item.tuf} target="_blank" rel="noreferrer">
          {item.title}
        </a>
        <div className="q-meta">
          {item.kind === "learning" ? (
            <span className="lecture">Lecture</span>
          ) : (
            item.diff && <span className={`diff diff-${item.diff.toLowerCase()}`}>{item.diff}</span>
          )}
          {item.dur && <span>{item.dur}</span>}
          {showSub && <span>{item.sub}</span>}
          {item.patterns.length > 0 && <span className="patterns">{item.patterns.join(", ")}</span>}
        </div>
      </div>

      <div className="q-links">
        <IconLink href={item.article} label="Read article">
          <ArticleIcon className="icon icon-article" />
        </IconLink>
        <IconLink href={item.yt} label="Watch video">
          <YouTubeIcon className="icon" />
        </IconLink>
        {/* Practice link: LeetCode, else GeeksforGeeks, else takeUforward's own problem page. */}
        {item.lc ? (
          <IconLink href={item.lc} label="Solve on LeetCode">
            <LeetCodeIcon className="icon icon-leetcode" />
          </IconLink>
        ) : item.gfgOptions && item.gfgOptions.length > 1 ? (
          <GfgMenu options={item.gfgOptions} />
        ) : item.gfg ? (
          <IconLink href={item.gfg} label="Solve on GeeksforGeeks">
            <GfgIcon className="icon icon-gfg" />
          </IconLink>
        ) : (
          <IconLink href={item.kind === "practice" ? item.tuf : ""} label="Solve on takeUforward">
            <CodeIcon className="icon icon-code" />
          </IconLink>
        )}
      </div>
    </li>
  );
}

export default memo(QuestionRow);
