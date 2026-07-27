// @ts-expect-error - Bun bundled package, types resolve at runtime
import { StorageManager, Watcher, Notifier, Scheduler } from "marktplaats-js";

const STORAGE_PATH = "./data/watches.json";

// Singletons live on globalThis so Vite dev-server module reloads reuse the same
// instances instead of starting extra schedulers with divergent in-memory copies.
type Singletons = {
	storage?: InstanceType<typeof StorageManager>;
	watcher?: InstanceType<typeof Watcher>;
	notifier?: InstanceType<typeof Notifier>;
	scheduler?: InstanceType<typeof Scheduler>;
};

const g = globalThis as typeof globalThis & { __mpWatches?: Singletons };
const singletons = (g.__mpWatches ??= {});

function getStorage() {
	if (!singletons.storage) singletons.storage = new StorageManager(STORAGE_PATH);
	return singletons.storage;
}

function getWatcher() {
	if (!singletons.watcher) singletons.watcher = new Watcher(getStorage());
	return singletons.watcher;
}

function getNotifier() {
	if (!singletons.notifier) singletons.notifier = new Notifier();
	return singletons.notifier;
}

export function startScheduler() {
	if (!singletons.scheduler) {
		singletons.scheduler = new Scheduler(getStorage(), getWatcher(), getNotifier());
		singletons.scheduler.start();
	}
	return singletons.scheduler;
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
	const watches = storage.getWatchesByUser(userId).filter((w: { enabled: boolean }) => w.enabled);
	let total = 0;

	for (const watch of watches) {
		const events = await getWatcher().poll(watch);
		await getNotifier().sendAll(watch, events);
		total += events.length;
	}

	return { watchesPolled: watches.length, eventsTotal: total };
}
