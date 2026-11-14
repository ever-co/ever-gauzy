import { HttpClient } from '@angular/common/http';
import { Injector } from '@angular/core';
import { BehaviorSubject, of, Subscription } from 'rxjs';
import { IUser } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-core/core';
import { ChatAvailabilityService } from './chat-availability.service';
import { ChatPresenceService } from './chat-presence.service';
import { AwayStamp, CHAT_PRESENCE_AWAY_CHANNEL, ChatPresenceReporterService, isNewerAway, newConnectionId } from './chat-presence-reporter.service';

describe('isNewerAway', () => {
	it('orders away changes by time, then by tab, the same way in every tab', () => {
		const a: AwayStamp = { at: 100, tab: 'tab-a' };
		const b: AwayStamp = { at: 101, tab: 'tab-b' };
		expect(isNewerAway(b, a)).toBe(true);
		expect(isNewerAway(a, b)).toBe(false);
		// The same moment: the tab decides, and only one of the two is newer.
		const c: AwayStamp = { at: 100, tab: 'tab-c' };
		expect(isNewerAway(c, a)).toBe(true);
		expect(isNewerAway(a, c)).toBe(false);
		// Nothing known yet: any change is newer; the same change is not newer than itself.
		expect(isNewerAway(a, null)).toBe(true);
		expect(isNewerAway(a, { ...a })).toBe(false);
	});
});

describe('newConnectionId', () => {
	it('is a fresh id of letters, digits, dashes and underscores, at most 64 long', () => {
		const id = newConnectionId();
		expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
		expect(newConnectionId()).not.toBe(id);
	});
});

/** A BroadcastChannel that delivers nothing by itself: the test hands each message over when it chooses. */
class FakeChannel {
	static opened: FakeChannel[] = [];
	onmessage: ((event: MessageEvent) => void) | null = null;
	readonly sent: unknown[] = [];
	closed = false;

	constructor(readonly name: string) {
		FakeChannel.opened.push(this);
	}

	postMessage(data: unknown): void {
		this.sent.push(data);
	}

	close(): void {
		this.closed = true;
	}

	/** Hands a message another tab posted to this one. */
	receive(data: unknown): void {
		this.onmessage?.({ data } as MessageEvent);
	}
}

/** The app's store as the reporter uses it: the signed-in user, read and written, and its changes. */
function fakeStore(user: IUser) {
	const user$ = new BehaviorSubject<IUser>(user);
	return {
		user$,
		get user(): IUser {
			return user$.value;
		},
		set user(value: IUser) {
			user$.next(value);
		}
	};
}

describe('ChatPresenceReporterService away sync', () => {
	const ANNA = { id: 'u-anna', employee: { id: 'e-anna', isAway: false } } as unknown as IUser;
	const realChannel = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
	let now: number;
	const running: Subscription[] = [];

	/** One tab: a reporter with its own store; the chat is not served, so only the tab sync runs. */
	function tab() {
		const store = fakeStore(ANNA);
		const injector = Injector.create({
			providers: [
				{ provide: ChatPresenceReporterService },
				{ provide: HttpClient, useValue: {} },
				{ provide: Store, useValue: store },
				{ provide: ChatAvailabilityService, useValue: { available$: of(false) } },
				{ provide: ChatPresenceService, useValue: {} }
			]
		});
		running.push(injector.get(ChatPresenceReporterService).start());
		const channel = FakeChannel.opened.filter((opened) => opened.name === CHAT_PRESENCE_AWAY_CHANNEL).pop()!;
		const setAway = (isAway: boolean) => (store.user = { ...store.user, employee: { ...store.user.employee, isAway } } as IUser);
		const isAway = () => !!store.user.employee?.isAway;
		return { store, channel, setAway, isAway };
	}

	beforeEach(() => {
		FakeChannel.opened = [];
		(globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeChannel;
		now = 100;
		jest.spyOn(Date, 'now').mockImplementation(() => now);
	});

	afterEach(() => {
		running.splice(0).forEach((subscription) => subscription.unsubscribe());
		(globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = realChannel;
		jest.restoreAllMocks();
	});

	it('tells another tab of a change, which takes it without telling it back', () => {
		const a = tab();
		const b = tab();

		a.setAway(true);
		expect(a.channel.sent).toHaveLength(1);
		b.channel.receive(a.channel.sent[0]);

		expect(b.isAway()).toBe(true);
		expect(b.channel.sent).toEqual([]);
	});

	it('settles both tabs on the newest change when changes cross on the way', () => {
		const a = tab();
		const b = tab();

		// Tab A sets away at 100; before either hears of the other, tab B sets away at 101 and back at 102.
		a.setAway(true);
		now = 101;
		b.setAway(true);
		now = 102;
		b.setAway(false);
		const [fromA] = a.channel.sent;
		const [awayFromB, backFromB] = b.channel.sent;

		// A hears B's two changes; B hears A's older one.
		a.channel.receive(awayFromB);
		a.channel.receive(backFromB);
		b.channel.receive(fromA);

		expect(a.isAway()).toBe(false);
		expect(b.isAway()).toBe(false);
		// Only the changes each tab made itself were told: nothing received went back out.
		expect(a.channel.sent).toEqual([fromA]);
		expect(b.channel.sent).toEqual([awayFromB, backFromB]);
	});

	it('stamps the changes of one tab in order, even within one millisecond', () => {
		const a = tab();
		a.setAway(true);
		a.setAway(false);
		const stamps = (a.channel.sent as Array<{ stamp: AwayStamp }>).map((message) => message.stamp);
		expect(stamps.map((stamp) => stamp.at)).toEqual([100, 101]);
		expect(isNewerAway(stamps[1], stamps[0])).toBe(true);
	});

	it('ignores a change for someone else, and a message without a stamp', () => {
		const a = tab();
		a.channel.receive({ employeeId: 'e-bob', isAway: true, stamp: { at: 500, tab: 'tab-x' } });
		a.channel.receive({ employeeId: 'e-anna', isAway: true });
		expect(a.isAway()).toBe(false);
		expect(a.channel.sent).toEqual([]);
	});
});
