import { findChoice, IPagedChoices } from './find-choice';

/** A selector's list over `offered`, loaded `limit` entries a page, as `SelectorService` loads it. */
function pagedList(offered: string[], limit = 2) {
	let page = 1;
	let data: { id: string }[] = [];
	const list = {
		resetPage: jest.fn(() => {
			page = 1;
			data = [];
		}),
		load: jest.fn(async () => {
			data = [...data, ...offered.slice((page - 1) * limit, page * limit).map((id) => ({ id }))];
		}),
		getAll: () => data,
		onScrollToEnd: jest.fn(() => {
			page++;
		}),
		selectorQuery: {
			get hasNext() {
				return page * limit < offered.length;
			}
		}
	};
	return list satisfies IPagedChoices<{ id: string }>;
}

/** The last log's choice is looked for in the list as the employee could pick it (#7753). */
describe('findChoice', () => {
	it('reloads the list from its first page, for the choices made so far', async () => {
		const list = pagedList(['a', 'b', 'c']);
		list.getAll().push({ id: 'stale' });

		await expect(findChoice(list, 'a')).resolves.toEqual({ id: 'a' });
		expect(list.resetPage).toHaveBeenCalledTimes(1);
		expect(list.load).toHaveBeenCalledTimes(1);
	});

	it('looks through the next pages for a choice beyond the first one', async () => {
		const list = pagedList(['a', 'b', 'c', 'd', 'e']);

		await expect(findChoice(list, 'e')).resolves.toEqual({ id: 'e' });
		expect(list.load).toHaveBeenCalledTimes(3);
	});

	it('is null when the list does not offer it: the employee can no longer pick it', async () => {
		const list = pagedList(['a', 'b', 'c']);

		await expect(findChoice(list, 'gone')).resolves.toBeNull();
		expect(list.load).toHaveBeenCalledTimes(2);
	});

	it('stops after the pages it may look through', async () => {
		const list = pagedList(['a', 'b', 'c', 'd', 'e', 'f', 'g']);

		await expect(findChoice(list, 'g', 2)).resolves.toBeNull();
		expect(list.load).toHaveBeenCalledTimes(2);
	});
});
