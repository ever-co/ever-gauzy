// The ui-core barrel boots half the app (and needs packages this spec does not): what the chat names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({ Store: class Store {}, ToastrService: class ToastrService {}, RealtimeSocketService: class RealtimeSocketService {} }));
import { IChatMemberState, IChatMessageWithRelations } from '@gauzy/contracts';
import { unreadMarkerId } from './conversation-view.component';

const message = (id: string, deleted = false) => ({ id, deletedAt: deleted ? new Date() : null }) as unknown as IChatMessageWithRelations;
const state = (unreadCount: number, lastReadMessageId: string | null = null) => ({ unreadCount, lastReadMessageId }) as unknown as IChatMemberState;

describe('unreadMarkerId', () => {
	it('puts the line after my read position when it is loaded', () => {
		expect(unreadMarkerId([message('a'), message('b'), message('c')], state(2, 'a'))).toBe('b');
		expect(unreadMarkerId([message('a'), message('b')], state(1, 'b'))).toBeNull();
	});

	it('counts back the unread messages when my read position is not loaded', () => {
		expect(unreadMarkerId([message('a'), message('b'), message('c')], state(2))).toBe('b');
		// More unread than loaded: above the first loaded message.
		expect(unreadMarkerId([message('a'), message('b')], state(5))).toBe('a');
	});

	it('skips the deleted messages the server does not count as unread', () => {
		// A deleted thread root stays in the list; the one unread message is `a`, not the root after it.
		expect(unreadMarkerId([message('read'), message('a'), message('root', true)], state(1))).toBe('a');
		expect(unreadMarkerId([message('gone', true), message('a')], state(3))).toBe('a');
	});

	it('draws no line when nothing is unread', () => {
		expect(unreadMarkerId([message('a')], state(0))).toBeNull();
		expect(unreadMarkerId([message('a')], null)).toBeNull();
		expect(unreadMarkerId([], state(2))).toBeNull();
	});
});
