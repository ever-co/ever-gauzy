import { ReactionEntityEnum } from '@gauzy/contracts';
import { reactorNameOf, summarizeReactions, SummarizedReaction } from './reaction-summary';

/** A reaction row as the summary reads it, with its employee and user. */
const reaction = (
	id: string,
	entityId: string,
	emoji: string,
	employeeId: string,
	createdAt: string,
	user: Record<string, unknown> = { firstName: employeeId, lastName: 'Doe' }
): SummarizedReaction =>
	({
		id,
		entity: ReactionEntityEnum.Comment,
		entityId,
		emoji,
		employeeId,
		employee: { id: employeeId, user },
		createdAt
	}) as unknown as SummarizedReaction;

describe('summarizeReactions — the reactions of a record’s comments, by comment and emoji', () => {
	it('counts each emoji of each comment, names who reacted in order, and marks the caller’s own', () => {
		const summary = summarizeReactions(
			[
				reaction('r3', 'comment-1', '👍', 'ann', '2026-11-11T10:02:00Z'),
				reaction('r1', 'comment-1', '👍', 'bob', '2026-11-11T10:00:00Z'),
				reaction('r2', 'comment-1', '🎉', 'bob', '2026-11-11T10:01:00Z'),
				reaction('r4', 'comment-2', '👀', 'ann', '2026-11-11T09:00:00Z')
			],
			['comment-1', 'comment-2'],
			'ann'
		);

		expect(summary).toEqual([
			{
				entity: ReactionEntityEnum.Comment,
				entityId: 'comment-1',
				emoji: '👍',
				count: 2,
				reactedByMe: true,
				reactionId: 'r3',
				reactors: [
					{ employeeId: 'bob', name: 'bob Doe', imageUrl: null },
					{ employeeId: 'ann', name: 'ann Doe', imageUrl: null }
				]
			},
			{
				entity: ReactionEntityEnum.Comment,
				entityId: 'comment-1',
				emoji: '🎉',
				count: 1,
				reactedByMe: false,
				reactionId: null,
				reactors: [{ employeeId: 'bob', name: 'bob Doe', imageUrl: null }]
			},
			{
				entity: ReactionEntityEnum.Comment,
				entityId: 'comment-2',
				emoji: '👀',
				count: 1,
				reactedByMe: true,
				reactionId: 'r4',
				reactors: [{ employeeId: 'ann', name: 'ann Doe', imageUrl: null }]
			}
		]);
	});

	it('keeps the comments in the order the caller read them, whatever order the reactions came in', () => {
		const summary = summarizeReactions(
			[
				reaction('r1', 'comment-2', '👍', 'ann', '2026-11-11T08:00:00Z'),
				reaction('r2', 'comment-1', '👍', 'ann', '2026-11-11T09:00:00Z')
			],
			['comment-1', 'comment-2']
		);

		expect(summary.map((entry) => entry.entityId)).toEqual(['comment-1', 'comment-2']);
	});

	it('counts a reactor once per emoji even if the table holds a duplicate row', () => {
		const summary = summarizeReactions(
			[
				reaction('r1', 'comment-1', '👍', 'ann', '2026-11-11T08:00:00Z'),
				reaction('r2', 'comment-1', '👍', 'ann', '2026-11-11T08:00:01Z')
			],
			['comment-1'],
			'ann'
		);

		expect(summary).toHaveLength(1);
		expect(summary[0]).toMatchObject({ count: 1, reactedByMe: true, reactionId: 'r1' });
	});

	it('leaves out reactions of other records, without an emoji or without an employee', () => {
		const orphan = { ...reaction('r3', 'comment-1', '👍', 'x', '2026-11-11T08:00:00Z'), employeeId: null, employee: null };
		const summary = summarizeReactions(
			[
				reaction('r1', 'comment-9', '👍', 'ann', '2026-11-11T08:00:00Z'),
				reaction('r2', 'comment-1', '', 'ann', '2026-11-11T08:00:00Z'),
				orphan as unknown as SummarizedReaction
			],
			['comment-1']
		);

		expect(summary).toEqual([]);
	});

	it('answers nothing for no reactions', () => {
		expect(summarizeReactions([], ['comment-1'], 'ann')).toEqual([]);
	});
});

describe('reactorNameOf', () => {
	it('reads the full name, then the user name, and never the e-mail', () => {
		expect(reactorNameOf(reaction('r', 'c', '👍', 'e', '', { firstName: ' Ann ', lastName: 'Lee' }))).toBe('Ann Lee');
		expect(reactorNameOf(reaction('r', 'c', '👍', 'e', '', { name: 'ann.lee' }))).toBe('ann.lee');
		expect(reactorNameOf(reaction('r', 'c', '👍', 'e', '', { email: 'ann@example.com' }))).toBe('');
	});
});
