import { ok, err, type Result } from "@f0rbit/corpus";
import type { EngineError } from "./errors.ts";

export type ResKey<T> = symbol & { readonly __res?: T };

const name_table = new Map<symbol, string>();

export const resource = <T>(name: string): ResKey<T> => {
	const key = Symbol(name) as ResKey<T>;
	name_table.set(key, name);
	return key;
};

export const resource_name = (k: ResKey<any>): string => name_table.get(k) ?? k.description ?? "<unnamed>";

export const is_named_resource = (k: ResKey<any>): boolean => name_table.has(k);

export type Resources = {
	set: <T>(k: ResKey<T>, v: T) => void;
	get: <T>(k: ResKey<T>) => Result<T, EngineError>;
	has: (k: ResKey<any>) => boolean;
	remove: (k: ResKey<any>) => void;
};

export const resources = (): Resources => {
	const store = new Map<symbol, unknown>();
	return {
		set: (k, v) => {
			store.set(k, v);
		},
		get: <T>(k: ResKey<T>): Result<T, EngineError> => {
			if (!store.has(k)) return err({ kind: "resource_missing", resource: resource_name(k) });
			return ok(store.get(k) as T);
		},
		has: k => store.has(k),
		remove: k => {
			store.delete(k);
		},
	};
};
