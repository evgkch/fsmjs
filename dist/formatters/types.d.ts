/** Types for the formatters (presentation) module. */
import type { Edge } from "../core/types.js";
/**
 * The contract: format some value (with options) into a string. Every export of this module has
 * this shape — pass any function of the same shape to swap in your own.
 *
 * Two prefixes divide them, and the rule is exact: `to*` takes a **schema** (`toRules`,
 * `toTree`, `toMermaid`, `toDot`), `format*` takes a **value some other module produced**
 * (`formatIssues`). Nothing here takes a schema and returns anything but a string.
 *
 * A custom renderer wanting the library's own edge label — `ON event WHEN … WITH … EMIT …` —
 * should call `edgeLabel` rather than rebuild it, so the two cannot drift apart.
 *
 * The options parameter is spelled `Opts`, never `O`: `O` is the obvious abbreviation for
 * *options*, and it is equally the obvious one for the output carrier — which is exactly why
 * that carrier is written `Λ` here. One symbol meaning two things is how drift starts.
 *
 * It defaults to `never`, not `void`, so that the bare `Formatter<T>` is the shape *every*
 * formatter fits — the one you can hold them all in:
 *
 * ```ts
 * const renderers: Record<string, Formatter<unknown>> = { rules: toRules, tree: toTree };
 * ```
 *
 * With `void` that assignment is rejected, because `void` is not assignable to an options object.
 * `never` also leaves room to give a formatter options later without breaking anyone who typed a
 * variable as the bare shape.
 */
export type Formatter<T, Opts = never> = (value: T, options?: Opts) => string;
/** Options for the diagram-language renderers (`toMermaid`, `toDot`). */
export type RenderOptions<Q extends string> = {
    /** Highlight this node as the current state (pass `fsm.state` for a live view). */
    current?: Q;
    /** Draw an initial-state marker pointing at this node. */
    start?: Q;
    /** Layout direction: top-to-bottom (default) or left-to-right. */
    direction?: "TB" | "LR";
    /** Say an edge some other way. Default `edgeLabel`; pass your own for another notation. */
    label?: (edge: Edge) => string;
};
/**
 * Options for the terminal tree (`toTree`).
 *
 * Deliberately not `RenderOptions & …`: a tree has no layout to direct and no arrow to hang a
 * start marker on, so inheriting `start` and `direction` would offer two options that do nothing.
 */
export type TextOptions<Q extends string> = {
    /** Mark this node as the current one (pass `fsm.state` for a live view). */
    current?: Q;
    /** Wrap the current node in an ANSI inverse-video escape (terminal colour). Default false. */
    color?: boolean;
    /** Print only this node's slice — one lookup, the schema being state-major. */
    at?: Q;
    /** Say an edge some other way. Default `edgeLabel`; pass your own for another notation. */
    label?: (edge: Edge) => string;
};
/** Options for the analysis-report formatters. */
export type FormatOptions = {
    /** Colour severities with ANSI escapes. Default false. */
    color?: boolean;
};
