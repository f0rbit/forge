import { describe, expect, test } from "bun:test";
import { world, schedule, time, rng, resources, input, debug, palette, atlas_registry_r, pos_c, type Ctx } from "../../src/index.ts";
import { Container } from "pixi.js";
import { assets, browser_source, camera, sprite_c, sprite_sync_system, anim_sync_system, debug_pixi, palette_pixi } from "../../src/pixi/index.ts";
import { sprite_node_for } from "../../src/pixi/sprite.ts";

const pos = pos_c;

describe("boot-equivalent smoke test", () => {
	test("wires assets + camera + input + sprite/anim sync + debug + palette without needing a real Application", () => {
		const w = world();
		const sch = schedule();
		const t = time();
		const r = rng(1);
		const res = resources();
		const inp = input();
		const dbg = debug({ enabled: true, dev: true });
		const pal = palette();

		const a = assets({ fixed_dt: t.fixed_dt, register_default: true });
		res.set(atlas_registry_r, a.registry());

		const cam = camera({ design: { width: 320, height: 180 }, mode: "letterbox" });
		cam.resize(640, 360);

		const world_container = new Container();
		const debug_overlay = new Container();
		const palette_overlay = new Container();

		const ctx: Ctx = {
			time: t,
			rng: r,
			res,
			input: inp,
			debug: dbg,
			palette: pal,
		};

		sch.add("post", sprite_sync_system({ assets: a, world_container, pos_component: pos }), "sprite");
		sch.add("post", anim_sync_system({ assets: a }), "anim_sync");
		sch.add("render", debug_pixi({ overlay: debug_overlay, dev: true }), "debug_pixi");
		const pal_ui = palette_pixi({ overlay: palette_overlay, palette: pal, get_ctx: () => ctx });
		sch.add("render", pal_ui.system, "palette_pixi");

		const src = browser_source({ get_time: () => t.tick });
		inp.source(src);

		w.spawn(
			[pos, { x: 10, y: 10 }],
			[sprite_c, { texture: "__default__" }],
		);

		for (let i = 0; i < 60; i++) {
			t.advance(1 / 60);
			sch.run("update", w, ctx);
			sch.run("post", w, ctx);
			sch.run("render", w, ctx);
		}

		expect(world_container.children.length).toBeGreaterThan(0);

		src.dispose();
		pal_ui.dispose();
	});

	test("pos_c canonical: sprite tracks position changes through sprite_sync_system without override", () => {
		const w = world();
		const sch = schedule();
		const t = time();
		const r = rng(1);
		const res = resources();
		const a = assets({ fixed_dt: t.fixed_dt, register_default: true });
		res.set(atlas_registry_r, a.registry());

		const world_container = new Container();
		const ctx: Ctx = {
			time: t,
			rng: r,
			res,
			input: input(),
			debug: debug({ enabled: false }),
			palette: palette(),
		};

		sch.add("post", sprite_sync_system({ assets: a, world_container, pos_component: pos_c }), "sprite");

		const id = w.spawn(
			[pos_c, { x: 0, y: 0 }],
			[sprite_c, { texture: "__default__" }],
		);

		const move_system = (world_in: typeof w): void => {
			for (const [eid, p] of world_in.query([pos_c] as const)) {
				world_in.set(eid, pos_c, { x: p.x + 1, y: p.y + 2 });
			}
		};

		for (let i = 0; i < 5; i++) {
			move_system(w);
			sch.run("post", w, ctx);
		}

		const sd = w.get(id, sprite_c);
		expect(sd.ok).toBe(true);
		const node = sprite_node_for(w, id);
		expect(node).toBeDefined();
		expect(node!.position.x).toBe(5);
		expect(node!.position.y).toBe(10);
	});
});
