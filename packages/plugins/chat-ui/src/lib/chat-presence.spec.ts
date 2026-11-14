import { RealtimePresenceStatus } from '@gauzy/contracts';
import {
	applyPresenceEvent,
	applyPresenceList,
	CHAT_PRESENCE_IDLE_AFTER_MS,
	chatPresenceOf,
	ChatPresenceEntry,
	mostPresent,
	presenceOfRecord,
	presenceOfStatus,
	tabStatus
} from './chat-presence';
import { lastSeenText } from './components/presence-label/presence-label.component';

const NOW = Date.parse('2026-11-13T12:00:00.000Z');

function envelope(eventName: string, data: Record<string, unknown>) {
	return { eventId: 'ev', eventName, occurredAt: new Date(NOW).toISOString(), aggregate: { type: 'employee', id: String(data['employeeId']) }, data } as never;
}

describe('presenceOfStatus', () => {
	it('draws active as online, idle and away as away, anything else as offline', () => {
		expect(presenceOfStatus('active')).toBe('online');
		expect(presenceOfStatus('idle')).toBe('away');
		expect(presenceOfStatus('away')).toBe('away');
		expect(presenceOfStatus('offline')).toBe('offline');
		expect(presenceOfStatus(undefined)).toBe('offline');
		expect(presenceOfStatus('nonsense')).toBe('offline');
	});
});

describe('chatPresenceOf', () => {
	it('reads a presence.changed, and nothing else', () => {
		expect(chatPresenceOf(envelope('presence.changed', { employeeId: 'e1', status: 'active', revision: 3 }), NOW)).toEqual({
			employeeId: 'e1',
			presence: 'online',
			lastSeenAt: NOW,
			revision: 3
		});
		expect(chatPresenceOf(envelope('typing.signalled', { employeeId: 'e1' }), NOW)).toBeNull();
		expect(chatPresenceOf(envelope('presence.changed', { status: 'active' }), NOW)).toBeNull();
		expect(chatPresenceOf(null, NOW)).toBeNull();
	});

	it('does not take the time an offline change was told as the last seen time', () => {
		const at = '2026-11-13T11:52:30.000Z';
		expect(chatPresenceOf(envelope('presence.changed', { employeeId: 'e1', status: 'offline', at }), NOW)?.lastSeenAt).toBeNull();
		// Applied, it keeps the last seen time already known.
		const book: ReadonlyMap<string, ChatPresenceEntry> = new Map([['e1', { presence: 'online', lastSeenAt: NOW - 150_000, revision: 1, learntAt: NOW - 150_000 }]]);
		const update = chatPresenceOf(envelope('presence.changed', { employeeId: 'e1', status: 'offline', at, revision: 2 }), NOW);
		expect(applyPresenceEvent(book, update!, NOW).get('e1')).toEqual({ presence: 'offline', lastSeenAt: NOW - 150_000, revision: 2, learntAt: NOW });
	});
});

describe('presenceOfRecord', () => {
	it('reads a person of the people list', () => {
		expect(presenceOfRecord({ employeeId: 'e1', presence: 'idle', lastSeenAt: '2026-11-13T11:59:00.000Z' })).toEqual({
			employeeId: 'e1',
			presence: 'away',
			lastSeenAt: Date.parse('2026-11-13T11:59:00.000Z'),
			revision: null
		});
		// An API older than the field: offline, never seen.
		expect(presenceOfRecord({ employeeId: 'e2' })).toEqual({ employeeId: 'e2', presence: 'offline', lastSeenAt: null, revision: null });
		expect(presenceOfRecord({})).toBeNull();
	});
});

describe('applyPresenceEvent', () => {
	it('applies only an event newer than the last applied for the person', () => {
		let book: ReadonlyMap<string, ChatPresenceEntry> = new Map();
		book = applyPresenceEvent(book, { employeeId: 'e1', presence: 'online', lastSeenAt: NOW, revision: 5 }, NOW);
		const stale = applyPresenceEvent(book, { employeeId: 'e1', presence: 'offline', lastSeenAt: NOW, revision: 4 }, NOW + 1);
		expect(stale).toBe(book);
		book = applyPresenceEvent(book, { employeeId: 'e1', presence: 'away', lastSeenAt: NOW, revision: 6 }, NOW + 2);
		expect(book.get('e1')).toEqual({ presence: 'away', lastSeenAt: NOW, revision: 6, learntAt: NOW + 2 });
	});

	it('applies an event without a revision as it comes, keeping the revision known', () => {
		let book: ReadonlyMap<string, ChatPresenceEntry> = new Map([['e1', { presence: 'online', lastSeenAt: NOW, revision: 5, learntAt: NOW }]]);
		book = applyPresenceEvent(book, { employeeId: 'e1', presence: 'away', lastSeenAt: null }, NOW + 1);
		expect(book.get('e1')).toEqual({ presence: 'away', lastSeenAt: NOW, revision: 5, learntAt: NOW + 1 });
	});
});

describe('applyPresenceList', () => {
	it('applies a list, except for people the tab learnt of after the read started', () => {
		const book: ReadonlyMap<string, ChatPresenceEntry> = new Map([
			['e1', { presence: 'online', lastSeenAt: NOW, revision: 9, learntAt: NOW + 500 }],
			['e2', { presence: 'online', lastSeenAt: NOW - 60_000, revision: 2, learntAt: NOW - 60_000 }]
		]);
		const next = applyPresenceList(
			book,
			[
				{ employeeId: 'e1', presence: 'offline', lastSeenAt: NOW - 1000 },
				{ employeeId: 'e2', presence: 'offline', lastSeenAt: NOW - 30_000 },
				{ employeeId: 'e3', presence: 'away', lastSeenAt: NOW }
			],
			NOW,
			NOW + 1000
		);
		expect(next.get('e1')?.presence).toBe('online');
		expect(next.get('e2')).toEqual({ presence: 'offline', lastSeenAt: NOW - 30_000, revision: 2, learntAt: NOW + 1000 });
		expect(next.get('e3')?.presence).toBe('away');
	});

	it('keeps the same book when nothing changed', () => {
		const book: ReadonlyMap<string, ChatPresenceEntry> = new Map([['e1', { presence: 'online', lastSeenAt: NOW, revision: null, learntAt: NOW - 5000 }]]);
		expect(applyPresenceList(book, [{ employeeId: 'e1', presence: 'online', lastSeenAt: NOW }], NOW, NOW + 1)).toBe(book);
	});
});

describe('mostPresent', () => {
	it('is the most present status of the tabs, offline when there is none', () => {
		expect(mostPresent([RealtimePresenceStatus.AWAY, RealtimePresenceStatus.ACTIVE, RealtimePresenceStatus.IDLE])).toBe(RealtimePresenceStatus.ACTIVE);
		expect(mostPresent([RealtimePresenceStatus.AWAY, RealtimePresenceStatus.IDLE])).toBe(RealtimePresenceStatus.IDLE);
		expect(mostPresent([RealtimePresenceStatus.AWAY])).toBe(RealtimePresenceStatus.AWAY);
		expect(mostPresent([])).toBe(RealtimePresenceStatus.OFFLINE);
	});
});

describe('tabStatus', () => {
	it('is away while hidden, idle after a while without input, active otherwise', () => {
		expect(tabStatus(false, NOW, NOW)).toBe(RealtimePresenceStatus.AWAY);
		expect(tabStatus(true, NOW - 1000, NOW)).toBe(RealtimePresenceStatus.ACTIVE);
		expect(tabStatus(true, NOW - CHAT_PRESENCE_IDLE_AFTER_MS, NOW)).toBe(RealtimePresenceStatus.IDLE);
	});
});

describe('lastSeenText', () => {
	it('says just now, minutes ago, the time today, or the date', () => {
		expect(lastSeenText(null, NOW)).toEqual({ key: 'CHAT.PRESENCE.OFFLINE' });
		expect(lastSeenText(NOW - 20_000, NOW)).toEqual({ key: 'CHAT.PRESENCE.LAST_SEEN_JUST_NOW' });
		expect(lastSeenText(NOW - 5 * 60_000, NOW)).toEqual({ key: 'CHAT.PRESENCE.LAST_SEEN_MINUTES', count: 5 });
		const earlier = new Date(NOW);
		earlier.setHours(earlier.getHours() - 2);
		const sameDay = earlier.getDate() === new Date(NOW).getDate();
		expect(lastSeenText(earlier.getTime(), NOW).key).toBe(sameDay ? 'CHAT.PRESENCE.LAST_SEEN_TODAY' : 'CHAT.PRESENCE.LAST_SEEN_DATE');
		expect(lastSeenText(NOW - 3 * 24 * 3_600_000, NOW)).toEqual({ key: 'CHAT.PRESENCE.LAST_SEEN_DATE', at: NOW - 3 * 24 * 3_600_000 });
	});
});
