export type Time = {
	readonly fixed_dt: number;
	readonly tick: number;
	readonly elapsed: number;
	readonly alpha: number;
	scale: number;
	advance: (real_dt: number, each?: () => void) => number;
	restore: (tick: number) => void;
};

export const time = (opts?: { fixed_dt?: number }): Time => {
	const fixed_dt = opts?.fixed_dt ?? 1 / 60;
	const state = { tick: 0, accumulator: 0, alpha: 0 };

	const api: Time = {
		get fixed_dt() {
			return fixed_dt;
		},
		get tick() {
			return state.tick;
		},
		get elapsed() {
			return state.tick * fixed_dt;
		},
		get alpha() {
			return state.alpha;
		},
		scale: 1,
		advance: (real_dt, each) => {
			state.accumulator += real_dt * api.scale;
			let consumed = 0;
			while (state.accumulator >= fixed_dt) {
				state.accumulator -= fixed_dt;
				state.tick += 1;
				consumed += 1;
				if (each) each();
			}
			state.alpha = state.accumulator / fixed_dt;
			return consumed;
		},
		restore: tick => {
			state.tick = tick;
			state.accumulator = 0;
			state.alpha = 0;
		},
	};
	return api;
};
