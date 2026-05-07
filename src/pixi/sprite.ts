import { Container, Sprite, Texture } from "pixi.js";
import type { System } from "../schedule.ts";
import { component, type Component, type Id } from "../world.ts";
import type { Assets_ } from "./assets.ts";

export type SpriteData = {
	texture: string;
	frame?: string;
	anchor?: { x: number; y: number };
	tint?: number;
	visible?: boolean;
	z?: number;
	scale?: { x: number; y: number };
	node?: Sprite | null;
};

export const sprite_c: Component<SpriteData> = component<SpriteData>("sprite");

export type Pos = { x: number; y: number };

const POS_NAME = "pos";

const is_pos = (c: Component<any>): boolean => c.name === POS_NAME;

const find_pos_component = (cs: readonly Component<any>[]): Component<{ x: number; y: number }> | null => {
	for (const c of cs) if (is_pos(c)) return c as Component<{ x: number; y: number }>;
	return null;
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
	const known = new Map<Id, Sprite>();

	return (w, _ctx) => {
		const seen = new Set<Id>();
		const q = w.query([opts.pos_component, sprite_c] as const);
		for (const [id, pos, sd] of q) {
			seen.add(id);
			let node = sd.node ?? known.get(id) ?? null;
			if (!node) {
				node = new Sprite();
				opts.world_container.addChild(node);
				known.set(id, node);
				w.set(id, sprite_c, { ...sd, node });
			}
			const tex = resolve_texture(opts.assets, sd.texture, sd.frame);
			if (tex && node.texture !== tex) node.texture = tex;
			if (sd.anchor) node.anchor.set(sd.anchor.x, sd.anchor.y);
			if (sd.tint !== undefined) node.tint = sd.tint;
			if (sd.scale) node.scale.set(sd.scale.x, sd.scale.y);
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

export const sprite_internal = {
	resolve_texture,
	find_pos_component,
};
