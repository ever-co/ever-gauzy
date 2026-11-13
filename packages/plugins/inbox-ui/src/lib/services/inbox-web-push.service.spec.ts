import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_PREFIX } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { INBOX_PUSH_OWNER_KEY, INBOX_PUSH_SIGN_OUT_KEY, InboxWebPushService } from './inbox-web-push.service';

const DEVICES = `${API_PREFIX}/inbox/push-subscriptions`;
const KEY = `${DEVICES}/public-key`;
const POST = { method: 'POST', url: DEVICES };
const PUBLIC_KEY = 'BNHkVsi8Cclc6eqRSElM_VAT1g9Eb2Pq2jSSq5MnWDXo1SntLBET8GBeB0Hqdr9NCAzkdg0BbGeiNhIJSlcjSSA';

/** Every promise continuation queued so far has run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve };
}

/** The browser's push side: one subscription per scope, shared by every tab of the site. */
class FakeBrowser {
	current: FakeSubscription | null = null;
	permission: NotificationPermission = 'granted';
	/** Holds every unsubscribe until the test lets it go. */
	unsubscribeGate: Promise<void> = Promise.resolve();
	/** Holds every lookup of the worker's registration until the test lets it go. */
	lookupGate: Promise<void> = Promise.resolve();
	failUnsubscribe = false;
	private count = 0;
	readonly pushManager = {
		getSubscription: jest.fn(async () => this.current),
		subscribe: jest.fn(async () => this.subscribed())
	};

	subscribed(): FakeSubscription {
		this.count += 1;
		this.current = new FakeSubscription(`https://push.example.com/${this.count}`, this);
		return this.current;
	}
}

class FakeSubscription {
	ended = false;
	readonly unsubscribe = jest.fn(async () => {
		await this.browser.unsubscribeGate;
		if (this.browser.failUnsubscribe) throw new Error('unsubscribe failed');
		this.ended = true;
		if (this.browser.current === this) this.browser.current = null;
		return true;
	});

	constructor(
		readonly endpoint: string,
		private readonly browser: FakeBrowser
	) {}

	toJSON() {
		return { endpoint: this.endpoint, keys: { p256dh: 'p256dh', auth: 'auth' } };
	}
}

/** Browser notifications for the inbox: one browser, the accounts that use it, and their sign-outs. */
describe('InboxWebPushService', () => {
	const store = { userId: null as string | null, token: null as string | null };
	let browser: FakeBrowser;
	let service: InboxWebPushService;
	let http: HttpTestingController;

	function own(subscription: FakeSubscription, userId: string, deviceId: string | null) {
		localStorage.setItem(INBOX_PUSH_OWNER_KEY, JSON.stringify({ userId, deviceId, endpoint: subscription.endpoint }));
	}
	const owner = () => JSON.parse(localStorage.getItem(INBOX_PUSH_OWNER_KEY) ?? 'null');
	const signIn = (userId: string | null) => {
		store.userId = userId;
		store.token = userId ? `token-of-${userId}` : null;
	};

	beforeEach(() => {
		browser = new FakeBrowser();
		signIn('user-a');
		localStorage.clear();
		const registration = { pushManager: browser.pushManager };
		Object.defineProperty(navigator, 'serviceWorker', {
			configurable: true,
			value: {
				register: jest.fn(async () => registration),
				getRegistration: jest.fn(async () => {
					await browser.lookupGate;
					return registration;
				})
			}
		});
		Object.assign(globalThis, {
			PushManager: class {},
			Notification: {
				get permission() {
					return browser.permission;
				},
				requestPermission: jest.fn(async () => browser.permission)
			}
		});
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Store, useValue: store }]
		});
		service = TestBed.inject(InboxWebPushService);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => {
		http.verify();
		delete (globalThis as Record<string, unknown>)['PushManager'];
		delete (globalThis as Record<string, unknown>)['Notification'];
		delete (navigator as unknown as Record<string, unknown>)['serviceWorker'];
		localStorage.clear();
	});

	describe('where this browser stands', () => {
		it('registers an owned subscription again, and says on once the platform confirmed it', async () => {
			const subscription = browser.subscribed();
			own(subscription, 'user-a', 'device-old');
			const state = service.state();
			await settle();
			http.expectOne(KEY).flush({ publicKey: PUBLIC_KEY });
			await settle();
			const post = http.expectOne(POST);
			expect(post.request.body).toMatchObject({ endpoint: subscription.endpoint, keys: { p256dh: 'p256dh', auth: 'auth' } });
			post.flush({ id: 'device-a', endpoint: subscription.endpoint });
			await expect(state).resolves.toBe('on');
			expect(owner()).toEqual({ userId: 'user-a', deviceId: 'device-a', endpoint: subscription.endpoint });
		});

		it('says sync-failed, not on, when registering it again fails, and keeps the subscription', async () => {
			const subscription = browser.subscribed();
			own(subscription, 'user-a', 'device-a');
			const state = service.state();
			await settle();
			http.expectOne(KEY).flush({ publicKey: PUBLIC_KEY });
			await settle();
			http.expectOne(POST).flush('boom', { status: 500, statusText: 'Server Error' });
			await expect(state).resolves.toBe('sync-failed');
			expect(subscription.unsubscribe).not.toHaveBeenCalled();
			expect(owner()).toMatchObject({ userId: 'user-a', endpoint: subscription.endpoint });
		});

		it('says sync-failed for a subscribed browser when the key request fails, and off for one that is not', async () => {
			const subscription = browser.subscribed();
			own(subscription, 'user-a', 'device-a');
			const subscribed = service.state();
			await settle();
			http.expectOne(KEY).error(new ProgressEvent('error'));
			await expect(subscribed).resolves.toBe('sync-failed');
			http.expectNone(POST);

			browser.current = null;
			const unsubscribed = service.state();
			await settle();
			http.expectOne(KEY).flush('down', { status: 503, statusText: 'Service Unavailable' });
			await expect(unsubscribed).resolves.toBe('off');
		});

		it('says unavailable on a normal start where the platform has web push off', async () => {
			const state = service.state();
			await settle();
			http.expectOne(KEY).flush('', { status: 404, statusText: 'Not Found' });
			await expect(state).resolves.toBe('unavailable');
		});

		it('keeps a failed switch-off retryable where the platform answers 404, and a second switch-off ends it', async () => {
			const subscription = browser.subscribed();
			own(subscription, 'user-a', 'device-a');
			const failed = service.disable();
			await settle();
			http.expectOne({ method: 'DELETE', url: `${DEVICES}/device-a` }).flush('boom', { status: 500, statusText: 'Server Error' });
			await expect(failed).rejects.toMatchObject({ status: 500 });
			expect(subscription.unsubscribe).not.toHaveBeenCalled();

			// Web push is off on the platform now: a subscribed browser still shows its switch, so it can be switched off.
			const state = service.state();
			await settle();
			http.expectOne(KEY).flush('', { status: 404, statusText: 'Not Found' });
			await expect(state).resolves.toBe('sync-failed');

			// The platform has nothing to remove any more (404 counts as removed), and the browser unsubscribes.
			const retried = service.disable();
			await settle();
			http.expectOne({ method: 'DELETE', url: `${DEVICES}/device-a` }).flush('', { status: 404, statusText: 'Not Found' });
			await expect(retried).resolves.toBe('off');
			expect(subscription.ended).toBe(true);
			expect(owner()).toBeNull();

			const after = service.state();
			await settle();
			http.expectOne(KEY).flush('', { status: 404, statusText: 'Not Found' });
			await expect(after).resolves.toBe('unavailable');
		});
	});

	describe('accounts sharing the browser', () => {
		it('ends the subscription another account opted in with, without waiting for the platform, and never registers it', async () => {
			const subscription = browser.subscribed();
			own(subscription, 'user-a', 'device-a');
			signIn('user-b');
			const state = service.state();
			await settle();
			expect(subscription.unsubscribe).toHaveBeenCalled();
			http.expectOne(KEY).flush({ publicKey: PUBLIC_KEY });
			await expect(state).resolves.toBe('off');
			http.expectNone(POST);
			expect(subscription.ended).toBe(true);
			expect(owner()).toBeNull();
		});

		it('ends a subscription left without an owner (a sign-out that did not finish)', async () => {
			const subscription = browser.subscribed();
			const state = service.state();
			await settle();
			http.expectOne(KEY).flush({ publicKey: PUBLIC_KEY });
			await expect(state).resolves.toBe('off');
			http.expectNone(POST);
			expect(subscription.ended).toBe(true);
		});

		it("leaves a newer account's subscription alone when a lookup resumes after a sign-out in another tab", async () => {
			const previous = browser.subscribed();
			own(previous, 'user-a', 'device-a');
			const gate = deferred();
			browser.lookupGate = gate.promise;
			const state = service.state();
			await settle();

			// Meanwhile, in another tab: A signs out, and B signs in there and switches on.
			localStorage.setItem(INBOX_PUSH_SIGN_OUT_KEY, 'signed-out-in-another-tab');
			const newer = browser.subscribed();
			own(newer, 'user-b', 'device-b');
			gate.resolve();
			await expect(state).resolves.toBe('off');
			expect(newer.unsubscribe).not.toHaveBeenCalled();
			expect(owner()).toEqual({ userId: 'user-b', deviceId: 'device-b', endpoint: newer.endpoint });
			http.expectNone(KEY);
			http.expectNone(POST);
		});

		it("tells, instead of off, when the browser keeps the previous account's subscription; switching off retries", async () => {
			const subscription = browser.subscribed();
			own(subscription, 'user-a', 'device-a');
			browser.failUnsubscribe = true;
			const cleanup = service.forgetThisBrowser();
			http.expectOne({ method: 'DELETE', url: `${DEVICES}/device-a` }).flush('boom', { status: 500, statusText: 'Server Error' });
			await cleanup;

			signIn('user-b');
			await expect(service.state()).resolves.toBe('sync-failed');
			// Once at the sign-out, twice at B's step: the subscription is still there, and nothing was registered.
			expect(subscription.unsubscribe).toHaveBeenCalledTimes(3);
			expect(browser.current).toBe(subscription);
			http.expectNone(KEY);
			http.expectNone(POST);

			browser.failUnsubscribe = false;
			const off = service.disable();
			await settle();
			http.expectOne({ method: 'GET', url: DEVICES }).flush([]);
			await expect(off).resolves.toBe('off');
			expect(subscription.ended).toBe(true);
		});

		it("switching on for the next account ends the previous account's subscription and subscribes anew", async () => {
			const previous = browser.subscribed();
			own(previous, 'user-a', 'device-a');
			signIn('user-b');
			const state = service.enable();
			await settle();
			http.expectOne(KEY).flush({ publicKey: PUBLIC_KEY });
			await settle();
			expect(previous.ended).toBe(true);
			expect(browser.pushManager.subscribe).toHaveBeenCalledTimes(1);
			const fresh = browser.current as FakeSubscription;
			const post = http.expectOne(POST);
			expect(post.request.body.endpoint).toBe(fresh.endpoint);
			expect(fresh.endpoint).not.toBe(previous.endpoint);
			post.flush({ id: 'device-b', endpoint: fresh.endpoint });
			await expect(state).resolves.toBe('on');
			expect(owner()).toEqual({ userId: 'user-b', deviceId: 'device-b', endpoint: fresh.endpoint });
		});
	});

	describe('a sign-out', () => {
		it('clears the owner and sends the removal at once; the next account waits for the delayed unsubscribe and gets nothing of it', async () => {
			const subscription = browser.subscribed();
			own(subscription, 'user-a', 'device-a');
			const gate = deferred();
			browser.unsubscribeGate = gate.promise;
			const cleanup = service.forgetThisBrowser();
			// Synchronously, before the auth strategy clears the session:
			expect(owner()).toBeNull();
			expect(localStorage.getItem(INBOX_PUSH_SIGN_OUT_KEY)).toBeTruthy();
			http.expectOne({ method: 'DELETE', url: `${DEVICES}/device-a` }).flush(null, { status: 204, statusText: 'No Content' });

			signIn(null);
			signIn('user-b');
			const state = service.state();
			await settle();
			// Still unsubscribing: the second account's first step has not started.
			http.expectNone(KEY);
			expect(subscription.ended).toBe(false);

			gate.resolve();
			await cleanup;
			await settle();
			expect(subscription.ended).toBe(true);
			http.expectOne(KEY).flush({ publicKey: PUBLIC_KEY });
			await expect(state).resolves.toBe('off');
			http.expectNone(POST);
			expect(owner()).toBeNull();
		});

		it("leaves the next account's opt-in alone when a switch-off's removal answers after the sign-out", async () => {
			const subscription = browser.subscribed();
			own(subscription, 'user-a', 'device-a');
			const off = service.disable();
			await settle();
			const removal = http.expectOne({ method: 'DELETE', url: `${DEVICES}/device-a` });

			// A signs out (its own removal of the device goes out too), B signs in and switches on, all before it answers.
			const cleanup = service.forgetThisBrowser();
			const removals = http.match({ method: 'DELETE', url: `${DEVICES}/device-a` });
			expect(removals).toHaveLength(1);
			removals[0].flush(null, { status: 204, statusText: 'No Content' });
			await cleanup;
			expect(subscription.ended).toBe(true);
			signIn('user-b');
			const on = service.enable();
			await settle();
			http.expectOne(KEY).flush({ publicKey: PUBLIC_KEY });
			await settle();
			const fresh = browser.current as FakeSubscription;
			http.expectOne(POST).flush({ id: 'device-b', endpoint: fresh.endpoint });
			await expect(on).resolves.toBe('on');

			removal.flush('', { status: 404, statusText: 'Not Found' });
			await expect(off).resolves.toBe('off');
			expect(owner()).toEqual({ userId: 'user-b', deviceId: 'device-b', endpoint: fresh.endpoint });
			expect(fresh.unsubscribe).not.toHaveBeenCalled();
		});

		it('unsubscribes at once, inside the sign-out, when this tab already holds the subscription', async () => {
			const subscription = browser.subscribed();
			own(subscription, 'user-a', 'device-a');
			// The app opened for the account: its subscription registered again (and now held by this tab).
			const opened = service.state();
			await settle();
			http.expectOne(KEY).flush({ publicKey: PUBLIC_KEY });
			await settle();
			http.expectOne(POST).flush({ id: 'device-a', endpoint: subscription.endpoint });
			await expect(opened).resolves.toBe('on');

			const cleanup = service.forgetThisBrowser();
			expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
			http.expectOne({ method: 'DELETE', url: `${DEVICES}/device-a` }).flush(null, { status: 204, statusText: 'No Content' });
			await cleanup;
			expect(subscription.ended).toBe(true);
		});

		it('undoes a registration that was on its way, here: nothing recorded, the browser unsubscribed', async () => {
			const subscription = browser.subscribed();
			own(subscription, 'user-a', 'device-a');
			const state = service.state();
			await settle();
			http.expectOne(KEY).flush({ publicKey: PUBLIC_KEY });
			await settle();
			const post = http.expectOne(POST);

			const cleanup = service.forgetThisBrowser();
			http.expectOne({ method: 'DELETE', url: `${DEVICES}/device-a` }).flush(null, { status: 204, statusText: 'No Content' });
			// Whatever the store reads after it was cleared, the sign-out of this tab is what counts.
			await cleanup;
			post.flush({ id: 'device-a', endpoint: subscription.endpoint });
			await expect(state).resolves.toBe('off');
			expect(owner()).toBeNull();
			expect(subscription.ended).toBe(true);
			// No removal without a session: the platform drops the device at its first push to the ended endpoint.
			http.expectNone({ method: 'DELETE' });

			signIn('user-b');
			const next = service.state();
			await settle();
			http.expectOne(KEY).flush({ publicKey: PUBLIC_KEY });
			await expect(next).resolves.toBe('off');
			http.expectNone(POST);
		});

		it('undoes a registration that was on its way when another tab signed out: the device removed, nothing recorded', async () => {
			const subscription = browser.subscribed();
			own(subscription, 'user-a', 'device-a');
			const state = service.state();
			await settle();
			http.expectOne(KEY).flush({ publicKey: PUBLIC_KEY });
			await settle();
			const post = http.expectOne(POST);

			// Another tab signs out: it changes the shared marker and clears the owner (its unsubscribe did not run).
			localStorage.setItem(INBOX_PUSH_SIGN_OUT_KEY, 'signed-out-in-another-tab');
			localStorage.removeItem(INBOX_PUSH_OWNER_KEY);
			post.flush({ id: 'device-a2', endpoint: subscription.endpoint });
			await settle();
			// This tab still has the account's session: the device it just registered is removed with it.
			http.expectOne({ method: 'DELETE', url: `${DEVICES}/device-a2` }).flush(null, { status: 204, statusText: 'No Content' });
			await expect(state).resolves.toBe('off');
			expect(subscription.ended).toBe(true);
			expect(owner()).toBeNull();
		});

		it('ends a subscription being switched on when the account signs out before the platform answered', async () => {
			const state = service.enable();
			await settle();
			http.expectOne(KEY).flush({ publicKey: PUBLIC_KEY });
			await settle();
			const post = http.expectOne(POST);
			const created = browser.current as FakeSubscription;
			// Claimed before the registration, so this account's other tabs leave it alone.
			expect(owner()).toEqual({ userId: 'user-a', deviceId: null, endpoint: created.endpoint });

			await service.forgetThisBrowser();
			post.flush({ id: 'device-a', endpoint: created.endpoint });
			await expect(state).resolves.toBe('off');
			expect(created.ended).toBe(true);
			expect(owner()).toBeNull();
		});

		it('never rejects; a subscription it could not end is ended at the next step, for the next account', async () => {
			const subscription = browser.subscribed();
			own(subscription, 'user-a', null);
			browser.failUnsubscribe = true;
			await expect(service.forgetThisBrowser()).resolves.toBeUndefined();
			expect(browser.current).toBe(subscription);

			browser.failUnsubscribe = false;
			signIn('user-b');
			const state = service.state();
			await settle();
			http.expectOne(KEY).flush({ publicKey: PUBLIC_KEY });
			await expect(state).resolves.toBe('off');
			http.expectNone(POST);
			expect(subscription.ended).toBe(true);
		});
	});
});
