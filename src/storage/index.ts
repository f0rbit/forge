// TODO(P3): export store factory (records-of-functions: store.save, store.load, store.history, store.bindings, store.prefs)
// TODO(P3): export Slot, Snap, EngineStore, StoreError types
// TODO(P3): export slots, autosave, migrate helpers
//
// Wraps @f0rbit/corpus. v1 backends: mem + file only. IndexedDB / Cloudflare are post-v1.
// Every async boundary returns Promise<Result<T, StoreError>>.

export {};
