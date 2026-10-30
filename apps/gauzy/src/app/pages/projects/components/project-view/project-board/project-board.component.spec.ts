import { SimpleChange } from '@angular/core';
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
				return of({ items: [task('sub-1', 'open'), task('sub-2', 'done')] });
			})
		};
	});

	const board = async () => {
		const component = new ProjectBoardComponent(
			http as unknown as HttpClient,
			{ hasAnyPermission: () => true } as unknown as Store,
			{ danger: jest.fn() } as unknown as ToastrService,
			{ getTasksStatistics: jest.fn(async () => []) } as unknown as TimesheetStatisticsService
		);
		Object.assign(component, { parentId: PARENT_ID, organizationId: ORGANIZATION, tenantId: TENANT });
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
		expect(component.total).toBe(3);
	});

	it('keeps the subtasks when the task itself cannot be read', async () => {
		parent$ = () => throwError(() => new Error('403'));
		const component = await board();

		expect(component.board.failed).toBe(false);
		expect(component.total).toBe(2);
	});

	it('reads again when the host bumps its reload key', async () => {
		const component = await board();
		http.get.mockClear();
		component.reloadKey = 1;
		component.ngOnChanges({ reloadKey: new SimpleChange(0, 1, false) });
		await new Promise((resolve) => setTimeout(resolve));

		expect(http.get).toHaveBeenCalled();
	});
});
