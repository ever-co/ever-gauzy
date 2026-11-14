import { ChatPresenceStatus, REALTIME_PRESENCE_TTL_SECONDS } from '@gauzy/contracts';
import { chatPresenceOf } from './chat-presence';

describe('chatPresenceOf', () => {
	const now = new Date('2026-11-13T12:00:00.000Z');
	const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

	it('is active or idle while the last report is within the presence window', () => {
		expect(chatPresenceOf({ lastSeenAt: ago(10), isIdle: false }, now)).toBe(ChatPresenceStatus.ACTIVE);
		expect(chatPresenceOf({ lastSeenAt: ago(10), isIdle: null }, now)).toBe(ChatPresenceStatus.ACTIVE);
		expect(chatPresenceOf({ lastSeenAt: ago(10), isIdle: true }, now)).toBe(ChatPresenceStatus.IDLE);
		expect(chatPresenceOf({ lastSeenAt: ago(REALTIME_PRESENCE_TTL_SECONDS), isIdle: false }, now)).toBe(ChatPresenceStatus.ACTIVE);
	});

	it('is idle while someone who set themselves as away is still here', () => {
		expect(chatPresenceOf({ lastSeenAt: ago(10), isIdle: false, isAway: true }, now)).toBe(ChatPresenceStatus.IDLE);
	});

	it('is offline once the last report lapsed, or when there never was one, away or not', () => {
		expect(chatPresenceOf({ lastSeenAt: ago(REALTIME_PRESENCE_TTL_SECONDS + 1), isIdle: false }, now)).toBe(ChatPresenceStatus.OFFLINE);
		expect(chatPresenceOf({ lastSeenAt: ago(REALTIME_PRESENCE_TTL_SECONDS + 1), isAway: true }, now)).toBe(ChatPresenceStatus.OFFLINE);
		expect(chatPresenceOf({ lastSeenAt: null, isIdle: false }, now)).toBe(ChatPresenceStatus.OFFLINE);
		expect(chatPresenceOf({ isIdle: true }, now)).toBe(ChatPresenceStatus.OFFLINE);
		expect(chatPresenceOf({ lastSeenAt: 'not a date' }, now)).toBe(ChatPresenceStatus.OFFLINE);
	});

	it('is offline at once when the realtime merge says the last tab closed, though that report moved lastSeenAt', () => {
		// The closing report wrote both: isIdle true and lastSeenAt now, the merge `offline` a moment before.
		expect(chatPresenceOf({ lastSeenAt: ago(2), isIdle: true, published: { status: 'offline', at: ago(3) } }, now)).toBe(ChatPresenceStatus.OFFLINE);
		// Lapsed connections settled by the sweep, after the last report.
		expect(chatPresenceOf({ lastSeenAt: ago(100), isIdle: false, published: { status: 'offline', at: ago(1) } }, now)).toBe(ChatPresenceStatus.OFFLINE);
		expect(chatPresenceOf({ lastSeenAt: ago(2), isIdle: true, published: { status: 'offline' } }, now)).toBe(ChatPresenceStatus.OFFLINE);
	});

	it('does not let an old offline merge hide reports that came after it', () => {
		expect(chatPresenceOf({ lastSeenAt: ago(5), isIdle: false, published: { status: 'offline', at: ago(600) } }, now)).toBe(ChatPresenceStatus.ACTIVE);
		expect(chatPresenceOf({ lastSeenAt: ago(5), isIdle: false, published: { status: 'active', at: ago(5) } }, now)).toBe(ChatPresenceStatus.ACTIVE);
	});

	it('reads an ISO string as the driver may hand it', () => {
		expect(chatPresenceOf({ lastSeenAt: ago(5).toISOString(), isIdle: false }, now)).toBe(ChatPresenceStatus.ACTIVE);
	});
});
