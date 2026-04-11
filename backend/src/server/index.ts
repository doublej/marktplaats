import { createServer } from "./api.js";
import { Notifier } from "./notifier.js";
import { Scheduler } from "./scheduler.js";
import { StorageManager } from "./storage.js";
import type { ServerConfig } from "./types.js";
import { Watcher } from "./watcher.js";

const config: ServerConfig = {
	storagePath: process.env.WATCH_STORAGE_PATH ?? "./marktplaats-watches.json",
	port: Number(process.env.PORT ?? 3000),
	host: process.env.HOST ?? "localhost",
};

const storage = new StorageManager(config.storagePath);
const notifier = new Notifier();
const watcher = new Watcher(storage);
const scheduler = new Scheduler(storage, watcher, notifier);

const server = createServer(config, storage, scheduler);
scheduler.start();

console.log(`Watch server running on http://${config.host}:${config.port}`);
console.log(`Storage: ${config.storagePath}`);
console.log(`Watches: ${storage.getWatches().length} configured`);

process.on("SIGINT", () => {
	scheduler.stop();
	server.stop();
	process.exit(0);
});
