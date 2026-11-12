import { IReactionSummary, ReactionEntityEnum } from '@gauzy/contracts';
import { reactorsText, summariesByComment, toggledSummaries } from './comment-reactions.util';

const ann = { employeeId: 'ann', name: 'Ann Lee' };
const bo = { employeeId: 'bo', name: 'Bo Ray' };
const me = { employeeId: 'me', name: 'Me' };

const summary = (entityId: string, emoji: string, reactors: (typeof ann)[], reactedByMe = false): IReactionSummary => ({
	entity: ReactionEntityEnum.Comment,
	entityId,
	emoji,
	count: reactors.length,
	reactedByMe,
	reactionId: null,
	reactors
});

describe('comment reactions — grouping, the optimistic toggle, who reacted', () => {
	it('groups by comment in the platform’s order, leaving empty entries out', () => {
		const byComment = summariesByComment([summary('c1', '👍', [ann]), summary('c2', '🎉', [bo]), summary('c1', '❤️', [bo]), summary('c3', '👀', [])]);

		expect(byComment.get('c1').map((entry) => entry.emoji)).toEqual(['👍', '❤️']);
		expect(byComment.has('c3')).toBe(false);
	});

	it('adds, takes back and drops the reader’s reaction as the platform’s toggle does', () => {
		const added = toggledSummaries([summary('c1', '👍', [ann])], 'c1', '👍', me);
		expect(added[0]).toMatchObject({ count: 2, reactedByMe: true, reactors: [ann, me] });

		const back = toggledSummaries(added, 'c1', '👍', me);
		expect(back[0]).toMatchObject({ count: 1, reactedByMe: false, reactors: [ann] });

		const gone = toggledSummaries([summary('c1', '👍', [me], true)], 'c1', '👍', me);
		expect(gone).toEqual([]);

		const fresh = toggledSummaries([summary('c1', '👍', [ann]), summary('c2', '🎉', [bo])], 'c1', '🚀', me);
		expect(fresh.map((entry) => `${entry.entityId}:${entry.emoji}`)).toEqual(['c1:👍', 'c1:🚀', 'c2:🎉']);
	});

	it('names three reactors, the reader as “You”, and counts the rest', () => {
		const words = { meEmployeeId: 'me', you: 'You', someone: 'Someone', others: (count: number) => `${count} more` };

		expect(reactorsText({ count: 2, reactors: [ann, bo] }, words, 'en')).toBe('Ann Lee and Bo Ray');
		expect(
			reactorsText({ count: 5, reactors: [ann, me, { employeeId: 'x', name: '' }, bo] }, words, 'en')
		).toBe('Ann Lee, You, Someone, and 2 more');
		expect(reactorsText({ count: 0, reactors: [] }, words, 'en')).toBe('');
	});
});
