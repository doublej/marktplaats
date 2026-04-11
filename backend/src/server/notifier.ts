import type { NotificationEvent, WatchConfig } from "./types.js";

export class Notifier {
	async send(watch: WatchConfig, event: NotificationEvent): Promise<boolean> {
		if (!watch.webhookUrl) return false;

		try {
			const response = await fetch(watch.webhookUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(event),
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	async sendAll(watch: WatchConfig, events: NotificationEvent[]): Promise<number> {
		let sent = 0;
		for (const event of events) {
			if (await this.send(watch, event)) sent++;
		}
		return sent;
	}
}
