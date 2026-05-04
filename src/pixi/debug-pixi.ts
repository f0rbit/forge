import { Container, Graphics, Text, type TextStyleOptions } from "pixi.js";
import type { System } from "../schedule.ts";
import type { Color, DebugCmd, DebugStats, Pin } from "../debug/types.ts";
import { is_dev } from "../debug/debug.ts";

const COLOR_HEX: Record<string, number> = {
	white: 0xffffff,
	black: 0x000000,
	red: 0xff4444,
	green: 0x44ff44,
	blue: 0x4488ff,
	yellow: 0xffff44,
	cyan: 0x44ffff,
	magenta: 0xff44ff,
	grey: 0x888888,
	gray: 0x888888,
};

const color_to_hex = (c: Color): number => {
	const lower = c.toLowerCase();
	if (lower in COLOR_HEX) return COLOR_HEX[lower] ?? 0xffffff;
	if (lower.startsWith("#")) {
		const n = Number.parseInt(lower.slice(1), 16);
		return Number.isFinite(n) ? n : 0xffffff;
	}
	return 0xffffff;
};

export type DebugPixiOpts = {
	overlay: Container;
	dev?: boolean;
	hud?: boolean;
};

const HUD_STYLE: TextStyleOptions = {
	fontFamily: "monospace",
	fontSize: 12,
	fill: 0xffffff,
};

const TEXT_STYLE: TextStyleOptions = {
	fontFamily: "monospace",
	fontSize: 11,
	fill: 0xffffff,
};

const draw_cmd = (g: Graphics, cmd: DebugCmd): void => {
	const color = color_to_hex(cmd.color);
	if (cmd.kind === "line") {
		g.moveTo(cmd.a.x, cmd.a.y);
		g.lineTo(cmd.b.x, cmd.b.y);
		g.stroke({ color, width: 1 });
		return;
	}
	if (cmd.kind === "circle") {
		g.circle(cmd.center.x, cmd.center.y, cmd.r);
		g.stroke({ color, width: 1 });
		return;
	}
	if (cmd.kind === "rect") {
		g.rect(cmd.x, cmd.y, cmd.w, cmd.h);
		g.stroke({ color, width: 1 });
		return;
	}
};

const format_hud = (stats: DebugStats, scale: number): string => {
	const lines: string[] = [];
	lines.push(`tick ${stats.tick}`);
	lines.push(`fps  ${stats.fps.toFixed(1)}`);
	lines.push(`ents ${stats.entities}`);
	lines.push(`scale ${scale.toFixed(2)}`);
	const sys = stats.system_us;
	const keys = Object.keys(sys).sort();
	for (const k of keys.slice(0, 6)) {
		lines.push(`${k} ${sys[k]?.toFixed(0) ?? 0}us`);
	}
	return lines.join("\n");
};

const format_pin = (pin: Pin): string => {
	if (pin.kind === "label") return String(pin.data);
	if (pin.kind === "box") return `[box:${JSON.stringify(pin.data)}]`;
	return `[arrow:${JSON.stringify(pin.data)}]`;
};

export const debug_pixi = (opts: DebugPixiOpts): System => {
	const dev = opts.dev ?? is_dev();
	if (!dev) return () => {};

	const shapes = new Graphics();
	opts.overlay.addChild(shapes);

	const text_layer = new Container();
	opts.overlay.addChild(text_layer);

	const text_pool: Text[] = [];
	let text_used = 0;

	const acquire_text = (): Text => {
		if (text_used < text_pool.length) {
			const t = text_pool[text_used] as Text;
			text_used += 1;
			t.visible = true;
			return t;
		}
		const t = new Text({ text: "", style: TEXT_STYLE });
		text_pool.push(t);
		text_layer.addChild(t);
		text_used += 1;
		return t;
	};

	const reset_texts = (): void => {
		for (let i = text_used; i < text_pool.length; i++) {
			const t = text_pool[i] as Text;
			t.visible = false;
		}
		text_used = 0;
	};

	const hud_text = opts.hud === false ? null : new Text({ text: "", style: HUD_STYLE });
	if (hud_text) {
		hud_text.position.set(8, 8);
		opts.overlay.addChild(hud_text);
	}

	return (w, ctx) => {
		opts.overlay.visible = ctx.debug.enabled();
		if (!ctx.debug.enabled()) {
			ctx.debug.frame();
			return;
		}

		shapes.clear();
		reset_texts();

		const cmds = ctx.debug.frame();
		for (const cmd of cmds) {
			if (cmd.kind === "text") {
				const t = acquire_text();
				t.text = cmd.text;
				t.style.fill = color_to_hex(cmd.color);
				t.position.set(cmd.pos.x, cmd.pos.y);
			} else {
				draw_cmd(shapes, cmd);
			}
		}

		const pins = ctx.debug.pinned();
		for (const pin of pins) {
			const t = acquire_text();
			t.text = format_pin(pin);
			t.position.set(0, 0);
		}

		ctx.debug.tick_stats(w, ctx.time, ctx.debug.stats().fps);
		if (hud_text) {
			hud_text.text = format_hud(ctx.debug.stats(), ctx.time.scale);
		}
	};
};
