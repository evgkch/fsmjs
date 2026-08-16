import { describe, it, expect, jest } from "@jest/globals";
import { player } from "./core.spec.js";

describe("dispatch — the machine as a process", () => {
  it("moves, sends on the channel, and reports whether it fired", () => {
    const fsm = player();
    const started = jest.fn();
    fsm.rx.on("started", started);

    expect(fsm.dispatch("load")).toBe(true);
    expect(fsm.dispatch("loaded")).toBe(true);
    expect(fsm.dispatch("play")).toBe(true);
    expect(fsm.state.type).toBe("playing");
    expect(started).toHaveBeenCalledTimes(1);
  });

  it("hands the output payload to the subscriber", () => {
    const fsm = player();
    const finished = jest.fn();
    fsm.rx.on("finished", finished);

    fsm.dispatch("load");
    fsm.dispatch("loaded");
    fsm.dispatch("play");
    fsm.dispatch("tick", { dt: 4 });
    fsm.dispatch("end");

    expect(finished).toHaveBeenCalledWith({ at: 4 });
  });

  it("returns false and changes nothing when the event is not accepted", () => {
    const fsm = player();
    expect(fsm.dispatch("tick", { dt: 1 })).toBe(false);
    expect(fsm.state.type).toBe("idle");
    expect(fsm.state.context).toEqual({ t: 0 });
  });

  it("leaves everything alone when an event arrives at a state without a cell for it", () => {
    const fsm = player();
    fsm.dispatch("load"); // idle → loading
    expect(fsm.dispatch("play")).toBe(false); // no cell at 'loading'
    expect(fsm.state.type).toBe("loading");
  });

  it("restores a configuration without sending anything", () => {
    const fsm = player();
    const started = jest.fn();
    fsm.rx.on("started", started);
    fsm.restore({ type: "playing", context: { t: 12 } });
    expect(fsm.state.type).toBe("playing");
    expect(fsm.state.context).toEqual({ t: 12 });
    expect(started).not.toHaveBeenCalled();
  });

  it("runs with no channel at all until someone subscribes", () => {
    const fsm = player();
    expect(fsm.dispatch("load")).toBe(true); // nothing touched `rx`, nothing to send to
    expect(fsm.state.type).toBe("loading");
  });

  it("is the only thing that moves the machine — asking does not", () => {
    const fsm = player();
    const started = jest.fn();
    fsm.rx.on("started", started);
    expect(fsm.can("load")).toBe(true);
    expect(fsm.state.type).toBe("idle");
    expect(fsm.state.context).toEqual({ t: 0 });
    expect(started).not.toHaveBeenCalled();
  });
});
