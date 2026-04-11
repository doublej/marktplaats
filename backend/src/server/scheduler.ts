import type { Notifier } from "./notifier.js";
import type { StorageManager } from "./storage.js";
import type { WatchConfig } from "./types.js";
import type { Watcher } from "./watcher.js";

const CHECK_INTERVAL_MS = 60_000;

function shouldPoll(watch: WatchConfig, lastPolledAt: string | null): boolean {
	if (!lastPolledAt) return true;
	const elapsed = Date.now() - new Date(lastPolledAt).getTime();
	return elapsed >= watch.intervalMinutes * 60_000;
}

export class Scheduler {
	private timer: ReturnType<typeof setInterval> | null = null;
	private polling = false;

	constructor(
		private readonly storage: StorageManager,
		private readonly watcher: Watcher,
		private readonly notifier: Notifier,
	) {}

	start(): void {
		if (this.timer) return;
		this.timer = setInterval(() => this.tick(), CHECK_INTERVAL_MS);
		this.tick();
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	private async tick(): Promise<void> {
		if (this.polling) return;
		this.polling = true;

		try {
			for (const watch of this.storage.getEnabledWatches()) {
				const state = this.storage.getState(watch.id);
				if (!shouldPoll(watch, state.lastPolledAt)) continue;
				await this.pollWatch(watch);
			}
		} finally {
			this.polling = false;
		}
	}

	async pollWatch(watch: WatchConfig): Promise<number> {
		const events = await this.watcher.poll(watch);
		await this.notifier.sendAll(watch, events);
		return events.length;
	}
}
