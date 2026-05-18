import type { Component, Id, System, World } from "../index.ts";
import { pos_c } from "../index.ts";
import type { Grid } from "../grid/index.ts";
import { sprite_c } from "../pixi/index.ts";
import { compute_corner_states, key, LOOKUP } from "./lookup.ts";

export type AutotileOpts = {
	/** Marker component identifying wall entities (project-specific). */
	wall_c: Component<true>;
	/** Grid used to map `pos_c` into cell-space (and report bounds). */
	grid: Grid;
	/** Atlas alias of the loaded walls sheet (e.g. `"walls"`). */
	texture: string;
	/** Sprite z-order. Defaults to `2` (walls render above floors). */
	z?: number;
};

/** Apply the Godot 3x3 minimal autotile pass to every wall entity in `w`.
 *
 * Pure function; safe to call multiple times. Skips entities that already
 * carry a `sprite_c` (the autotile is conceptually a one-shot startup pass).
 */
export const apply_wall_autotile = (w: World, opts: AutotileOpts): void => {
	const { wall_c, grid: g, texture, z = 2 } = opts;
	const cells = new Set<number>();
	const entries: Array<[Id, { cx: number; cy: number }]> = [];
	for (const [id, p] of w.query([pos_c, wall_c] as const).collect()) {
		const c = g.world_to_cell(p.x, p.y);
		cells.add(g.key(c.x, c.y));
		entries.push([id, { cx: c.x, cy: c.y }]);
	}
	const is_wall = (x: number, y: number): boolean =>
		!g.in_bounds(x, y) || cells.has(g.key(x, y));
	for (const [id, { cx, cy }] of entries) {
		if (w.has(id, sprite_c)) continue;
		const s = compute_corner_states(cx, cy, is_wall);
		const tile = LOOKUP[key(s.tl, s.tr, s.bl, s.br)]!;
		const frame = `wat_${tile.col}_${tile.row}`;
		w.set(id, sprite_c, {
			texture,
			frame,
			anchor: { x: 0.5, y: 0.5 },
			visible: true,
			z,
		});
	}
};

/** Build a `System` that runs the autotile pass on every tick it's scheduled.
 *
 * Typically wired into the `startup` stage — once the wall entities exist and
 * the atlas alias is loaded, autotile assigns each one its corner-keyed frame.
 *
 * ```ts
 * import { make_wall_autotile_system } from "@f0rbit/forge/autotile";
 *
 * schedule.add("startup", make_wall_autotile_system({ wall_c, grid: g, texture: "walls" }), "walls.autotile");
 * ```
 */
export const make_wall_autotile_system = (opts: AutotileOpts): System => w => {
	apply_wall_autotile(w, opts);
};

export { LOOKUP, compute_corner_states, corner_state, key, OUTER, SIDE_A, SIDE_B, CONCAVE, FILLED } from "./lookup.ts";
export type { CornerKey, CornerState, CornerStates, TilePos } from "./lookup.ts";
