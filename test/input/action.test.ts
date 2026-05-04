import { describe, expect, test } from "bun:test";
import { input, empty_bindings, type Bindings, type RawInput } from "../../src/index.ts";

const with_jump_bind = (): Bindings => ({
	digital: {
		jump: [
			{ kind: "key", code: "Space" },
			{ kind: "pad.button", button: 0 },
		],
	},
	axes: {},
	deadzone: 0.15,
});

describe("input — pressed/just/released semantics", () => {
	test("pressed true while held, false after release", () => {
		const i = input(with_jump_bind());
		i.pump([{ kind: "key.down", code: "Space", pad: null, t: 0 }]);
		expect(i.pressed("jump")).toBe(true);
		i.pump([]);
		expect(i.pressed("jump")).toBe(true);
		i.pump([{ kind: "key.up", code: "Space", pad: null, t: 1 }]);
		expect(i.pressed("jump")).toBe(false);
	});

	test("just_pressed only on transition tick", () => {
		const i = input(with_jump_bind());
		i.pump([{ kind: "key.down", code: "Space", pad: null, t: 0 }]);
		expect(i.just("jump")).toBe(true);
		i.pump([]);
		expect(i.just("jump")).toBe(false);
		expect(i.pressed("jump")).toBe(true);
	});

	test("just_released only on transition tick", () => {
		const i = input(with_jump_bind());
		i.pump([{ kind: "key.down", code: "Space", pad: null, t: 0 }]);
		i.pump([{ kind: "key.up", code: "Space", pad: null, t: 1 }]);
		expect(i.released("jump")).toBe(true);
		i.pump([]);
		expect(i.released("jump")).toBe(false);
	});
});

describe("input — multi-binding fan-in", () => {
	test("any of multiple triggers activates the action", () => {
		const i = input(with_jump_bind());
		i.pump([{ kind: "pad.button.down", button: 0, pad: 0, t: 0 }]);
		expect(i.pressed("jump")).toBe(true);
		i.pump([{ kind: "pad.button.up", button: 0, pad: 0, t: 1 }]);
		expect(i.pressed("jump")).toBe(false);
		i.pump([{ kind: "key.down", code: "Space", pad: null, t: 2 }]);
		expect(i.pressed("jump")).toBe(true);
	});
});

describe("input — axes (analog + digital)", () => {
	const axis_bind: Bindings = {
		digital: {},
		axes: {
			"move.x": [
				{ kind: "key.pair", positive: "ArrowRight", negative: "ArrowLeft" },
				{ kind: "pad.axis", axis: 0 },
			],
		},
		deadzone: 0.15,
	};

	test("digital key pair drives -1/0/1", () => {
		const i = input(axis_bind);
		i.pump([{ kind: "key.down", code: "ArrowLeft", pad: null, t: 0 }]);
		expect(i.axis("move.x")).toBe(-1);
		i.pump([{ kind: "key.up", code: "ArrowLeft", pad: null, t: 1 }]);
		expect(i.axis("move.x")).toBe(0);
		i.pump([{ kind: "key.down", code: "ArrowRight", pad: null, t: 2 }]);
		expect(i.axis("move.x")).toBe(1);
	});

	test("analog pad axis honoured outside deadzone", () => {
		const i = input(axis_bind);
		i.pump([{ kind: "pad.axis", axis: 0, value: 0.05, pad: 0, t: 0 }]);
		expect(i.axis("move.x")).toBe(0);
		i.pump([{ kind: "pad.axis", axis: 0, value: 0.5, pad: 0, t: 1 }]);
		expect(i.axis("move.x")).toBeCloseTo(0.5, 5);
	});

	test("custom deadzone via binding overrides global", () => {
		const i = input({
			digital: {},
			axes: {
				"move.x": [{ kind: "pad.axis", axis: 0, deadzone: 0.5 }],
			},
			deadzone: 0.05,
		});
		i.pump([{ kind: "pad.axis", axis: 0, value: 0.3, pad: 0, t: 0 }]);
		expect(i.axis("move.x")).toBe(0);
		i.pump([{ kind: "pad.axis", axis: 0, value: 0.7, pad: 0, t: 1 }]);
		expect(i.axis("move.x")).toBeCloseTo(0.7, 5);
	});

	test("scale + invert applied to analog value", () => {
		const i = input({
			digital: {},
			axes: { "move.x": [{ kind: "pad.axis", axis: 0, scale: 2, invert: true }] },
			deadzone: 0.15,
		});
		i.pump([{ kind: "pad.axis", axis: 0, value: 0.5, pad: 0, t: 0 }]);
		expect(i.axis("move.x")).toBeCloseTo(-1, 5);
	});

	test("vector(x, y) returns both axes", () => {
		const i = input({
			digital: {},
			axes: {
				"move.x": [{ kind: "key.pair", positive: "KeyD", negative: "KeyA" }],
				"move.y": [{ kind: "key.pair", positive: "KeyS", negative: "KeyW" }],
			},
			deadzone: 0.15,
		});
		const events: readonly RawInput[] = [
			{ kind: "key.down", code: "KeyD", pad: null, t: 0 },
			{ kind: "key.down", code: "KeyW", pad: null, t: 0 },
		];
		i.pump(events);
		const [x, y] = i.vector("move.x", "move.y");
		expect(x).toBe(1);
		expect(y).toBe(-1);
	});
});

describe("input — bindings update at runtime", () => {
	test("rebind swaps trigger without losing state on next pump", () => {
		const i = input(with_jump_bind());
		i.bind(empty_bindings());
		i.pump([{ kind: "key.down", code: "Space", pad: null, t: 0 }]);
		expect(i.pressed("jump")).toBe(false);
		i.bind({
			digital: { jump: [{ kind: "key", code: "Space" }] },
			axes: {},
			deadzone: 0.15,
		});
		i.pump([]);
		expect(i.pressed("jump")).toBe(true);
	});
});

describe("input — source drives advance", () => {
	test("advance() drains source and updates state", () => {
		const i = input(with_jump_bind());
		i.source({
			drain: () => [{ kind: "key.down", code: "Space", pad: null, t: 0 }],
		});
		const fake_w = {} as never;
		i.advance(fake_w, { input: i });
		expect(i.pressed("jump")).toBe(true);
		i.source({ drain: () => [{ kind: "key.up", code: "Space", pad: null, t: 1 }] });
		i.advance(fake_w, { input: i });
		expect(i.pressed("jump")).toBe(false);
	});
});
