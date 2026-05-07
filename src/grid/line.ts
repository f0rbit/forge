import type { Cell } from "./grid.ts";

export const line = function* (a: Cell, b: Cell): Generator<Cell> {
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
};
