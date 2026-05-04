import { type RawInput, type InputSource, noop_source } from "./source.ts";
import { type Bindings, type Trigger, type AxisBinding, empty_bindings } from "./bindings.ts";
import type { World } from "../world.ts";

export type ActionState = {
	pressed: boolean;
	just_pressed: boolean;
	just_released: boolean;
	value: number;
};

export type ActionEventLike =
	| { kind: "press"; action: string }
	| { kind: "release"; action: string }
	| { kind: "axis"; action: string; value: number };

export type RawListener = (events: readonly RawInput[]) => void;
export type AdvanceListener = () => void;

export type Input = {
	bind: (b: Bindings) => void;
	bindings: () => Bindings;
	pressed: (a: string) => boolean;
	just: (a: string) => boolean;
	released: (a: string) => boolean;
	axis: (a: string) => number;
	vector: (x: string, y: string) => readonly [number, number];
	query: (a: string) => ActionState;
	pump: (raw: readonly RawInput[]) => void;
	source: (s: InputSource) => void;
	current_source: () => InputSource;
	on_raw: (fn: RawListener) => () => void;
	on_pre_advance: (fn: AdvanceListener) => () => void;
	on_advance: (fn: AdvanceListener) => () => void;
	advance: (w: World, ctx: { input: Input }) => void;
	inject_actions: (events: readonly ActionEventLike[]) => void;
};

const trigger_active = (trigger: Trigger, key_state: ReadonlyMap<string, boolean>, mouse_state: ReadonlyMap<number, boolean>, pad_buttons: ReadonlyMap<string, boolean>, pad_axes: ReadonlyMap<string, number>): boolean => {
	if (trigger.kind === "key") return key_state.get(trigger.code) === true;
	if (trigger.kind === "mouse") return mouse_state.get(trigger.button) === true;
	if (trigger.kind === "pad.button") {
		const k = `${trigger.pad ?? "*"}:${trigger.button}`;
		return pad_buttons.get(k) === true;
	}
	const k = `${trigger.pad ?? "*"}:${trigger.axis}`;
	const v = (pad_axes.get(k) ?? 0) * (trigger.sign ?? 1);
	return v >= (trigger.threshold ?? 0.5);
};

const axis_value = (binding: AxisBinding, key_state: ReadonlyMap<string, boolean>, pad_axes: ReadonlyMap<string, number>, pad_buttons: ReadonlyMap<string, boolean>, deadzone: number): number => {
	if (binding.kind === "key.pair") {
		const pos = key_state.get(binding.positive) ? 1 : 0;
		const neg = key_state.get(binding.negative) ? 1 : 0;
		return pos - neg;
	}
	if (binding.kind === "pad.button.pair") {
		const key_pos = `${binding.pad ?? "*"}:${binding.positive}`;
		const key_neg = `${binding.pad ?? "*"}:${binding.negative}`;
		const pos = pad_buttons.get(key_pos) ? 1 : 0;
		const neg = pad_buttons.get(key_neg) ? 1 : 0;
		return pos - neg;
	}
	const ax_key = `${binding.pad ?? "*"}:${binding.axis}`;
	const raw = pad_axes.get(ax_key) ?? 0;
	const dz = binding.deadzone ?? deadzone;
	if (Math.abs(raw) < dz) return 0;
	const scale = binding.scale ?? 1;
	const sign = binding.invert ? -1 : 1;
	return raw * scale * sign;
};

export const input = (initial?: Bindings): Input => {
	let bindings_data: Bindings = initial ?? empty_bindings();
	let src: InputSource = noop_source();

	const key_state = new Map<string, boolean>();
	const mouse_state = new Map<number, boolean>();
	const pad_buttons = new Map<string, boolean>();
	const pad_axes = new Map<string, number>();
	const raw_listeners = new Set<RawListener>();
	const pre_listeners = new Set<AdvanceListener>();
	const post_listeners = new Set<AdvanceListener>();

	const overrides_pressed = new Map<string, boolean>();
	const overrides_axis = new Map<string, number>();

	const action_state = new Map<string, ActionState>();

	const get_state = (a: string): ActionState => {
		const existing = action_state.get(a);
		if (existing) return existing;
		const fresh: ActionState = { pressed: false, just_pressed: false, just_released: false, value: 0 };
		action_state.set(a, fresh);
		return fresh;
	};

	const ingest_raw = (events: readonly RawInput[]): void => {
		for (const ev of events) {
			if (ev.kind === "key.down") key_state.set(ev.code, true);
			else if (ev.kind === "key.up") key_state.set(ev.code, false);
			else if (ev.kind === "mouse.down") mouse_state.set(ev.button, true);
			else if (ev.kind === "mouse.up") mouse_state.set(ev.button, false);
			else if (ev.kind === "pad.button.down") {
				pad_buttons.set(`${ev.pad}:${ev.button}`, true);
				pad_buttons.set(`*:${ev.button}`, true);
			} else if (ev.kind === "pad.button.up") {
				pad_buttons.set(`${ev.pad}:${ev.button}`, false);
				pad_buttons.set(`*:${ev.button}`, false);
			} else if (ev.kind === "pad.axis") {
				pad_axes.set(`${ev.pad}:${ev.axis}`, ev.value);
				pad_axes.set(`*:${ev.axis}`, ev.value);
			}
		}
	};

	const resolve_digital = (action: string): boolean => {
		const override = overrides_pressed.get(action);
		if (override !== undefined) return override;
		const triggers = bindings_data.digital[action] ?? [];
		for (const t of triggers) {
			if (trigger_active(t, key_state, mouse_state, pad_buttons, pad_axes)) return true;
		}
		return false;
	};

	const resolve_axis = (action: string): number => {
		const override = overrides_axis.get(action);
		if (override !== undefined) return override;
		const axes = bindings_data.axes[action];
		if (axes && axes.length > 0) {
			let max_abs = 0;
			let value = 0;
			for (const b of axes) {
				const v = axis_value(b, key_state, pad_axes, pad_buttons, bindings_data.deadzone);
				if (Math.abs(v) > max_abs) {
					max_abs = Math.abs(v);
					value = v;
				}
			}
			return value;
		}
		return resolve_digital(action) ? 1 : 0;
	};

	const refresh = (): void => {
		const seen = new Set<string>();
		for (const action of Object.keys(bindings_data.digital)) seen.add(action);
		for (const action of Object.keys(bindings_data.axes)) seen.add(action);
		for (const action of action_state.keys()) seen.add(action);
		for (const action of overrides_pressed.keys()) seen.add(action);
		for (const action of overrides_axis.keys()) seen.add(action);

		for (const action of seen) {
			const state = get_state(action);
			const prev = state.pressed;
			const has_axis = bindings_data.axes[action] !== undefined || overrides_axis.has(action);
			if (has_axis) {
				const v = resolve_axis(action);
				state.value = v;
				state.pressed = Math.abs(v) > 0;
			} else {
				const down = resolve_digital(action);
				state.value = down ? 1 : 0;
				state.pressed = down;
			}
			state.just_pressed = state.pressed && !prev;
			state.just_released = !state.pressed && prev;
		}
	};

	const api: Input = {
		bind: b => {
			bindings_data = b;
		},
		bindings: () => bindings_data,
		pressed: a => get_state(a).pressed,
		just: a => get_state(a).just_pressed,
		released: a => get_state(a).just_released,
		axis: a => get_state(a).value,
		vector: (x, y) => [api.axis(x), api.axis(y)] as const,
		query: get_state,
		pump: raw => {
			for (const fn of pre_listeners) fn();
			for (const fn of raw_listeners) fn(raw);
			ingest_raw(raw);
			refresh();
			for (const fn of post_listeners) fn();
		},
		source: s => {
			src = s;
		},
		current_source: () => src,
		on_raw: fn => {
			raw_listeners.add(fn);
			return () => {
				raw_listeners.delete(fn);
			};
		},
		on_pre_advance: fn => {
			pre_listeners.add(fn);
			return () => {
				pre_listeners.delete(fn);
			};
		},
		on_advance: fn => {
			post_listeners.add(fn);
			return () => {
				post_listeners.delete(fn);
			};
		},
		advance: () => {
			for (const fn of pre_listeners) fn();
			const events = src.drain();
			for (const fn of raw_listeners) fn(events);
			ingest_raw(events);
			refresh();
			for (const fn of post_listeners) fn();
		},
		inject_actions: events => {
			for (const ev of events) {
				if (ev.kind === "press") overrides_pressed.set(ev.action, true);
				else if (ev.kind === "release") overrides_pressed.set(ev.action, false);
				else overrides_axis.set(ev.action, ev.value);
			}
		},
	};
	return api;
};
