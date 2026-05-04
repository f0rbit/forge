import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { browser_source } from "../../src/pixi/input-browser.ts";

type Listener = { kind: string; fn: (ev: Event) => void };

class FakeTarget implements EventTarget {
	listeners: Listener[] = [];
	addEventListener(kind: string, fn: EventListenerOrEventListenerObject): void {
		this.listeners.push({ kind, fn: fn as (ev: Event) => void });
	}
	removeEventListener(kind: string, fn: EventListenerOrEventListenerObject): void {
		this.listeners = this.listeners.filter(l => !(l.kind === kind && l.fn === fn));
	}
	dispatchEvent(ev: Event): boolean {
		for (const l of this.listeners) {
			if (l.kind === ev.type) l.fn(ev);
		}
		return true;
	}
	emit(kind: string, payload: Record<string, unknown>): void {
		const ev = { type: kind, ...payload } as unknown as Event;
		this.dispatchEvent(ev);
	}
}

let original_navigator: { value: unknown; ok: boolean };

const set_pads = (pads: readonly (Partial<Gamepad> | null)[]): void => {
	(globalThis as unknown as { navigator: { getGamepads: () => readonly (Partial<Gamepad> | null)[] } }).navigator = {
		getGamepads: () => pads,
	};
};

beforeEach(() => {
	const desc = Object.getOwnPropertyDescriptor(globalThis, "navigator");
	original_navigator = desc ? { value: desc.value, ok: true } : { value: undefined, ok: false };
});

afterEach(() => {
	if (original_navigator.ok) {
		(globalThis as { navigator?: unknown }).navigator = original_navigator.value;
	} else {
		delete (globalThis as { navigator?: unknown }).navigator;
	}
});

describe("browser_source — keyboard", () => {
	test("keydown / keyup emits raw events", () => {
		const target = new FakeTarget();
		const src = browser_source({ target: target as unknown as HTMLElement });
		set_pads([]);
		target.emit("keydown", { code: "KeyW", repeat: false });
		target.emit("keyup", { code: "KeyW" });
		const evs = src.drain();
		expect(evs.length).toBe(2);
		expect(evs[0]?.kind).toBe("key.down");
		expect(evs[1]?.kind).toBe("key.up");
		src.dispose();
	});

	test("ignores key repeats", () => {
		const target = new FakeTarget();
		const src = browser_source({ target: target as unknown as HTMLElement });
		set_pads([]);
		target.emit("keydown", { code: "KeyW", repeat: true });
		expect(src.drain().length).toBe(0);
		src.dispose();
	});
});

describe("browser_source — mouse", () => {
	test("mouse buttons + move + wheel", () => {
		const target = new FakeTarget();
		const src = browser_source({ target: target as unknown as HTMLElement });
		set_pads([]);
		target.emit("mousedown", { button: 0, clientX: 1, clientY: 2 });
		target.emit("mouseup", { button: 0, clientX: 1, clientY: 2 });
		target.emit("mousemove", { clientX: 3, clientY: 4 });
		target.emit("wheel", { deltaX: 0, deltaY: 5 });
		const evs = src.drain();
		expect(evs.map(e => e.kind)).toEqual(["mouse.down", "mouse.up", "mouse.move", "wheel"]);
		src.dispose();
	});
});

describe("browser_source — gamepad", () => {
	test("polls connected pads and emits button + axis transitions", () => {
		const target = new FakeTarget();
		const src = browser_source({ target: target as unknown as HTMLElement, deadzone: 0.1 });
		const buttons_a = [{ value: 0 }, { value: 0 }];
		const axes_a = [0, 0];
		set_pads([{ buttons: buttons_a, axes: axes_a } as unknown as Gamepad]);
		src.poll_pads();
		expect(src.drain().length).toBe(0);

		const buttons_b = [{ value: 1 }, { value: 0 }];
		const axes_b = [0.5, 0];
		set_pads([{ buttons: buttons_b, axes: axes_b } as unknown as Gamepad]);
		const evs = src.drain();
		expect(evs.find(e => e.kind === "pad.button.down" && e.button === 0)).toBeDefined();
		expect(evs.find(e => e.kind === "pad.axis" && e.axis === 0 && e.value === 0.5)).toBeDefined();
		src.dispose();
	});

	test("applies deadzone to axes", () => {
		const target = new FakeTarget();
		const src = browser_source({ target: target as unknown as HTMLElement, deadzone: 0.5 });
		set_pads([{ buttons: [], axes: [0.3] } as unknown as Gamepad]);
		src.poll_pads();
		const evs = src.drain();
		expect(evs.filter(e => e.kind === "pad.axis").length).toBe(0);
		src.dispose();
	});
});

describe("browser_source — dispose", () => {
	test("removes registered listeners", () => {
		const target = new FakeTarget();
		const src = browser_source({ target: target as unknown as HTMLElement });
		expect(target.listeners.length).toBeGreaterThan(0);
		src.dispose();
		expect(target.listeners.length).toBe(0);
	});

	test("dispose is idempotent", () => {
		const target = new FakeTarget();
		const src = browser_source({ target: target as unknown as HTMLElement });
		src.dispose();
		src.dispose();
		expect(target.listeners.length).toBe(0);
	});
});
