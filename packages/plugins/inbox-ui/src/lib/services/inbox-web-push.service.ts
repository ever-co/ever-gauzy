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
 * Changed at every sign-out on this browser, and read by all its tabs: a step that began before a sign-out, here or in
 * another tab, finds it changed when it is about to record a subscription, and undoes its work instead.
 */
export const INBOX_PUSH_SIGN_OUT_KEY = 'gauzy-inbox-push-signed-out';

/**
 * Where this browser stands: `unavailable` (the platform has web push off), `unsupported` (the browser cannot),
 * `blocked` (the person refused notifications for the site), `off`, `on` (subscribed, and the platform confirmed the
 * device), `sync-failed` (not confirmed: subscribed for this account but the platform did not confirm the device — it
 * could not be reached, refused the registration or has web push off — or another account's subscription that the
 * browser could not end; switching off still works, and asking again retries).
 */
export type InboxWebPushState = 'unavailable' | 'unsupported' | 'blocked' | 'off' | 'on' | 'sync-failed';

interface IInboxPushDevice {
	id: string;
	endpoint: string;
}

interface PushOwner {
	userId: string;
	deviceId: string | null;
	endpoint: string;
}

/** The account a step runs for, and the sign-outs it started after: this tab's, and the browser's. */
interface PushSession {
	userId: string | null;
	signOuts: number;
	signedOut: string | null;
}

/** A step whose account signed out, here or in another tab, while it was on its way. */
class InboxWebPushSessionEnded extends Error {}

/** The HTTP status of a failed request, if it has one. */
function statusOf(error: unknown): number | undefined {
	return (error as { status?: number } | null)?.status;
}

/**
 * Browser notifications for the inbox on this device, over the platform's web push devices
 * (`/api/inbox/push-subscriptions`: the VAPID public key, my devices). The routes answer 404 where web push is off.
 *
 * The subscription belongs to the account that opted in (the owner record, in local storage and so shared by the
 * browser's tabs). A subscription without an owner record for the signed-in account is never registered or reused:
 * it is unsubscribed at the next step, in any tab, and a new opt-in subscribes anew, so whatever device another
 * account still has on the platform for the old endpoint points at nothing. A sign-out clears the owner record and
 * changes the sign-out marker at once, sends the device's removal while the session still allows it, and unsubscribes
 * the browser; every next step of this tab waits until the browser has unsubscribed.
 */
@Injectable({ providedIn: 'root' })
export class InboxWebPushService {
	private readonly http = inject(HttpClient);
	private readonly store = inject(Store);
	/** The sign-out unsubscribing the browser: whatever this tab does next waits for it. */
	private cleanup: Promise<void> = Promise.resolve();
	/** Sign-outs in this tab (the marker in storage covers the other tabs, and storage that is blocked). */
	private signOuts = 0;
	/** The account's subscription as this tab last saw it: a sign-out unsubscribes it at once, without a lookup. */
	private seen: PushSubscription | null = null;

	/**
	 * Where this browser stands for the signed-in account. A subscription the account did not opt in with is ended
	 * first, before any request. An owned subscription is registered again (the platform drops devices after failed
	 * pushes): `on` once the platform confirmed it, `sync-failed` when it could not.
	 */
	async state(): Promise<InboxWebPushState> {
		await this.cleanup;
		if (!supportsWebPush()) return 'unsupported';
		const session = this.session();
		let subscription: PushSubscription | null;
		try {
			subscription = await this.ownSubscription(session);
		} catch (error) {
			// Signed out meanwhile: nothing to tell. A subscription the browser kept although it is not this account's:
			// told, and switching off or asking again retries.
			return error instanceof InboxWebPushSessionEnded ? 'off' : 'sync-failed';
		}
		let key: 'ok' | 'off' | 'unreachable' = 'ok';
		try {
			await this.publicKey();
		} catch (error) {
			key = statusOf(error) === 404 ? 'off' : 'unreachable';
		}
		if (!subscription) {
			if (key === 'off') return 'unavailable';
			return Notification.permission === 'denied' ? 'blocked' : 'off';
		}
		if (Notification.permission === 'denied') return 'blocked';
		// Subscribed, but nothing to confirm it with (or no permission to show anything): it stays switchable, so it
		// can be switched off, also where the platform has turned web push off since.
		if (key !== 'ok' || Notification.permission !== 'granted') return 'sync-failed';
		try {
			await this.register(subscription, session);
			return 'on';
		} catch (error) {
			return error instanceof InboxWebPushSessionEnded ? 'off' : 'sync-failed';
		}
	}

	/**
	 * Asks for permission, registers the worker, subscribes with the platform's key and registers the device. A
	 * subscription this account did not opt in with is never taken over: it is ended and a new one made.
	 */
	async enable(): Promise<InboxWebPushState> {
		await this.cleanup;
		const session = this.session();
		const userId = session.userId;
		if (!userId) throw new InboxWebPushSessionEnded('No signed-in account.');
		const permission = await Notification.requestPermission();
		if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
		const registration = await navigator.serviceWorker.register(this.urlOf(INBOX_PUSH_WORKER_PATH), { scope: this.urlOf(INBOX_PUSH_WORKER_SCOPE) });
		const publicKey = await this.publicKey();
		let subscription = await registration.pushManager.getSubscription();
		// Signed out meanwhile: what the browser holds now is not this step's to judge.
		if (!this.isCurrent(session)) return 'off';
		if (subscription && !this.owns(subscription, userId)) {
			// Throws when it cannot be ended: it must never be registered for this account.
			await this.end(subscription);
			subscription = null;
		}
		const deviceId = subscription ? (this.owner()?.deviceId ?? null) : null;
		subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) as BufferSource });
		if (!this.isCurrent(session)) {
			await this.undo(subscription, null, session);
			return 'off';
		}
		// Claimed before the registration, so this account's other tabs do not take it for one left by a sign-out.
		this.setOwner({ userId, deviceId, endpoint: subscription.endpoint });
		this.seen = subscription;
		try {
			await this.register(subscription, session);
		} catch (error) {
			if (error instanceof InboxWebPushSessionEnded) return 'off';
			// Not registered: the browser must not keep a subscription the platform never pushes to.
			await subscription.unsubscribe().catch(() => undefined);
			if (this.claimed(subscription)) this.setOwner(null);
			throw error;
		}
		return 'on';
	}

	/**
	 * Removes this device from the platform (one it no longer has counts as removed), then unsubscribes the browser. A
	 * failure (the list, the removal) is thrown with the browser still subscribed, so the switch stays on and switching
	 * off retries. Only what it ended is forgotten: an owner record a newer opt-in wrote meanwhile (the account signed
	 * out and another switched on, here or in another tab) stays.
	 */
	async disable(): Promise<InboxWebPushState> {
		await this.cleanup;
		const session = this.session();
		const subscription = await this.subscription();
		// Signed out during the lookup: the subscription may be a newer account's by now; the sign-out ended the old one.
		if (!this.isCurrent(session)) return 'off';
		if (subscription) {
			const deviceId = await this.deviceIdOf(subscription);
			if (deviceId) await this.removeDevice(deviceId);
			await subscription.unsubscribe();
		}
		if (subscription ? this.claimed(subscription) : this.isCurrent(session)) this.setOwner(null);
		if (!subscription || this.seen?.endpoint === subscription.endpoint) this.seen = null;
		return 'off';
	}

	/**
	 * A sign-out on this browser, called before the session is cleared (the auth strategy's `logout$`, which it does
	 * not wait for). At once: the owner record is cleared and the sign-out marker changed, so no step of any tab records
	 * the subscription for the account that signed out, and the device's removal is sent while the request still carries
	 * the session. The browser unsubscribes: at once when this tab already holds the subscription (it does once the app
	 * opened for a subscribed account), else after looking it up; from that moment it delivers nothing on that
	 * subscription, whatever the platform still holds. Never rejects; when unsubscribing fails, the next step of any tab
	 * ends the subscription (it has no owner), and tells when it cannot either.
	 */
	forgetThisBrowser(): Promise<void> {
		const owner = this.owner();
		const seen = this.seen;
		this.seen = null;
		this.signOuts += 1;
		this.write(INBOX_PUSH_SIGN_OUT_KEY, `${Date.now()}-${Math.random().toString(36).slice(2)}`);
		this.setOwner(null);
		if (owner?.deviceId) void this.removeDevice(owner.deviceId).catch(() => undefined);
		const direct = seen ? seen.unsubscribe().catch(() => false) : Promise.resolve(false);
		this.cleanup = (async () => {
			await direct;
			try {
				if (!supportsWebPush()) return;
				const subscription = await this.subscription();
				if (subscription && !this.claimed(subscription)) await subscription.unsubscribe();
			} catch {
				// Left without an owner: the next step ends it.
			}
		})();
		return this.cleanup;
	}

	/** The app opened for a signed-in account: a subscribed browser is registered again (never throws). */
	async resync(): Promise<void> {
		try {
			await this.state();
		} catch {
			// The settings page reports what it finds.
		}
	}

	/** The platform's VAPID public key (404 where web push is off there). */
	private async publicKey(): Promise<string> {
		const answer = await firstValueFrom(this.http.get<{ publicKey: string }>(`${DEVICES}/public-key`));
		return answer.publicKey;
	}

	/** This browser's push subscription for the inbox worker's scope, if any. */
	private async subscription(): Promise<PushSubscription | null> {
		const registration = await navigator.serviceWorker.getRegistration(this.urlOf(INBOX_PUSH_WORKER_SCOPE));
		return (await registration?.pushManager.getSubscription()) ?? null;
	}

	/**
	 * This browser's subscription when the account opted in with it. One of another account, or one a sign-out left
	 * without an owner, is ended, never taken over.
	 */
	private async ownSubscription(session: PushSession): Promise<PushSubscription | null> {
		const subscription = await this.subscription().catch(() => null);
		// Signed out (here or in another tab) during the lookup: the subscription may be a newer account's by now.
		if (!this.isCurrent(session)) throw new InboxWebPushSessionEnded('Signed out while looking up the subscription.');
		if (!subscription) return null;
		if (session.userId && this.owns(subscription, session.userId)) {
			this.seen = subscription;
			return subscription;
		}
		await this.end(subscription);
		return null;
	}

	/**
	 * Ends a subscription that is not the account's: unsubscribed (asked twice), and the owner record cleared when it
	 * still names it. Throws when the browser keeps it.
	 */
	private async end(subscription: PushSubscription): Promise<void> {
		try {
			await subscription.unsubscribe();
		} catch {
			await subscription.unsubscribe();
		}
		if (this.seen?.endpoint === subscription.endpoint) this.seen = null;
		if (this.claimed(subscription)) this.setOwner(null);
	}

	/** This browser's device on the platform: the one recorded at registration, else the one with its endpoint. */
	private async deviceIdOf(subscription: PushSubscription): Promise<string | null> {
		const owner = this.owner();
		if (owner?.deviceId && owner.endpoint === subscription.endpoint) return owner.deviceId;
		let devices: IInboxPushDevice[] | null;
		try {
			devices = await firstValueFrom(this.http.get<IInboxPushDevice[]>(DEVICES));
		} catch (error) {
			// Web push is off on the platform: it has no device to remove.
			if (statusOf(error) === 404) return null;
			throw error;
		}
		return (devices ?? []).find((candidate) => candidate.endpoint === subscription.endpoint)?.id ?? null;
	}

	/** Removes a device; one the platform does not have (any more, or not this account's) counts as removed. */
	private async removeDevice(deviceId: string): Promise<void> {
		try {
			await firstValueFrom(this.http.delete(`${DEVICES}/${encodeURIComponent(deviceId)}`));
		} catch (error) {
			if (statusOf(error) !== 404) throw error;
		}
	}

	/**
	 * Registers the device and records the account as its owner, unless the account signed out (here or in another tab)
	 * while the registration was on its way: then nothing is recorded, the work is undone, and it throws.
	 */
	private async register(subscription: PushSubscription, session: PushSession): Promise<void> {
		const json = subscription.toJSON();
		const device = await firstValueFrom(
			this.http.post<IInboxPushDevice>(DEVICES, {
				endpoint: json.endpoint ?? subscription.endpoint,
				keys: { p256dh: json.keys?.['p256dh'] ?? '', auth: json.keys?.['auth'] ?? '' },
				expirationTime: typeof json.expirationTime === 'number' ? json.expirationTime : null,
				userAgent: navigator.userAgent.slice(0, 255)
			})
		);
		if (!session.userId || !this.isCurrent(session)) {
			await this.undo(subscription, device?.id ?? null, session);
			throw new InboxWebPushSessionEnded('Signed out while registering.');
		}
		this.setOwner({ userId: session.userId, deviceId: device?.id ?? null, endpoint: subscription.endpoint });
	}

	/**
	 * Undoes a step whose account signed out meanwhile. The device it registered is removed while this tab still has
	 * that account's session (another tab signed out); after a sign-out here the request would carry none, and the
	 * platform drops the device at its first push to the ended endpoint. The browser unsubscribes unless a newer
	 * opt-in claimed the subscription.
	 */
	private async undo(subscription: PushSubscription, deviceId: string | null, session: PushSession): Promise<void> {
		const ownSessionLive = this.signOuts === session.signOuts && !!session.userId && this.store.userId === session.userId && !!this.store.token;
		if (deviceId && ownSessionLive) await this.removeDevice(deviceId).catch(() => undefined);
		const current = await this.subscription().catch(() => null);
		if (current && current.endpoint === subscription.endpoint && !this.claimed(current)) {
			await current.unsubscribe().catch(() => undefined);
		}
	}

	/** The step's account and the sign-outs seen so far, to compare with when it is about to record anything. */
	private session(): PushSession {
		return { userId: this.store.userId ?? null, signOuts: this.signOuts, signedOut: this.read(INBOX_PUSH_SIGN_OUT_KEY) };
	}

	/** Whether the step's account is still the one signed in, with no sign-out since it began (here or in another tab). */
	private isCurrent(session: PushSession): boolean {
		return (
			this.signOuts === session.signOuts &&
			this.read(INBOX_PUSH_SIGN_OUT_KEY) === session.signedOut &&
			(this.store.userId ?? null) === session.userId
		);
	}

	/** Whether the owner record says this account opted in with this subscription. */
	private owns(subscription: PushSubscription, userId: string): boolean {
		const owner = this.owner();
		return !!owner && owner.userId === userId && owner.endpoint === subscription.endpoint;
	}

	/** Whether the owner record names this subscription (whoever's it is). */
	private claimed(subscription: PushSubscription): boolean {
		return this.owner()?.endpoint === subscription.endpoint;
	}

	/** The owner record, when there is a well-formed one. */
	private owner(): PushOwner | null {
		try {
			const raw = localStorage.getItem(INBOX_PUSH_OWNER_KEY);
			const owner = raw ? (JSON.parse(raw) as PushOwner) : null;
			return owner && typeof owner.userId === 'string' && typeof owner.endpoint === 'string' ? owner : null;
		} catch {
			return null;
		}
	}

	/** Records (or, with null, clears) the owner record. */
	private setOwner(owner: PushOwner | null): void {
		this.write(INBOX_PUSH_OWNER_KEY, owner ? JSON.stringify(owner) : null);
	}

	/** A local storage value; null where storage is blocked. */
	private read(key: string): string | null {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	}

	/** Writes (or, with null, removes) a local storage value; nothing where storage is blocked. */
	private write(key: string, value: string | null): void {
		try {
			if (value === null) localStorage.removeItem(key);
			else localStorage.setItem(key, value);
		} catch {
			// Storage can be blocked: the next visit asks again.
		}
	}

	/** A path of the app, against its base (the app may be served below the site's root). */
	private urlOf(path: string): string {
		return new URL(path, document.baseURI).pathname;
	}
}
