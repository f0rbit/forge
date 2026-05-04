import type { Bindings } from "../input/bindings.ts";

const PAD_LEFT_STICK_X = 0;
const PAD_LEFT_STICK_Y = 1;
const PAD_RIGHT_STICK_X = 2;
const PAD_RIGHT_STICK_Y = 3;

const PAD_SOUTH = 0;
const PAD_DPAD_UP = 12;
const PAD_DPAD_DOWN = 13;
const PAD_DPAD_LEFT = 14;
const PAD_DPAD_RIGHT = 15;

const movement2d: Bindings = {
	digital: {},
	axes: {
		"move.x": [
			{ kind: "key.pair", positive: "ArrowRight", negative: "ArrowLeft" },
			{ kind: "key.pair", positive: "KeyD", negative: "KeyA" },
			{ kind: "pad.axis", axis: PAD_LEFT_STICK_X },
			{ kind: "pad.button.pair", positive: PAD_DPAD_RIGHT, negative: PAD_DPAD_LEFT },
		],
		"move.y": [
			{ kind: "key.pair", positive: "ArrowDown", negative: "ArrowUp" },
			{ kind: "key.pair", positive: "KeyS", negative: "KeyW" },
			{ kind: "pad.axis", axis: PAD_LEFT_STICK_Y },
			{ kind: "pad.button.pair", positive: PAD_DPAD_DOWN, negative: PAD_DPAD_UP },
		],
	},
	deadzone: 0.15,
};

const movement8way: Bindings = {
	digital: {
		"move.left": [
			{ kind: "key", code: "ArrowLeft" },
			{ kind: "key", code: "KeyA" },
			{ kind: "pad.button", button: PAD_DPAD_LEFT },
			{ kind: "pad.axis", axis: PAD_LEFT_STICK_X, sign: -1, threshold: 0.5 },
		],
		"move.right": [
			{ kind: "key", code: "ArrowRight" },
			{ kind: "key", code: "KeyD" },
			{ kind: "pad.button", button: PAD_DPAD_RIGHT },
			{ kind: "pad.axis", axis: PAD_LEFT_STICK_X, sign: 1, threshold: 0.5 },
		],
		"move.up": [
			{ kind: "key", code: "ArrowUp" },
			{ kind: "key", code: "KeyW" },
			{ kind: "pad.button", button: PAD_DPAD_UP },
			{ kind: "pad.axis", axis: PAD_LEFT_STICK_Y, sign: -1, threshold: 0.5 },
		],
		"move.down": [
			{ kind: "key", code: "ArrowDown" },
			{ kind: "key", code: "KeyS" },
			{ kind: "pad.button", button: PAD_DPAD_DOWN },
			{ kind: "pad.axis", axis: PAD_LEFT_STICK_Y, sign: 1, threshold: 0.5 },
		],
	},
	axes: {
		"move.x": movement2d.axes["move.x"]!,
		"move.y": movement2d.axes["move.y"]!,
	},
	deadzone: 0.15,
};

const platformer: Bindings = {
	digital: {
		jump: [
			{ kind: "key", code: "Space" },
			{ kind: "pad.button", button: PAD_SOUTH },
		],
	},
	axes: {
		"move.x": [
			{ kind: "key.pair", positive: "ArrowRight", negative: "ArrowLeft" },
			{ kind: "key.pair", positive: "KeyD", negative: "KeyA" },
			{ kind: "pad.axis", axis: PAD_LEFT_STICK_X },
			{ kind: "pad.button.pair", positive: PAD_DPAD_RIGHT, negative: PAD_DPAD_LEFT },
		],
	},
	deadzone: 0.15,
};

const twinstick: Bindings = {
	digital: {},
	axes: {
		"move.x": [
			{ kind: "key.pair", positive: "KeyD", negative: "KeyA" },
			{ kind: "pad.axis", axis: PAD_LEFT_STICK_X },
		],
		"move.y": [
			{ kind: "key.pair", positive: "KeyS", negative: "KeyW" },
			{ kind: "pad.axis", axis: PAD_LEFT_STICK_Y },
		],
		"aim.x": [
			{ kind: "key.pair", positive: "ArrowRight", negative: "ArrowLeft" },
			{ kind: "pad.axis", axis: PAD_RIGHT_STICK_X },
		],
		"aim.y": [
			{ kind: "key.pair", positive: "ArrowDown", negative: "ArrowUp" },
			{ kind: "pad.axis", axis: PAD_RIGHT_STICK_Y },
		],
	},
	deadzone: 0.15,
};

const menu: Bindings = {
	digital: {
		up: [
			{ kind: "key", code: "ArrowUp" },
			{ kind: "pad.button", button: PAD_DPAD_UP },
		],
		down: [
			{ kind: "key", code: "ArrowDown" },
			{ kind: "pad.button", button: PAD_DPAD_DOWN },
		],
		left: [
			{ kind: "key", code: "ArrowLeft" },
			{ kind: "pad.button", button: PAD_DPAD_LEFT },
		],
		right: [
			{ kind: "key", code: "ArrowRight" },
			{ kind: "pad.button", button: PAD_DPAD_RIGHT },
		],
		confirm: [
			{ kind: "key", code: "Enter" },
			{ kind: "pad.button", button: PAD_SOUTH },
		],
		cancel: [
			{ kind: "key", code: "Escape" },
			{ kind: "pad.button", button: 1 },
		],
	},
	axes: {},
	deadzone: 0.15,
};

export const presets = {
	movement2d,
	movement8way,
	platformer,
	twinstick,
	menu,
} as const;
