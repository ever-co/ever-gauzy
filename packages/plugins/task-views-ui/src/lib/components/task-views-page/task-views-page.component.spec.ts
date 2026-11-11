// The ui-core barrel boots half the app (and needs packages this spec does not have): what the page names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({
	Store: class Store {},
	ToastrService: class ToastrService {},
	UsersService: class UsersService {},
	QuickActionShortcutBridge: class QuickActionShortcutBridge {},
	QuickActionsPreferencesService: class QuickActionsPreferencesService {}
}));

import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { ID, ITask, ITaskView, ITaskViewTasksPage, TaskStatusEnum } from '@gauzy/contracts';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import { ShortcutRegistryService } from '../../keyboard/shortcut-registry.service';
import { TASK_VIEW_VERSION_CONFLICT } from '../../models/view-conflict';
import { TaskViewsApiService } from '../../services/task-views-api.service';
import { TaskViewsAvailabilityService } from '../../services/task-views-availability.service';
import { EMPTY_OPTIONS, TaskViewsOptionsService } from '../../services/task-views-options.service';
import { BULK_UNDO_WINDOW_MS } from '../../task-views-ui.constants';
import { TaskViewsPageComponent } from './task-views-page.component';

const LABEL = '11111111-1111-4111-8111-111111111111' as ID;
const GONE = '22222222-2222-4222-8222-222222222222' as ID;
const scope = { userId: 'u1', organizationId: 'org' as ID, tenantId: 'ten' as ID };

const savedView = (extra: Partial<ITaskView> = {}): ITaskView =>
	({
		id: 'v1' as ID,
		name: 'Backend bugs',
		version: 3,
		visibility: 'shared',
		filterOptions: {
			filter: { op: 'and', conditions: [{ field: 'labels', operator: 'in', values: [LABEL, GONE] }] },
			groupBy: 'none',
			orderBy: { field: 'manual' },
			teams: ['kept']
		},
		manualOrder: ['t1', 't2', 'tx'] as ID[],
		organizationId: 'org' as ID,
		...extra
	}) as ITaskView;

const page = (items: ITask[], extra: Partial<ITaskViewTasksPage> = {}): ITaskViewTasksPage => ({
	items,
	nextCursor: null,
	total: items.length,
	groups: null,
	groupBy: 'none',
	invalidFilters: [],
	...extra
});
const rows = ['t1', 't2', 't3'].map((id) => ({ id, title: id }) as ITask);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('TaskViewsPageComponent', () => {
	let api: Record<string, jest.Mock>;
	let toastr: Record<string, jest.Mock>;
	let component: any;

	async function create(view: ITaskView = savedView(), firstPage = page(rows)) {
		api = {
			getView: jest.fn(() => of(view)),
			viewTasks: jest.fn(() => of(firstPage)),
			listViews: jest.fn(() => of({ items: [view], total: 1 })),
			updateView: jest.fn(),
			setOrder: jest.fn(),
			createView: jest.fn(),
			deleteView: jest.fn(),
			bulkUpdate: jest.fn(),
			deleteTask: jest.fn(),
			builtIn: jest.fn(() => of({ items: rows, total: 3 })),
			notify: jest.fn()
		};
		(api as Record<string, unknown>)['changed$'] = of();
		toastr = { success: jest.fn(), warning: jest.fn(), danger: jest.fn(), info: jest.fn() };
		TestBed.configureTestingModule({
			imports: [TaskViewsPageComponent],
			providers: [
				{ provide: TaskViewsApiService, useValue: api },
				{ provide: TaskViewsOptionsService, useValue: { options: () => of(EMPTY_OPTIONS) } },
				{
					provide: TaskViewsAvailabilityService,
					useValue: { available$: new BehaviorSubject(true), scope$: new BehaviorSubject(scope) }
				},
				{
					provide: Store,
					useValue: { user: { id: 'u1', timeZone: 'Europe/Paris' }, hasAnyPermission: () => true }
				},
				{ provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ viewId: 'v1' })) } },
				{ provide: Router, useValue: { navigate: jest.fn(() => Promise.resolve(true)) } },
				{ provide: NbDialogService, useValue: { open: jest.fn() } },
				{ provide: ToastrService, useValue: toastr },
				{ provide: ShortcutRegistryService, useValue: { registerAll: jest.fn(() => () => undefined) } }
			]
		}).overrideComponent(TaskViewsPageComponent, { set: { template: '', imports: [] } });
		const fixture = TestBed.createComponent(TaskViewsPageComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
		await flush();
		await flush();
	}

	afterEach(() => jest.useRealTimers());

	it('opens the saved view of the route and reads its tasks with its filter tree in the caller time zone', async () => {
		await create();
		expect(api.getView).toHaveBeenCalledWith('v1', { organizationId: 'org', tenantId: 'ten' });
		const [id, , request] = api.viewTasks.mock.calls[0];
		expect(id).toBe('v1');
		expect(request).toMatchObject({
			cursor: null,
			groupBy: 'none',
			timeZone: 'Europe/Paris',
			filter: { op: 'and', conditions: [{ field: 'labels', values: [LABEL, GONE] }] }
		});
		expect(component.items().map((row: ITask) => row.id)).toEqual(['t1', 't2', 't3']);
		expect(component.dirty()).toBe(false);
	});

	it('shows an invalid filter on its condition, and fixing it reads the tasks again', async () => {
		await create(
			savedView(),
			page(rows, {
				invalidFilters: [
					{ path: 'filter.conditions.0', field: 'labels', reason: 'deleted-reference', values: [GONE] }
				]
			})
		);
		expect([...component.invalid().keys()]).toEqual(['0']);
		jest.useFakeTimers();
		component.setFilter({ op: 'and', conditions: [{ field: 'labels', operator: 'in', values: [LABEL] }] });
		expect(component.dirty()).toBe(true);
		jest.advanceTimersByTime(400);
		expect(api.viewTasks).toHaveBeenCalledTimes(2);
		expect(api.viewTasks.mock.calls[1][2].filter.conditions[0].values).toEqual([LABEL]);
	});

	it('changes the selection in one bulk request and undoes it with the previous values, for 10 s', async () => {
		await create();
		component.onToggle({ id: 't1', shift: false });
		component.onToggle({ id: 't3', shift: true });
		expect(component.selection().ids).toEqual(['t1', 't2', 't3']);
		api.bulkUpdate.mockReturnValueOnce(
			of({
				applied: 2,
				refused: 1,
				results: [
					{ taskId: 't1', ok: true, previous: { status: TaskStatusEnum.OPEN, taskStatusId: 's0' } },
					{ taskId: 't2', ok: true, previous: { status: TaskStatusEnum.BLOCKED, taskStatusId: 's9' } },
					{ taskId: 't3', ok: false, error: 'Forbidden' }
				]
			})
		);
		jest.useFakeTimers();
		await component.applyBulk({ action: 'status', changes: { taskStatusId: 's1', status: TaskStatusEnum.DONE } });
		expect(api.bulkUpdate).toHaveBeenCalledWith({
			organizationId: 'org',
			tenantId: 'ten',
			taskIds: ['t1', 't2', 't3'],
			changes: { taskStatusId: 's1', status: 'done' }
		});
		expect(component.undo()).toMatchObject({
			messageKey: 'TASK_VIEWS.BULK.PARTIAL',
			params: { applied: 2, refused: 1 }
		});
		expect(toastr.warning).toHaveBeenCalledWith('TASK_VIEWS.BULK.REFUSED', expect.objectContaining({ count: 1 }));

		api.bulkUpdate.mockReturnValueOnce(
			of({
				applied: 2,
				refused: 0,
				results: [
					{ taskId: 't1', ok: true },
					{ taskId: 't2', ok: true }
				]
			})
		);
		await component.undoLast();
		expect(api.bulkUpdate).toHaveBeenLastCalledWith({
			organizationId: 'org',
			tenantId: 'ten',
			items: [
				{ taskId: 't1', changes: { status: 'open', taskStatusId: 's0' } },
				{ taskId: 't2', changes: { status: 'blocked', taskStatusId: 's9' } }
			]
		});
		expect(component.undo()).toBeNull();
		expect(toastr.success).toHaveBeenCalledWith('TASK_VIEWS.BULK.UNDONE');

		api.bulkUpdate.mockReturnValueOnce(
			of({ applied: 1, refused: 0, results: [{ taskId: 't1', ok: true, previous: { isArchived: false } }] })
		);
		await component.applyBulk({ action: 'archive', changes: { isArchived: true } });
		expect(component.undo()).not.toBeNull();
		jest.advanceTimersByTime(BULK_UNDO_WINDOW_MS + 1);
		expect(component.undo()).toBeNull();
	});

	it('shows a stale save as a conflict, and Overwrite saves the edit on the latest version keeping its other keys', async () => {
		await create();
		component.setGroupBy('status');
		const latest = savedView({
			version: 5,
			name: 'Renamed meanwhile',
			filterOptions: { filter: null, teams: ['theirs'] }
		});
		api.updateView.mockReturnValueOnce(
			throwError(
				() => new HttpErrorResponse({ status: 409, error: { code: TASK_VIEW_VERSION_CONFLICT, view: latest } })
			)
		);
		await component.save();
		expect(api.updateView.mock.calls[0][1]).toMatchObject({
			expectedVersion: 3,
			filterOptions: { groupBy: 'status', teams: ['kept'] }
		});
		expect(component.conflict()).toMatchObject({ kind: 'save', latest: { version: 5 } });

		api.updateView.mockReturnValueOnce(
			of({ ...latest, version: 6, filterOptions: { ...latest.filterOptions, groupBy: 'status' } })
		);
		await component.overwrite();
		expect(api.updateView.mock.calls[1][1]).toMatchObject({
			expectedVersion: 5,
			filterOptions: { groupBy: 'status', teams: ['theirs'] }
		});
		expect(component.conflict()).toBeNull();
		expect(component.savedView().version).toBe(6);
	});

	it('leaves the view opened meanwhile alone when a save of the previous one answers', async () => {
		await create();
		component.setGroupBy('status');
		const answer = new Subject<ITaskView>();
		api.updateView.mockReturnValueOnce(answer);
		const saving = component.save();
		// Another view opens before the save of v1 answers.
		const other = savedView({ id: 'v2' as ID, name: 'Other', version: 1 });
		component.current.set({ kind: 'saved', id: 'v2' });
		component.savedView.set(other);
		answer.next(savedView({ version: 4 }));
		answer.complete();
		await saving;
		expect(component.savedView()).toBe(other);
		expect(component.conflict()).toBeNull();
	});

	it('Reload takes the latest view and drops the edit', async () => {
		await create();
		component.setGroupBy('priority');
		const latest = savedView({ version: 9, filterOptions: { groupBy: 'project' } });
		api.updateView.mockReturnValueOnce(
			throwError(
				() => new HttpErrorResponse({ status: 409, error: { code: TASK_VIEW_VERSION_CONFLICT, view: latest } })
			)
		);
		await component.save();
		component.reloadLatest();
		expect(component.conflict()).toBeNull();
		expect(component.draft().groupBy).toBe('project');
		expect(component.savedView().version).toBe(9);
	});

	it('saves a drop as the whole manual order with the version read, and a stale one as a conflict', async () => {
		await create();
		expect(component.draggable()).toBe(true);
		api.setOrder.mockReturnValueOnce(of(savedView({ version: 4, manualOrder: ['t2', 't1', 't3', 'tx'] as ID[] })));
		await component.drop({ from: 1, to: 0 });
		expect(api.setOrder).toHaveBeenCalledWith('v1', {
			organizationId: 'org',
			tenantId: 'ten',
			taskIds: ['t2', 't1', 't3', 'tx'],
			expectedVersion: 3
		});
		expect(component.savedView().version).toBe(4);

		api.setOrder.mockReturnValueOnce(
			throwError(
				() =>
					new HttpErrorResponse({
						status: 409,
						error: { code: TASK_VIEW_VERSION_CONFLICT, view: savedView({ version: 8 }) }
					})
			)
		);
		await component.drop({ from: 0, to: 2 });
		expect(component.conflict()).toMatchObject({ kind: 'order' });
	});

	it('does not drag a view grouped or ordered otherwise', async () => {
		await create(savedView({ filterOptions: { orderBy: { field: 'createdAt' } } }));
		expect(component.draggable()).toBe(false);
	});

	it('warns when the selection is full', async () => {
		await create();
		component.selection.set({ ids: Array.from({ length: 100 }, (_, index) => `x${index}`), anchor: null });
		component.onToggle({ id: 't1', shift: false });
		expect(component.selection().ids).not.toContain('t1');
		expect(toastr.warning).toHaveBeenCalledWith('TASK_VIEWS.BULK.LIMIT', { limit: 100 });
	});
});
