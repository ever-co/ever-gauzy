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

	/** Opens a saved view as the route does: the page's view becomes it, then it is read. */
	const openRoute = (id: string) => {
		component.current.set({ kind: 'saved', id });
		return component.open({ kind: 'saved', id });
	};
	/** The view ids the rows were read for, from the read at `from` on. */
	const readsOf = (from = 0) => api.viewTasks.mock.calls.slice(from).map((call: unknown[]) => call[0]);

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

	it('says an undo put an old name back in part only for the tasks the undo changed', async () => {
		await create();
		component.onToggle({ id: 't1', shift: false });
		component.onToggle({ id: 't2', shift: false });
		api.bulkUpdate.mockReturnValueOnce(
			of({
				applied: 2,
				refused: 0,
				results: [
					{ taskId: 't1', ok: true, previous: { status: 'legacy-name', taskStatusId: 's0' } },
					{ taskId: 't2', ok: true, previous: { status: 'older-name', taskStatusId: 's9' } }
				]
			})
		);
		jest.useFakeTimers();
		await component.applyBulk({ action: 'status', changes: { taskStatusId: 's1', status: TaskStatusEnum.DONE } });
		// The undo of t1 is refused: t1 got nothing back, so only t2 was put back in part.
		api.bulkUpdate.mockReturnValueOnce(
			of({
				applied: 1,
				refused: 1,
				results: [
					{ taskId: 't1', ok: false, error: 'Forbidden' },
					{ taskId: 't2', ok: true }
				]
			})
		);
		await component.undoLast();
		expect(api.bulkUpdate.mock.calls[1][0].items).toEqual([
			{ taskId: 't1', changes: { taskStatusId: 's0' } },
			{ taskId: 't2', changes: { taskStatusId: 's9' } }
		]);
		expect(toastr.warning).toHaveBeenCalledWith('TASK_VIEWS.BULK.UNDO_PARTIAL', { applied: 1, refused: 1 });
		expect(toastr.warning).toHaveBeenCalledWith('TASK_VIEWS.BULK.UNDO_LOSSY', { count: 1 });
	});

	it('draws a saved view as its timeline, saves a change of layout with the view, and drags rows only in the list', async () => {
		await create(savedView({ displayOptions: { layout: 'timeline', density: 'kept' } }));
		expect(component.isTimeline()).toBe(true);
		expect(component.dirty()).toBe(false);
		// A manual order is dragged in the list only.
		expect(component.draggable()).toBe(false);

		component.setLayout('list');
		expect(component.isTimeline()).toBe(false);
		expect(component.dirty()).toBe(true);
		expect(component.draggable()).toBe(true);

		api.updateView.mockReturnValueOnce(of(savedView({ version: 4, displayOptions: { density: 'kept' } })));
		await component.save();
		// The list is the layout of a view that names none; the other keys of the column stay.
		expect(api.updateView.mock.calls[0][1].displayOptions).toEqual({ density: 'kept' });
		expect(api.updateView.mock.calls[0][1]).toMatchObject({ expectedVersion: 3 });

		// A built-in view is always the list.
		component.setLayout('timeline');
		component.current.set({ kind: 'built-in', key: 'mine' });
		component.draft.update((draft: object) => ({ ...draft, layout: 'timeline' }));
		expect(component.isTimeline()).toBe(false);
	});

	it('keeps the row keys to the list: on a timeline only a selection takes the task keys', async () => {
		await create(savedView({ displayOptions: { layout: 'timeline' } }));
		const keys = (TestBed.inject(ShortcutRegistryService).registerAll as jest.Mock).mock.calls[0][0];
		component.focusedId.set('t1');
		expect(keys.listDown.enabled()).toBe(false);
		expect(keys.listOpen.enabled()).toBe(false);
		expect(keys.taskStatus.enabled()).toBe(false);

		component.onToggle({ id: 't2', shift: false });
		expect(keys.taskStatus.enabled()).toBe(true);

		component.setLayout('list');
		expect(keys.listDown.enabled()).toBe(true);
		expect(keys.listOpen.enabled()).toBe(true);
		// Back to the timeline: no focused row.
		component.setLayout('timeline');
		expect(component.focusedId()).toBeNull();
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
			of({ ...latest, version: 6, filterOptions: { ...(latest.filterOptions as object), groupBy: 'status' } })
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

	it('applies no late answer of a view left and opened again (another opening)', async () => {
		await create();
		component.setGroupBy('status');
		const answer = new Subject<ITaskView>();
		api.updateView.mockReturnValueOnce(answer);
		const saving = component.save();
		// v1 -> v2 -> v1: the view opened again read version 7 meanwhile.
		await component.open({ kind: 'saved', id: 'v2' });
		api.getView.mockReturnValueOnce(of(savedView({ version: 7 })));
		await component.open({ kind: 'saved', id: 'v1' });
		expect(component.savedView().version).toBe(7);
		answer.next(savedView({ version: 4 }));
		answer.complete();
		await saving;
		expect(component.savedView().version).toBe(7);
	});

	it('keeps the selection of rows past the first page when it reads the first page again, and drops deleted tasks', async () => {
		await create(savedView(), page(rows, { nextCursor: 'next', total: 10 }));
		component.selection.set({ ids: ['t1', 'far'], anchor: null });
		await component.reload();
		expect(component.selection().ids).toEqual(['t1', 'far']);
		const dialogs = TestBed.inject(NbDialogService) as unknown as { open: jest.Mock };
		dialogs.open.mockReturnValue({ onClose: of(true) });
		api.deleteTask.mockImplementation((id: string) =>
			id === 'far'
				? throwError(
						() =>
							new HttpErrorResponse({
								status: 403,
								error: { message: 'You can only delete a task of a team you manage.' }
							})
					)
				: of({})
		);
		await component.deleteSelected();
		expect(component.selection().ids).toEqual(['far']);
		expect(toastr.warning).toHaveBeenCalledWith('TASK_VIEWS.BULK.DELETE_PARTIAL', {
			applied: 1,
			refused: 1,
			errors: 'far: You can only delete a task of a team you manage.'
		});
	});

	it('drops a selected task the view no longer has once Load more read its last page', async () => {
		await create(savedView(), page(rows, { nextCursor: 'next' }));
		component.selection.set({ ids: ['t1', 'far'], anchor: 'far' });
		await component.reload();
		expect(component.selection().ids).toEqual(['t1', 'far']);
		api.viewTasks.mockReturnValueOnce(of(page([{ id: 't4', title: 't4' } as ITask], { nextCursor: 'more' })));
		await component.loadMore();
		// A page before the last says nothing about the rows after it.
		expect(component.selection().ids).toEqual(['t1', 'far']);
		api.viewTasks.mockReturnValueOnce(of(page([{ id: 't5', title: 't5' } as ITask])));
		await component.loadMore();
		expect(api.viewTasks).toHaveBeenLastCalledWith(
			'v1',
			expect.anything(),
			expect.objectContaining({ cursor: 'more' })
		);
		expect(component.items().map((row: ITask) => row.id)).toEqual(['t1', 't2', 't3', 't4', 't5']);
		expect(component.selection()).toEqual({ ids: ['t1'], anchor: null });
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

	it('reads the rows again once Overwrite saved the order a conflict refused', async () => {
		await create();
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
		await flush();
		const reads = api.viewTasks.mock.calls.length;
		api.setOrder.mockReturnValueOnce(of(savedView({ version: 9, manualOrder: ['t2', 't3', 't1'] as ID[] })));
		await component.overwrite();
		expect(api.setOrder).toHaveBeenLastCalledWith('v1', expect.objectContaining({ expectedVersion: 8 }));
		expect(component.conflict()).toBeNull();
		expect(api.viewTasks.mock.calls.length).toBe(reads + 1);
	});

	it('lists only the views of the scope open, and drops a list read for the previous one', async () => {
		await create();
		const availability = TestBed.inject(TaskViewsAvailabilityService) as unknown as {
			scope$: BehaviorSubject<unknown>;
		};
		const late = new Subject<unknown>();
		api.listViews.mockReturnValueOnce(late);
		const reading = component.loadViews();
		const other = savedView({ id: 'vB' as ID, name: 'Organization B view', organizationId: 'orgB' as ID });
		api.listViews.mockReturnValueOnce(of({ items: [other], total: 1 }));
		availability.scope$.next({ ...scope, organizationId: 'orgB' });
		await flush();
		late.next({ items: [savedView()], total: 1 });
		late.complete();
		await reading;
		expect(component.views().map((view: ITaskView) => view.id)).toEqual(['vB']);
	});

	it('offers no undo of an organization left while its bulk change ran, and forgets an undo on leaving', async () => {
		await create();
		const availability = TestBed.inject(TaskViewsAvailabilityService) as unknown as {
			scope$: BehaviorSubject<unknown>;
		};
		component.onToggle({ id: 't1', shift: false });
		const answer = new Subject<unknown>();
		api.bulkUpdate.mockReturnValueOnce(answer);
		jest.useFakeTimers();
		const applying = component.applyBulk({ action: 'archive', changes: { isArchived: true } });
		availability.scope$.next({ ...scope, organizationId: 'orgB' });
		answer.next({ applied: 1, refused: 0, results: [{ taskId: 't1', ok: true, previous: { isArchived: false } }] });
		answer.complete();
		await applying;
		expect(component.undo()).toBeNull();

		component.onToggle({ id: 't2', shift: false });
		api.bulkUpdate.mockReturnValueOnce(
			of({ applied: 1, refused: 0, results: [{ taskId: 't2', ok: true, previous: { isArchived: false } }] })
		);
		await component.applyBulk({ action: 'archive', changes: { isArchived: true } });
		expect(component.undo()).not.toBeNull();
		availability.scope$.next({ ...scope, organizationId: 'orgC' });
		expect(component.undo()).toBeNull();
	});

	it('keeps the undo when it failed, over rows read again, so it can be tried again', async () => {
		await create();
		component.onToggle({ id: 't1', shift: false });
		api.bulkUpdate.mockReturnValueOnce(
			of({ applied: 1, refused: 0, results: [{ taskId: 't1', ok: true, previous: { isArchived: false } }] })
		);
		jest.useFakeTimers();
		await component.applyBulk({ action: 'archive', changes: { isArchived: true } });
		const pending = component.undo();
		const reads = api.viewTasks.mock.calls.length;
		api.bulkUpdate.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
		await component.undoLast();
		expect(toastr.danger).toHaveBeenCalledWith('TASK_VIEWS.BULK.UNDO_FAILED');
		expect(component.undo()).toBe(pending);
		expect(api.viewTasks.mock.calls.length).toBe(reads + 1);
		api.bulkUpdate.mockReturnValueOnce(of({ applied: 1, refused: 0, results: [{ taskId: 't1', ok: true }] }));
		await component.undoLast();
		expect(component.undo()).toBeNull();
		expect(toastr.success).toHaveBeenCalledWith('TASK_VIEWS.BULK.UNDONE');
	});

	it('deletes nothing when another view opened while the delete was being confirmed', async () => {
		await create();
		component.onToggle({ id: 't1', shift: false });
		const answer = new Subject<boolean>();
		(TestBed.inject(NbDialogService) as unknown as { open: jest.Mock }).open.mockReturnValue({ onClose: answer });
		const deleting = component.deleteSelected();
		await openRoute('v2');
		answer.next(true);
		answer.complete();
		await deleting;
		expect(api.deleteTask).not.toHaveBeenCalled();
	});

	it('holds nothing of the view left while the next one loads, and frees Load more of the rows read before', async () => {
		await create(savedView(), page(rows, { nextCursor: 'next' }));
		component.setGroupBy('status');
		expect(component.dirty()).toBe(true);
		// The rows of the new grouping are read first (no Load more while they are).
		await flush();
		const more = new Subject<ITaskViewTasksPage>();
		api.viewTasks.mockReturnValueOnce(more);
		const loading = component.loadMore();
		expect(component.loadingMore()).toBe(true);
		const next = new Subject<ITaskView>();
		api.getView.mockReturnValueOnce(next);
		const reads = api.viewTasks.mock.calls.length;
		const opening = openRoute('v2');
		expect(component.savedView()).toBeNull();
		expect(component.dirty()).toBe(false);
		expect(component.loadingMore()).toBe(false);
		more.next(page([{ id: 't9', title: 't9' } as ITask]));
		more.complete();
		await loading;
		expect(component.items().map((row: ITask) => row.id)).not.toContain('t9');
		next.next(savedView({ id: 'v2' as ID, name: 'Other' }));
		next.complete();
		await opening;
		expect(component.savedView().id).toBe('v2');
		expect(readsOf(reads)).toEqual(['v2']);
	});

	it('reads the rows again after an undo that failed while another view opened, once that view is open', async () => {
		await create();
		component.onToggle({ id: 't1', shift: false });
		api.bulkUpdate.mockReturnValueOnce(
			of({ applied: 1, refused: 0, results: [{ taskId: 't1', ok: true, previous: { isArchived: false } }] })
		);
		jest.useFakeTimers();
		await component.applyBulk({ action: 'archive', changes: { isArchived: true } });
		const undoAnswer = new Subject<unknown>();
		api.bulkUpdate.mockReturnValueOnce(undoAnswer);
		const undoing = component.undoLast();
		const view = new Subject<ITaskView>();
		api.getView.mockReturnValueOnce(view);
		const opening = openRoute('v2');
		const reads = api.viewTasks.mock.calls.length;
		undoAnswer.error(new HttpErrorResponse({ status: 503 }));
		// Fake timers hold setTimeout: let the promises settle instead.
		for (let tick = 0; tick < 20; tick += 1) await Promise.resolve();
		// Nothing is read while the view opens (a read now would be superseded by the opening's own).
		expect(api.viewTasks.mock.calls.length).toBe(reads);
		expect(component.busy()).toBe(false);
		view.next(savedView({ id: 'v2' as ID, name: 'Other' }));
		view.complete();
		await opening;
		await undoing;
		expect(component.savedView()?.id).toBe('v2');
		// The opening's read, then the one after the undo: both of the view now open.
		expect(readsOf(reads)).toEqual(['v2', 'v2']);
	});

	it('reads the rows of a view opened during a bulk change again once the change answered', async () => {
		await create();
		component.onToggle({ id: 't1', shift: false });
		const answer = new Subject<unknown>();
		api.bulkUpdate.mockReturnValueOnce(answer);
		jest.useFakeTimers();
		const applying = component.applyBulk({ action: 'archive', changes: { isArchived: true } });
		api.getView.mockReturnValueOnce(of(savedView({ id: 'v2' as ID, name: 'Other' })));
		await openRoute('v2');
		const reads = api.viewTasks.mock.calls.length;
		answer.next({ applied: 1, refused: 0, results: [{ taskId: 't1', ok: true, previous: { isArchived: false } }] });
		answer.complete();
		await applying;
		expect(readsOf(reads)).toEqual(['v2']);
	});

	it('keeps a saved view that could not be read in its error after a bulk change answered', async () => {
		await create();
		component.onToggle({ id: 't1', shift: false });
		const answer = new Subject<unknown>();
		api.bulkUpdate.mockReturnValueOnce(answer);
		jest.useFakeTimers();
		const applying = component.applyBulk({ action: 'archive', changes: { isArchived: true } });
		api.getView.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
		await openRoute('v2');
		expect(component.error()).toBe(true);
		const reads = api.viewTasks.mock.calls.length;
		answer.next({ applied: 1, refused: 0, results: [{ taskId: 't1', ok: true, previous: { isArchived: false } }] });
		answer.complete();
		await applying;
		// No rows read without the view's definition: the error (and its Try again) stays.
		expect(api.viewTasks.mock.calls.length).toBe(reads);
		expect(component.error()).toBe(true);
		expect(component.savedView()).toBeNull();
	});

	it('drops an edit of the filter still to be read when another view opens', async () => {
		await create();
		jest.useFakeTimers();
		component.setFilter({ op: 'and', conditions: [{ field: 'labels', operator: 'in', values: [LABEL] }] });
		const view = new Subject<ITaskView>();
		api.getView.mockReturnValueOnce(view);
		const opening = openRoute('v2');
		const reads = api.viewTasks.mock.calls.length;
		jest.advanceTimersByTime(1_000);
		expect(api.viewTasks.mock.calls.length).toBe(reads);
		view.next(savedView({ id: 'v2' as ID, name: 'Other' }));
		view.complete();
		await opening;
		expect(component.savedView()?.id).toBe('v2');
		expect(readsOf(reads)).toEqual(['v2']);
	});

	it('reads no next page while the rows are being read anew', async () => {
		await create(savedView(), page(rows, { nextCursor: 'next' }));
		const fresh = new Subject<ITaskViewTasksPage>();
		api.viewTasks.mockReturnValueOnce(fresh);
		const reloading = component.reload();
		const reads = api.viewTasks.mock.calls.length;
		await component.loadMore();
		expect(api.viewTasks.mock.calls.length).toBe(reads);
		fresh.next(page(rows));
		fresh.complete();
		await reloading;
		expect(component.loading()).toBe(false);
	});

	it('opens a saved view again when Try again follows a failed read of it', async () => {
		await create();
		api.getView.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 503 })));
		await component.open({ kind: 'saved', id: 'v1' });
		expect(component.error()).toBe(true);
		expect(component.savedView()).toBeNull();
		const reads = api.getView.mock.calls.length;
		component.retry();
		await flush();
		await flush();
		expect(api.getView.mock.calls.length).toBe(reads + 1);
		expect(component.savedView()?.id).toBe('v1');
		expect(component.error()).toBe(false);
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
