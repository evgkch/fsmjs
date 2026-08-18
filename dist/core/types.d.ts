/**
 * Type primitives for the machine.
 *
 * A machine is **one** artifact: a schema of states, each mapping an event type to the rules it
 * accepts. A rule is five words, one column per fact:
 *
 *   | word   | kind     | what it says                                              |
 *   |--------|----------|-----------------------------------------------------------|
 *   | `to`   | label    | the target state                                          |
 *   | `with` | function | `(context, payload) => Q[to]` — the context arrived with   |
 *   | `emit` | label    | the output event type λ                                   |
 *   | `by`   | function | `(context, payload) => Λ[λ]` — that event's payload       |
 *   | `when` | function | `(context, payload) => boolean` — does this apply         |
 *
 * `to` is the only one always required — a rule with no target is not a rule. The other four are
 * decided by the two labels rather than by taste: `with` is required exactly where the target
 * state carries something the source does not, forbidden where it carries nothing; `by` is
 * required exactly where the emitted event carries data, forbidden where it does not. So "this
 * state needs a context and none was built", like "this event needs data and none was given", is
 * not a check but an impossibility.
 *
 * Labels are the graph; the three functions are the code. Forgetting the code is `toJSON` — a
 * total map onto `Graph`, which is what a diagram, a validator or a wire format needs, and
 * which reads back as a schema. Because every word is its own property, `JSON.stringify`
 * performs most of that forgetting on its own: a function held as a property simply does not
 * survive.
 *
 * Most, not all. What survives a dump is each operation's *name*, in the place the operation
 * stood — `when: 'short'`, `to: ['idle', 'collect']`, `emit: ['vend', 'refund']`, or `'?'` for one
 * the author never named. A name is not the
 * code and cannot be run; it says that an operation was here and what it was called, which is
 * exactly what a reader, a diagram and `validate` can use. Keeping the guard is the part that
 * is not optional: `when` decides *whether* a rule applies, so it belongs to the transition
 * relation, and the transition relation is what a graph is. Drop it and a dumped machine reads
 * as nondeterministic where it is merely conditional.
 *
 * Nothing else exists, and all three parameters are the same kind of thing: `Q`, `Σ` and `Λ`
 * are carriers. `Σ` is event type ↦ payload and `Λ` the same for the output; `Q` is state ↦ the
 * context that state carries. So the sets themselves are never a parameter — the alphabets are
 * `keyof Σ` and `keyof Λ`, and the state set is `keyof Q`, finite by construction in each case.
 * A single state is written `q`, an event type `σ`, exactly as in the formal notation, and
 * `Q[q]` is the context of state `q`.
 */
/**
 * A carrier: tag ↦ what that tag carries.
 *
 * All three parameters are carriers, which is why there is one type for them and not three.
 * `Σ` and `Λ` are event type ↦ payload — set them equal for a machine that can drive itself —
 * and `Q` is state ↦ context. A `void` value means the tag carries nothing at all.
 *
 * A carrier is not the set of tags: it is the indexed family of what they carry. The set is
 * `keyof` it — `keyof Σ` for the input alphabet, `keyof Q` for the states — finite by
 * construction, and an element of it is written `σ` or `q`. That is why a carrier and its key
 * set are never the same thing in a signature here.
 */
export type Carrier = Record<PropertyKey, unknown>;
/**
 * One entry of a carrier, written on its own: `IState<'ready', Ctx>` is `{ ready: Ctx }`.
 *
 * Several tags may share one shape — `IState<'idle' | 'off', Ctx>` — and the default `void`
 * means the tag carries nothing at all. Combine entries with `Merge`:
 *
 * ```ts
 * type Q = Merge<
 *   | IState<'empty'>                                  // carries nothing
 *   | IState<'ready',    { rect: Rect }>
 *   | IState<'dragging', { rect: Rect; from: Point }>
 * >;
 * // { empty: void; ready: { rect: Rect }; dragging: { rect: Rect; from: Point } }
 * ```
 *
 * The helper builds nothing new — a carrier is a plain map, and you may always write the map
 * out by hand. What it buys is one tag and its shape on one line, which is how a state or an
 * event is actually thought about.
 */
export type IState<Q extends PropertyKey, D = void> = {
    [q in Q]: D;
};
/** One entry of an input or output carrier. The same helper, named for the other axis. */
export type IEvent<T extends PropertyKey, D = void> = {
    [t in T]: D;
};
/**
 * Flatten a union of one-entry carriers into a single carrier.
 *
 * `IState<'a', X> | IState<'b', Y>` is a *union of two maps*, which is not a map: writing it
 * as a carrier requires taking every key of every member and looking the value up in whichever
 * member has it. That is what this does, and it is why the union spelling reads as if it were
 * an intersection.
 */
export type Merge<U> = {
    [k in U extends unknown ? keyof U : never]: U extends Record<k, infer D> ? D : never;
};
/**
 * A state: its type, and what it carries — the two together, because the context belongs to
 * the state and cannot be recovered from a type name alone.
 *
 * A discriminated union rather than a pair of loose fields, so `type` narrows `context`: after
 * `if (s.type === 'dragging')` the fields of *that* state are in scope and no others.
 *
 * The name of the state lives in `type` because that is what it is — which of the states this
 * one is. `machine.state` names the whole value, the thing the machine is in; `state.type` names
 * which one. The word "state" therefore keeps meaning what it always did, and nothing has to be
 * called a snapshot.
 */
export type FsmState<Q extends Carrier> = {
    [q in keyof Q]: {
        readonly type: q;
        readonly context: Readonly<Q[q]>;
    };
}[keyof Q];
/**
 * An event: which type it is, and what rides with it — `{ type: 'tick', payload: { dt: 1 } }`,
 * or `{ type: 'play' }` when it carries nothing.
 *
 * The same shape as `FsmState`, and deliberately: a state is `type` plus what it carries, an
 * event is `type` plus what it carries. One idea, two axes, so the vocabulary transfers.
 *
 * Internally tagged, but with the data under its own key rather than spread. That is what makes
 * it safe: the objection to `{ type: 'tick', dt: 1 }` was that `type` occupies a name in the
 * payload's namespace, and here it cannot — `payload` is one field beside it, and an event's
 * data may itself have a `type` of its own without colliding.
 *
 * `payload` is *absent*, not `undefined`, on an event that carries nothing: the optional
 * `payload?: undefined` says exactly that and refuses a value someone tried to attach anyway.
 */
export type FsmEvent<M extends Carrier> = {
    [σ in keyof M]: void extends M[σ] ? {
        readonly type: σ;
        readonly payload?: undefined;
    } : {
        readonly type: σ;
        readonly payload: M[σ];
    };
}[keyof M];
/** `when` — names the subset of states this rule applies to. */
export type When<C, X> = (context: Readonly<C>, payload: X) => boolean;
/**
 * `with` — the context of the state being entered, built from the one being left.
 *
 * Two context types, not one: `From` is the source state's, `To` the target's. That is what
 * ties `with` to `to` — the target chosen by `to` decides what `with` has to return, so
 * arriving somewhere with the wrong shape is not a mistake to catch but one you cannot write.
 */
export type With<From, To, X> = (context: Readonly<From>, payload: X) => To;
/** `by` — the emitted payload, built from the context *after* the move. */
export type By<C, X, Y> = (context: Readonly<C>, payload: X) => Y;
/**
 * Where a rule leads: the state, and — where the state carries something — how to build it.
 *
 * One slot and not two. `with` builds the context of the state `to` names, so the two are one
 * fact about the rule, and writing them as siblings left that fact in the documentation: a
 * reader had to be told that `with` belongs to `to` and `by` belongs to `emit`, and a dump wrote
 * four keys where there are two things.
 *
 * Required, optional or forbidden, decided by the two contexts and nothing else:
 *
 *   forbidden  the target carries nothing, so there is nothing to build — a bare name
 *   optional   the source context already *is* a target context — carrying it over is legal
 *   required   the shapes differ, so arriving at all means constructing the difference
 *
 * The third case is the one that pays: it is impossible to enter a state without giving it
 * what it carries. No `blank` to invent, no zero-valued rectangle standing in for the absence
 * of one. That guarantee is the same as it was — what changed is where it is written.
 */
type ToSlot<Q extends Carrier, q extends keyof Q, r extends keyof Q, X> = void extends Q[r] ? {
    readonly to: r;
} : [Readonly<Q[q]>] extends [Q[r]] ? {
    readonly to: r | readonly [r, With<Q[q], Q[r], X> | string];
} : {
    readonly to: readonly [r, With<Q[q], Q[r], X> | string];
};
/**
 * One rule: where it leads, and what it computes on the way.
 *
 * A distributed conditional over `keyof Q`, so the rule's shape follows the target it names:
 * `to` picks a state, and that state decides what `with` must return. The same trick, one axis
 * over, gives `emit`/`by`: no `by` without an `emit` to attach it to, none on an event that
 * carries nothing, and one that is mandatory — returning exactly `Λ[λ]` — on an event that does.
 *
 * A *name* is admitted wherever a function is, since that is what `toJSON` leaves behind: it
 * reads as the neutral element at run time, so a dumped schema still runs.
 */
export type Rule<Q extends Carrier, q extends keyof Q, X, Λ extends Carrier> = {
    [r in keyof Q]: {
        /**
         * The guard, or its name — which is what `toJSON` leaves behind. You never write a
         * string here: it means "guarded by something this copy of the machine does not carry",
         * and at run time it reads as ⊤, so a dumped schema still runs — as the total machine it
         * now is.
         */
        readonly when?: When<Q[q], X> | string;
    } & ToSlot<Q, q, r, X> & ({
        readonly emit?: never;
    } | {
        [λ in keyof Λ]: void extends Λ[λ] ? {
            readonly emit: λ;
        } : {
            readonly emit: readonly [λ, By<Q[r], X, Λ[λ]> | string];
        };
    }[keyof Λ]);
}[keyof Q];
/**
 * The machine: state → event type → rules.
 *
 * Indexed by state first, the way a machine is drawn and read: one entry is one state and
 * everything it accepts. The event type stays the inner key, so a rule at one coordinate knows
 * both exactly — its source context is `Q[q]`, its payload `Σ[σ]`.
 *
 * The rules at one (state, event) are called a *cell* in the docs and in `validate`'s messages,
 * but there is no `Cell` type: it would alias `readonly Rule<…>[]` and nothing more. The list is
 * always a list, even of one — the single-rule shorthand used to save a pair of brackets and cost
 * every consumer a branch, plus one runtime error class of its own.
 *
 * Two rules may share a target: each carries its own guard and its own operations, so
 * `[{ when: p, to: ['x', a] }, { when: q, to: ['x', b] }]` is two distinct rules, not
 * a collision. Nothing addresses a rule by anything but its position in the list — which is
 * what the previous two-artifact form got wrong, having keyed the code by target.
 */
export type Schema<Q extends Carrier, Σ extends Carrier, Λ extends Carrier> = {
    readonly [q in keyof Q]?: {
        readonly [σ in keyof Σ]?: readonly Rule<Q, q, Σ[σ], Λ>[];
    };
};
/**
 * The graph alone: the labels, and each operation turned into a name.
 *
 * Literally `Schema` with the three functions replaced by strings. `JSON.stringify` already
 * drops function-valued properties unaided; what this buys is a name in their place — `?` for
 * one the author never gave — so a diagram or a rule line can still say "guarded by `short`"
 * rather than just "guarded".
 *
 * A pair stays a pair: `["ready", "grab"]`, the name standing where the function stood. The shape
 * a schema has in code is the shape it has in JSON, which is the whole point of calling this a
 * projection — and it settles one thing by saying it out loud: `emit` names one letter and never a
 * list of them, because in a dump `["moved", "pack"]` would otherwise be readable two ways.
 *
 * A `Graph` still constructs and runs, because a name is admitted wherever a function is. What
 * it no longer computes is the difference: a named `with` carries the context over unchanged and
 * a named `by` attaches no payload, so a dumped machine walks its graph and remembers nothing
 * new. Rendering and analysis take either form all the same; they read labels and names, never
 * code.
 */
export type Graph<Q extends Carrier, Σ extends Carrier, Λ extends Carrier> = {
    readonly [q in keyof Q]?: {
        readonly [σ in keyof Σ]?: readonly {
            readonly to: keyof Q | readonly [keyof Q, string];
            readonly emit?: keyof Λ | readonly [keyof Λ, string];
            readonly when?: string;
        }[];
    };
};
/**
 * One row of the transition relation — a cell flattened into a standalone edge.
 *
 * A `Rule` lives in the fibre over one (state, event); an `Edge` is that same rule as an
 * element of ⊆ keyof Q × keyof Σ × (keyof Λ ∪ {ε}) × keyof Q, which is what a graph walk, a
 * diagram and a report all want. Flattening adds the two coordinates and changes nothing else:
 * the words are already one column per fact, so a row *is* the rule it came from with `from`
 * and `on` in front.
 *
 * `from`, `on`, `to` are the keywords `toRules` prints, and deliberately so — one
 * vocabulary for the row, the dump and the diagram.
 *
 * The operations ride along as the functions themselves where the schema still carries code,
 * and as their names (or `?`) where it came off a dump — `nameOf` (in `fsmjs/core`) is what
 * turns either into a string worth printing. A reader who only asks "is this edge guarded"
 * tests `when` for presence, and gets the same answer whichever form it is in.
 */
export type Edge<N extends PropertyKey = PropertyKey> = {
    readonly from: N;
    readonly on: PropertyKey;
    readonly to: N;
    readonly emit?: PropertyKey;
    readonly when?: Function | string;
    readonly with?: Function | string;
    readonly by?: Function | string;
};
/**
 * Every state a rule of this cell can lead to.
 *
 * A target is a name or a name with its carrier beside it, so this looks through the pair: the
 * first element of the tuple is the state, exactly as the bare form is.
 */
export type EdgeNodes<C> = C extends readonly (infer E)[] ? E extends {
    to: infer R;
} ? R extends readonly [infer N, unknown] ? N : R : never : never;
/**
 * Q — every state a schema names, as a key or as some rule's target.
 *
 * Intersected with `PropertyKey` to drop the `undefined` that an optional cell leaks in: `T[q]`
 * is `… | undefined`, and reading `keyof` through it lets that `undefined` into the node set,
 * where it is not a state and no graph walk should meet it.
 */
export type Nodes<T> = (keyof T | {
    [q in keyof T]: {
        [σ in keyof T[q]]: EdgeNodes<T[q][σ]>;
    }[keyof T[q]];
}[keyof T]) & PropertyKey;
export {};
