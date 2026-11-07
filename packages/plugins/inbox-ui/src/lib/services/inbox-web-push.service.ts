import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { base64UrlToBytes, supportsWebPush } from './web-push.helpers';

const DEVICES = `${API_PREFIX}/inbox/push-subscriptions`;

/** The worker that shows pushed inbox entries (`apps/gauzy/src/assets`), and the scope it is registered for. */
export const INBOX_PUSH_WORKER_PATH = 'assets/inbox-push-sw.js';
export const INBOX_PUSH_WORKER_SCOPE = 'assets/';

/**
 * Where this browser stands: `unavailable` (the platform has web push off), `unsupported` (the browser cannot),
 * `blocked` (the person refused notifications for the site), `off`, `on`.
 */
export type InboxWebPushState = 'unavailable' | 'unsupported' | 'blocked' | 'off' | 'on';

interface IInboxPushDevice {
	id: string;
	endpoint: string;
}

/**
 * Browser notifications for the inbox on this device, over the platform's web push devices
 * (`/api/inbox/push-subscriptions`: the VAPID public key, my devices). The routes answer 404 where web push is off.
 */
@Injectable({ providedIn: 'root' })
export class InboxWebPushService {
	private readonly http = inject(HttpClient);

	/** Where this browser stands; a subscribed browser is registered again (the platform may have removed it). */
	async state(): Promise<InboxWebPushState> {
		if (!supportsWebPush()) return 'unsupported';
		try {
			await this.publicKey();
		} catch (error) {
			return (error as { status?: number })?.status === 404 ? 'unavailable' : 'off';
		}
		if (Notification.permission === 'denied') return 'blocked';
		const subscription = await this.subscription().catch(() => null);
		if (subscription && Notification.permission === 'granted') {
			// A failed re-registration shows off: switching on sets the device up again.
			return this.register(subscription).then(
				() => 'on' as const,
				() => 'off' as const
			);
		}
		return 'off';
	}

	/** Asks for permission, registers the worker, subscribes with the platform's key and registers the device. */
	async enable(): Promise<InboxWebPushState> {
		const permission = await Notification.requestPermission();
		if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
		const registration = await navigator.serviceWorker.register(this.urlOf(INBOX_PUSH_WORKER_PATH), { scope: this.urlOf(INBOX_PUSH_WORKER_SCOPE) });
		const publicKey = await this.publicKey();
		const subscription =
			(await registration.pushManager.getSubscription()) ??
			(await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) as BufferSource }));
		try {
			await this.register(subscription);
		} catch (error) {
			// Not registered: the browser must not keep a subscription the platform never pushes to.
			await subscription.unsubscribe().catch(() => undefined);
			throw error;
		}
		return 'on';
	}

	/** Removes this device from the platform and unsubscribes the browser. */
	async disable(): Promise<InboxWebPushState> {
		const subscription = await this.subscription();
		if (subscription) {
			const devices = await firstValueFrom(this.http.get<IInboxPushDevice[]>(DEVICES)).catch(() => [] as IInboxPushDevice[]);
			const device = (devices ?? []).find((candidate) => candidate.endpoint === subscription.endpoint);
			if (device) await firstValueFrom(this.http.delete(`${DEVICES}/${encodeURIComponent(device.id)}`));
			await subscription.unsubscribe();
		}
		return 'off';
	}

	private async publicKey(): Promise<string> {
		const answer = await firstValueFrom(this.http.get<{ publicKey: string }>(`${DEVICES}/public-key`));
		return answer.publicKey;
	}

	private async subscription(): Promise<PushSubscription | null> {
		const registration = await navigator.serviceWorker.getRegistration(this.urlOf(INBOX_PUSH_WORKER_SCOPE));
		return (await registration?.pushManager.getSubscription()) ?? null;
	}

	private register(subscription: PushSubscription): Promise<unknown> {
		const json = subscription.toJSON();
		return firstValueFrom(
			this.http.post(DEVICES, {
				endpoint: json.endpoint ?? subscription.endpoint,
				keys: { p256dh: json.keys?.['p256dh'] ?? '', auth: json.keys?.['auth'] ?? '' },
				expirationTime: typeof json.expirationTime === 'number' ? json.expirationTime : null,
				userAgent: navigator.userAgent.slice(0, 255)
			})
		);
	}

	/**
	 * The session ended on this browser (a sign-out): the browser unsubscribes, so the next person on a shared browser
	 * receives nothing of the previous account; the push service then refuses the platform's next push, and the
	 * platform drops the device. Never throws.
	 */
	async forgetThisBrowser(): Promise<void> {
		try {
			if (!supportsWebPush()) return;
			const subscription = await this.subscription();
			await subscription?.unsubscribe();
		} catch {
			// Nothing to undo.
		}
	}

	/** A path of the app, against its base (the app may be served below the site's root). */
	private urlOf(path: string): string {
		return new URL(path, document.baseURI).pathname;
	}
}
