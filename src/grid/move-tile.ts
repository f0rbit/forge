import { ok, type Result } from "@f0rbit/corpus";
import type { Component, Id, World } from "../world.ts";
import type { EngineError } from "../errors.ts";
import type { Cell, Grid } from "./grid.ts";

export type TileMoveOpts = {
	blocked_by: (cell: Cell) => boolean;
	slide?: boolean;
};

export type TileMoveResult = {
	from: Cell;
	to: Cell;
	moved: boolean;
};

export const move_tile = <P extends { x: number; y: number }>(
	w: World,
	id: Id,
	pos_c: Component<P>,
	g: Grid,
	dir: { dx: -1 | 0 | 1; dy: -1 | 0 | 1 },
	opts: TileMoveOpts,
): Result<TileMoveResult, EngineError> => {
	const slide = opts.slide ?? true;
	const cur = w.get(id, pos_c);
	if (!cur.ok) return cur;
	const p = cur.value;
	const cell = g.world_to_cell(p.x, p.y);

	if (dir.dx === 0 && dir.dy === 0) {
		return ok({ from: cell, to: cell, moved: false });
	}

	let nx = cell.x;
	let ny = cell.y;

	if (slide) {
		if (dir.dx !== 0) {
			const candidate: Cell = { x: cell.x + dir.dx, y: cell.y };
			if (g.in_bounds(candidate.x, candidate.y) && !opts.blocked_by(candidate)) nx = candidate.x;
		}
		if (dir.dy !== 0) {
			const candidate: Cell = { x: nx, y: cell.y + dir.dy };
			if (g.in_bounds(candidate.x, candidate.y) && !opts.blocked_by(candidate)) ny = candidate.y;
		}
	} else {
		const candidate: Cell = { x: cell.x + dir.dx, y: cell.y + dir.dy };
		if (g.in_bounds(candidate.x, candidate.y) && !opts.blocked_by(candidate)) {
			nx = candidate.x;
			ny = candidate.y;
		}
	}

	const target: Cell = { x: nx, y: ny };
	if (nx === cell.x && ny === cell.y) {
		return ok({ from: cell, to: target, moved: false });
	}

	const world = g.cell_to_world(nx, ny);
	const next = { ...p, x: world.x, y: world.y } as P;
	const set = w.set(id, pos_c, next);
	if (!set.ok) return set;
	return ok({ from: cell, to: target, moved: true });
};
