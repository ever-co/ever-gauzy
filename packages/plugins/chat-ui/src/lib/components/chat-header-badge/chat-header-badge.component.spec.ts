// The ui-core barrel boots half the app (and needs packages this spec does not): what the chat names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ RealtimeSocketService: class RealtimeSocketService {}, Store: class Store {} }));
import { CHAT_EVENT_NAMES, ChatConversationKindEnum, ChatEventName } from '@gauzy/contracts';
import { toPeople } from '../../services/chat-people.service';
import { menuDateFormat, menuRows, movesBadge, unreadOf } from './chat-header-badge.component';

describe('chat header badge', () => {
	it('reads the states again for the events that can move its count', () => {
		const moves = (name: ChatEventName) => movesBadge({ name });
		expect(moves(CHAT_EVENT_NAMES.MEMBER_STATE_CHANGED)).toBe(true);
		expect(moves(CHAT_EVENT_NAMES.MESSAGE_CREATED)).toBe(true);
		// Deleting the last unread message, or a removal from an unread conversation, lowers it.
		expect(moves(CHAT_EVENT_NAMES.MESSAGE_DELETED)).toBe(true);
		expect(moves(CHAT_EVENT_NAMES.CONVERSATION_CHANGED)).toBe(true);
		expect(moves(CHAT_EVENT_NAMES.THREAD_CHANGED)).toBe(true);
		// An edit, a reaction or a pin does not.
		expect(moves(CHAT_EVENT_NAMES.MESSAGE_UPDATED)).toBe(false);
	});

	it('counts the conversations and the followed threads holding something unread', () => {
		expect(
			unreadOf({
				states: [
					{ conversationId: 'a', unreadCount: 2, mentionCount: 0 },
					{ conversationId: 'b', unreadCount: 0, mentionCount: 1 },
					{ conversationId: 'c', unreadCount: 0, mentionCount: 0 }
				] as never,
				threads: [
					{ rootMessageId: 'r1', conversationId: 'a', unreadReplies: 3 },
					{ rootMessageId: 'r2', conversationId: 'a', unreadReplies: 0 }
				]
			})
		).toBe(3);
		expect(unreadOf(null)).toBe(0);
	});

	it('lists the latest conversations that hold messages in the dropdown, newest first', () => {
		const people = toPeople([
			{ employeeId: 'me', userId: 'u-me', name: 'Me Myself', imageUrl: null },
			{ employeeId: 'e2', userId: 'u2', name: 'Ada Lovelace', imageUrl: null }
		] as never);
		const conversations = [
			{ id: 'c1', kind: ChatConversationKindEnum.CHANNEL, name: 'general', messageCount: 4, lastMessageAt: '2026-11-01T10:00:00Z', state: { unreadCount: 0, mentionCount: 0 } },
			{
				id: 'c2',
				kind: ChatConversationKindEnum.DIRECT,
				messageCount: 2,
				lastMessageAt: '2026-11-03T10:00:00Z',
				members: [{ employeeId: 'me' }, { employeeId: 'e2' }],
				state: { unreadCount: 3, mentionCount: 0 }
			},
			// Opened but never written in, and archived: neither is listed.
			{ id: 'c3', kind: ChatConversationKindEnum.DIRECT, messageCount: 0, lastMessageAt: null, members: [{ employeeId: 'e2' }], state: null },
			{ id: 'c4', kind: ChatConversationKindEnum.CHANNEL, name: 'old', messageCount: 9, lastMessageAt: '2026-11-04T10:00:00Z', archivedAt: '2026-11-05', state: null },
			{ id: 'c5', kind: ChatConversationKindEnum.CHANNEL, name: 'news', messageCount: 1, lastMessageAt: '2026-11-02T10:00:00Z', state: { unreadCount: 0, mentionCount: 1 } }
		] as never;

		const rows = menuRows(conversations, people, 'me', 'Conversation');
		expect(rows.map((row) => row.id)).toEqual(['c2', 'c5', 'c1']);
		expect(rows[0]).toMatchObject({ title: 'Ada Lovelace', channel: false, unread: true, count: '3' });
		expect(rows[0].person?.employeeId).toBe('e2');
		// A mention alone marks it unread without a count.
		expect(rows[1]).toMatchObject({ title: '#news', channel: true, unread: true, count: '' });
		expect(rows[2]).toMatchObject({ title: '#general', unread: false });
		expect(menuRows(conversations, people, 'me', 'Conversation', 1)).toHaveLength(1);
	});

	it('shows the time for today, the day for this year, the date before', () => {
		const now = new Date(2026, 10, 19, 15, 0);
		expect(menuDateFormat(new Date(2026, 10, 19, 9, 30), now)).toBe('shortTime');
		expect(menuDateFormat(new Date(2026, 2, 1), now)).toBe('MMM d');
		expect(menuDateFormat(new Date(2025, 2, 1), now)).toBe('mediumDate');
	});
});
