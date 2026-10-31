import {
	BOARD_UNASSIGNED,
	boardAvatarColorOf,
	boardFilterOptionsOf,
	IBoardFilter,
	IBoardFilterCard,
	isBoardFilterActive,
	matchesBoardFilter,
	NO_BOARD_FILTER
} from './board-filter';

const ann = { id: 'ann', name: 'Ann Brown', initials: 'AB' };
const bob = { id: 'bob', name: 'Bob Stone', initials: 'BS' };

const card = (overrides: Partial<IBoardFilterCard> = {}): IBoardFilterCard => ({
	key: 'DES-1',
	title: 'Fix the login page',
	people: [],
	labels: [],
	...overrides
});

const filter = (overrides: Partial<IBoardFilter>): IBoardFilter => ({ ...NO_BOARD_FILTER, ...overrides });

describe('board filter', () => {
	describe('matchesBoardFilter', () => {
		it('leaves every card with no filter in use', () => {
			expect(matchesBoardFilter(card(), NO_BOARD_FILTER)).toBe(true);
		});

		it('searches the title and the key, in any case, with or without the header\'s #', () => {
			expect(matchesBoardFilter(card(), filter({ search: 'LOGIN' }))).toBe(true);
			expect(matchesBoardFilter(card(), filter({ search: 'des-1' }))).toBe(true);
			expect(matchesBoardFilter(card(), filter({ search: '#DES-1' }))).toBe(true);
			expect(matchesBoardFilter(card(), filter({ search: 'signup' }))).toBe(false);
		});

		it('takes any of the choices within a filter', () => {
			const priorities = filter({ priorities: ['high', 'low'] });

			expect(matchesBoardFilter(card({ priority: 'High' }), priorities)).toBe(true);
			expect(matchesBoardFilter(card({ priority: 'Medium' }), priorities)).toBe(false);
			expect(matchesBoardFilter(card(), priorities)).toBe(false);
		});

		it('takes every filter in use', () => {
			const both = filter({ people: ['ann'], types: ['bug'] });

			expect(matchesBoardFilter(card({ people: [ann], type: 'Bug' }), both)).toBe(true);
			expect(matchesBoardFilter(card({ people: [ann], type: 'Story' }), both)).toBe(false);
			expect(matchesBoardFilter(card({ people: [bob], type: 'Bug' }), both)).toBe(false);
		});

		it('picks the cards with no assignee beside the assignees chosen', () => {
			const people = filter({ people: ['ann', BOARD_UNASSIGNED] });

			expect(matchesBoardFilter(card(), people)).toBe(true);
			expect(matchesBoardFilter(card({ people: [ann] }), people)).toBe(true);
			expect(matchesBoardFilter(card({ people: [bob] }), people)).toBe(false);
		});

		it('matches labels by their id', () => {
			const labels = filter({ labels: ['tag-1'] });

			expect(matchesBoardFilter(card({ labels: [{ id: 'tag-1', name: 'Backend' }] }), labels)).toBe(true);
			expect(matchesBoardFilter(card({ labels: [{ id: 'tag-2', name: 'Backend' }] }), labels)).toBe(false);
		});
	});

	describe('boardAvatarColorOf', () => {
		it('gives a person the same colour each time, and people different ones', () => {
			expect(boardAvatarColorOf('Ann Brown')).toBe(boardAvatarColorOf('Ann Brown'));
			expect(boardAvatarColorOf('Ann Brown')).not.toBe(boardAvatarColorOf('Bob Stone'));
		});
	});

	describe('isBoardFilterActive', () => {
		it('ignores a search of spaces', () => {
			expect(isBoardFilterActive(NO_BOARD_FILTER)).toBe(false);
			expect(isBoardFilterActive(filter({ search: '   ' }))).toBe(false);
			expect(isBoardFilterActive(filter({ search: 'a' }))).toBe(true);
			expect(isBoardFilterActive(filter({ labels: ['tag-1'] }))).toBe(true);
		});
	});

	describe('boardFilterOptionsOf', () => {
		it('offers each choice once, by name, and the priorities most pressing first', () => {
			const options = boardFilterOptionsOf([
				card({ people: [bob, ann], priority: 'Low', type: 'Story', labels: [{ id: 'b', name: 'Beta' }] }),
				card({ people: [ann], priority: 'urgent', type: 'Bug', labels: [{ id: 'a', name: 'Alpha' }] }),
				card({ people: [ann], priority: 'low', type: 'bug', labels: [{ id: 'b', name: 'Beta' }] }),
				card({ people: [ann], priority: 'Critical' })
			]);

			expect(options.people.map((person) => person.id)).toEqual(['ann', 'bob']);
			expect(options.priorities).toEqual([
				{ id: 'urgent', name: 'urgent' },
				{ id: 'low', name: 'Low' },
				{ id: 'critical', name: 'Critical' }
			]);
			expect(options.types.map((type) => type.id)).toEqual(['bug', 'story']);
			expect(options.labels.map((label) => label.name)).toEqual(['Alpha', 'Beta']);
			expect(options.unassigned).toBe(false);
		});

		it('offers the unassigned once a card has no assignee', () => {
			expect(boardFilterOptionsOf([card({ people: [ann] }), card()]).unassigned).toBe(true);
		});
	});
});
