import { describe, expect, test } from "bun:test";
import { input, type RawInput } from "../../src/index.ts";
import { presets } from "../../src/presets/index.ts";

describe("presets — keys exist", () => {
	test("all six presets exposed", () => {
		expect(Object.keys(presets).sort()).toEqual([
			"menu",
			"movement2d",
			"movement8way",
			"movement_4way_digital",
			"platformer",
			"twinstick",
		]);
	});
});

describe("presets.movement_4way_digital", () => {
	test("WASD drives digital actions", () => {
		const i = input(presets.movement_4way_digital);
		i.pump([{ kind: "key.down", code: "KeyW", pad: null, t: 0 }]);
		expect(i.pressed("move.up")).toBe(true);
		expect(i.pressed("move.down")).toBe(false);
		i.pump([
			{ kind: "key.up", code: "KeyW", pad: null, t: 1 },
			{ kind: "key.down", code: "KeyD", pad: null, t: 1 },
		]);
		expect(i.pressed("move.right")).toBe(true);
	});

	test("arrow keys drive digital actions", () => {
		const i = input(presets.movement_4way_digital);
		i.pump([{ kind: "key.down", code: "ArrowLeft", pad: null, t: 0 }]);
		expect(i.pressed("move.left")).toBe(true);
	});

	test("no axes configured", () => {
		expect(Object.keys(presets.movement_4way_digital.axes)).toEqual([]);
	});

	test("digital-only edges (just_pressed semantics)", () => {
		const i = input(presets.movement_4way_digital);
		i.pump([{ kind: "key.down", code: "ArrowUp", pad: null, t: 0 }]);
		expect(i.just("move.up")).toBe(true);
	});
});

describe("presets.movement2d", () => {
	test("WASD drives move.x / move.y", () => {
		const i = input(presets.movement2d);
		i.pump([{ kind: "key.down", code: "KeyD", pad: null, t: 0 }]);
		expect(i.axis("move.x")).toBe(1);
		i.pump([
			{ kind: "key.up", code: "KeyD", pad: null, t: 1 },
			{ kind: "key.down", code: "KeyA", pad: null, t: 1 },
		]);
		expect(i.axis("move.x")).toBe(-1);
		i.pump([{ kind: "key.down", code: "KeyW", pad: null, t: 2 }]);
		expect(i.axis("move.y")).toBe(-1);
	});

	test("arrow keys drive move.x", () => {
		const i = input(presets.movement2d);
		i.pump([{ kind: "key.down", code: "ArrowRight", pad: null, t: 0 }]);
		expect(i.axis("move.x")).toBe(1);
	});

	test("left stick drives move.x analog", () => {
		const i = input(presets.movement2d);
		i.pump([{ kind: "pad.axis", axis: 0, value: 0.75, pad: 0, t: 0 }]);
		expect(i.axis("move.x")).toBeCloseTo(0.75, 5);
	});
});

describe("presets.platformer", () => {
	test("space triggers jump", () => {
		const i = input(presets.platformer);
		i.pump([{ kind: "key.down", code: "Space", pad: null, t: 0 }]);
		expect(i.pressed("jump")).toBe(true);
		expect(i.just("jump")).toBe(true);
	});

	test("south button triggers jump", () => {
		const i = input(presets.platformer);
		i.pump([{ kind: "pad.button.down", button: 0, pad: 0, t: 0 }]);
		expect(i.pressed("jump")).toBe(true);
	});

	test("no move.y axis configured", () => {
		const i = input(presets.platformer);
		expect(presets.platformer.axes["move.y"]).toBeUndefined();
		expect(presets.platformer.axes["move.x"]).toBeDefined();
	});
});

describe("presets.twinstick", () => {
	test("left stick drives move.*, right stick drives aim.*", () => {
		const i = input(presets.twinstick);
		const events: readonly RawInput[] = [
			{ kind: "pad.axis", axis: 0, value: 0.5, pad: 0, t: 0 },
			{ kind: "pad.axis", axis: 1, value: -0.5, pad: 0, t: 0 },
			{ kind: "pad.axis", axis: 2, value: 1, pad: 0, t: 0 },
			{ kind: "pad.axis", axis: 3, value: -1, pad: 0, t: 0 },
		];
		i.pump(events);
		expect(i.axis("move.x")).toBeCloseTo(0.5, 5);
		expect(i.axis("move.y")).toBeCloseTo(-0.5, 5);
		expect(i.axis("aim.x")).toBeCloseTo(1, 5);
		expect(i.axis("aim.y")).toBeCloseTo(-1, 5);
	});
});

describe("presets.movement8way", () => {
	test("digital actions for cardinal directions", () => {
		const i = input(presets.movement8way);
		i.pump([{ kind: "key.down", code: "KeyW", pad: null, t: 0 }]);
		expect(i.pressed("move.up")).toBe(true);
		expect(i.pressed("move.down")).toBe(false);
	});

	test("axes also exposed for code that wants analog", () => {
		const i = input(presets.movement8way);
		i.pump([{ kind: "key.down", code: "KeyD", pad: null, t: 0 }]);
		expect(i.axis("move.x")).toBe(1);
	});
});

describe("presets.menu", () => {
	test("Enter triggers confirm; Escape triggers cancel", () => {
		const i = input(presets.menu);
		i.pump([{ kind: "key.down", code: "Enter", pad: null, t: 0 }]);
		expect(i.pressed("confirm")).toBe(true);
		i.pump([
			{ kind: "key.up", code: "Enter", pad: null, t: 1 },
			{ kind: "key.down", code: "Escape", pad: null, t: 1 },
		]);
		expect(i.pressed("cancel")).toBe(true);
	});
});
