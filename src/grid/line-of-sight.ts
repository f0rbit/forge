import type { Cell, Grid } from "./grid.ts";
import { line } from "./line.ts";

export type FovOpts = {
	from: Cell;
	radius: number;
	grid: Grid;
	is_blocking: (cell: Cell) => boolean;
	include_origin?: boolean;
};

export const line_of_sight = (opts: FovOpts): ReadonlySet<number> => {
	const { from, radius, grid: g, is_blocking } = opts;
	const include_origin = opts.include_origin ?? true;
	const out = new Set<number>();
	if (!g.in_bounds(from.x, from.y)) return out;
	if (include_origin) out.add(g.key(from.x, from.y));

	for (let dy = -radius; dy <= radius; dy++) {
		for (let dx = -radius; dx <= radius; dx++) {
			if (dx === 0 && dy === 0) continue;
			const tx = from.x + dx;
			const ty = from.y + dy;
			if (!g.in_bounds(tx, ty)) continue;
			const target: Cell = { x: tx, y: ty };
			if (g.chebyshev(from, target) > radius) continue;

			let blocked = false;
			let first = true;
			for (const step of line(from, target)) {
				if (first) {
					first = false;
					continue;
				}
				if (step.x === target.x && step.y === target.y) break;
				if (is_blocking(step)) {
					blocked = true;
					break;
				}
			}
			if (!blocked) out.add(g.key(tx, ty));
		}
	}
	return out;
};
