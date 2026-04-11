// @ts-expect-error - Bun bundled package, types resolve at runtime
import { StorageManager, Watcher, Notifier } from "marktplaats-js";

const STORAGE_PATH = "./data/watches.json";

let _storage: InstanceType<typeof StorageManager> | null = null;
let _watcher: InstanceType<typeof Watcher> | null = null;
let _notifier: InstanceType<typeof Notifier> | null = null;

function getStorage() {
	if (!_storage) _storage = new StorageManager(STORAGE_PATH);
	return _storage;
}

function getWatcher() {
	if (!_watcher) _watcher = new Watcher(getStorage());
	return _watcher;
}

function getNotifier() {
	if (!_notifier) _notifier = new Notifier();
	return _notifier;
}

export const storage = {
	getWatches: () => getStorage().getWatches(),
	getWatch: (id: string) => getStorage().getWatch(id),
	getWatchesByUser: (userId: string) => getStorage().getWatchesByUser(userId),
	getWatchByUser: (id: string, userId: string) => getStorage().getWatchByUser(id, userId),
	getEnabledWatches: () => getStorage().getEnabledWatches(),
	addWatch: (watch: any) => getStorage().addWatch(watch),
	updateWatch: (id: string, updates: any) => getStorage().updateWatch(id, updates),
	deleteWatch: (id: string) => getStorage().deleteWatch(id),
	getState: (id: string) => getStorage().getState(id),
};

export async function pollWatch(watchId: string) {
	const watch = storage.getWatch(watchId);
	if (!watch) return null;

	const events = await getWatcher().poll(watch);
	await getNotifier().sendAll(watch, events);
	return events.length;
}

export async function pollWatchByUser(watchId: string, userId: string) {
	const watch = storage.getWatchByUser(watchId, userId);
	if (!watch) return null;

	const events = await getWatcher().poll(watch);
	await getNotifier().sendAll(watch, events);
	return events.length;
}

export async function pollAllWatches() {
	const watches = storage.getEnabledWatches();
	let total = 0;

	for (const watch of watches) {
		const events = await getWatcher().poll(watch);
		await getNotifier().sendAll(watch, events);
		total += events.length;
	}

	return { watchesPolled: watches.length, eventsTotal: total };
}

export async function pollAllWatchesByUser(userId: string) {
	const watches = storage.getWatchesByUser(userId).filter((w) => w.enabled);
	let total = 0;

	for (const watch of watches) {
		const events = await getWatcher().poll(watch);
		await getNotifier().sendAll(watch, events);
		total += events.length;
	}

	return { watchesPolled: watches.length, eventsTotal: total };
}
