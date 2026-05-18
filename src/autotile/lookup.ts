// Godot 3x3 minimal autotile (47-tile, corner-based composition).
//
// For each wall cell we sample the 8 surrounding cells (4 cardinals + 4 diagonals)
// and classify each of the tile's 4 corners (TL, TR, BL, BR) into one of 5 states
// based on the two adjacent cardinals (A, B) and the diagonal (C):
//   0 = OUTER     (!A && !B)             exposed corner of the wall
//   1 = SIDE_A    ( A && !B)             wall on the vertical orthogonal only
//   2 = SIDE_B    (!A &&  B)             wall on the horizontal orthogonal only
//   3 = CONCAVE   ( A &&  B && !C)       inner corner gap (T/L-joint)
//   4 = FILLED    ( A &&  B &&  C)       fully interior
//
// The 4 corner states key into a 47-entry table extracted directly from Godot's
// reference template (autotile_template_3x3_minimal.png), which matches the layout
// of 0x72's atlas_walls_low-16x16 sheet (12 cols x 4 rows).
//
// All 256 raw 8-neighbourhood patterns map onto exactly one of the 47 entries
// (the diagonal-gating rule collapses the rest).

export const OUTER = 0;
export const SIDE_A = 1;
export const SIDE_B = 2;
export const CONCAVE = 3;
export const FILLED = 4;

export type CornerState = 0 | 1 | 2 | 3 | 4;

export const corner_state = (a: number, b: number, c: number): CornerState => {
	if (!a && !b) return OUTER;
	if (a && !b) return SIDE_A;
	if (!a && b) return SIDE_B;
	if (!c) return CONCAVE;
	return FILLED;
};

export type CornerKey = `${number},${number},${number},${number}`;

export type TilePos = { col: number; row: number };

export const key = (tl: number, tr: number, bl: number, br: number): CornerKey =>
	`${tl},${tr},${bl},${br}` as CornerKey;

/** 47-entry corner-state combo → tile position lookup.
 *
 * Extracted from Godot's autotile_template_3x3_minimal.png. The layout matches
 * 0x72's `atlas_walls_low-16x16.png` sheet (12 cols x 4 rows).
 */
export const LOOKUP: Readonly<Record<CornerKey, TilePos>> = {
	"0,0,0,0": { col: 0, row: 3 },
	"0,0,1,1": { col: 0, row: 0 },
	"0,2,0,2": { col: 1, row: 3 },
	"0,2,1,3": { col: 1, row: 0 },
	"0,2,1,4": { col: 8, row: 0 },
	"1,1,0,0": { col: 0, row: 2 },
	"1,1,1,1": { col: 0, row: 1 },
	"1,3,0,2": { col: 1, row: 2 },
	"1,3,1,3": { col: 1, row: 1 },
	"1,3,1,4": { col: 4, row: 1 },
	"1,4,0,2": { col: 8, row: 3 },
	"1,4,1,3": { col: 4, row: 2 },
	"1,4,1,4": { col: 8, row: 1 },
	"2,0,2,0": { col: 3, row: 3 },
	"2,0,3,1": { col: 3, row: 0 },
	"2,0,4,1": { col: 11, row: 0 },
	"2,2,2,2": { col: 2, row: 3 },
	"2,2,3,3": { col: 2, row: 0 },
	"2,2,3,4": { col: 5, row: 0 },
	"2,2,4,3": { col: 6, row: 0 },
	"2,2,4,4": { col: 10, row: 0 },
	"3,1,2,0": { col: 3, row: 2 },
	"3,1,3,1": { col: 3, row: 1 },
	"3,1,4,1": { col: 7, row: 1 },
	"3,3,2,2": { col: 2, row: 2 },
	"3,3,3,3": { col: 2, row: 1 },
	"3,3,3,4": { col: 7, row: 3 },
	"3,3,4,3": { col: 4, row: 3 },
	"3,3,4,4": { col: 9, row: 0 },
	"3,4,2,2": { col: 5, row: 3 },
	"3,4,3,3": { col: 7, row: 0 },
	"3,4,3,4": { col: 8, row: 2 },
	"3,4,4,3": { col: 9, row: 1 },
	"3,4,4,4": { col: 5, row: 1 },
	"4,1,2,0": { col: 11, row: 3 },
	"4,1,3,1": { col: 7, row: 2 },
	"4,1,4,1": { col: 11, row: 2 },
	"4,3,2,2": { col: 6, row: 3 },
	"4,3,3,3": { col: 4, row: 0 },
	"4,3,3,4": { col: 10, row: 2 },
	"4,3,4,3": { col: 11, row: 1 },
	"4,3,4,4": { col: 6, row: 1 },
	"4,4,2,2": { col: 9, row: 3 },
	"4,4,3,3": { col: 10, row: 3 },
	"4,4,3,4": { col: 5, row: 2 },
	"4,4,4,3": { col: 6, row: 2 },
	"4,4,4,4": { col: 9, row: 2 },
};

export type CornerStates = { tl: CornerState; tr: CornerState; bl: CornerState; br: CornerState };

export const compute_corner_states = (
	cx: number,
	cy: number,
	is_wall: (x: number, y: number) => boolean,
): CornerStates => {
	const n = is_wall(cx, cy - 1) ? 1 : 0;
	const s = is_wall(cx, cy + 1) ? 1 : 0;
	const e = is_wall(cx + 1, cy) ? 1 : 0;
	const w = is_wall(cx - 1, cy) ? 1 : 0;
	const nw = is_wall(cx - 1, cy - 1) ? 1 : 0;
	const ne = is_wall(cx + 1, cy - 1) ? 1 : 0;
	const sw = is_wall(cx - 1, cy + 1) ? 1 : 0;
	const se = is_wall(cx + 1, cy + 1) ? 1 : 0;
	return {
		tl: corner_state(n, w, nw),
		tr: corner_state(n, e, ne),
		bl: corner_state(s, w, sw),
		br: corner_state(s, e, se),
	};
};
