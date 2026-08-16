/** Types for the debug module. */
import type { Rx } from "@evgkch/channeljs";
import type { Carrier, FsmState } from "../core/types.js";

/** What a recorder says about itself: it moved, and to where. */
export type Moved = { moved: [index: number] };

/** A time-travel view over a machine's states. */
export interface History<Q extends Carrier> {
  /**
   * Said whenever the recorder moves the machine — `undo`, `redo`, `jump`.
   *
   * `restore` is not a transition and publishes nothing, deliberately: walking a run back is
   * not a thing the machine did. But it *is* a thing that happened to it, and every reader
   * drawing that machine has to hear about it from somewhere. Without this they hear about it
   * from whoever called `jump`, which means a caller in another process has to restate the
   * whole machine to say one number, and a caller on the same page has to remember to redraw.
   */
  readonly rx: Rx<Moved>;
  /** Recorded states, oldest first (index 0 is the initial one). */
  readonly states: readonly FsmState<Q>[];
  /** Current position within `states`. */
  readonly index: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Step back one state. Returns false at the start. */
  undo(): boolean;
  /** Step forward one state. Returns false at the end. */
  redo(): boolean;
  /** Restore the state at `index`. Returns false if out of range. */
  jump(index: number): boolean;
  /** Detach from the machine (stop recording). */
  stop(): void;
}
