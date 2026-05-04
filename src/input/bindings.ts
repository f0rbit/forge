export type Action = string;

export type Trigger =
	| { kind: "key"; code: string }
	| { kind: "mouse"; button: 0 | 1 | 2 }
	| { kind: "pad.button"; button: number; pad?: number }
	| { kind: "pad.axis"; axis: number; pad?: number; threshold?: number; sign?: 1 | -1 };

export type AxisBinding =
	| { kind: "key.pair"; positive: string; negative: string }
	| { kind: "pad.axis"; axis: number; pad?: number; scale?: number; deadzone?: number; invert?: boolean }
	| { kind: "pad.button.pair"; positive: number; negative: number; pad?: number };

export type Bindings = {
	digital: Record<Action, readonly Trigger[]>;
	axes: Record<Action, readonly AxisBinding[]>;
	deadzone: number;
};

export const empty_bindings = (): Bindings => ({ digital: {}, axes: {}, deadzone: 0.15 });

export const merge_bindings = (...all: readonly Bindings[]): Bindings => {
	const out = empty_bindings();
	for (const b of all) {
		out.deadzone = b.deadzone;
		for (const [action, triggers] of Object.entries(b.digital)) {
			const existing = out.digital[action] ?? [];
			out.digital[action] = [...existing, ...triggers];
		}
		for (const [action, axes] of Object.entries(b.axes)) {
			const existing = out.axes[action] ?? [];
			out.axes[action] = [...existing, ...axes];
		}
	}
	return out;
};
