import { ok, type Result } from "@f0rbit/corpus";
import type { Component, Id, World } from "../world.ts";
import type { EngineError } from "../errors.ts";
import { pos_c as default_pos_c } from "../index.ts";

export type Cell = { readonly x: number; readonly y: number };

export type GridOpts = {
	cols: number;
	rows: number;
	tile: number;
};

export type FovOpts = {
	from: Cell;
	radius: number;
	is_blocking: (cell: Cell) => boolean;
	include_origin?: boolean;
};

export type TileMoveOpts<P extends { x: number; y: number } = { x: number; y: number }> = {
	blocked_by: (cell: Cell) => boolean;
	slide?: boolean;
	pos?: Component<P>;
};

export type TileMoveResult = {
	from: Cell;
	to: Cell;
	moved: boolean;
};

export type Grid = {
	readonly cols: number;
	readonly rows: number;
	readonly tile: number;
	key: (x: number, y: number) => number;
	unkey: (k: number) => Cell;
	in_bounds: (x: number, y: number) => boolean;
	cell_to_world: (cx: number, cy: number) => { x: number; y: number };
	world_to_cell: (wx: number, wy: number) => Cell;
	chebyshev: (a: Cell, b: Cell) => number;
	manhattan: (a: Cell, b: Cell) => number;
	neighbors4: (x: number, y: number) => readonly Cell[];
	neighbors8: (x: number, y: number) => readonly Cell[];
	line: (a: Cell, b: Cell) => Generator<Cell>;
	line_of_sight: (opts: FovOpts) => ReadonlySet<number>;
	move_tile: <P extends { x: number; y: number } = { x: number; y: number }>(
		w: World,
		id: Id,
		dir: { dx: -1 | 0 | 1; dy: -1 | 0 | 1 },
		opts: TileMoveOpts<P>,
	) => Result<TileMoveResult, EngineError>;
};

const N4: ReadonlyArray<readonly [number, number]> = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
];

const N8: ReadonlyArray<readonly [number, number]> = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
	[1, 1],
	[1, -1],
	[-1, 1],
	[-1, -1],
];

function* line_gen(a: Cell, b: Cell): Generator<Cell> {
	let x = a.x;
	let y = a.y;
	const dx = Math.abs(b.x - a.x);
	const dy = Math.abs(b.y - a.y);
	const sx = a.x < b.x ? 1 : -1;
	const sy = a.y < b.y ? 1 : -1;
	let err = dx - dy;
	yield { x, y };
	while (x !== b.x || y !== b.y) {
		const e2 = 2 * err;
		if (e2 > -dy) {
			err -= dy;
			x += sx;
		}
		if (e2 < dx) {
			err += dx;
			y += sy;
		}
		yield { x, y };
	}
}

export const grid = (opts: GridOpts): Grid => {
	const { cols, rows, tile } = opts;

	const key = (x: number, y: number): number => y * cols + x;
	const unkey = (k: number): Cell => ({ x: k % cols, y: Math.floor(k / cols) });
	const in_bounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < cols && y < rows;
	const cell_to_world = (cx: number, cy: number) => ({ x: cx * tile + tile / 2, y: cy * tile + tile / 2 });
	const world_to_cell = (wx: number, wy: number): Cell => ({ x: Math.floor(wx / tile), y: Math.floor(wy / tile) });
	const chebyshev = (a: Cell, b: Cell): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
	const manhattan = (a: Cell, b: Cell): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
	const neighbors4 = (x: number, y: number): readonly Cell[] => N4.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));
	const neighbors8 = (x: number, y: number): readonly Cell[] => N8.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));

	const line_of_sight = (fov: FovOpts): ReadonlySet<number> => {
		const { from, radius, is_blocking } = fov;
		const include_origin = fov.include_origin ?? true;
		const out = new Set<number>();
		if (!in_bounds(from.x, from.y)) return out;
		if (include_origin) out.add(key(from.x, from.y));

		for (let dy = -radius; dy <= radius; dy++) {
			for (let dx = -radius; dx <= radius; dx++) {
				if (dx === 0 && dy === 0) continue;
				const tx = from.x + dx;
				const ty = from.y + dy;
				if (!in_bounds(tx, ty)) continue;
				const target: Cell = { x: tx, y: ty };
				if (chebyshev(from, target) > radius) continue;

				let blocked = false;
				let first = true;
				for (const step of line_gen(from, target)) {
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
				if (!blocked) out.add(key(tx, ty));
			}
		}
		return out;
	};

	const move_tile = <P extends { x: number; y: number } = { x: number; y: number }>(
		w: World,
		id: Id,
		dir: { dx: -1 | 0 | 1; dy: -1 | 0 | 1 },
		mt: TileMoveOpts<P>,
	): Result<TileMoveResult, EngineError> => {
		const slide = mt.slide ?? true;
		const pos = (mt.pos ?? (default_pos_c as unknown as Component<P>)) as Component<P>;
		const cur = w.get(id, pos);
		if (!cur.ok) return cur;
		const p = cur.value;
		const cell = world_to_cell(p.x, p.y);

		if (dir.dx === 0 && dir.dy === 0) {
			return ok({ from: cell, to: cell, moved: false });
		}

		let nx = cell.x;
		let ny = cell.y;

		if (slide) {
			if (dir.dx !== 0) {
				const candidate: Cell = { x: cell.x + dir.dx, y: cell.y };
				if (in_bounds(candidate.x, candidate.y) && !mt.blocked_by(candidate)) nx = candidate.x;
			}
			if (dir.dy !== 0) {
				const candidate: Cell = { x: nx, y: cell.y + dir.dy };
				if (in_bounds(candidate.x, candidate.y) && !mt.blocked_by(candidate)) ny = candidate.y;
			}
		} else {
			const candidate: Cell = { x: cell.x + dir.dx, y: cell.y + dir.dy };
			if (in_bounds(candidate.x, candidate.y) && !mt.blocked_by(candidate)) {
				nx = candidate.x;
				ny = candidate.y;
			}
		}

		const target: Cell = { x: nx, y: ny };
		if (nx === cell.x && ny === cell.y) {
			return ok({ from: cell, to: target, moved: false });
		}

		const world = cell_to_world(nx, ny);
		const next = { ...p, x: world.x, y: world.y } as P;
		const set = w.set(id, pos, next);
		if (!set.ok) return set;
		return ok({ from: cell, to: target, moved: true });
	};

	return {
		cols,
		rows,
		tile,
		key,
		unkey,
		in_bounds,
		cell_to_world,
		world_to_cell,
		chebyshev,
		manhattan,
		neighbors4,
		neighbors8,
		line: line_gen,
		line_of_sight,
		move_tile,
	};
};
