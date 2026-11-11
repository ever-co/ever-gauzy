import { IChatMessage } from '@gauzy/contracts';
import { applyCatchUp, reconcileWithNewest, reconcileWithOldest, rootWithMyFields } from './chat-catch-up';

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

	it('keeps the history when the last loaded message was deleted (the page still overlaps)', () => {
		const result = reconcileWithNewest(loaded, { hasBefore: true, messages: [message('c', 3), message('e', 5)] });
		expect(result.replaced).toBe(false);
		expect(ids(result.messages)).toEqual(['a', 'b', 'c', 'e']);
		expect(ids(result.added)).toEqual(['e']);
	});

	it('replaces the list when the page shares no message with the loaded ones', () => {
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

describe('applyCatchUp', () => {
	const loaded = [message('a', 1), message('b', 2), message('c', 3), message('d', 4)];
	const before = new Set(loaded.map((item) => String(item.id)));

	it('keeps what was shown or changed while the read ran, whatever the page says', () => {
		// While the read ran: d was edited here (touched), e arrived live. The page (older) has d's old text, no e.
		const current = [...loaded.slice(0, 3), message('d', 4, 'mine'), message('e', 5)];
		const page = { hasBefore: true, messages: [message('b', 2), message('c', 3, 'edited'), message('d', 4, 'old')] };
		const result = applyCatchUp(current, before, new Set(['d']), (settled) => reconcileWithNewest(settled, page));
		expect(ids(result.messages)).toEqual(['a', 'b', 'c', 'd', 'e']);
		expect(result.messages.find((item) => item.id === 'c')?.body).toBe('edited');
		expect(result.messages.find((item) => item.id === 'd')?.body).toBe('mine');
		expect(result.replaced).toBe(false);
	});

	it('keeps the page boundary when its first message was touched, so a deletion of the gap still applies', () => {
		// b (the page's first) was refreshed here; c was deleted during the gap.
		const page = { hasBefore: true, messages: [message('b', 2, 'old'), message('d', 4)] };
		const result = applyCatchUp(loaded, before, new Set(['b']), (settled) => reconcileWithNewest(settled, page));
		expect(ids(result.messages)).toEqual(['a', 'b', 'd']);
		expect(result.messages.find((item) => item.id === 'b')?.body).toBe('b');
	});

	it('keeps a reply deleted here deleted, and reports only untouched additions', () => {
		const replies = [message('r1', 1), message('r3', 3)];
		const was = new Set(['r1', 'r2', 'r3']);
		const page = { hasAfter: false, messages: [message('r1', 1), message('r2', 2), message('r3', 3), message('r4', 4)] };
		// r2 was deleted by an event while the read ran (touched, gone from the list); r4 is new.
		const result = applyCatchUp(replies, was, new Set(['r2']), (settled) => reconcileWithOldest(settled, page));
		expect(ids(result.messages)).toEqual(['r1', 'r3', 'r4']);
		expect(ids(result.added)).toEqual(['r4']);
	});
});

describe('rootWithMyFields', () => {
	const root = { id: 'r', body: 'edited by someone', replyCount: 4, lastReplyAt: new Date('2026-11-11T10:05:00Z'), following: false } as never as Parameters<typeof rootWithMyFields>[0];

	it('takes the root the catch-up read (an edit) with only my own fields on top', () => {
		const next = rootWithMyFields(root, { following: true });
		expect(next.body).toBe('edited by someone');
		expect(next.following).toBe(true);
		expect(next.replyCount).toBe(4);
	});

	it('never puts the reply count or the last reply behind what either side knows', () => {
		const mine = { replyCount: 3, lastReplyAt: new Date('2026-11-11T10:01:00Z'), following: true };
		const next = rootWithMyFields(root, mine);
		expect(next.replyCount).toBe(4);
		expect(next.lastReplyAt).toEqual(new Date('2026-11-11T10:05:00Z'));
		expect(rootWithMyFields(root, { replyCount: 6, lastReplyAt: new Date('2026-11-11T10:09:00Z') }).replyCount).toBe(6);
	});
});
