import { describe, it, expect } from "@jest/globals";
import { StateMachine, DispatchInsideHandlerError } from "../src/core/index.js";
import type { IEvent, IState, Merge } from "../src/core/index.js";
import { history } from "../src/debug/index.js";

// Synchronous dispatch inside an event handler is now forbidden.
// The tests verify that it throws and that queueMicrotask keeps things ordered.

type Node = "a" | "b" | "c";
const chain = () =>
  new StateMachine<
    IState<Node>,
    Merge<IEvent<"go"> | IEvent<"next">>,
    IEvent<"out">
  >(
    {
      a: { go: [{ to: "b", emit: "out" }] },
      b: { next: [{ to: "c" }] },
    },
    { type: "a", context: undefined },
  );

describe("a dispatch from a listener", () => {
  it("throws DispatchInsideHandlerError when called synchronously inside a listener", () => {
    const fsm = chain();
    fsm.rx.on("out", () => fsm.dispatch("next"));

    expect(() => fsm.dispatch("go")).toThrow(DispatchInsideHandlerError);
  });

  it("is safe when deferred with queueMicrotask", async () => {
    const fsm = chain();
    const past = history(fsm);
    fsm.rx.on("out", () => queueMicrotask(() => fsm.dispatch("next")));

    expect(fsm.dispatch("go")).toBe(true);
    expect(fsm.state.type).toBe("b"); // the deferred move has not happened yet
    await Promise.resolve();
    expect(fsm.state.type).toBe("c");
    expect(past.states.map((s) => s.type)).toEqual(["a", "b", "c"]);
  });

  it("releases the lock when a listener throws — one bad listener is not fatal", () => {
    const fsm = chain();
    const off = fsm.rx.on("out", () => {
      throw new Error("listener blew up");
    });

    expect(() => fsm.dispatch("go")).toThrow("listener blew up");
    off();

    // Without the `finally` the flag would still be raised here and this would throw
    // `DispatchInsideHandlerError` — a live machine bricked by an unrelated bug.
    expect(fsm.state.type).toBe("b");
    expect(fsm.dispatch("next")).toBe(true);
    expect(fsm.state.type).toBe("c");
  });
});

describe("a dispatch from an operation of the rule itself", () => {
  type Node = "a" | "b" | "c";
  type Ctx = { n: number };
  type Σ = Merge<IEvent<"go"> | IEvent<"other">>;
  type Λ = IEvent<"out", Ctx>;

  /** The lock covers the whole transition, so `with` is as much inside it as a listener is. */
  const nesting = (slot: "when" | "with" | "by") => {
    const fsm: StateMachine<IState<Node, Ctx>, Σ, Λ> = new StateMachine<
      IState<Node, Ctx>,
      Σ,
      Λ
    >(
      {
        a: {
          go: [
            {
              when:
                slot === "when"
                  ? () => (fsm.dispatch("other"), true)
                  : undefined,
              to:
                slot === "with"
                  ? ([
                      "b",
                      (c) => (fsm.dispatch("other"), { n: c.n + 1 }),
                    ] as const)
                  : "b",
              emit: [
                "out",
                slot === "by" ? (c) => (fsm.dispatch("other"), c) : (c) => c,
              ] as const,
            },
          ],
          other: [{ to: "c" }],
        },
      },
      { type: "a", context: { n: 0 } },
    );
    return fsm;
  };

  it.each(["when", "with", "by"] as const)(
    "refuses a nested dispatch from `%s` rather than losing the inner move",
    (slot) => {
      const fsm = nesting(slot);
      expect(() => fsm.dispatch("go")).toThrow(DispatchInsideHandlerError);
      // The inner transition to 'c' must not have been committed and then overwritten.
      expect(fsm.state.type).toBe("a");
      expect(fsm.state.context).toEqual({ n: 0 });
    },
  );

  it("still answers `can` from inside a handler — a question moves nothing", () => {
    const fsm = chain();
    let answer: boolean | undefined;
    fsm.rx.on("out", () => {
      answer = fsm.can("next");
    });
    fsm.dispatch("go");
    expect(answer).toBe(true);
  });
});
