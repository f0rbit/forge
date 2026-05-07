import { ok, err, type Result } from "@f0rbit/corpus";
import { z } from "zod";
import type { EngineError } from "./errors.ts";
import { internal, type Component, type World, type Id } from "./world.ts";
import type { ResKey } from "./resources.ts";
import { resource_name } from "./resources.ts";
import type { Time } from "./time.ts";
import type { Rng } from "./rng.ts";

const entity_snap_schema = z.object({
	id: z.number().int().nonnegative(),
	components: z.record(z.string(), z.unknown()),
});

const meta_schema = z.object({
	tick: z.number().int().nonnegative(),
	rng_state: z.number().int(),
	rng_seed: z.number().int(),
});

export const snapshot_schema = z.object({
	version: z.literal(1),
	meta: meta_schema,
	entities: z.array(entity_snap_schema),
	resources: z.record(z.string(), z.unknown()),
});

export type Snapshot = z.infer<typeof snapshot_schema>;
export type SnapshotMeta = z.infer<typeof meta_schema>;
export type EntitySnap = z.infer<typeof entity_snap_schema>;

export type Snapshotter = {
	register: <T>(c: Component<T>, schema?: z.ZodType<T>) => Snapshotter;
	register_resource: <T>(k: ResKey<T>, schema?: z.ZodType<T>) => Snapshotter;
	take: (w: World, opts: TakeOpts) => Result<Snapshot, EngineError>;
	restore: (w: World, snap: Snapshot, opts: RestoreOpts) => Result<void, EngineError>;
};

export type TakeOpts = {
	time: Time;
	rng: Rng;
	res: import("./resources.ts").Resources;
};

export type RestoreOpts = {
	time?: Time;
	rng?: Rng;
	res?: import("./resources.ts").Resources;
};

type ComponentEntry = { component: Component<any>; schema?: z.ZodType<any> };
type ResourceEntry = { key: ResKey<any>; name: string; schema?: z.ZodType<any> };

export const snapshotter = (): Snapshotter => {
	const components_by_name = new Map<string, ComponentEntry>();
	const resources_by_name = new Map<string, ResourceEntry>();

	const api: Snapshotter = {
		register: <T>(c: Component<T>, schema?: z.ZodType<T>): Snapshotter => {
			components_by_name.set(c.name, { component: c, schema });
			return api;
		},
		register_resource: <T>(k: ResKey<T>, schema?: z.ZodType<T>): Snapshotter => {
			const name = resource_name(k);
			resources_by_name.set(name, { key: k, name, schema });
			return api;
		},
		take: (w, opts) => take(w, opts, components_by_name, resources_by_name),
		restore: (w, snap, opts) => restore(w, snap, opts, components_by_name, resources_by_name),
	};
	return api;
};

const take = (
	w: World,
	opts: TakeOpts,
	components_by_name: ReadonlyMap<string, ComponentEntry>,
	resources_by_name: ReadonlyMap<string, ResourceEntry>,
): Result<Snapshot, EngineError> => {
	const wi = w[internal];
	const stores = wi.stores();

	const ids = new Set<number>();
	const by_id = new Map<number, Record<string, unknown>>();

	for (const entry of components_by_name.values()) {
		const store = stores.get(entry.component.key);
		if (!store) continue;
		for (const [id, raw] of store as ReadonlyMap<Id, unknown>) {
			const data = entry.schema ? entry.schema.safeParse(raw) : { success: true, data: raw } as const;
			if (!data.success) {
				return err({ kind: "snapshot_validation_failed", issues: data.error.issues.map(i => `${entry.component.name}: ${i.path.join(".")}: ${i.message}`) });
			}
			const num_id = id as unknown as number;
			ids.add(num_id);
			const bag = by_id.get(num_id) ?? {};
			bag[entry.component.name] = data.success ? data.data : raw;
			by_id.set(num_id, bag);
		}
	}

	const sorted = Array.from(ids).sort((a, b) => a - b);
	const entities: EntitySnap[] = sorted.map(id => ({ id, components: by_id.get(id) ?? {} }));

	const resources_out: Record<string, unknown> = {};
	for (const entry of resources_by_name.values()) {
		const r = opts.res.get(entry.key);
		if (!r.ok) continue;
		const validated = entry.schema ? entry.schema.safeParse(r.value) : { success: true, data: r.value } as const;
		if (!validated.success) {
			return err({ kind: "snapshot_validation_failed", issues: validated.error.issues.map(i => `${entry.name}: ${i.path.join(".")}: ${i.message}`) });
		}
		resources_out[entry.name] = validated.data;
	}

	return ok({
		version: 1,
		meta: {
			tick: opts.time.tick,
			rng_state: opts.rng.state(),
			rng_seed: opts.rng.seed,
		},
		entities,
		resources: resources_out,
	});
};

const restore = (
	w: World,
	snap: Snapshot,
	opts: RestoreOpts,
	components_by_name: ReadonlyMap<string, ComponentEntry>,
	resources_by_name: ReadonlyMap<string, ResourceEntry>,
): Result<void, EngineError> => {
	if (snap.version !== 1) {
		return err({ kind: "snapshot_version_mismatch", expected: 1, got: snap.version });
	}

	const validated = snapshot_schema.safeParse(snap);
	if (!validated.success) {
		return err({ kind: "snapshot_validation_failed", issues: validated.error.issues.map(i => `${i.path.join(".")}: ${i.message}`) });
	}

	const wi = w[internal];
	wi.clear();

	for (const ent of snap.entities) {
		const tuples: Array<readonly [Component<any>, unknown]> = [];
		for (const [name, data] of Object.entries(ent.components)) {
			const entry = components_by_name.get(name);
			if (!entry) {
				return err({ kind: "component_not_registered", component: name });
			}
			const decoded = entry.schema ? entry.schema.safeParse(data) : { success: true, data } as const;
			if (!decoded.success) {
				return err({ kind: "snapshot_validation_failed", issues: decoded.error.issues.map(i => `${name}: ${i.path.join(".")}: ${i.message}`) });
			}
			tuples.push([entry.component, decoded.data] as const);
		}
		wi.spawn_at(ent.id as Id, ...(tuples as unknown as readonly (readonly [Component<any>, any])[]));
	}

	for (const [name, data] of Object.entries(snap.resources)) {
		const entry = resources_by_name.get(name);
		if (!entry) {
			return err({ kind: "resource_not_registered", resource: name });
		}
		if (!opts.res) continue;
		const decoded = entry.schema ? entry.schema.safeParse(data) : { success: true, data } as const;
		if (!decoded.success) {
			return err({ kind: "snapshot_validation_failed", issues: decoded.error.issues.map(i => `${name}: ${i.path.join(".")}: ${i.message}`) });
		}
		opts.res.set(entry.key, decoded.data);
	}

	if (opts.rng) opts.rng.restore(snap.meta.rng_state);
	if (opts.time) opts.time.restore?.(snap.meta.tick);

	return ok(undefined);
};
