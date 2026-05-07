export type Cell = { readonly x: number; readonly y: number };

export type GridOpts = {
	cols: number;
	rows: number;
	tile: number;
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

export const grid = (opts: GridOpts): Grid => {
	const { cols, rows, tile } = opts;
	return {
		cols,
		rows,
		tile,
		key: (x, y) => y * cols + x,
		unkey: k => ({ x: k % cols, y: Math.floor(k / cols) }),
		in_bounds: (x, y) => x >= 0 && y >= 0 && x < cols && y < rows,
		cell_to_world: (cx, cy) => ({ x: cx * tile + tile / 2, y: cy * tile + tile / 2 }),
		world_to_cell: (wx, wy) => ({ x: Math.floor(wx / tile), y: Math.floor(wy / tile) }),
		chebyshev: (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)),
		manhattan: (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
		neighbors4: (x, y) => N4.map(([dx, dy]) => ({ x: x + dx, y: y + dy })),
		neighbors8: (x, y) => N8.map(([dx, dy]) => ({ x: x + dx, y: y + dy })),
	};
};
