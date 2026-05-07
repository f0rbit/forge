export const ticks_per_step = (cells_per_second: number, fixed_dt: number): number =>
	Math.max(1, Math.round(1 / (cells_per_second * fixed_dt)));
