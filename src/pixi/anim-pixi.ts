// IMPORTANT: ECS owns animation frame state. Never use PIXI's `AnimatedSprite`
// or its `Ticker`-driven `play()` — both would tick on real wall-clock and
// silently break the determinism contract documented in §5.E of PLAN.md.
// This system is a pure passive renderer: it reads the current frame from
// `anim_c` and assigns the matching `Texture` onto the existing `Sprite`.

import type { Spritesheet, Texture } from "pixi.js";
import type { System } from "../schedule.ts";
import { anim_c } from "../anim.ts";
import { sprite_c, sprite_node_for } from "./sprite.ts";
import { atlas_registry } from "../anim.ts";
import type { Assets_ } from "./assets.ts";
import { DEFAULT_ATLAS } from "./assets.ts";

export type AnimPixiOpts = {
	assets: Assets_;
	default_atlas?: string;
};

const lookup_texture = (sheet: Spritesheet, frame_name: string): Texture | null => {
	const t = sheet.textures[frame_name];
	return t ?? null;
};

export const anim_sync_system = (opts: AnimPixiOpts): System => {
	const default_alias = opts.default_atlas ?? DEFAULT_ATLAS;
	const warned_atlas = new Set<string>();
	const warned_frame = new Set<string>();

	return (w, ctx) => {
		const reg_r = ctx.res.get(atlas_registry);
		const registry = reg_r.ok ? reg_r.value : undefined;

		for (const [id, anim_data, _sd] of w.query([anim_c, sprite_c] as const)) {
			let alias = anim_data.atlas;
			let sheet_r = opts.assets.get<Spritesheet>(alias);
			if (!sheet_r.ok) {
				const key = alias;
				if (!warned_atlas.has(key)) {
					warned_atlas.add(key);
					ctx.debug.counter("anim.missing_atlas", warned_atlas.size);
				}
				alias = default_alias;
				sheet_r = opts.assets.get<Spritesheet>(default_alias);
				if (!sheet_r.ok) continue;
			}
			const sheet = sheet_r.value;

			const seqs = registry?.[alias];
			const seq = seqs ? seqs[anim_data.sequence] : undefined;
			let frame_name: string | null = null;
			if (seq && seq.length > 0) {
				const idx = Math.min(anim_data.frame, seq.length - 1);
				frame_name = seq[idx]?.frame ?? null;
			}
			if (!frame_name) {
				const animations = (sheet.data as { animations?: Record<string, readonly string[]> }).animations;
				const list = animations?.[anim_data.sequence];
				if (list && list.length > 0) {
					const idx = Math.min(anim_data.frame, list.length - 1);
					frame_name = list[idx] ?? null;
				}
			}
			if (!frame_name) {
				const key = `${alias}:${anim_data.sequence}`;
				if (!warned_frame.has(key)) {
					warned_frame.add(key);
					ctx.debug.counter("anim.missing_sequence", warned_frame.size);
				}
				const all = Object.keys(sheet.textures);
				frame_name = all[0] ?? null;
				if (!frame_name) continue;
			}

			const tex = lookup_texture(sheet, frame_name);
			if (!tex) {
				const key = `${alias}:${frame_name}`;
				if (!warned_frame.has(key)) {
					warned_frame.add(key);
					ctx.debug.counter("anim.missing_frame", warned_frame.size);
				}
				continue;
			}
			const node = sprite_node_for(w, id);
			if (node && node.texture !== tex) node.texture = tex;
		}
	};
};
