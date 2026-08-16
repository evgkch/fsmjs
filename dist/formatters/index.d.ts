import type { Edge } from "../core/types.js";
import type { Issue } from "../analysis/types.js";
import type { Formatter, RenderOptions, TextOptions, FormatOptions } from "./types.js";
export type { Formatter, RenderOptions, TextOptions, FormatOptions, } from "./types.js";
/**
 * The edge label, in run order: `ON event WHEN … WITH … EMIT …`.
 *
 * These are the keywords `toRules` prints, the same four a transition can fill on its own
 * — one vocabulary for the table, the drawing and the running log. Nothing is punctuation, so
 * nothing needs a legend: a reader who can read a rule can read an arrow.
 *
 * The classic statechart notation would be `event [when] / emit`. It is one line away — pass your
 * own `label` to `toMermaid`, `toDot` or `toTree` — but it is not the default, because it would put
 * a second vocabulary next to the one the rest of the library already uses.
 *
 * `by` is the one word a diagram leaves out. A guard changes which edge fires and an update changes
 * the context, both facts about the walk; `by` only shapes the payload of an event already named on
 * the label. It appears in `toRules`, which has a column for everything.
 *
 * Exported so a renderer of your own says an edge the way the shipped ones do: rebuilding it by
 * hand is how two drawings of one machine start to disagree.
 */
export declare const edgeLabel: (row: Edge) => string;
/** Mermaid `stateDiagram-v2` (paste into Markdown). */
export declare const toMermaid: Formatter<unknown, RenderOptions<string>>;
/** Graphviz DOT. */
export declare const toDot: Formatter<unknown, RenderOptions<string>>;
/**
 * Plain-text adjacency tree for the terminal — current node `●`, dead ends `∎`.
 *
 * Nodes come in schema order, and a node written with an empty cell still gets a line: it has no
 * rows at all, and reading the node set off the edges alone would hide exactly the mistake worth
 * seeing.
 *
 * Pass `at` to print one node's slice instead of the whole machine — the cheap answer to "what
 * does this node do", which is one lookup because the schema is keyed by node first.
 */
export declare const toTree: Formatter<unknown, TextOptions<string>>;
/**
 * Schema dump as rules — one sentence per rule, `FROM ON WHEN TO WITH EMIT BY`:
 *
 *     FROM locked ON coin WHEN underCap TO locked WITH addCoin
 *     FROM locked ON coin               TO open   WITH reset   EMIT opened
 *     FROM open   ON pass               TO locked
 *
 * One column per word, plus the two coordinates — the same shape as the rule it dumps, in the
 * order the rule runs: `WHEN` gates, `WITH` folds, `EMIT`/`BY` observe.
 *
 * `FROM`, `ON`, `TO` and `EMIT` carry labels — the graph. `WHEN`, `WITH` and `BY` carry what can be
 * said about a function: its name, or `?` for one that has none. They are bound parameters in the
 * SQL sense — the operation exists, but it is supplied by the code. A schema loaded from JSON
 * carries the names without the code, so the columns stay and the line reads the same; a column
 * vanishes only when no rule in the schema fills it at all.
 *
 * Rows come in schema order, which is state-major, so `FROM` groups. The grammar is regular and
 * whitespace-insensitive, though the library ships no parser for it.
 *
 * `fsmjs/debug`'s `rules` writes a running machine in this same language, four words of it. A
 * schema and a log read the same way on purpose: one vocabulary for the table and the run.
 */
export declare const toRules: Formatter<unknown>;
/** A `validate` report for the terminal (✗ error / ⚠ warning per line). */
export declare const formatIssues: Formatter<Issue<string>[], FormatOptions>;
