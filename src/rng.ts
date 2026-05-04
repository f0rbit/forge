import { ok, err, type Result } from "@f0rbit/corpus";
import type { EngineError } from "./errors.ts";

export type Rng = {
	readonly seed: number;
	next: () => number;
	int: (min: number, max: number) => number;
	pick: <T>(arr: readonly T[]) => Result<T, EngineError>;
	fork: (label: string) => Rng;
	state: () => number;
	restore: (s: number) => void;
};

const mix32 = (h: number, label: string): number => {
	let s = h | 0;
	for (let i = 0; i < label.length; i++) {
		s = Math.imul(s ^ label.charCodeAt(i), 2654435761) | 0;
		s = (s << 13) | (s >>> 19);
	}
	return s >>> 0;
};

const mulberry32 = (seed: number) => {
	let s = seed >>> 0;
	const next = (): number => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	return {
		next,
		state: () => s,
		restore: (v: number) => {
			s = v >>> 0;
		},
	};
};

export const rng = (seed: number): Rng => {
	const m = mulberry32(seed);
	const api: Rng = {
		seed,
		next: m.next,
		int: (min, max) => {
			const lo = Math.ceil(min);
			const hi = Math.floor(max);
			return lo + Math.floor(m.next() * (hi - lo + 1));
		},
		pick: <T>(arr: readonly T[]): Result<T, EngineError> => {
			if (arr.length === 0) return err({ kind: "empty_array" });
			const idx = Math.floor(m.next() * arr.length);
			return ok(arr[idx] as T);
		},
		fork: label => rng(mix32(m.state(), label)),
		state: () => m.state(),
		restore: m.restore,
	};
	return api;
};
