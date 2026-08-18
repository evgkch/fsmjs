var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _StateMachine_instances, _StateMachine_type, _StateMachine_context, _StateMachine_channel, _StateMachine_dispatching, _StateMachine_rule;
/**
 * The kernel — and nothing else.
 *
 * A machine is one object: state → event type → rules, each rule five words. `new StateMachine`
 * takes that schema and the state to start in, and there is nothing between you and it — no
 * builder, no factory. The three carriers are given explicitly because none of them can be read
 * off the schema, and giving them is also what lets you write the machine's type down:
 * `StateMachine<Till, Σ, Λ>` names a field, a parameter or a variable.
 *
 * A machine advances one way — `dispatch(type, payload?)` — and answers one question about
 * advancing: `can(type, payload?)`. Both work from where the machine actually is; there is
 * no second entry point taking a state of its own.
 *
 * There is no second artifact to keep in step. The graph is a projection of the one
 * object — `toJSON` turns each operation into its name and forgets the rest — and `edges`
 * and `nodes` read either form, with the functions present or loaded back from JSON as names.
 */
import Channel from "@evgkch/channeljs";
// Outside production, freeze every context handed out: `Readonly<Q[q]>` is compile-time only,
// and `when` is called speculatively, so an in-place mutation would corrupt live state. This
// covers the pass-through case too — a rule with no `with` hands the caller's own object
// straight back, which is exactly where a mutation hides. Gated so production pays nothing;
// the `typeof process` guard keeps this safe with no bundler.
const freezing = typeof process === "undefined" || process.env?.NODE_ENV !== "production";
const freeze = (context) => freezing ? Object.freeze(context) : context;
/**
 * The two halves of a slot, and the only place in this library that knows a slot has two forms.
 *
 * Every reader asks through these — `edges` before it hands a row on, `dispatch` before it runs
 * one — so "a name, or a name and its operation" is a fact about the schema's shape and not a
 * branch each consumer writes for itself, slightly differently, until one of them forgets.
 */
const isPair = (slot) => slot !== undefined && Array.isArray(slot);
export const nameIn = (slot) => isPair(slot) ? slot[0] : slot;
export const opIn = (slot) => {
    if (!isPair(slot))
        return undefined;
    // Same reason as in `nameOf`: a pair off a plain `stringify` is `["ready", null]`, and a null
    // carrier is no carrier — not a carrier that crashes whoever asks it its name.
    return slot[1] ?? undefined;
};
/**
 * Flatten a schema into the transition relation — one `Edge` per rule, in schema order.
 *
 * A row is the rule itself with its two coordinates in front: the words are already one
 * column per fact, so nothing is taken apart here. Operations ride along as themselves; a row
 * off a JSON-loaded schema has none.
 */
export function edges(schema) {
    const rows = [];
    for (const [from, byLetter] of Object.entries((schema ?? {})))
        for (const [on, cell] of Object.entries(byLetter ?? {}))
            for (const rule of cell ?? [])
                // Flattened, and that is the point of this function: a row is one column per fact, so a
                // target and its carrier come apart here and every reader downstream — a diagram, a
                // report, a rule line, another program's inspector — goes on reading four flat words.
                rows.push({
                    ...(rule.when !== undefined && { when: rule.when }),
                    from: from,
                    on,
                    to: nameIn(rule.to),
                    ...(opIn(rule.to) !== undefined && { with: opIn(rule.to) }),
                    ...(nameIn(rule.emit) !== undefined && { emit: nameIn(rule.emit) }),
                    ...(opIn(rule.emit) !== undefined && { by: opIn(rule.emit) }),
                });
    return rows;
}
/**
 * Every state the schema names — its own keys, plus every target some rule leads to.
 *
 * Graph vocabulary on purpose: this reads the projection, and a graph has nodes. The machine
 * is *in* a state; the drawing *has* nodes, and they are the same Q seen from two sides.
 *
 * The keys matter on their own: a state written with an empty cell (`ghost: {}`) has no rows
 * at all, and reading the node set off `edges` alone would hide it from exactly the checks
 * meant to find it.
 */
export function nodes(schema) {
    const found = new Set(Object.keys((schema ?? {})));
    for (const row of edges(schema))
        found.add(row.to);
    return [...found];
}
/**
 * Name an operation: its own name, or a name already read off a previous dump, passed
 * straight through since a dump cannot un-forget the code it forgot. Both fall back to `?`
 * when there is nothing to show.
 *
 * The `slot` matters for the function case: a property-valued arrow inherits the *property's*
 * name from JS itself (`{ when: () => … }.when.name` is `"when"`, not `""`), and without
 * discounting that every anonymous guard would misreport as a guard literally named "when".
 *
 * Exported for `fsmjs/formatters`, which prints the same names on rule lines and diagram
 * labels — one naming rule for the dump and for the drawing, so they cannot disagree about
 * what an operation is called.
 */
export function nameOf(operation, slot) {
    // `null` and not only `undefined`: a schema that went through a plain `JSON.stringify` — rather
    // than through `toJSON` — has a hole where each function was, and inside a pair an array keeps
    // that hole as `null`. Such a schema is still a schema, and reading one is this library's job.
    if (operation === undefined || operation === null)
        return undefined;
    if (typeof operation === "string")
        return operation;
    return operation.name && operation.name !== slot ? operation.name : "?";
}
/**
 * The graph: the labels, and each operation's name where one was there.
 *
 * Three columns turned into names rather than dropped — `JSON.stringify` would drop `with` and
 * `by` unaided, since they are function-valued properties, but the point was never to shrink
 * the schema, only to make it safe to ship: a name cannot be run, so the dump carries what a
 * diagram or a rule line can say about a rule without carrying the code that says it.
 *
 * `when`'s presence is what a graph must never drop, named or not: it decides whether a rule
 * applies at all, which is part of the transition relation a graph is. Without it a dumped
 * machine reads as nondeterministic where it is only conditional, and `validate` would call a
 * sound cell's second rule dead.
 */
export function graph(schema) {
    const out = {};
    for (const [q, byLetter] of Object.entries((schema ?? {}))) {
        const cells = (out[q] = {});
        for (const [σ, cell] of Object.entries(byLetter ?? {}))
            cells[σ] = (cell ?? []).map((rule) => {
                const carry = opIn(rule.to);
                const pack = opIn(rule.emit);
                const letter = nameIn(rule.emit);
                return {
                    // The pair survives the dump as a pair. A name where the function was, and nothing
                    // wrapped around it: the shape a schema has in code is the shape it has in JSON, and a
                    // reader who wants something else overrides `toJSON` — which is what this is.
                    to: carry === undefined
                        ? nameIn(rule.to)
                        : [nameIn(rule.to), nameOf(carry, "with")],
                    ...(letter !== undefined && {
                        emit: pack === undefined ? letter : [letter, nameOf(pack, "by")],
                    }),
                    ...(rule.when !== undefined && { when: nameOf(rule.when, "when") }),
                };
            });
    }
    return out;
}
/** The reserved channel key a `Transition` rides on. */
export const TRANSITION = Symbol("transition");
/**
 * Thrown when `dispatch` is re-entered: called synchronously from inside a transition already
 * in progress, whether from a listener or from a `when`/`with`/`by` of the rule itself. Defer
 * it with `queueMicrotask` to send the event after the current transition has finished.
 */
export class DispatchInsideHandlerError extends Error {
    constructor() {
        super("nested dispatch is forbidden; use queueMicrotask");
        this.name = "DispatchInsideHandlerError";
        Object.setPrototypeOf(this, DispatchInsideHandlerError.prototype);
    }
}
/**
 * A state machine: the schema, where it currently is, and the output bus.
 *
 * The schema stays a public field — a wrapper reads it to draw or validate, operations still
 * in view. `Q` is a carrier — state ↦ the context that state carries — exactly as `Σ` is
 * event type ↦ payload, so the set of states is `keyof Q` and needs no parameter of its own.
 *
 * The constructor takes the starting state as a `State`, one value rather than two, because
 * with a per-state context the two arguments were only valid in combination: `('empty', {…})`
 * could name a state and hand it another state's context.
 */
export class StateMachine {
    constructor(schema, start) {
        _StateMachine_instances.add(this);
        this.schema = schema;
        _StateMachine_type.set(this, void 0);
        _StateMachine_context.set(this, void 0);
        _StateMachine_channel.set(this, void 0);
        _StateMachine_dispatching.set(this, false);
        __classPrivateFieldSet(this, _StateMachine_type, start.type, "f");
        __classPrivateFieldSet(this, _StateMachine_context, start.context, "f");
    }
    /**
     * Where the machine is: the state, and the context that state carries — one value.
     *
     * One accessor rather than a pair of them, because with a per-state context the two halves
     * are only meaningful together. Two independent getters could not be correlated by the
     * compiler either: testing the state's name would say nothing about what its context holds,
     * so reading a field would mean reading it off the union of every state's context. Here `type`
     * is the discriminant, and narrowing it narrows the context with it:
     *
     * ```ts
     * const at = machine.state;
     * if (at.type === 'resizing') at.context.handle;   // a field only that state has
     * ```
     *
     * It is the same type the ends of a `Transition` carry, the entries `history` records, and
     * the argument the constructor and `restore` take — one shape for "where a machine is",
     * wherever the question comes up.
     */
    get state() {
        return { type: __classPrivateFieldGet(this, _StateMachine_type, "f"), context: __classPrivateFieldGet(this, _StateMachine_context, "f") };
    }
    /** The output bus. Built on first use, so a machine nobody listens to pays nothing. */
    get rx() {
        return (__classPrivateFieldSet(this, _StateMachine_channel, __classPrivateFieldGet(this, _StateMachine_channel, "f") ?? new Channel(), "f")).rx;
    }
    /**
     * Would this message fire from here? A question, not a move: the guards run, nothing else
     * does, and the machine does not budge.
     *
     * Exactly equivalent to what the next `dispatch` of the same message would return —
     * `with` and `by` cannot refuse a rule the guard admitted, so nothing beyond the guards
     * can change the answer. That equivalence is why the guards must be pure: asking twice
     * has to give the same answer as asking once.
     *
     * This is the question a view asks — whether to enable the button — and it is answerable
     * without a speculative copy of the machine because the guard is the only thing that
     * decides.
     */
    can(...args) {
        const [type, payload] = args;
        return __classPrivateFieldGet(this, _StateMachine_instances, "m", _StateMachine_rule).call(this, type, payload) !== undefined;
    }
    /**
     * Feed one event, from wherever the machine now is. `true` if a transition fired.
     *
     * One transition is that partial function, and this is the only way to take one.
     * The operations run in the order they are named: `when` decides, `with` folds the input into
     * the context, `by` unfolds the reached context into the output. A dispatch that fires nothing
     * changes nothing and sends nothing.
     *
     * Everything here is synchronous, notifications included, so a second `dispatch` reached
     * from inside this one — from a listener, or from `when`/`with`/`by` — would put one
     * transition inside another and let the inner commit be overwritten by the outer. That is
     * refused rather than allowed to happen quietly: the machine holds a lock for the length of
     * the call and a re-entrant `dispatch` throws `DispatchInsideHandlerError`. To send an event
     * *because* of this one, defer it with `queueMicrotask` and it lands after this call returns.
     *
     * `can` is not affected — it asks the guards a question and moves nothing, so it stays
     * answerable from inside a handler.
     */
    dispatch(...args) {
        const [type, payload] = args;
        if (__classPrivateFieldGet(this, _StateMachine_dispatching, "f"))
            throw new DispatchInsideHandlerError();
        // The lock is held for the whole transition, not just the notifications, and released in a
        // `finally` so it cannot outlive the call. Both halves of that matter:
        //
        // Holding it over the operations closes the other way in. A `with` or `by` that dispatches
        // is the same fault as a listener that does — the inner transition commits, the outer one
        // overwrites it, and nothing anywhere says so. Guarding only the sends left that silent.
        //
        // Releasing it in `finally` is what keeps one bad listener from being fatal. A listener
        // that throws is ordinary; if the flag were cleared on the normal path only, it would stay
        // raised and every later `dispatch` on this machine would throw
        // `DispatchInsideHandlerError` forever — a live machine bricked by an unrelated bug.
        __classPrivateFieldSet(this, _StateMachine_dispatching, true, "f");
        try {
            const rule = __classPrivateFieldGet(this, _StateMachine_instances, "m", _StateMachine_rule).call(this, type, payload);
            if (rule === undefined)
                return false;
            const source = this.state;
            // On a rule loaded back from `toJSON`, `with`/`by` are names rather than code. Each then
            // reads as its own neutral element — `id` for `with`, "no payload" for `by` — the same
            // way a named `when` reads as ⊤.
            const carry = opIn(rule.to);
            const reached = freeze(typeof carry === "function"
                ? carry(__classPrivateFieldGet(this, _StateMachine_context, "f"), payload)
                : __classPrivateFieldGet(this, _StateMachine_context, "f"));
            const letter = nameIn(rule.emit);
            const pack = opIn(rule.emit);
            const output = letter === undefined
                ? undefined
                : {
                    type: letter,
                    ...(typeof pack === "function" && {
                        payload: pack(reached, payload),
                    }),
                };
            __classPrivateFieldSet(this, _StateMachine_type, nameIn(rule.to), "f");
            __classPrivateFieldSet(this, _StateMachine_context, reached, "f");
            const target = this.state;
            const tx = __classPrivateFieldGet(this, _StateMachine_channel, "f")?.tx;
            if (tx && output) {
                // The channel is keyed by event type and takes the payload as an argument, so the event
                // is taken apart again here — one shape for a value, another for a call.
                const { type: λ, payload: emitted } = output;
                tx.send(λ, emitted);
            }
            if (tx?.has(TRANSITION))
                tx.send(TRANSITION, {
                    input: {
                        type,
                        ...(payload !== undefined && { payload }),
                    },
                    source,
                    target,
                    output,
                    at: Date.now(),
                });
            return true;
        }
        finally {
            __classPrivateFieldSet(this, _StateMachine_dispatching, false, "f");
        }
    }
    /**
     * Move to a state directly (persistence, time travel). Sends nothing.
     *
     * Takes a `State`, the same one value the constructor does — there is no partial
     * restore, because half a state is not a state the machine could have been in, and with a
     * per-state context a loose pair could name one state and hand it another's context.
     */
    restore(start) {
        __classPrivateFieldSet(this, _StateMachine_type, start.type, "f");
        __classPrivateFieldSet(this, _StateMachine_context, start.context, "f");
    }
    /** The `JSON.stringify` hook: a machine serializes as its `graph`. */
    toJSON() {
        return graph(this.schema);
    }
}
_StateMachine_type = new WeakMap(), _StateMachine_context = new WeakMap(), _StateMachine_channel = new WeakMap(), _StateMachine_dispatching = new WeakMap(), _StateMachine_instances = new WeakSet(), _StateMachine_rule = function _StateMachine_rule(type, payload) {
    const cell = this.schema[__classPrivateFieldGet(this, _StateMachine_type, "f")]?.[type];
    if (cell === undefined)
        return; // no cell here
    for (const rule of cell) {
        // A `when` that is not a function is a guard whose code this copy of the machine does
        // not carry — a name off a dumped schema. It reads as ⊤, which is what keeps such a
        // schema runnable.
        if (typeof rule.when === "function" &&
            !rule.when(__classPrivateFieldGet(this, _StateMachine_context, "f"), payload))
            continue;
        return rule;
    }
    return; // every guard rejected
};
