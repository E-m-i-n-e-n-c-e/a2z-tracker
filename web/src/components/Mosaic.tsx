import { memo } from "react";
import { type Item, STEPS, itemKey } from "@/lib/sheet";

interface Props {
  done: Record<string, string | null>;
  onPick: (item: Item) => void;
}

/** The whole sheet at a glance: one square per question, grouped by step. */
function Mosaic({ done, onPick }: Props) {
  return (
    <div className="mosaic" aria-label="Every question in the sheet, grouped by step">
      {STEPS.map((step) => (
        <div
          key={step.no}
          className="mosaic-step"
          title={`Step ${step.no}: ${step.name}`}
        >
          {step.items.map((it) => (
            <button
              key={itemKey(it)}
              type="button"
              tabIndex={-1}
              className="tile"
              data-done={String(it.id) in done || undefined}
              data-kind={it.kind}
              title={`${it.title} (Step ${step.no})`}
              aria-label={it.title}
              onClick={() => onPick(it)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default memo(Mosaic);
