/**
 * Analysis layer (opt-in via `fsmjs/analysis`).
 *
 * Static checks over a schema — reachability, dead ends, structural lints, path
 * enumeration. Nothing here runs a machine or looks inside a function: the graph checks read
 * `to` and `emit`, and the two cell-level checks read only whether an edge *has* a guard,
 * never what it decides.
 *
 * That is what makes the answers hold for both forms of the same machine, and it is why
 * `toJSON` keeps a guard at all — as its name, where the code used to be. Presence is all
 * these checks ever wanted. Pass `machine.schema` or a schema read straight from JSON and
 * `unreachable`, `terminal` and `dead-rule` answer the same. Only `duplicate-edge`
 * needs more: it tells guards apart by identity, which a name cannot do — two rules guarded by
 * different anonymous arrows both read `?` — so on a dumped schema it stays quiet rather than
 * guessing.
 *
 * Returns pure data (`Analysis`, `Issue[]`, `Path[]`); rendering it for humans lives in
 * `fsmjs/formatters`.
 */
import { edges, nodes } from "../core/index.js";
/** A schema's shape: all nodes, reachability from `start`, and terminal (dead-end) nodes. */
export function analyze(schema, start) {
    const rows = edges(schema);
    const all = nodes(schema);
    const terminal = all.filter((n) => !rows.some((r) => r.from === n));
    const reachable = new Set();
    if (start !== undefined) {
        const queue = [start];
        reachable.add(start);
        for (let i = 0; i < queue.length; i++)
            for (const row of rows)
                if (row.from === queue[i] && !reachable.has(row.to)) {
                    reachable.add(row.to);
                    queue.push(row.to);
                }
    }
    return {
        nodes: all,
        reachable: [...reachable],
        unreachable: start === undefined ? [] : all.filter((n) => !reachable.has(n)),
        terminal,
    };
}
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
export function validate(schema, start) {
    const issues = [];
    const rows = edges(schema);
    const { unreachable, terminal } = analyze(schema, start);
    for (const node of unreachable)
        issues.push({
            severity: "error",
            kind: "unreachable",
            node,
            message: `node "${node}" is unreachable from "${start}"`,
        });
    for (const node of terminal)
        issues.push({
            severity: "warning",
            kind: "terminal",
            node,
            message: `node "${node}" has no outgoing transitions`,
        });
    // Group the rows back into cells: one cell is one (node, event) pair.
    const cells = new Map();
    for (const row of rows) {
        const key = `${row.from}\0${row.on}`;
        (cells.get(key) ?? cells.set(key, []).get(key)).push(row);
    }
    for (const list of cells.values()) {
        const { from: node, on: event } = list[0];
        // Two rules with the same target, the same output event and the *same* guard
        // object are indistinguishable at run time — the second can never be the one that
        // fires. Sharing a target is fine and expected; sharing a target *and* a guard is
        // copy-paste. Reference equality is the exact test, and it is available precisely
        // because the guard now lives on the edge rather than at a coordinate.
        //
        // Off a dumped schema every guard is a name (a string), not the function it named, so
        // nothing can be told apart by reference and nothing is claimed: the check needs the
        // code, and says so by staying quiet.
        const seen = new Map();
        for (const row of list) {
            const key = `${row.to}\0${row.emit ?? ""}`;
            const guards = seen.get(key) ?? seen.set(key, []).get(key);
            if (typeof row.when !== "string" && guards.includes(row.when))
                issues.push({
                    severity: "warning",
                    kind: "duplicate-edge",
                    node,
                    event,
                    message: `cell "${event}" at "${node}" repeats the edge to "${row.to}"`,
                });
            guards.push(row.when);
        }
        // A rule with no guard always fires, so nothing after it is reachable.
        const open = list.findIndex((r) => !r.when);
        if (open !== -1 && open < list.length - 1)
            issues.push({
                severity: "error",
                kind: "dead-rule",
                node,
                event,
                message: `cell "${event}" at "${node}": rule ${open + 1} has no guard, so the ${list.length - open - 1} after it can never fire`,
            });
    }
    return issues;
}
/**
 * Enumerate every simple path from `from`: acyclic runs ending at a dead end
 * (`kind: 'terminal'`) and loops that revisit a node already on the path
 * (`kind: 'cycle'`, whose last node repeats an earlier one). Pure; the count can grow
 * large on dense graphs, since it lists all simple paths.
 */
export function paths(schema, from) {
    const out = edges(schema);
    const result = [];
    const walk = (node, nodes, legs) => {
        const outgoing = out.filter((r) => r.from === node);
        if (outgoing.length === 0) {
            result.push({ nodes: [...nodes], legs: [...legs], kind: "terminal" });
            return;
        }
        for (const row of outgoing) {
            if (nodes.includes(row.to))
                result.push({
                    nodes: [...nodes, row.to],
                    legs: [...legs, row],
                    kind: "cycle",
                });
            else
                walk(row.to, [...nodes, row.to], [...legs, row]);
        }
    };
    walk(from, [from], []);
    return result;
}
