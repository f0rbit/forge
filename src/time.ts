export type Time = {
	readonly fixed_dt: number;
	readonly tick: number;
	readonly elapsed: number;
	readonly alpha: number;
	scale: number;
	advance: (real_dt: number) => number;
};

export const time = (opts?: { fixed_dt?: number }): Time => {
	const fixed_dt = opts?.fixed_dt ?? 1 / 60;
	const state = { tick: 0, elapsed: 0, alpha: 0, accumulator: 0 };

	const api: Time = {
		get fixed_dt() {
			return fixed_dt;
		},
		get tick() {
			return state.tick;
		},
		get elapsed() {
			return state.elapsed;
		},
		get alpha() {
			return state.alpha;
		},
		scale: 1,
		advance: real_dt => {
			state.accumulator += real_dt * api.scale;
			let consumed = 0;
			while (state.accumulator >= fixed_dt) {
				state.accumulator -= fixed_dt;
				state.tick += 1;
				state.elapsed += fixed_dt;
				consumed += 1;
			}
			state.alpha = state.accumulator / fixed_dt;
			return consumed;
		},
	};
	return api;
};
