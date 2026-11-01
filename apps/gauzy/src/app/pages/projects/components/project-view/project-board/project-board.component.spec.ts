import { ChangeDetectorRef, SimpleChange } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ITask } from '@gauzy/contracts';
import { Store, TimesheetStatisticsService, ToastrService } from '@gauzy/ui-core/core';
import { ProjectBoardComponent } from './project-board.component';

const PARENT_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const ORGANIZATION = 'cccccccc-3333-4333-8333-333333333333';
const TENANT = 'dddddddd-4444-4444-8444-444444444444';

const STATUSES = [
	{ id: 'open', value: 'open', name: 'Open', order: 1, isSystem: true },
	{ id: 'done', value: 'done', name: 'Done', order: 2, isSystem: true, isDone: true }
];

const task = (id: string, status: string): ITask => ({ id, title: id, status, taskStatusId: status }) as ITask;

/**
 * A task's board (`parentId`): the task itself on it with its subtasks, as Jira's boards keep a parent with
 * its subtasks — its card marked, and first in its column.
 */
describe('ProjectBoardComponent', () => {
	let parent$: () => any;
	let http: { get: jest.Mock };

	beforeEach(() => {
		parent$ = () => of(task(PARENT_ID, 'open'));
		http = {
			get: jest.fn((url: string, options: { params: HttpParams }) => {
				if (url.endsWith('/task-statuses')) return of({ items: STATUSES });
				if (url.endsWith(`/tasks/${PARENT_ID}`)) return parent$();
				// The subtasks: read by their parent, never by the project.
				expect(options.params.get('where[parentId]')).toBe(PARENT_ID);
				return of({ items: [task('sub-1', 'open'), task('sub-2', 'done')], total: 2 });
			})
		};
	});

	/** The cards on the board, the parent's included; `total` counts the subtasks the pages read. */
	const cards = (component: ProjectBoardComponent) =>
		component.board.value.reduce((sum, column) => sum + column.cards.length, 0);

	let statistics: { getTasksStatistics: jest.Mock };
	let toastr: { danger: jest.Mock };

	const board = async (inputs: Partial<ProjectBoardComponent> = {}) => {
		statistics = { getTasksStatistics: jest.fn(async () => []) };
		toastr = { danger: jest.fn() };
		const component = new ProjectBoardComponent(
			http as unknown as HttpClient,
			{ hasAnyPermission: () => true } as unknown as Store,
			toastr as unknown as ToastrService,
			statistics as unknown as TimesheetStatisticsService,
			{ markForCheck: jest.fn() } as unknown as ChangeDetectorRef
		);
		Object.assign(component, { parentId: PARENT_ID, organizationId: ORGANIZATION, tenantId: TENANT, ...inputs });
		component.ngOnChanges({ parentId: new SimpleChange(undefined, PARENT_ID, true) });
		for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve));
		return component;
	};

	it('shows the task with its subtasks, its own card marked and first in its column', async () => {
		const component = await board();
		const [open, done] = component.board.value;

		expect(open.cards.map((card) => [card.id, !!card.isParent])).toEqual([
			[PARENT_ID, true],
			['sub-1', false]
		]);
		expect(done.cards.map((card) => card.id)).toEqual(['sub-2']);
		expect(cards(component)).toBe(3);
		expect(component.total).toBe(2);
		expect(component.hasParent).toBe(true);
	});

	it('keeps the subtasks when the task itself cannot be read', async () => {
		parent$ = () => throwError(() => new Error('403'));
		const component = await board();

		expect(component.board.failed).toBe(false);
		expect(cards(component)).toBe(2);
		expect(component.hasParent).toBe(false);
	});

	it('reads again when the host bumps its reload key', async () => {
		const component = await board();
		http.get.mockClear();
		component.reloadKey = 1;
		component.ngOnChanges({ reloadKey: new SimpleChange(0, 1, false) });
		await new Promise((resolve) => setTimeout(resolve));

		expect(http.get).toHaveBeenCalled();
	});

	it('narrows the cards to the filter, and a moved card stays in its new column', async () => {
		const component = await board();
		const [open, done] = component.board.value;

		expect(component.visibleCards(open)).toBe(open.cards);

		component.filter = { ...component.filter, search: 'sub' };

		expect(component.visibleCards(open).map((card) => card.id)).toEqual(['sub-1']);
		expect(component.visibleCards(done).map((card) => card.id)).toEqual(['sub-2']);
		expect(component.shownCards).toBe('2');
		expect(component.totalCards).toBe(3);

		const [moved] = done.cards.splice(0, 1);
		open.cards.push(moved);

		expect(component.visibleCards(open).map((card) => card.id)).toEqual(['sub-1', 'sub-2']);
		expect(component.visibleCards(done)).toEqual([]);
	});

	describe('dropping a card', () => {
		let put: jest.Mock;

		/** The screen under the pointer: the column with this id, its header unless `cards`, or nothing of the board. */
		const pointerOver = (columnId: string | null, { cards = false } = {}) => {
			const column = document.createElement('section');
			if (columnId) column.dataset['columnId'] = columnId;
			const list = column.appendChild(document.createElement('ul'));
			list.className = 'board-cards';
			const element = cards ? list : column;
			(document as any).elementFromPoint = jest.fn(() => (columnId ? element : null));
		};

		const release = (component: ProjectBoardComponent, overrides: Record<string, unknown>) =>
			component.drop({ isPointerOverContainer: true, currentIndex: 0, dropPoint: { x: 1, y: 1 }, ...overrides } as any);

		const ids = (column: { cards: { id: string }[] }) => column.cards.map((card) => card.id);

		beforeEach(() => {
			put = jest.fn(() => of({}));
			Object.assign(http, { put });
		});

		afterEach(() => {
			delete (document as any).elementFromPoint;
		});

		it('takes a card let go over the header of a column, which is no part of the drop list', async () => {
			const component = await board();
			const [open, done] = component.board.value;
			pointerOver('done');

			await release(component, {
				previousContainer: { data: open },
				container: { data: open },
				item: { data: open.cards[1] },
				isPointerOverContainer: false
			});

			expect(ids(open)).toEqual([PARENT_ID]);
			expect(ids(done)).toEqual(['sub-1', 'sub-2']);
			expect(put).toHaveBeenCalledWith(
				expect.stringContaining('/tasks/sub-1/status'),
				expect.objectContaining({ status: 'done', taskStatusId: 'done' })
			);
		});

		it('puts a card at the top of a column let go over its header, after passing through its cards', async () => {
			const component = await board();
			const [open, done] = component.board.value;
			pointerOver('done');

			// The list took the card on the way to its header, and keeps the last index it had there.
			await release(component, {
				previousContainer: { data: open },
				container: { data: done },
				item: { data: open.cards[1] },
				isPointerOverContainer: false,
				currentIndex: 1
			});

			expect(ids(done)).toEqual(['sub-1', 'sub-2']);
		});

		it("keeps a card where it was let go among a list's cards, when the drag's own flag is out of date", async () => {
			const component = await board();
			const [open, done] = component.board.value;
			pointerOver('done', { cards: true });

			// The list was measured when the drag began; a scrolled page leaves that behind.
			await release(component, {
				previousContainer: { data: open },
				container: { data: done },
				item: { data: open.cards[1] },
				isPointerOverContainer: false,
				currentIndex: 1
			});

			expect(ids(done)).toEqual(['sub-2', 'sub-1']);
		});

		it('saves the column let go over, not the last one the card passed through', async () => {
			const component = await board();
			const [open, done] = component.board.value;
			pointerOver('open');

			await release(component, {
				previousContainer: { data: done },
				container: { data: done },
				item: { data: done.cards[0] },
				isPointerOverContainer: false
			});

			expect(ids(open)).toContain('sub-2');
			expect(put).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'open' }));
		});

		it('leaves a card let go outside every column where it was', async () => {
			const component = await board();
			const [open, done] = component.board.value;
			pointerOver(null);

			await release(component, {
				previousContainer: { data: open },
				container: { data: done },
				item: { data: open.cards[1] },
				isPointerOverContainer: false
			});

			expect(ids(open)).toEqual([PARENT_ID, 'sub-1']);
			expect(put).not.toHaveBeenCalled();
		});

		it('leaves a card let go on its own column where it was: a task has no stored place in it', async () => {
			const component = await board();
			const [open] = component.board.value;
			pointerOver('open');

			await release(component, {
				previousContainer: { data: open },
				container: { data: open },
				item: { data: open.cards[1] },
				currentIndex: 0
			});

			expect(ids(open)).toEqual([PARENT_ID, 'sub-1']);
			expect(put).not.toHaveBeenCalled();
		});

		it('puts a dropped card where it was let go among the cards on show, with others hidden by the filter', async () => {
			const component = await board();
			const [open, done] = component.board.value;

			// The parent's card is hidden, and stays in the column: the drop after `sub-1` is index 1 among those on show.
			component.filter = { ...component.filter, search: 'sub' };
			await release(component, {
				previousContainer: { data: done },
				container: { data: open },
				item: { data: done.cards[0] },
				currentIndex: 1,
				dropPoint: undefined
			});

			expect(ids(open)).toEqual([PARENT_ID, 'sub-1', 'sub-2']);
			expect(put).toHaveBeenCalledTimes(1);
		});

		it("keeps the parent's card first, as a reload will", async () => {
			const component = await board();
			const [open, done] = component.board.value;
			pointerOver('open');

			await release(component, {
				previousContainer: { data: done },
				container: { data: open },
				item: { data: done.cards[0] },
				currentIndex: 0
			});

			expect(ids(open)).toEqual([PARENT_ID, 'sub-2', 'sub-1']);
		});

		it('puts the card back when the save fails, and says so', async () => {
			const component = await board();
			const [open, done] = component.board.value;
			const error = new Error('refused');
			put.mockReturnValue(throwError(() => error));
			pointerOver('done');

			await release(component, {
				previousContainer: { data: open },
				container: { data: open },
				item: { data: open.cards[1] },
				isPointerOverContainer: false
			});

			expect(ids(open)).toEqual([PARENT_ID, 'sub-1']);
			expect(ids(done)).toEqual(['sub-2']);
			expect(open.cards[1].saving).toBe(false);
			expect(toastr.danger).toHaveBeenCalledWith(error);
		});

		it('marks the column that will take the card, not its own, and clears the mark when the drag ends', async () => {
			const component = await board();
			const [open] = component.board.value;
			const moved = { pointerPosition: { x: 1, y: 1 }, source: { data: open.cards[1] } } as any;

			pointerOver('done');
			component.onDragMoved(moved);
			expect(component.dropColumnId).toBe('done');

			pointerOver('open');
			component.onDragMoved(moved);
			expect(component.dropColumnId).toBeNull();

			pointerOver('done');
			component.onDragMoved(moved);
			component.onDragEnded();
			expect(component.dropColumnId).toBeNull();
		});
	});

	it('reads what only the filter needs, and offers what the cards carry, on a filterable board only', async () => {
		http.get.mockImplementation((url: string) => {
			if (url.endsWith('/task-statuses')) return of({ items: STATUSES });
			if (url.endsWith(`/tasks/${PARENT_ID}`)) return parent$();
			return of({
				items: [
					{
						...task('sub-1', 'open'),
						issueType: 'bug',
						tags: [{ id: 'tag-1', name: 'Backend', color: '#000' }]
					}
				],
				total: 1
			});
		});
		const relations = () =>
			http.get.mock.calls
				.filter(([url]) => url.endsWith('/tasks'))
				.flatMap(([, options]) => options.params.getAll('relations[4]') || []);

		const plain = await board();

		expect(relations()).toEqual([]);
		expect(plain.filterOptions.labels).toEqual([]);

		http.get.mockClear();
		const component = await board({ filterable: true });

		expect(relations()).toEqual(['taskType']);
		expect(component.filterOptions.types).toEqual([{ id: 'bug', name: 'Bug' }]);
		expect(component.filterOptions.labels).toEqual([{ id: 'tag-1', name: 'Backend' }]);
		expect(component.filterOptions.unassigned).toBe(true);
	});

	it('reads the time of a task outside any project for its cards, a page at a time', async () => {
		http.get.mockImplementation((url: string, options: { params: HttpParams }) => {
			if (url.endsWith('/task-statuses')) return of({ items: STATUSES });
			if (url.endsWith(`/tasks/${PARENT_ID}`)) return parent$();
			return options.params.get('skip') === '0'
				? of({ items: [task('sub-1', 'open'), task('sub-2', 'done')], total: 3 })
				: of({ items: [task('sub-3', 'open')], total: 3 });
		});
		const component = await board();

		expect(statistics.getTasksStatistics).toHaveBeenCalledTimes(1);
		expect(statistics.getTasksStatistics.mock.calls[0][0].taskIds.sort()).toEqual(
			[PARENT_ID, 'sub-1', 'sub-2'].sort()
		);
		expect(component.hasMore).toBe(true);

		await component.loadMore();
		await new Promise((resolve) => setTimeout(resolve));

		expect(cards(component)).toBe(4);
		expect(component.hasMore).toBe(false);
		expect(statistics.getTasksStatistics).toHaveBeenCalledTimes(2);
		expect(statistics.getTasksStatistics.mock.calls[1][0].taskIds).toEqual(['sub-3']);
	});
});
