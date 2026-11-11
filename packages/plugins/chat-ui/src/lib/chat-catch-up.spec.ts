import { IChatMessage } from '@gauzy/contracts';
import { reconcileWithNewest, reconcileWithOldest } from './chat-catch-up';

type Message = Pick<IChatMessage, 'id' | 'createdAt' | 'body'> & IChatMessage;

function message(id: string, minute: number, body = id): Message {
	return { id, createdAt: new Date(Date.UTC(2026, 10, 11, 10, minute)), body } as Message;
}

const ids = (list: readonly { id?: string }[]) => list.map((item) => item.id);

describe('reconcileWithNewest', () => {
	const loaded = [message('a', 1), message('b', 2), message('c', 3), message('d', 4)];

	it('takes the page as the truth over its span: edits applied, deleted messages gone, new ones appended', () => {
		// The page starts at b: c was deleted, d edited, e written meanwhile; a is older and stays.
		const page = { hasBefore: true, messages: [message('b', 2), message('d', 4, 'edited'), message('e', 5)] };
		const result = reconcileWithNewest(loaded, page);
		expect(result.replaced).toBe(false);
		expect(ids(result.messages)).toEqual(['a', 'b', 'd', 'e']);
		expect(result.messages.find((item) => item.id === 'd')?.body).toBe('edited');
		expect(ids(result.added)).toEqual(['e']);
	});

	it('drops every loaded message the page does not hold when nothing comes before the page', () => {
		const result = reconcileWithNewest(loaded, { hasBefore: false, messages: [message('b', 2), message('d', 4)] });
		expect(ids(result.messages)).toEqual(['b', 'd']);
		expect(result.added).toEqual([]);
	});

	it('replaces the list when the page no longer reaches the last loaded message', () => {
		const page = { hasBefore: true, messages: [message('x', 10), message('y', 11)] };
		const result = reconcileWithNewest(loaded, page);
		expect(result.replaced).toBe(true);
		expect(ids(result.messages)).toEqual(['x', 'y']);
		expect(reconcileWithNewest([], page).replaced).toBe(true);
	});
});

describe('reconcileWithOldest', () => {
	const loaded = [message('r1', 1), message('r2', 2), message('r3', 3), message('r4', 4)];

	it('takes the first page as the truth up to its last reply and keeps the replies after it', () => {
		// The first page holds r1..r3 (more follows): r2 was deleted, r3 edited; r4 is after the page and stays.
		const result = reconcileWithOldest(loaded, { hasAfter: true, messages: [message('r1', 1), message('r3', 3, 'edited')] });
		expect(ids(result.messages)).toEqual(['r1', 'r3', 'r4']);
		expect(result.messages.find((item) => item.id === 'r3')?.body).toBe('edited');
		expect(result.beyond).toBe(true);
	});

	it('is the whole truth when nothing follows the page', () => {
		const result = reconcileWithOldest(loaded, { hasAfter: false, messages: [message('r1', 1), message('r4', 4), message('r5', 5)] });
		expect(ids(result.messages)).toEqual(['r1', 'r4', 'r5']);
		expect(ids(result.added)).toEqual(['r5']);
		expect(result.beyond).toBe(false);
	});
});
