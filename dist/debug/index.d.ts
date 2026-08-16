import type { Off, StateMachine, Transition } from "../core/index.js";
import type { Carrier } from "../core/types.js";
import type { History } from "./types.js";
export type { History } from "./types.js";
/**
 * Subscribe to a machine's transitions. Returns an unsubscribe handle.
 *
 * The `sink` gets the whole `Transition` and nothing else, which makes this the one subscription
 * the debug layer needs: print it, filter it, count it, ship it somewhere. Reacting to every output
 * whatever its type — the one thing `rx` cannot say, since `rx.on` wants one type — is a
 * conditional in the sink:
 *
 * ```ts
 * log(fsm, t => { if (t.output) send(t.output); });
 * ```
 *
 * A formatted log is a sink wrapped in a formatter, not a mode of the subscription:
 *
 * ```ts
 * log(fsm, rules(line => file.write(line + '\n')));
 * ```
 *
 * The default sink is `rules()`, which is why `log(fsm)` still prints a line per transition —
 * but the formatting lives in an argument a caller can drop, replace or wrap.
 */
export declare function log<Q extends Carrier, Σ extends Carrier, Λ extends Carrier>(fsm: StateMachine<Q, Σ, Λ>, sink?: (transition: Transition<Q, Σ, Λ>) => void): Off;
/**
 * Wrap a sink so it is handed each transition already written as one line — a `log` sink.
 *
 * The line is a sentence in the same language `toRules` prints the schema in, four of its seven
 * words: the ones a transition can fill on its own. That is the whole reason this takes nothing
 * but the sink — a transition already carries every label the line says, so a formatter of one
 * needs no machine, no schema and no state, and the same wrapper works on any of them.
 *
 * The wrapped sink still gets the whole transition beside the line, so formatting costs nothing:
 * a sink that wants the payloads reads them off the value instead of parsing them back out of text.
 * With no sink of its own it prints, which makes `rules()` what plain `log(fsm)` runs.
 */
export declare function rules<Q extends Carrier, Σ extends Carrier, Λ extends Carrier>(sink?: (line: string, transition: Transition<Q, Σ, Λ>) => void): (transition: Transition<Q, Σ, Λ>) => void;
/**
 * Assert a property of the context after every fired transition. Returns an unsubscribe handle.
 * On violation calls `onViolation` if given, otherwise throws.
 *
 * `onViolation` gets the offending transition and the same line the default message would have
 * carried, so a custom handler reports it the way the library does without formatting anything
 * itself.
 */
export declare function invariant<Q extends Carrier, Σ extends Carrier, Λ extends Carrier>(fsm: StateMachine<Q, Σ, Λ>, check: (context: Readonly<Q[keyof Q]>, transition: Transition<Q, Σ, Λ>) => boolean, onViolation?: (transition: Transition<Q, Σ, Λ>, line: string) => void): Off;
/**
 * Record a machine's states for undo/redo/jump.
 *
 * Records the state after every fired transition. Navigation replays nothing — a
 * `Transition` already carries its target, so recording is a push and restoring is one
 * `fsm.restore`, both O(1). Dispatching after an undo truncates the redo future, as usual.
 * Pass `{ maxSize }` (≥ 1) to cap the buffer: once full it drops the oldest entry, so a
 * long-running machine does not grow without bound (undo then reaches back only `maxSize`
 * transitions).
 *
 * Moving says so on `rx`. `restore` publishes nothing — walking a run back is not a thing the
 * machine did — so without a word from here, everything drawing that machine would learn where it
 * went from whoever called `jump`, one caller at a time.
 */
export declare function history<Q extends Carrier, Σ extends Carrier, Λ extends Carrier>(fsm: StateMachine<Q, Σ, Λ>, opts?: {
    maxSize?: number;
}): History<Q>;
