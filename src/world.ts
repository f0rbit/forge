import { ok, err, type Result } from "@f0rbit/corpus";
import type { EngineError } from "./errors.ts";

export type Id = number & { readonly __id: unique symbol };

export type Component<T> = { readonly key: symbol; readonly name: string; readonly __t?: T };

export const component = <T>(name: string): Component<T> => ({ key: Symbol(name), name });

export type ComponentTuple<C extends readonly Component<any>[]> = {
	[K in keyof C]: C[K] extends Component<infer T> ? T : never;
};

type SpawnTuple = readonly [Component<any>, any];
type SpawnArgs = readonly SpawnTuple[];

export type QueryOpts = {
	without?: readonly Component<any>[];
};

export type Query<C extends readonly Component<any>[]> = {
	each: (fn: (id: Id, ...data: ComponentTuple<C>) => void) => void;
	collect: () => Array<readonly [Id, ...ComponentTuple<C>]>;
	[Symbol.iterator]: () => Iterator<readonly [Id, ...ComponentTuple<C>]>;
};

export const internal = Symbol("forge.world.internal");

export type WorldInternal = {
	components_of: (id: Id) => readonly Component<any>[];
	stores: () => ReadonlyMap<symbol, ReadonlyMap<Id, unknown>>;
	clear: () => void;
};

export type World = {
	spawn: (...components: SpawnArgs) => Id;
	spawn_at: (id: Id, ...components: SpawnArgs) => void;
	despawn: (id: Id) => Result<void, EngineError>;
	has: (id: Id, c: Component<any>) => boolean;
	get: <T>(id: Id, c: Component<T>) => Result<T, EngineError>;
	set: <T>(id: Id, c: Component<T>, data: T) => Result<void, EngineError>;
	remove: (id: Id, c: Component<any>) => Result<void, EngineError>;
	query: <C extends readonly Component<any>[]>(cs: C, opts?: QueryOpts) => Query<C>;
	count: () => number;
	[internal]: WorldInternal;
};

export const world = (): World => {
	const stores = new Map<symbol, Map<Id, unknown>>();
	const components_by_key = new Map<symbol, Component<any>>();
	const entities = new Set<Id>();
	let next_id = 1;

	const get_store = (c: Component<any>): Map<Id, unknown> => {
		const existing = stores.get(c.key);
		if (existing) return existing;
		const fresh = new Map<Id, unknown>();
		stores.set(c.key, fresh);
		components_by_key.set(c.key, c);
		return fresh;
	};

	const has = (id: Id, c: Component<any>): boolean => {
		const store = stores.get(c.key);
		return store ? store.has(id) : false;
	};

	const spawn = (...components: SpawnArgs): Id => {
		const id = next_id++ as Id;
		entities.add(id);
		for (const [c, data] of components) {
			get_store(c).set(id, data);
		}
		return id;
	};

	const spawn_at = (id: Id, ...components: SpawnArgs): void => {
		entities.add(id);
		for (const [c, data] of components) {
			get_store(c).set(id, data);
		}
		if ((id as unknown as number) >= next_id) next_id = (id as unknown as number) + 1;
	};

	const despawn = (id: Id): Result<void, EngineError> => {
		if (!entities.has(id)) return err({ kind: "entity_not_found", id });
		entities.delete(id);
		for (const store of stores.values()) store.delete(id);
		return ok(undefined);
	};

	const get_data = <T>(id: Id, c: Component<T>): Result<T, EngineError> => {
		const store = stores.get(c.key);
		if (!store || !store.has(id)) return err({ kind: "component_missing", id, component: c.name });
		return ok(store.get(id) as T);
	};

	const set_data = <T>(id: Id, c: Component<T>, data: T): Result<void, EngineError> => {
		if (!entities.has(id)) return err({ kind: "entity_not_found", id });
		get_store(c).set(id, data);
		return ok(undefined);
	};

	const remove = (id: Id, c: Component<any>): Result<void, EngineError> => {
		const store = stores.get(c.key);
		if (!store || !store.has(id)) return err({ kind: "component_missing", id, component: c.name });
		store.delete(id);
		return ok(undefined);
	};

	const query = <C extends readonly Component<any>[]>(cs: C, opts?: QueryOpts): Query<C> => {
		const without = opts?.without ?? [];

		const iterate = function* (): Generator<readonly [Id, ...ComponentTuple<C>]> {
			if (cs.length === 0) return;
			const required_stores = cs.map(c => stores.get(c.key));
			if (required_stores.some(s => !s)) return;

			let primary = required_stores[0] as Map<Id, unknown>;
			let primary_idx = 0;
			for (let i = 1; i < required_stores.length; i++) {
				const s = required_stores[i] as Map<Id, unknown>;
				if (s.size < primary.size) {
					primary = s;
					primary_idx = i;
				}
			}

			outer: for (const id of primary.keys()) {
				const data: unknown[] = new Array(cs.length);
				data[primary_idx] = primary.get(id);
				for (let i = 0; i < cs.length; i++) {
					if (i === primary_idx) continue;
					const s = required_stores[i] as Map<Id, unknown>;
					if (!s.has(id)) continue outer;
					data[i] = s.get(id);
				}
				for (const w of without) {
					const s = stores.get(w.key);
					if (s && s.has(id)) continue outer;
				}
				yield [id, ...(data as ComponentTuple<C>)] as const;
			}
		};

		return {
			each: fn => {
				for (const tuple of iterate()) {
					const [id, ...data] = tuple;
					fn(id, ...(data as ComponentTuple<C>));
				}
			},
			collect: () => Array.from(iterate()),
			[Symbol.iterator]: () => iterate(),
		};
	};

	const count = (): number => entities.size;

	return {
		spawn,
		spawn_at,
		despawn,
		has,
		get: get_data,
		set: set_data,
		remove,
		query,
		count,
		[internal]: {
			components_of: (id: Id) => {
				const out: Component<any>[] = [];
				for (const [key, store] of stores) {
					if (store.has(id)) {
						const c = components_by_key.get(key);
						if (c) out.push(c);
					}
				}
				return out;
			},
			stores: () => stores as unknown as ReadonlyMap<symbol, ReadonlyMap<Id, unknown>>,
			clear: () => {
				entities.clear();
				for (const store of stores.values()) store.clear();
				next_id = 1;
			},
		},
	};
};
