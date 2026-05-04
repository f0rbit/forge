import { Container, Graphics, Text, type TextStyleOptions } from "pixi.js";
import type { System } from "../schedule.ts";
import type { Palette } from "../palette/palette.ts";
import type { CommandError } from "../palette/types.ts";
import type { Ctx } from "../schedule.ts";

export type PalettePixiOpts = {
	overlay: Container;
	palette: Palette;
	get_ctx: () => Ctx;
	width?: number;
	height?: number;
	max_hits?: number;
	toggle_action?: string;
	get_screen?: () => { w: number; h: number };
};

type PaletteUI = {
	system: System;
	dispose: () => void;
	type: (text: string) => void;
	backspace: () => void;
	submit: () => Promise<void>;
	close: () => void;
	open: () => void;
	state: () => { open: boolean; query: string; hits: readonly string[]; result: string | null };
};

const PROMPT = "> ";

const INPUT_STYLE: TextStyleOptions = {
	fontFamily: "monospace",
	fontSize: 16,
	fill: 0xffffff,
};

const HIT_STYLE: TextStyleOptions = {
	fontFamily: "monospace",
	fontSize: 13,
	fill: 0xcccccc,
};

const RESULT_STYLE_OK: TextStyleOptions = {
	fontFamily: "monospace",
	fontSize: 13,
	fill: 0x44ff88,
};

const RESULT_STYLE_ERR: TextStyleOptions = {
	fontFamily: "monospace",
	fontSize: 13,
	fill: 0xff8844,
};

const format_err = (e: CommandError): string => {
	if (e.kind === "unknown_command") return `unknown: ${e.name}`;
	if (e.kind === "parse") return `parse: ${e.message}`;
	if (e.kind === "validation") return `args: ${e.issues.join(", ")}`;
	return `error: ${e.message}`;
};

export const palette_pixi = (opts: PalettePixiOpts): PaletteUI => {
	const width = opts.width ?? 480;
	const height = opts.height ?? 32;
	const max_hits = opts.max_hits ?? 6;

	const panel = new Graphics();
	panel.rect(0, 0, width, height + max_hits * 16 + 24).fill({ color: 0x000000, alpha: 0.85 });
	opts.overlay.addChild(panel);

	const input_text = new Text({ text: PROMPT, style: INPUT_STYLE });
	input_text.position.set(8, 6);
	opts.overlay.addChild(input_text);

	const hits_container = new Container();
	hits_container.position.set(8, height);
	opts.overlay.addChild(hits_container);

	const result_text = new Text({ text: "", style: RESULT_STYLE_OK });
	result_text.position.set(8, height + max_hits * 16);
	opts.overlay.addChild(result_text);

	let query = "";
	let result_msg: string | null = null;
	let result_ok = true;
	let result_until_tick = 0;
	let history_offset = 0;

	const refresh_hits = (): void => {
		hits_container.removeChildren();
		const hits = opts.palette.search(query).slice(0, max_hits);
		for (let i = 0; i < hits.length; i++) {
			const h = hits[i];
			if (!h) continue;
			const t = new Text({ text: `  ${h.command.name}`, style: HIT_STYLE });
			t.position.set(0, i * 16);
			hits_container.addChild(t);
		}
	};

	const refresh_input = (): void => {
		input_text.text = PROMPT + query;
	};

	refresh_hits();

	const do_open = (): void => {
		opts.overlay.visible = true;
		if (!opts.palette.open()) opts.palette.toggle();
	};
	const do_close = (): void => {
		opts.overlay.visible = false;
		if (opts.palette.open()) opts.palette.toggle();
	};

	const submit = async (): Promise<void> => {
		const line = query.trim();
		if (line.length === 0) {
			do_close();
			return;
		}
		const ctx = opts.get_ctx();
		const r = await opts.palette.exec(line, ctx);
		if (r.ok) {
			result_msg = r.value;
			result_ok = true;
		} else {
			result_msg = format_err(r.error);
			result_ok = false;
		}
		result_until_tick = ctx.time.tick + 120;
		query = "";
		history_offset = 0;
		refresh_input();
		refresh_hits();
		do_close();
	};

	const recall = (delta: number): void => {
		history_offset = Math.max(0, history_offset + delta);
		const item = opts.palette.recall(history_offset);
		if (item !== undefined) {
			query = item;
			refresh_input();
			refresh_hits();
		}
	};

	const handler = (e: Event): void => {
		const ke = e as KeyboardEvent;
		const action = opts.toggle_action ?? "palette.toggle";
		if (ke.key === "`" || ke.code === "Backquote") {
			if (opts.palette.open()) do_close();
			else do_open();
			ke.preventDefault?.();
			return;
		}
		if (!opts.palette.open()) return;
		if (ke.key === "Escape") {
			do_close();
			return;
		}
		if (ke.key === "Enter") {
			void submit();
			return;
		}
		if (ke.key === "Backspace") {
			query = query.slice(0, -1);
			refresh_input();
			refresh_hits();
			return;
		}
		if (ke.key === "ArrowUp") {
			recall(1);
			return;
		}
		if (ke.key === "ArrowDown") {
			recall(-1);
			return;
		}
		if (ke.key && ke.key.length === 1 && !ke.ctrlKey && !ke.metaKey && !ke.altKey) {
			query += ke.key;
			refresh_input();
			refresh_hits();
			return;
		}
		void action;
	};

	const target = (globalThis as { window?: Window }).window;
	if (target && typeof target.addEventListener === "function") {
		target.addEventListener("keydown", handler);
	}

	const system: System = (_w, ctx) => {
		opts.overlay.visible = opts.palette.open() || (result_msg !== null && ctx.time.tick < result_until_tick);
		if (result_msg !== null) {
			if (ctx.time.tick >= result_until_tick) {
				result_msg = null;
				result_text.text = "";
			} else {
				result_text.text = result_msg;
				result_text.style = result_ok ? RESULT_STYLE_OK : RESULT_STYLE_ERR;
			}
		} else {
			result_text.text = "";
		}
	};

	return {
		system,
		dispose: () => {
			if (target && typeof target.removeEventListener === "function") {
				target.removeEventListener("keydown", handler);
			}
		},
		type: text => {
			query += text;
			refresh_input();
			refresh_hits();
		},
		backspace: () => {
			query = query.slice(0, -1);
			refresh_input();
			refresh_hits();
		},
		submit,
		close: do_close,
		open: do_open,
		state: () => ({
			open: opts.palette.open(),
			query,
			hits: opts.palette.search(query).slice(0, max_hits).map(h => h.command.name),
			result: result_msg,
		}),
	};
};
