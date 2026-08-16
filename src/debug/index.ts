/**
 * Debug layer (opt-in via `fsmjs/debug`).
 *
 * Runtime observation built on the machine's reserved `Transition`, sent after every *fired*
 * dispatch (silent or observable): logging, runtime invariants and time-travel history.
 * Subscribing is what turns observation on — the machine builds the value only while
 * `TRANSITION` has a listener — so an unobserved machine pays nothing, and detaching every
 * helper turns it back off. A dispatch that fires nothing sends nothing, so nothing here sees it.
 *
 * Three exports, one per question: `log` — what is happening; `invariant` — has a property of the
 * context broken; `history` — how to go back. Anything else a caller wants from a transition is
 * a conditional in `log`'s sink, which receives the whole value and nothing else.
 *
 * Formatting is not one of the questions and so is not folded into any of them: `rules` wraps a
 * sink into one that is handed lines, and `log` takes any sink at all. A subscription that decided
 * the shape of what it hands over would leave a sink that wants the payloads parsing text back out
 * — so the rendering is an argument, and the default is only the argument a caller did not pass.
 *
 * Everything here watches transitions that *happened*. `can` is not one: it asks the guards a
 * question and answers the caller, so nothing observable took place and nothing appears here.
 */
import Channel from "@evgkch/channeljs";
import { TRANSITION } from "../core/index.js";
import type { Off, StateMachine, Transition } from "../core/index.js";
import type { Carrier, Edge, FsmState } from "../core/types.js";
import { LABELS, writer } from "../formatters/words.js";
import type { History, Moved } from "./types.js";

export type { History } from "./types.js";

/**
 * A transition read as a row of the transition relation — internal.
 *
 * Nothing is invented here: a transition already carries all four labels — where it came from,
 * on what event, where it went, what it emitted. Turning it into an `Edge` is renaming, and it
 * is what lets the same word writer print the schema and the run. Not exported: a formatter
 * takes a schema, so an `Edge` on its own has nowhere to go.
 */
function asEdge<Q extends Carrier, Σ extends Carrier, Λ extends Carrier>(
  t: Transition<Q, Σ, Λ>,
): Edge<keyof Q & string> {
  return {
    from: t.source.type as keyof Q & string,
    on: t.input.type as string,
    to: t.target.type as keyof Q & string,
    ...(t.output && { emit: t.output.type as string }),
  };
}

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
export function log<Q extends Carrier, Σ extends Carrier, Λ extends Carrier>(
  fsm: StateMachine<Q, Σ, Λ>,
  sink: (transition: Transition<Q, Σ, Λ>) => void = rules(),
): Off {
  return fsm.rx.on(TRANSITION, sink);
}

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
export function rules<Q extends Carrier, Σ extends Carrier, Λ extends Carrier>(
  sink: (line: string, transition: Transition<Q, Σ, Λ>) => void = console.log,
): (transition: Transition<Q, Σ, Λ>) => void {
  return (t) => sink(formatTransition(t), t);
}

/**
 * One transition as a rule — internal.
 *
 * The columns are sized by the row itself, so a line stands alone: it names its own transition and
 * nothing lines it up against the rest of the machine. Not exported — the two places a line is
 * wanted are `rules` and the message `invariant` hands its `onViolation`, and both are here.
 */
function formatTransition<
  Q extends Carrier,
  Σ extends Carrier,
  Λ extends Carrier,
>(t: Transition<Q, Σ, Λ>): string {
  const row = asEdge(t);
  return writer([row], LABELS)(row);
}

/**
 * Assert a property of the context after every fired transition. Returns an unsubscribe handle.
 * On violation calls `onViolation` if given, otherwise throws.
 *
 * `onViolation` gets the offending transition and the same line the default message would have
 * carried, so a custom handler reports it the way the library does without formatting anything
 * itself.
 */
export function invariant<
  Q extends Carrier,
  Σ extends Carrier,
  Λ extends Carrier,
>(
  fsm: StateMachine<Q, Σ, Λ>,
  check: (
    context: Readonly<Q[keyof Q]>,
    transition: Transition<Q, Σ, Λ>,
  ) => boolean,
  onViolation?: (transition: Transition<Q, Σ, Λ>, line: string) => void,
): Off {
  return fsm.rx.on(TRANSITION, (t) => {
    if (check(t.target.context, t)) return;
    const line = formatTransition(t);
    if (onViolation) onViolation(t, line);
    else throw new Error(`fsm invariant violated: ${line}`);
  });
}

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
export function history<
  Q extends Carrier,
  Σ extends Carrier,
  Λ extends Carrier,
>(fsm: StateMachine<Q, Σ, Λ>, opts?: { maxSize?: number }): History<Q> {
  const maxSize =
    opts?.maxSize !== undefined ? Math.max(1, opts.maxSize) : undefined;
  const states: FsmState<Q>[] = [fsm.state];
  const said = new Channel<Moved>();
  let index = 0;

  // `restore` does not dispatch, so it never sends a `Transition` and never re-enters this.
  const off = fsm.rx.on(TRANSITION, (t) => {
    states.length = index + 1; // drop any redo future
    states.push(t.target);
    index = states.length - 1;
    if (maxSize !== undefined && states.length > maxSize) {
      const excess = states.length - maxSize;
      states.splice(0, excess); // drop oldest to keep the buffer bounded
      index -= excess;
    }
  });

  const go = (i: number): boolean => {
    if (i < 0 || i >= states.length) return false;
    index = i;
    fsm.restore(states[i]);
    said.tx.send("moved", i);
    return true;
  };

  return {
    rx: said.rx,
    get states() {
      return states;
    },
    get index() {
      return index;
    },
    get canUndo() {
      return index > 0;
    },
    get canRedo() {
      return index < states.length - 1;
    },
    undo: () => go(index - 1),
    redo: () => go(index + 1),
    jump: go,
    stop: () => {
      off();
      said.clear();
    },
  };
}
