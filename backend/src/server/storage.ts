import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Storage, WatchConfig, WatchState } from "./types.js";
import { StorageSchema } from "./types.js";

function emptyStorage(): Storage {
	return { version: 1, watches: [], states: {} };
}

export class StorageManager {
	private data: Storage;

	constructor(private readonly path: string) {
		this.data = this.load();
	}

	private load(): Storage {
		if (!existsSync(this.path)) return emptyStorage();
		const raw = readFileSync(this.path, "utf-8");
		return StorageSchema.parse(JSON.parse(raw));
	}

	private save(): void {
		writeFileSync(this.path, JSON.stringify(this.data, null, 2));
	}

	getWatches(): WatchConfig[] {
		return this.data.watches;
	}

	getEnabledWatches(): WatchConfig[] {
		return this.data.watches.filter((w) => w.enabled);
	}

	getWatch(id: string): WatchConfig | undefined {
		return this.data.watches.find((w) => w.id === id);
	}

	getWatchesByUser(userId: string): WatchConfig[] {
		return this.data.watches.filter((w) => w.userId === userId);
	}

	getWatchByUser(id: string, userId: string): WatchConfig | undefined {
		return this.data.watches.find((w) => w.id === id && w.userId === userId);
	}

	addWatch(watch: WatchConfig): void {
		this.data.watches.push(watch);
		this.data.states[watch.id] = { watchId: watch.id, lastPolledAt: null, listings: {} };
		this.save();
	}

	updateWatch(id: string, updates: Partial<WatchConfig>): WatchConfig | undefined {
		const idx = this.data.watches.findIndex((w) => w.id === id);
		if (idx === -1) return undefined;
		this.data.watches[idx] = { ...this.data.watches[idx], ...updates } as WatchConfig;
		this.save();
		return this.data.watches[idx];
	}

	deleteWatch(id: string): boolean {
		const idx = this.data.watches.findIndex((w) => w.id === id);
		if (idx === -1) return false;
		this.data.watches.splice(idx, 1);
		delete this.data.states[id];
		this.save();
		return true;
	}

	getState(watchId: string): WatchState {
		return this.data.states[watchId] ?? { watchId, lastPolledAt: null, listings: {} };
	}

	saveState(state: WatchState): void {
		this.data.states[state.watchId] = state;
		this.save();
	}
}
