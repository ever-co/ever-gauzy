/**
 * 🛑 This import must stay FIRST, before any import that pulls a core entity — see `channel.controller.spec.ts`
 * for the cycle it avoids.
 */
import '../core/entities/internal';

import { Comment } from './comment.entity';
import { withoutUnreadableRelatedComments } from './related-comments.helper';

/** Readable unless its id says otherwise. */
const unlessHidden = jest.fn(async (comment: Record<string, unknown>) => !String(comment.id).startsWith('hidden'));

describe('withoutUnreadableRelatedComments', () => {
	beforeEach(() => unlessHidden.mockClear());

	it('leaves refused comments out of a parent or replies, and keeps the comments read themselves', async () => {
		const read = {
			id: 'hidden-root',
			parent: { id: 'hidden-parent' },
			replies: [{ id: 'reply-1' }, { id: 'hidden-reply' }, { id: 'reply-2' }]
		};

		const result = await withoutUnreadableRelatedComments(read, unlessHidden);

		expect(result).toBe(read);
		expect(result).toEqual({ id: 'hidden-root', parent: null, replies: [{ id: 'reply-1' }, { id: 'reply-2' }] });
	});

	it('walks the items of a page and the elements of a list', async () => {
		const page = { items: [{ id: 'a', parent: { id: 'hidden-1' } }], total: 1 };
		const list = [{ id: 'b', replies: [{ id: 'hidden-2' }] }];

		await withoutUnreadableRelatedComments(page, unlessHidden);
		await withoutUnreadableRelatedComments(list, unlessHidden);

		expect(page.items[0].parent).toBeNull();
		expect(list[0].replies).toEqual([]);
	});

	it('checks the replies of a reply it keeps, and leaves the replies of a refused one unread', async () => {
		const read = {
			id: 'root',
			replies: [
				{ id: 'kept', replies: [{ id: 'hidden-nested' }] },
				{ id: 'hidden-reply', replies: [{ id: 'under-refused' }] }
			]
		};

		await withoutUnreadableRelatedComments(read, unlessHidden);

		expect(read.replies).toEqual([{ id: 'kept', replies: [] }]);
		expect(unlessHidden.mock.calls.map(([comment]) => comment.id)).toEqual([
			'kept',
			'hidden-nested',
			'hidden-reply'
		]);
	});

	it('checks a comment loaded through another relation, wherever it is found', async () => {
		const note = Object.assign(new Comment(), { id: 'hidden-assigned' });
		const read = { id: 'root', employee: { id: 'employee', assignedComments: [note], lastComment: note } };

		await withoutUnreadableRelatedComments(read, unlessHidden);

		expect(read.employee.assignedComments).toEqual([]);
		expect(read.employee.lastComment).toBeNull();
	});

	it('reads a `parent` or `replies` of a record that is not a comment as that record’s own', async () => {
		const read = { id: 'root', organization: { id: 'organization', parent: { id: 'hidden-organization' } } };

		await withoutUnreadableRelatedComments(read, unlessHidden);

		expect(read.organization.parent).toEqual({ id: 'hidden-organization' });
		expect(unlessHidden).not.toHaveBeenCalled();
	});

	it('asks about a comment loaded twice once, and keeps a comment read wherever it is found again', async () => {
		const parent: Record<string, unknown> = { id: 'parent' };
		const read = { id: 'hidden-root', parent, replies: [{ id: 'reply', parent }] };
		parent.replies = [read];

		await withoutUnreadableRelatedComments(read, unlessHidden);

		expect(unlessHidden.mock.calls.map(([comment]) => comment.id)).toEqual(['parent', 'reply']);
		expect(parent.replies).toEqual([read]);
	});

	it('returns a value that is not a record as it is, and does not walk dates or buffers', async () => {
		const createdAt = new Date('2026-10-31T00:00:00.000Z');
		const read = { id: 'root', createdAt, data: Buffer.from('x') };

		await expect(withoutUnreadableRelatedComments(3, unlessHidden)).resolves.toBe(3);
		await expect(withoutUnreadableRelatedComments(null, unlessHidden)).resolves.toBeNull();
		await withoutUnreadableRelatedComments(read, unlessHidden);

		expect(read.createdAt).toBe(createdAt);
		expect(unlessHidden).not.toHaveBeenCalled();
	});
});
