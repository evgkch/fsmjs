import type { Analysis, Issue, Path } from "./types.js";
export type { Analysis, Issue, Path } from "./types.js";
/** A schema's shape: all nodes, reachability from `start`, and terminal (dead-end) nodes. */
export declare function analyze<T, Q extends PropertyKey = PropertyKey>(schema: T, start?: Q): Analysis<Q>;
/**
 * Turn `analyze` facts plus the cell-level lints into a severity-ranked report.
 *
 *   error   — unreachable node (dead code; requires `start`)
 *   error   — dead rule: a rule sitting after an unguarded one, so it can never fire
 *   warning — terminal node (dead end, possibly an intended final state)
 *   warning — duplicate edge: two rules a run cannot tell apart
 *
 * A `terminal` node is a warning rather than an error because it is usually a final state on
 * purpose — a fact worth seeing, not a repair to make.
 *
 * Note what is *not* here, and deliberately. Several rules on one cell is not a finding:
 * their guards decide. Neither is a cell whose every rule is guarded. An absent `when` reads
 * as ⊤, so "guarded" versus "unguarded" is not a distinction between a careful cell and a
 * careless one — it is just whether the event can be refused here, and a refusal is a
 * legitimate outcome. That is the partiality of δ, and the reason `dispatch` returns a
 * boolean. Reporting it flagged every machine that meant it.
 */
export declare function validate<T, Q extends PropertyKey = PropertyKey>(schema: T, start?: Q): Issue<Q>[];
/**
 * Enumerate every simple path from `from`: acyclic runs ending at a dead end
 * (`kind: 'terminal'`) and loops that revisit a node already on the path
 * (`kind: 'cycle'`, whose last node repeats an earlier one). Pure; the count can grow
 * large on dense graphs, since it lists all simple paths.
 */
export declare function paths<T, Q extends PropertyKey = PropertyKey>(schema: T, from: Q): Path<Q>[];
