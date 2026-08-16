/** Types for the analysis module. */
import type { Edge } from "../core/types.js";
/**
 * Static facts about a schema, computable without running anything.
 * Each field is a *subset* of the node set — hence readonly; order carries no meaning.
 */
export type Analysis<Q extends string> = {
    nodes: readonly Q[];
    reachable: readonly Q[];
    unreachable: readonly Q[];
    terminal: readonly Q[];
};
/**
 * A problem found by `validate`.
 *
 * `dead-rule` needs to know *that* an edge is guarded, and no more — presence, which `toJSON`
 * keeps (as the guard's name), so it answers the same on a machine in hand and on one loaded
 * from JSON. `duplicate-edge` wants identity rather than presence, and is quiet without it.
 */
export type Issue<Q extends string> = {
    severity: "error" | "warning";
    kind: "unreachable" | "terminal" | "duplicate-edge" | "dead-rule";
    node: Q;
    /** The event type whose cell the finding is about; absent for node-level findings. */
    event?: string;
    message: string;
};
/** A walk from the start node — either to a dead end, or closing a loop. */
export type Path<Q extends string> = {
    nodes: Q[];
    legs: Edge<Q>[];
    kind: "terminal" | "cycle";
};
