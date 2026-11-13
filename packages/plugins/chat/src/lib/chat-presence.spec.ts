import { ChatPresenceStatus, REALTIME_PRESENCE_TTL_SECONDS } from '@gauzy/contracts';
import { chatPresenceOf } from './chat-presence';

describe('chatPresenceOf', () => {
	const now = new Date('2026-11-13T12:00:00.000Z');
	const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

	it('is active or idle while the last report is within the presence window', () => {
		expect(chatPresenceOf(ago(10), false, now)).toBe(ChatPresenceStatus.ACTIVE);
		expect(chatPresenceOf(ago(10), null, now)).toBe(ChatPresenceStatus.ACTIVE);
		expect(chatPresenceOf(ago(10), true, now)).toBe(ChatPresenceStatus.IDLE);
		expect(chatPresenceOf(ago(REALTIME_PRESENCE_TTL_SECONDS), false, now)).toBe(ChatPresenceStatus.ACTIVE);
	});

	it('is offline once the last report lapsed, or when there never was one', () => {
		expect(chatPresenceOf(ago(REALTIME_PRESENCE_TTL_SECONDS + 1), false, now)).toBe(ChatPresenceStatus.OFFLINE);
		expect(chatPresenceOf(null, false, now)).toBe(ChatPresenceStatus.OFFLINE);
		expect(chatPresenceOf(undefined, true, now)).toBe(ChatPresenceStatus.OFFLINE);
		expect(chatPresenceOf('not a date', false, now)).toBe(ChatPresenceStatus.OFFLINE);
	});

	it('reads an ISO string as the driver may hand it', () => {
		expect(chatPresenceOf(ago(5).toISOString(), false, now)).toBe(ChatPresenceStatus.ACTIVE);
	});
});
