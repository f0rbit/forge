import { create_memory_backend } from "@f0rbit/corpus";
import { z } from "zod";
import { store, type StoreOpts } from "./store.ts";
import type { Store } from "./types.ts";

export type MemOpts<T> = {
	schema: z.ZodType<T>;
	id?: string;
};

export const mem = <T>(opts: MemOpts<T>): Store<T> => {
	const store_opts: StoreOpts<T> = {
		backend: create_memory_backend(),
		schema: opts.schema,
		id: opts.id,
	};
	return store(store_opts);
};
