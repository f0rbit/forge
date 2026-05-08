import { ok, type Result } from "@f0rbit/corpus";
import { Container, Sprite, Texture } from "pixi.js";
import type { System } from "../schedule.ts";
import { component, type Component, type Id, type World } from "../world.ts";
import type { EngineError } from "../errors.ts";
import type { Assets_ } from "./assets.ts";

export type SpriteData = {
	texture: string;
	frame?: string;
	anchor?: { x: number; y: number };
	tint?: number;
	visible?: boolean;
	z?: number;
	scale?: { x: number; y: number };
	alpha?: number;
};

export const sprite_c: Component<SpriteData> = component<SpriteData>("sprite");

export type Pos = { x: number; y: number };

const node_map = new WeakMap<World, Map<Id, Sprite>>();

const get_nodes = (w: World): Map<Id, Sprite> => {
	let m = node_map.get(w);
	if (!m) {
		m = new Map<Id, Sprite>();
		node_map.set(w, m);
	}
	return m;
};

const resolve_texture = (assets: Assets_, atlas_or_alias: string, frame: string | undefined): Texture | null => {
	if (frame) {
		const r = assets.get<{ textures?: Record<string, Texture> }>(atlas_or_alias);
		if (r.ok && r.value && r.value.textures) {
			const t = r.value.textures[frame];
			if (t) return t;
		}
	}
	const tx = assets.texture(atlas_or_alias);
	if (tx.ok) return tx.value;
	const sheet = assets.get<{ textures?: Record<string, Texture> }>(atlas_or_alias);
	if (sheet.ok && sheet.value && sheet.value.textures) {
		const first = Object.values(sheet.value.textures)[0];
		if (first) return first;
	}
	return null;
};

export type SpriteSystemOpts = {
	assets: Assets_;
	world_container: Container;
	pos_component: Component<{ x: number; y: number }>;
};

export const sprite_sync_system = (opts: SpriteSystemOpts): System => {
	return (w, _ctx) => {
		const known = get_nodes(w);
		const seen = new Set<Id>();
		const q = w.query([opts.pos_component, sprite_c] as const);
		for (const [id, pos, sd] of q) {
			seen.add(id);
			let node = known.get(id) ?? null;
			if (!node) {
				node = new Sprite();
				opts.world_container.addChild(node);
				known.set(id, node);
			}
			const tex = resolve_texture(opts.assets, sd.texture, sd.frame);
			if (tex && node.texture !== tex) node.texture = tex;
			if (sd.anchor) node.anchor.set(sd.anchor.x, sd.anchor.y);
			if (sd.tint !== undefined) node.tint = sd.tint;
			if (sd.scale) node.scale.set(sd.scale.x, sd.scale.y);
			if (sd.alpha !== undefined) node.alpha = sd.alpha;
			node.visible = sd.visible ?? true;
			node.position.set(pos.x, pos.y);
			if (sd.z !== undefined) node.zIndex = sd.z;
		}

		for (const [id, node] of known) {
			if (seen.has(id)) continue;
			node.removeFromParent();
			node.destroy();
			known.delete(id);
		}
	};
};

const set_patch = (w: World, id: Id, patch: Partial<SpriteData>): Result<void, EngineError> => {
	const cur = w.get(id, sprite_c);
	if (!cur.ok) return cur;
	return w.set(id, sprite_c, { ...cur.value, ...patch });
};

export const sprite = {
	set: set_patch,
	show: (w: World, id: Id): Result<void, EngineError> => set_patch(w, id, { visible: true }),
	hide: (w: World, id: Id): Result<void, EngineError> => set_patch(w, id, { visible: false }),
};

/** @internal — used by `anim_sync_system` to apply the active frame texture. */
export const sprite_node_for = (w: World, id: Id): Sprite | undefined => node_map.get(w)?.get(id);
