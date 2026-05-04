import type { InputSource, PadIndex, RawInput } from "../input/source.ts";

export type BrowserSourceOpts = {
	target?: HTMLElement | Window;
	pads?: "all" | readonly PadIndex[];
	deadzone?: number;
	get_time?: () => number;
};

export type BrowserSource = InputSource & {
	dispose: () => void;
	poll_pads: () => void;
};

type GamepadSnapshot = {
	buttons: number[];
	axes: number[];
};

const PAD_INDICES: readonly PadIndex[] = [0, 1, 2, 3];

const get_pads_array = (): readonly (Gamepad | null)[] => {
	const nav = (globalThis as { navigator?: { getGamepads?: () => readonly (Gamepad | null)[] } }).navigator;
	if (!nav || typeof nav.getGamepads !== "function") return [];
	try {
		const pads = nav.getGamepads();
		return pads ?? [];
	} catch {
		return [];
	}
};

export const browser_source = (opts?: BrowserSourceOpts): BrowserSource => {
	const target_default: EventTarget | null = (globalThis as { window?: Window }).window ?? null;
	const target = (opts?.target as EventTarget | undefined) ?? target_default;
	const wanted_pads: readonly PadIndex[] = opts?.pads === "all" || opts?.pads === undefined ? PAD_INDICES : opts.pads;
	const deadzone = opts?.deadzone ?? 0.15;
	const get_time = opts?.get_time ?? (() => 0);

	const queue: RawInput[] = [];
	const pad_state = new Map<PadIndex, GamepadSnapshot>();
	const listeners: Array<{ kind: string; fn: EventListener }> = [];

	const push = (ev: RawInput): void => {
		queue.push(ev);
	};

	const on_keydown = (ev: Event): void => {
		const ke = ev as KeyboardEvent;
		if (ke.repeat) return;
		push({ kind: "key.down", code: ke.code, pad: null, t: get_time() });
	};
	const on_keyup = (ev: Event): void => {
		const ke = ev as KeyboardEvent;
		push({ kind: "key.up", code: ke.code, pad: null, t: get_time() });
	};
	const on_mousedown = (ev: Event): void => {
		const me = ev as MouseEvent;
		const button = me.button === 0 || me.button === 1 || me.button === 2 ? me.button : 0;
		push({ kind: "mouse.down", button, x: me.clientX, y: me.clientY, pad: null, t: get_time() });
	};
	const on_mouseup = (ev: Event): void => {
		const me = ev as MouseEvent;
		const button = me.button === 0 || me.button === 1 || me.button === 2 ? me.button : 0;
		push({ kind: "mouse.up", button, x: me.clientX, y: me.clientY, pad: null, t: get_time() });
	};
	const on_mousemove = (ev: Event): void => {
		const me = ev as MouseEvent;
		push({ kind: "mouse.move", x: me.clientX, y: me.clientY, pad: null, t: get_time() });
	};
	const on_wheel = (ev: Event): void => {
		const we = ev as WheelEvent;
		push({ kind: "wheel", dx: we.deltaX, dy: we.deltaY, pad: null, t: get_time() });
	};

	const bind = (kind: string, fn: EventListener): void => {
		if (!target || typeof (target as EventTarget).addEventListener !== "function") return;
		try {
			(target as EventTarget).addEventListener(kind, fn);
			listeners.push({ kind, fn });
		} catch {
			/* no-op */
		}
	};

	bind("keydown", on_keydown);
	bind("keyup", on_keyup);
	bind("mousedown", on_mousedown);
	bind("mouseup", on_mouseup);
	bind("mousemove", on_mousemove);
	bind("wheel", on_wheel);

	const poll_pads = (): void => {
		const pads = get_pads_array();
		for (const idx of wanted_pads) {
			const pad = pads[idx];
			if (!pad) {
				pad_state.delete(idx);
				continue;
			}
			const prev = pad_state.get(idx);
			const next: GamepadSnapshot = { buttons: pad.buttons.map(b => b.value), axes: pad.axes.slice() };
			if (prev) {
				for (let i = 0; i < next.buttons.length; i++) {
					const a = prev.buttons[i] ?? 0;
					const b = next.buttons[i] ?? 0;
					if (a < 0.5 && b >= 0.5) push({ kind: "pad.button.down", button: i, pad: idx, t: get_time() });
					else if (a >= 0.5 && b < 0.5) push({ kind: "pad.button.up", button: i, pad: idx, t: get_time() });
				}
				for (let i = 0; i < next.axes.length; i++) {
					const a = prev.axes[i] ?? 0;
					const b = next.axes[i] ?? 0;
					const out = Math.abs(b) < deadzone ? 0 : b;
					const out_prev = Math.abs(a) < deadzone ? 0 : a;
					if (out !== out_prev) push({ kind: "pad.axis", axis: i, value: out, pad: idx, t: get_time() });
				}
			} else {
				for (let i = 0; i < next.buttons.length; i++) {
					if ((next.buttons[i] ?? 0) >= 0.5) push({ kind: "pad.button.down", button: i, pad: idx, t: get_time() });
				}
				for (let i = 0; i < next.axes.length; i++) {
					const v = next.axes[i] ?? 0;
					const out = Math.abs(v) < deadzone ? 0 : v;
					if (out !== 0) push({ kind: "pad.axis", axis: i, value: out, pad: idx, t: get_time() });
				}
			}
			pad_state.set(idx, next);
		}
	};

	return {
		drain: () => {
			poll_pads();
			if (queue.length === 0) return [];
			const out = queue.slice();
			queue.length = 0;
			return out;
		},
		poll_pads,
		dispose: () => {
			if (!target || typeof (target as EventTarget).removeEventListener !== "function") {
				listeners.length = 0;
				return;
			}
			for (const { kind, fn } of listeners) {
				try {
					(target as EventTarget).removeEventListener(kind, fn);
				} catch {
					/* no-op */
				}
			}
			listeners.length = 0;
			pad_state.clear();
			queue.length = 0;
		},
	};
};
