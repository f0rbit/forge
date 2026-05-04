import { describe, expect, test } from "bun:test";
import { component, debug, vec2, world, type Id } from "../src/index.ts";

describe("debug — frame buffer", () => {
	test("line/circle/rect/text push to buffer; frame() drains", () => {
		const d = debug();
		d.line(vec2(0, 0), vec2(10, 10), "red");
		d.circle(vec2(5, 5), 3, "blue");
		d.rect(0, 0, 4, 4, "green");
		d.text(vec2(1, 1), "hello", "white");
		const cmds = d.frame();
		expect(cmds.length).toBe(4);
		expect(cmds[0]?.kind).toBe("line");
		expect(cmds[1]?.kind).toBe("circle");
		expect(cmds[2]?.kind).toBe("rect");
		expect(cmds[3]?.kind).toBe("text");
		expect(d.frame().length).toBe(0);
	});

	test("default colour fills in", () => {
		const d = debug();
		d.line(vec2(0, 0), vec2(1, 0));
		const [cmd] = d.frame();
		expect(cmd?.kind).toBe("line");
		if (cmd?.kind === "line") expect(cmd.color).toBeDefined();
	});

	test("disabled debug no-ops every shape call", () => {
		const d = debug({ enabled: false });
		d.line(vec2(0, 0), vec2(1, 1));
		d.circle(vec2(0, 0), 1);
		d.rect(0, 0, 1, 1);
		d.text(vec2(0, 0), "hi");
		expect(d.frame().length).toBe(0);
	});

	test("dev=false strips writes regardless of enabled", () => {
		const d = debug({ enabled: true, dev: false });
		d.line(vec2(0, 0), vec2(1, 1));
		expect(d.frame().length).toBe(0);
	});

	test("toggle flips enabled state", () => {
		const d = debug();
		expect(d.enabled()).toBe(true);
		d.toggle();
		expect(d.enabled()).toBe(false);
		d.toggle();
		expect(d.enabled()).toBe(true);
	});
});

describe("debug — pinned per-entity entries", () => {
	test("pin records and pinned() returns it", () => {
		const d = debug();
		const id = 1 as unknown as Id;
		d.pin(id, { kind: "label", data: { text: "boss" } });
		const list = d.pinned(id);
		expect(list.length).toBe(1);
		expect(list[0]?.kind).toBe("label");
	});

	test("pin TTL expires after tick_stats updates", () => {
		const w = world();
		const d = debug();
		const id = 7 as unknown as Id;
		d.tick_stats(w, { tick: 0 });
		d.pin(id, { kind: "label", data: "x", ttl: 3 });
		d.tick_stats(w, { tick: 1 });
		expect(d.pinned(id).length).toBe(1);
		d.tick_stats(w, { tick: 4 });
		expect(d.pinned(id).length).toBe(0);
	});

	test("unpin removes a single kind or all", () => {
		const d = debug();
		const id = 2 as unknown as Id;
		d.pin(id, { kind: "label", data: "a" });
		d.pin(id, { kind: "box", data: "b" });
		d.unpin(id, "label");
		expect(d.pinned(id).map(p => p.kind)).toEqual(["box"]);
		d.unpin(id);
		expect(d.pinned(id).length).toBe(0);
	});
});

describe("debug — HUD stats and counters", () => {
	test("counters are read/writeable", () => {
		const d = debug();
		d.counter("score", 100);
		d.counter("level", "boss");
		expect(d.counters().score).toBe(100);
		expect(d.counters().level).toBe("boss");
	});

	test("tick_stats updates entity count and tick from world+time", () => {
		const w = world();
		const c = component<number>("n");
		w.spawn([c, 1]);
		w.spawn([c, 2]);
		w.spawn([c, 3]);
		const d = debug();
		d.tick_stats(w, { tick: 42 }, 60);
		expect(d.stats().tick).toBe(42);
		expect(d.stats().entities).toBe(3);
		expect(d.stats().fps).toBe(60);
	});

	test("timing records system micros", () => {
		const d = debug();
		d.timing("movement", 250);
		expect(d.stats().system_us.movement).toBe(250);
	});
});

describe("debug — inspector", () => {
	test("inspect returns entity and its components", () => {
		const w = world();
		const pos = component<{ x: number; y: number }>("pos");
		const vel = component<{ dx: number; dy: number }>("vel");
		const id = w.spawn([pos, { x: 1, y: 2 }], [vel, { dx: 3, dy: 4 }]);
		const d = debug();
		const inspection = d.inspect(w, id);
		expect(inspection.entity).toBe(id);
		expect(inspection.components.length).toBe(2);
		const names = inspection.components.map(c => c.name).sort();
		expect(names).toEqual(["pos", "vel"]);
	});

	test("select / selected round-trip", () => {
		const d = debug();
		expect(d.selected()).toBeNull();
		d.select(99 as unknown as Id);
		expect(d.selected()).toBe(99 as unknown as Id);
		d.select(null);
		expect(d.selected()).toBeNull();
	});
});
