import { ChatMemberRoleEnum, IChatCategory, IChatConversationWithState } from '@gauzy/contracts';
import { canManageConversation, moveCategory, movedCategoryOrder, nextCategoryPosition, sortCategories } from './chat-categories';

const category = (id: string, name: string, position: number): IChatCategory => ({ id, name, position }) as IChatCategory;

describe('chat categories', () => {
	const list = [category('c', 'Projects', 2), category('a', 'Teams', 0), category('b', 'Clients', 0)];

	it('orders the categories by position, then by name', () => {
		expect(sortCategories(list).map((item) => item.id)).toEqual(['b', 'a', 'c']);
	});

	it('moves a category one place and writes only the positions that changed', () => {
		// Clients (0), Teams (0), Projects (2) → Teams, Clients, Projects numbered 0, 1, 2.
		expect(moveCategory(list, 'a', -1)).toEqual([{ id: 'b', position: 1 }]);
		// Clients, Projects, Teams.
		expect(moveCategory(list, 'c', -1)).toEqual([
			{ id: 'c', position: 1 },
			{ id: 'a', position: 2 }
		]);
	});

	it('does nothing at either end or for an unknown category', () => {
		expect(moveCategory(list, 'b', -1)).toEqual([]);
		expect(moveCategory(list, 'c', 1)).toEqual([]);
		expect(moveCategory(list, 'nope', 1)).toEqual([]);
	});

	it('gives the whole order after a move, for the one reorder call', () => {
		// Clients, Teams, Projects → Teams, Clients, Projects.
		expect(movedCategoryOrder(list, 'a', -1)).toEqual(['a', 'b', 'c']);
		expect(movedCategoryOrder(list, 'b', 1)).toEqual(['a', 'b', 'c']);
		expect(movedCategoryOrder(list, 'c', -1)).toEqual(['b', 'c', 'a']);
		expect(movedCategoryOrder(list, 'b', -1)).toBeNull();
		expect(movedCategoryOrder(list, 'c', 1)).toBeNull();
		expect(movedCategoryOrder(list, 'nope', 1)).toBeNull();
	});

	it('puts a new category after the last one', () => {
		expect(nextCategoryPosition(list)).toBe(3);
		expect(nextCategoryPosition([])).toBe(0);
	});

	it('lets an admin, a manager of the conversation or its creator manage it, as the API does', () => {
		const member = { role: ChatMemberRoleEnum.MEMBER } as IChatConversationWithState['state'];
		const manager = { role: ChatMemberRoleEnum.MANAGER } as IChatConversationWithState['state'];
		expect(canManageConversation({ state: member, createdByEmployeeId: 'e2' }, 'e1', true)).toBe(true);
		expect(canManageConversation({ state: manager, createdByEmployeeId: 'e2' }, 'e1', false)).toBe(true);
		expect(canManageConversation({ state: member, createdByEmployeeId: 'e1' }, 'e1', false)).toBe(true);
		expect(canManageConversation({ state: member, createdByEmployeeId: 'e2' }, 'e1', false)).toBe(false);
		expect(canManageConversation({ state: null, createdByEmployeeId: null }, null, false)).toBe(false);
	});
});
