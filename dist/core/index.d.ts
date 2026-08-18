import type { Carrier, IState, Edge, Graph, FsmEvent, Nodes, Schema, FsmState } from "./types.js";
export type { Schema, Graph, FsmState, FsmEvent, Carrier, Nodes, Edge, Rule, When, With, By, IState, IEvent, Merge, } from "./types.js";
/**
 * One rule as the kernel reads it — the precise `Rule<…>` lives at the edges.
 *
 * Untyped in the contexts on purpose: `Rule` ties each operation to the state it belongs to,
 * and the kernel walks a schema whose states it cannot name. The narrowing happened where the
 * schema was written; here every context is just a value being passed along.
 */
/** An operation as it may be found: code where the schema still has any, a name off a dump. */
type Op = ((context: never, payload: never) => unknown) | string;
/** A target or a letter: the name alone, or the name with what fills it. */
type Slot = PropertyKey | readonly [PropertyKey, Op | null];
export declare const nameIn: (slot: Slot | undefined) => PropertyKey | undefined;
export declare const opIn: (slot: Slot | undefined) => Op | undefined;
/**
 * Flatten a schema into the transition relation — one `Edge` per rule, in schema order.
 *
 * A row is the rule itself with its two coordinates in front: the words are already one
 * column per fact, so nothing is taken apart here. Operations ride along as themselves; a row
 * off a JSON-loaded schema has none.
 */
export declare function edges<T>(schema: T): Edge<Nodes<T>>[];
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
export declare function nodes<T>(schema: T): Nodes<T>[];
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
export declare function nameOf(operation: Function | string | null | undefined, slot: string): string | undefined;
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
export declare function graph<T, Σ extends Carrier = Carrier, Λ extends Carrier = Carrier>(schema: T): Graph<IState<Nodes<T>, unknown>, Σ, Λ>;
/**
 * The one type behind the two calls — `dispatch` and `can` — as a variadic tuple union:
 * `[type]` for an event that carries nothing, `[type, payload]` for one that does.
 *
 * One signature rather than the two overloads that used to split the alphabet by whether an
 * event carries a payload. The correlation is the same — a payload is impossible where there is
 * nothing to attach and mandatory where there is — but as a single tuple the editor offers every
 * event name in one list, and a wrong name is reported against the concrete union of keys rather
 * than an alias.
 *
 * Distributive on purpose: `keyof M` over a `Merge<…>` carrier does not reduce to a literal union
 * on its own, so a mapped type over it stays symbolic. Distributing `K extends keyof M` folds each
 * key separately, and the union comes out in literal shapes — `["coin"] | ["tick", { dt }]`.
 */
type Args<M extends Carrier> = keyof M extends infer K ? K extends keyof M ? void extends M[K] ? [type: K] : [type: K, payload: M[K]] : never : never;
/** The reserved channel key a `Transition` rides on. */
export declare const TRANSITION: unique symbol;
/**
 * A transition that happened — what a machine says about itself after every *fired* dispatch.
 *
 * Four of these fields are the step materialized — `FsmState<Q> × Msg(Σ) ⇀ FsmState<Q> × Msg(Λ)`:
 * the input event and the source state going in, the reached state and an optional output event
 * coming out. A state in full at both ends, since a type name alone would not carry a context.
 *
 * The fifth is when. It is no part of the relation — δ says nothing about clocks — but it is part
 * of what happened, and every reader that keeps a run keeps it: a log without times is a list, and
 * the gap between two steps is the difference between a machine that is working and one that is
 * stuck. Stamped here rather than by whoever is listening, because a listener may be a window in
 * another process, and its clock would date the run by when the network mentioned it.
 */
export interface Transition<Q extends Carrier, Σ extends Carrier, Λ extends Carrier> {
    readonly input: FsmEvent<Σ>;
    readonly source: FsmState<Q>;
    readonly target: FsmState<Q>;
    readonly output?: FsmEvent<Λ>;
    /** When it fired — `Date.now()`, taken in the process the machine is running in. */
    readonly at: number;
}
/**
 * A transition that happened, in the four names it is made of and the time it happened at.
 *
 * `Transition<Carrier, Carrier, Carrier>` is not the loose form it looks like: `Carrier` binds
 * every payload to `unknown`, and the mapped `FsmEvent` reads that as "carries nothing", so the
 * erased transition is one that specifically has no payloads. This says what it means to say —
 * these fields, these names, nothing about what rides with them.
 */
export type AnyTransition = {
    readonly input: {
        readonly type: PropertyKey;
    };
    readonly source: {
        readonly type: PropertyKey;
    };
    readonly target: {
        readonly type: PropertyKey;
    };
    readonly output?: {
        readonly type: PropertyKey;
    };
    readonly at: number;
};
/**
 * Any machine at all, as a reader of one needs it.
 *
 * `StateMachine<Q, Σ, Λ>` is invariant in all three parameters, so the erased shape — no context,
 * no payload — is the one shape a real application's machine never is. Anything written *about*
 * machines rather than *for* one had to ask for that shape and send its caller looking for a cast:
 * a logger, a recorder, a debugger, a page drawing what is happening.
 *
 * So this asks for what such a reader actually touches — the name of the state it is in, the
 * channel it says its transitions on, and the two calls that move it — and a concrete machine
 * satisfies it without being told to.
 */
export type AnyMachine = {
    readonly state: {
        readonly type: PropertyKey;
    };
    readonly rx: {
        on(msg: typeof TRANSITION, hear: (t: AnyTransition) => void): Off;
    };
    can(type: PropertyKey, payload?: unknown): boolean;
    dispatch(type: PropertyKey, payload?: unknown): boolean;
    toJSON(): unknown;
};
/**
 * The channel's message map — every output event type keyed by itself, plus the reserved
 * `TRANSITION` key.
 *
 * One mapped type rather than an intersection of two: with a generic `Λ`, TS cannot prove
 * `Λ` has no `TRANSITION`-typed member, so an intersection leaks a phantom member into
 * every listener.
 */
type Messages<Q extends Carrier, Σ extends Carrier, Λ extends Carrier> = {
    [λ in keyof Λ | typeof TRANSITION]: λ extends typeof TRANSITION ? [transition: Transition<Q, Σ, Λ>] : [payload: Λ[λ & keyof Λ]];
};
/** Unsubscribe handle. Returns true if the listener was removed. */
export type Off = () => boolean;
/**
 * Thrown when `dispatch` is re-entered: called synchronously from inside a transition already
 * in progress, whether from a listener or from a `when`/`with`/`by` of the rule itself. Defer
 * it with `queueMicrotask` to send the event after the current transition has finished.
 */
export declare class DispatchInsideHandlerError extends Error {
    constructor();
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
export declare class StateMachine<Q extends Carrier, Σ extends Carrier, Λ extends Carrier = Σ> {
    #private;
    readonly schema: Schema<Q, Σ, Λ>;
    constructor(schema: Schema<Q, Σ, Λ>, start: FsmState<Q>);
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
    get state(): FsmState<Q>;
    /** The output bus. Built on first use, so a machine nobody listens to pays nothing. */
    get rx(): import("@evgkch/channeljs").Rx<Messages<Q, Σ, Λ>>;
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
    can(...args: Args<Σ>): boolean;
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
    dispatch(...args: Args<Σ>): boolean;
    /**
     * Move to a state directly (persistence, time travel). Sends nothing.
     *
     * Takes a `State`, the same one value the constructor does — there is no partial
     * restore, because half a state is not a state the machine could have been in, and with a
     * per-state context a loose pair could name one state and hand it another's context.
     */
    restore(start: FsmState<Q>): void;
    /** The `JSON.stringify` hook: a machine serializes as its `graph`. */
    toJSON(): Graph<Q, Σ, Λ>;
}
