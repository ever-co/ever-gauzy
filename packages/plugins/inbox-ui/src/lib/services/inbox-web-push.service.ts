import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { base64UrlToBytes, supportsWebPush } from './web-push.helpers';

const DEVICES = `${API_PREFIX}/inbox/push-subscriptions`;

/** The worker that shows pushed inbox entries (`apps/gauzy/src/assets`), and the scope it is registered for. */
export const INBOX_PUSH_WORKER_PATH = 'assets/inbox-push-sw.js';
export const INBOX_PUSH_WORKER_SCOPE = 'assets/';

/** Whose this browser's subscription is: the account that opted in, and its device on the platform. */
export const INBOX_PUSH_OWNER_KEY = 'gauzy-inbox-push-owner';

/**
 * Where this browser stands: `unavailable` (the platform has web push off), `unsupported` (the browser cannot),
 * `blocked` (the person refused notifications for the site), `off`, `on`.
 */
export type InboxWebPushState = 'unavailable' | 'unsupported' | 'blocked' | 'off' | 'on';

interface IInboxPushDevice {
	id: string;
	endpoint: string;
}

interface PushOwner {
	userId: string;
	deviceId: string | null;
	endpoint: string;
}

/**
 * Browser notifications for the inbox on this device, over the platform's web push devices
 * (`/api/inbox/push-subscriptions`: the VAPID public key, my devices). The routes answer 404 where web push is off.
 *
 * The subscription belongs to the account that opted in (kept in local storage with its device): another account on
 * the same browser starts with it off and has to opt in itself; a sign-out removes the device while the session still
 * allows it and unsubscribes the browser. Every step after a sign-out waits for that cleanup.
 */
@Injectable({ providedIn: 'root' })
export class InboxWebPushService {
	private readonly http = inject(HttpClient);
	private readonly store = inject(Store);
	/** The sign-out cleanup on its way: whatever comes next waits for it. */
	private cleanup: Promise<void> = Promise.resolve();

	/**
	 * Where this browser stands for the signed-in account. A subscription of another account is ended first. A
	 * subscribed browser is registered again (the platform drops devices after failed pushes); a failed re-registration,
	 * like a platform that cannot be reached, leaves the switch where the browser is — on while subscribed, so it can
	 * still be switched off — and switching on again retries.
	 */
	async state(): Promise<InboxWebPushState> {
		await this.cleanup;
		if (!supportsWebPush()) return 'unsupported';
		let reachable = true;
		try {
			await this.publicKey();
		} catch (error) {
			if ((error as { status?: number })?.status === 404) return 'unavailable';
			reachable = false;
		}
		if (Notification.permission === 'denied') return 'blocked';
		let subscription = await this.subscription().catch(() => null);
		const owner = this.owner();
		if (subscription && (!owner || owner.userId !== this.store.userId || owner.endpoint !== subscription.endpoint)) {
			// Opted in by someone else on this browser (or before the owner was recorded): ended, never taken over.
			await subscription.unsubscribe().catch(() => undefined);
			this.setOwner(null);
			subscription = null;
		}
		if (!subscription) return 'off';
		if (reachable && Notification.permission === 'granted') {
			await this.register(subscription).catch(() => undefined);
		}
		return 'on';
	}

	/** Asks for permission, registers the worker, subscribes with the platform's key and registers the device. */
	async enable(): Promise<InboxWebPushState> {
		await this.cleanup;
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
			this.setOwner(null);
			throw error;
		}
		return 'on';
	}

	/**
	 * Removes this device from the platform, then unsubscribes the browser. A failure (the list, the removal) is
	 * thrown with the browser still subscribed, so the switch stays on and switching off retries.
	 */
	async disable(): Promise<InboxWebPushState> {
		await this.cleanup;
		const subscription = await this.subscription();
		if (subscription) {
			const deviceId = await this.deviceIdOf(subscription);
			if (deviceId) await firstValueFrom(this.http.delete(`${DEVICES}/${encodeURIComponent(deviceId)}`));
			await subscription.unsubscribe();
		}
		this.setOwner(null);
		return 'off';
	}

	/**
	 * A sign-out on this browser. Called before the session is cleared: the removal of the device is sent at once,
	 * while the request still carries the session, and the browser unsubscribes; the next account's first step waits
	 * for both. Never throws.
	 */
	forgetThisBrowser(): void {
		const owner = this.owner();
		const removal = owner?.deviceId
			? firstValueFrom(this.http.delete(`${DEVICES}/${encodeURIComponent(owner.deviceId)}`)).catch(() => undefined)
			: Promise.resolve(undefined);
		this.setOwner(null);
		this.cleanup = Promise.all([
			removal,
			(async () => {
				try {
					if (!supportsWebPush()) return;
					await (await this.subscription())?.unsubscribe();
				} catch {
					// Nothing to undo.
				}
			})()
		]).then(() => undefined);
	}

	/** The app opened for a signed-in account: a subscribed browser is registered again (never throws). */
	async resync(): Promise<void> {
		try {
			await this.state();
		} catch {
			// The settings page reports what it finds.
		}
	}

	private async publicKey(): Promise<string> {
		const answer = await firstValueFrom(this.http.get<{ publicKey: string }>(`${DEVICES}/public-key`));
		return answer.publicKey;
	}

	private async subscription(): Promise<PushSubscription | null> {
		const registration = await navigator.serviceWorker.getRegistration(this.urlOf(INBOX_PUSH_WORKER_SCOPE));
		return (await registration?.pushManager.getSubscription()) ?? null;
	}

	/** This browser's device on the platform: the one recorded at registration, else the one with its endpoint. */
	private async deviceIdOf(subscription: PushSubscription): Promise<string | null> {
		const owner = this.owner();
		if (owner?.deviceId && owner.endpoint === subscription.endpoint) return owner.deviceId;
		const devices = await firstValueFrom(this.http.get<IInboxPushDevice[]>(DEVICES));
		return (devices ?? []).find((candidate) => candidate.endpoint === subscription.endpoint)?.id ?? null;
	}

	private async register(subscription: PushSubscription): Promise<void> {
		const json = subscription.toJSON();
		const device = await firstValueFrom(
			this.http.post<IInboxPushDevice>(DEVICES, {
				endpoint: json.endpoint ?? subscription.endpoint,
				keys: { p256dh: json.keys?.['p256dh'] ?? '', auth: json.keys?.['auth'] ?? '' },
				expirationTime: typeof json.expirationTime === 'number' ? json.expirationTime : null,
				userAgent: navigator.userAgent.slice(0, 255)
			})
		);
		const userId = this.store.userId;
		if (userId) this.setOwner({ userId, deviceId: device?.id ?? null, endpoint: subscription.endpoint });
	}

	private owner(): PushOwner | null {
		try {
			const raw = localStorage.getItem(INBOX_PUSH_OWNER_KEY);
			const owner = raw ? (JSON.parse(raw) as PushOwner) : null;
			return owner && typeof owner.userId === 'string' && typeof owner.endpoint === 'string' ? owner : null;
		} catch {
			return null;
		}
	}

	private setOwner(owner: PushOwner | null): void {
		try {
			if (owner) localStorage.setItem(INBOX_PUSH_OWNER_KEY, JSON.stringify(owner));
			else localStorage.removeItem(INBOX_PUSH_OWNER_KEY);
		} catch {
			// Storage can be blocked: the next visit asks again.
		}
	}

	/** A path of the app, against its base (the app may be served below the site's root). */
	private urlOf(path: string): string {
		return new URL(path, document.baseURI).pathname;
	}
}
