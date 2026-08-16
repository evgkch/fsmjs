import type { Edge } from "../core/types.js";
/** The keywords, in the order a rule runs. */
export declare const WORDS: readonly ["FROM", "ON", "WHEN", "TO", "WITH", "EMIT", "BY"];
export type Word = (typeof WORDS)[number];
/**
 * The words a transition can fill: it knows where it came from, on what event, where it went
 * and what it emitted, but not which operations the rule that carried it named.
 *
 * Nothing worth having is lost. Two rules these four cannot tell apart are exactly what
 * `validate` reports as `duplicate-edge`, so on a machine that passes validation a line is
 * unambiguous.
 */
export declare const LABELS: readonly ["FROM", "ON", "TO", "EMIT"];
/**
 * Build a writer: a function of one row, with the columns already sized.
 *
 * Widths come from the rows given here, not from the row being written, which is what lets a
 * *stream* of rows line up — the schema is known in advance even when the run is not. A word no
 * row can fill is dropped whole; one that some row fills is padded blank in the rest. Pass a
 * single row to get an unaligned one-off line.
 */
export declare const writer: (rows: readonly Edge[], words: readonly Word[]) => (row: Edge) => string;
