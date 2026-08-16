/**
 * The word language, shared by the schema printer and the live log — internal.
 *
 * One rule reads as one sentence: `FROM ON WHEN TO WITH EMIT BY` — the five words of the rule
 * plus its two coordinates, in the order the rule runs. That order is the whole point: `when`
 * decides, `to` names the target, `with` folds the input into the context, `emit`/`by` unfold
 * the reached context into the output. `toRules` writes all seven over a whole schema; the
 * debug layer's `rules` writes the four label words over transitions as they fire. Both are
 * the same writer with different arguments, which is why the machinery lives here and not in
 * either caller.
 *
 * Not exported from the package: the writer is a factory, not a `Formatter`, and a second
 * public entry point into the same language would only invite the two to drift apart.
 */
import { nameOf } from "../core/index.js";
import type { Edge } from "../core/types.js";

/** The keywords, in the order a rule runs. */
export const WORDS = [
  "FROM",
  "ON",
  "WHEN",
  "TO",
  "WITH",
  "EMIT",
  "BY",
] as const;

export type Word = (typeof WORDS)[number];

/**
 * The words a transition can fill: it knows where it came from, on what event, where it went
 * and what it emitted, but not which operations the rule that carried it named.
 *
 * Nothing worth having is lost. Two rules these four cannot tell apart are exactly what
 * `validate` reports as `duplicate-edge`, so on a machine that passes validation a line is
 * unambiguous.
 */
export const LABELS = [
  "FROM",
  "ON",
  "TO",
  "EMIT",
] as const satisfies readonly Word[];

/** What a row puts under one word — a label as it stands, an operation by name. */
const said = (row: Edge, word: Word): string | undefined => {
  switch (word) {
    case "FROM":
      return row.from;
    case "ON":
      return row.on;
    case "TO":
      return row.to;
    case "EMIT":
      return row.emit;
    case "WHEN":
      return nameOf(row.when, "when");
    case "WITH":
      return nameOf(row.with, "with");
    case "BY":
      return nameOf(row.by, "by");
  }
};

/**
 * Build a writer: a function of one row, with the columns already sized.
 *
 * Widths come from the rows given here, not from the row being written, which is what lets a
 * *stream* of rows line up — the schema is known in advance even when the run is not. A word no
 * row can fill is dropped whole; one that some row fills is padded blank in the rest. Pass a
 * single row to get an unaligned one-off line.
 */
export const writer = (rows: readonly Edge[], words: readonly Word[]) => {
  const width = (word: Word) =>
    Math.max(0, ...rows.map((r) => (said(r, word) ?? "").length));
  const sized = words
    .map((word) => [word, width(word)] as const)
    .filter(([, w]) => w > 0);

  return (row: Edge): string =>
    sized
      .map(([word, w]) => {
        const value = said(row, word);
        return value === undefined
          ? " ".repeat(word.length + 1 + w)
          : `${word} ${value.padEnd(w)}`;
      })
      .join(" ")
      .trimEnd();
};
