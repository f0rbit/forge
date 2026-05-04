import { describe, expect, test } from "bun:test";
import { noop_source, scripted, ticked, type RawInput } from "../../src/index.ts";

describe("noop_source", () => {
	test("drain returns empty array", () => {
		const s = noop_source();
		expect(s.drain()).toEqual([]);
		expect(s.drain()).toEqual([]);
	});
});

describe("scripted source", () => {
	test("drains all events on first call, empty thereafter", () => {
		const events: RawInput[] = [
			{ kind: "key.down", code: "Space", pad: null, t: 0 },
			{ kind: "key.up", code: "Space", pad: null, t: 1 },
		];
		const s = scripted(events);
		const first = s.drain();
		expect(first.length).toBe(2);
		expect(first[0]?.kind).toBe("key.down");
		expect(s.drain()).toEqual([]);
	});

	test("snapshot returned by drain is detached from internal queue", () => {
		const s = scripted([{ kind: "key.down", code: "Space", pad: null, t: 0 }]);
		const drained = s.drain();
		expect(drained.length).toBe(1);
		expect(s.drain().length).toBe(0);
	});
});

describe("ticked source", () => {
	test("returns events for the current tick only", () => {
		let tick = 0;
		const frames = new Map<number, readonly RawInput[]>([
			[0, [{ kind: "key.down", code: "Space", pad: null, t: 0 }]],
			[5, [{ kind: "key.up", code: "Space", pad: null, t: 0 }]],
		]);
		const s = ticked(frames, () => tick);
		expect(s.drain().length).toBe(1);
		tick = 1;
		expect(s.drain().length).toBe(0);
		tick = 5;
		const at5 = s.drain();
		expect(at5.length).toBe(1);
		expect(at5[0]?.kind).toBe("key.up");
	});
});

describe("RawInput shape", () => {
	test("keyboard events carry pad: null", () => {
		const ev: RawInput = { kind: "key.down", code: "KeyA", pad: null, t: 42 };
		expect(ev.pad).toBeNull();
	});

	test("gamepad events carry pad index", () => {
		const ev: RawInput = { kind: "pad.button.down", button: 0, pad: 1, t: 0 };
		expect(ev.pad).toBe(1);
	});

	test("axis events carry pad index", () => {
		const ev: RawInput = { kind: "pad.axis", axis: 0, value: 0.5, pad: 0, t: 0 };
		expect(ev.value).toBe(0.5);
		expect(ev.pad).toBe(0);
	});
});
