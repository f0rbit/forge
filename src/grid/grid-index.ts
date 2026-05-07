import type { Component, Id, World } from "../world.ts";
import type { System } from "../schedule.ts";
import type { Cell, Grid } from "./grid.ts";

export type GridIndex = {
	at: (cell: Cell) => Id | null;
	all_at: (cell: Cell) => readonly Id[];
	around: (cell: Cell, r: number) => readonly Id[];
	refresh: () => void;
};

export const grid_index = <P extends { x: number; y: number }>(
	w: World,
	pos_c: Component<P>,
	g: Grid,
	filter?: Component<any>,
): GridIndex => {
	const buckets = new Map<number, Id[]>();

	const refresh = (): void => {
		buckets.clear();
		const rows = filter
			? w.query([pos_c, filter] as const).collect()
			: w.query([pos_c] as const).collect();
		for (const row of rows) {
			const id = row[0] as Id;
			const p = row[1] as P;
			const cell = g.world_to_cell(p.x, p.y);
			if (!g.in_bounds(cell.x, cell.y)) continue;
			const k = g.key(cell.x, cell.y);
			const list = buckets.get(k);
			if (list) list.push(id);
			else buckets.set(k, [id]);
		}
	};

	const at = (cell: Cell): Id | null => {
		if (!g.in_bounds(cell.x, cell.y)) return null;
		const list = buckets.get(g.key(cell.x, cell.y));
		return list && list.length > 0 ? (list[0] as Id) : null;
	};

	const all_at = (cell: Cell): readonly Id[] => {
		if (!g.in_bounds(cell.x, cell.y)) return [];
		return buckets.get(g.key(cell.x, cell.y)) ?? [];
	};

	const around = (cell: Cell, r: number): readonly Id[] => {
		const out: Id[] = [];
		for (let dy = -r; dy <= r; dy++) {
			for (let dx = -r; dx <= r; dx++) {
				const x = cell.x + dx;
				const y = cell.y + dy;
				if (!g.in_bounds(x, y)) continue;
				const list = buckets.get(g.key(x, y));
				if (!list) continue;
				for (const id of list) out.push(id);
			}
		}
		return out;
	};

	refresh();

	return { at, all_at, around, refresh };
};

export const grid_index_sync_system = (idx: GridIndex): System => () => {
	idx.refresh();
};
