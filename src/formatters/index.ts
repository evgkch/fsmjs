/**
 * Formatters (opt-in via `fsmjs/formatters`).
 *
 * Standard implementations of the `Formatter` contract — turn a schema into strings: diagram
 * source (Mermaid / DOT / a terminal tree / SQL-like rule lines), and a `validate` report into
 * terminal text. Swap in your own by passing any function of the same shape, and say an edge with
 * `edgeLabel` so it reads like the shipped ones.
 *
 * Two prefixes, one rule: `to*` takes a schema, `format*` takes a value another module produced.
 *
 * Everything here *renders* what it is given and computes nothing about the graph: walking it,
 * reaching over it and enumerating it belong to `fsmjs/analysis`, which returns data. The one
 * traversal in this module is the one every renderer needs — `edges`, listing the rows in schema
 * order.
 *
 * Every renderer takes a schema, in either of its two forms, and says the same thing about both.
 * Given `machine.schema` the operations are present and get named; given a schema read back from
 * JSON the names are already there, because that is what `toJSON` wrote in place of the code.
 * `toRules(machine.schema)` and `toRules(machine.toJSON())` therefore print the same lines. What a
 * renderer never does is pretend: an edge that fires conditionally is a different fact from one
 * that always does, and a diagram that hid the guard would be lying — so a guard with no name of
 * its own still shows as `?`.
 *
 * Names are taken from the functions themselves (`const underCap = …` → `underCap`), by the one
 * `nameOf` the dump also uses. They are not a namespace: nothing is looked up by them, and they
 * cannot drift from what the code does the way a hand-written label could.
 */
import { edges, nodes, nameOf } from "../core/index.js";
import type { Edge } from "../core/types.js";
import type { Issue } from "../analysis/types.js";
import { WORDS, writer } from "./words.js";
import type {
  Formatter,
  RenderOptions,
  TextOptions,
  FormatOptions,
} from "./types.js";

export type {
  Formatter,
  RenderOptions,
  TextOptions,
  FormatOptions,
} from "./types.js";

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
export const edgeLabel = (row: Edge): string => {
  const when = nameOf(row.when, "when");
  const with_ = nameOf(row.with, "with");
  return (
    `ON ${String(row.on)}` +
    (when ? ` WHEN ${when}` : "") +
    (with_ ? ` WITH ${with_}` : "") +
    (row.emit ? ` EMIT ${String(row.emit)}` : "")
  );
};

const invert = (s: string) => `\x1b[7m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;

/** Mermaid `stateDiagram-v2` (paste into Markdown). */
export const toMermaid: Formatter<unknown, RenderOptions<PropertyKey>> = (
  schema,
  options,
) => {
  const lines = ["stateDiagram-v2"];
  if (options?.direction) lines.push(`    direction ${options.direction}`);
  if (options?.start !== undefined) lines.push(`    [*] --> ${String(options.start)}`);
  const say = options?.label ?? edgeLabel;
  for (const row of edges(schema))
    lines.push(`    ${row.from} --> ${row.to}: ${say(row)}`);
  if (options?.current !== undefined) {
    lines.push("    classDef current fill:#4f46e5,color:#fff,font-weight:bold");
    lines.push(`    class ${String(options.current)} current`);
  }
  return lines.join("\n");
};

/** Graphviz DOT. */
export const toDot: Formatter<unknown, RenderOptions<PropertyKey>> = (
  schema,
  options,
) => {
  const lines = ["digraph FSM {"];
  if (options?.direction) lines.push(`    rankdir=${options.direction};`);
  if (options?.start !== undefined) {
    lines.push("    __start [shape=point];");
    lines.push(`    __start -> "${String(options.start)}";`);
  }
  if (options?.current !== undefined)
    lines.push(
      `    "${String(options.current)}" [style=filled fillcolor="#4f46e5" fontcolor=white];`,
    );
  const say = options?.label ?? edgeLabel;
  for (const row of edges(schema))
    lines.push(`    "${row.from}" -> "${row.to}" [label="${say(row)}"];`);
  lines.push("}");
  return lines.join("\n");
};

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
export const toTree: Formatter<unknown, TextOptions<PropertyKey>> = (
  schema,
  options,
) => {
  const rows = edges(schema) as Edge[];
  const say = options?.label ?? edgeLabel;
  const lines: string[] = [];

  for (const node of options?.at !== undefined
    ? [options.at]
    : (nodes(schema) as PropertyKey[])) {
    const outgoing = rows.filter((r) => r.from === node);
    const mark =
      options?.current === node ? " ●" : outgoing.length === 0 ? " ∎" : "";
    const name =
      options?.color && options?.current === node ? invert(String(node)) : String(node);
    lines.push(`${name}${mark}`);
    outgoing.forEach((row, i) =>
      lines.push(
        `  ${i === outgoing.length - 1 ? "└─" : "├─"} ${say(row)} → ${String(row.to)}`,
      ),
    );
  }
  return lines.join("\n");
};

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
export const toRules: Formatter<unknown> = (schema) => {
  const rows = edges(schema) as Edge[];
  const line = writer(rows, WORDS);
  return rows.map(line).join("\n");
};

/** A `validate` report for the terminal (✗ error / ⚠ warning per line). */
export const formatIssues: Formatter<Issue<PropertyKey>[], FormatOptions> = (
  issues,
  options,
) => {
  if (issues.length === 0) return "no issues";
  return issues
    .map((issue) => {
      const tag = `${issue.severity === "error" ? "✗" : "⚠"} ${issue.severity.padEnd(7)}`;
      const head = options?.color
        ? issue.severity === "error"
          ? red(tag)
          : yellow(tag)
        : tag;
      return `${head} ${issue.message}`;
    })
    .join("\n");
};
