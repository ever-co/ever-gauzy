// The ui-core barrel boots half the app (and needs packages this spec does not): what the chat names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ RealtimeSocketService: class RealtimeSocketService {}, Store: class Store {} }));
import { CHAT_EVENT_NAMES, ChatEventName } from '@gauzy/contracts';
import { movesBadge, unreadOf } from './chat-header-badge.component';

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
});
