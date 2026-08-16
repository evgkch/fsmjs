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
 * Most, not all. What survives a dump is each operation's *name* — `when: 'short'`,
 * `with: 'collect'`, `by: 'refund'`, or `'?'` for one the author never named. A name is not the
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
export {};
// There is deliberately no `Accepts<T, q>` / `Reached<T, σ, q>` here any more — the pair that
// narrowed an event type to the current state's cell and the reached state to that cell's
// targets. They typed a chain of transitions the way a typestate does in Rust, and they only
// ever paid off where the event type was known at compile time. A machine exists because it is
// not: the event arrives from a handler and the state is wherever the machine got to. What is
// left is the honest run-time question, `can(type, payload?)`.
