export type PadIndex = 0 | 1 | 2 | 3;

export type RawInput =
	| { kind: "key.down"; code: string; pad: null; t: number }
	| { kind: "key.up"; code: string; pad: null; t: number }
	| { kind: "mouse.down"; button: 0 | 1 | 2; x: number; y: number; pad: null; t: number }
	| { kind: "mouse.up"; button: 0 | 1 | 2; x: number; y: number; pad: null; t: number }
	| { kind: "mouse.move"; x: number; y: number; pad: null; t: number }
	| { kind: "wheel"; dx: number; dy: number; pad: null; t: number }
	| { kind: "pad.button.down"; button: number; pad: PadIndex; t: number }
	| { kind: "pad.button.up"; button: number; pad: PadIndex; t: number }
	| { kind: "pad.axis"; axis: number; value: number; pad: PadIndex; t: number };

export type InputSource = {
	drain: () => readonly RawInput[];
	start?: () => void;
	stop?: () => void;
};

export const noop_source = (): InputSource => ({
	drain: () => [],
});

export const scripted = (events: readonly RawInput[]): InputSource => {
	const queue = [...events];
	return {
		drain: () => {
			if (queue.length === 0) return [];
			const out = queue.slice();
			queue.length = 0;
			return out;
		},
	};
};

export const ticked = (frames: ReadonlyMap<number, readonly RawInput[]>, get_tick: () => number): InputSource => ({
	drain: () => {
		const tick = get_tick();
		const events = frames.get(tick);
		return events ? events.slice() : [];
	},
});
