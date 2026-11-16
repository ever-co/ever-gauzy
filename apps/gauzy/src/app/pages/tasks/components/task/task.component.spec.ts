import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { ComponentLayoutStyleEnum, ITask, TaskPriorityEnum } from '@gauzy/contracts';
import {
	ErrorHandlingService,
	GenericFavoriteService,
	Store,
	TasksService,
	TaskTrashService
} from '@gauzy/ui-core/core';
import { HashNumberPipe } from '@gauzy/ui-core/shared';
import { TaskComponent } from './task.component';

const ORGANIZATION = { id: 'org-1', tenantId: 'tenant-1', name: 'Ever' };

/** The page size the list reads with (`PaginationFilterBaseComponent.minItemPerPage`). */
const PAGE_SIZE = 10;

const taskNumbered = (n: number): ITask =>
	({
		id: `task-${n}`,
		title: `Task ${n}`,
		taskNumber: `${n}`,
		priority: TaskPriorityEnum.LOW,
		organizationId: ORGANIZATION.id,
		tenantId: ORGANIZATION.tenantId,
		members: [],
		teams: [],
		tags: []
	}) as unknown as ITask;

/** What the edit dialogs answer when they are saved: the form's values. */
const dialogValues = (overrides: Record<string, unknown> = {}) => ({
	title: 'Task 15',
	priority: TaskPriorityEnum.HIGH,
	estimateDays: 0,
	estimateHours: 0,
	estimateMinutes: 0,
	...overrides
});

/**
 * ever-co/ever-gauzy#12008: saving, duplicating or deleting one task from Tasks, My Tasks or Team Tasks reloaded the
 * whole list. The selection and the open drawer were dropped, the card grid was emptied and sent back to its first
 * page, and a spinner covered the card. The list is now read again where it stands.
 */
describe('TaskComponent', () => {
	let fixture: ComponentFixture<TaskComponent>;
	let component: TaskComponent;
	/** The tasks the API holds, in the order it answers them. */
	let server: ITask[];
	let http: { get: jest.Mock };
	let dialogResult: unknown;
	let dialogService: { open: jest.Mock };
	let tasksService: { editTask: jest.Mock; createTask: jest.Mock; deleteTask: jest.Mock };
	let layout: ComponentLayoutStyleEnum;
	/** Every value the page gave its loading flag, in order. */
	let loadingSeen: boolean[];

	/** The debounces of the page (100 ms on pagination, 400 ms on reads), then the read itself. */
	const settle = async (ms = 700) => {
		await new Promise((resolve) => setTimeout(resolve, ms));
		for (let i = 0; i < 10; i++) await Promise.resolve();
	};

	/** The `skip` (page) and `take` (page size) of a list read. */
	const pagingOf = (call: unknown[]) => {
		const params = (call[1] as { params: HttpParams }).params;
		return { page: +params.get('skip'), size: +params.get('take') };
	};
	const lastRead = () => pagingOf(http.get.mock.calls[http.get.mock.calls.length - 1]);

	/** The page's private side the specs read and drive: the tasks it shows, and a column filter. */
	const internals = () =>
		component as unknown as { _tasks: ITask[]; setFilter: (filter: { field: string; search: string }) => void };
	const shown = (): ITask[] => internals()._tasks;

	beforeEach(() => {
		server = Array.from({ length: 25 }, (_, index) => taskNumbered(index + 1));
		http = {
			get: jest.fn((_url: string, options: { params: HttpParams }) => {
				const page = +options.params.get('skip');
				const size = +options.params.get('take');
				const items = server.slice((page - 1) * size, page * size).map((task) => ({ ...task }));
				return of(new HttpResponse({ body: { items, total: server.length } }));
			})
		};
		dialogResult = null;
		dialogService = { open: jest.fn(() => ({ onClose: of(dialogResult) })) };
		tasksService = {
			editTask: jest.fn((task: ITask) => {
				const stored = server.find(({ id }) => id === task.id);
				Object.assign(stored, { title: task.title, priority: task.priority });
				return of({ ...stored });
			}),
			createTask: jest.fn((task: ITask) => {
				const created = { ...taskNumbered(server.length + 1), title: task.title } as ITask;
				server.push(created);
				return of({ ...created });
			}),
			deleteTask: jest.fn((id: string) => {
				server = server.filter((task) => task.id !== id);
				return of(undefined);
			})
		};
		layout = ComponentLayoutStyleEnum.CARDS_GRID;
		loadingSeen = [];
	});

	afterEach(() => fixture?.destroy());

	/** The page at `/pages/tasks/<path>`, with its subscriptions started and its first page read. */
	const open = async (path: 'dashboard' | 'me' | 'team') => {
		await TestBed.configureTestingModule({
			declarations: [TaskComponent],
			providers: [
				{
					provide: ActivatedRoute,
					useValue: { snapshot: { url: [{ path }] }, queryParamMap: of(convertToParamMap({})) }
				},
				{ provide: Router, useValue: { navigate: jest.fn() } },
				{ provide: HttpClient, useValue: http },
				{ provide: NbDialogService, useValue: dialogService },
				{ provide: TasksService, useValue: tasksService },
				{ provide: TaskTrashService, useValue: { isEnabledOrFalse: jest.fn(async () => false) } },
				{ provide: GenericFavoriteService, useValue: { loadFavorites: jest.fn(async () => []) } },
				{ provide: ErrorHandlingService, useValue: { handleError: jest.fn() } },
				{ provide: HashNumberPipe, useValue: { transform: (value: string) => `#${value}` } },
				{
					provide: Store,
					useValue: {
						user: { tenantId: ORGANIZATION.tenantId },
						selectedOrganization: ORGANIZATION,
						selectedOrganization$: new BehaviorSubject(ORGANIZATION).asObservable(),
						selectedEmployee$: of(null),
						selectedProject$: of(null),
						selectedTeam$: of(null),
						componentLayout$: () => of(layout),
						hasAnyPermission: () => true,
						hasPermission: () => true
					}
				}
			],
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();

		fixture = TestBed.createComponent(TaskComponent);
		component = fixture.componentInstance;

		let loading = false;
		Object.defineProperty(component, 'loading', {
			configurable: true,
			get: () => loading,
			set: (value: boolean) => {
				loading = value;
				loadingSeen.push(value);
			}
		});

		component.ngOnInit();
		await settle();
		if (layout === ComponentLayoutStyleEnum.TABLE) {
			// The table reads its own source once it has it.
			await component.smartTableSource.getElements();
		}
	};

	/** Goes to the second page: the card grid scrolls to it, the table pages to it. */
	const toSecondPage = async () => {
		if (layout === ComponentLayoutStyleEnum.TABLE) {
			component.onPageChange(2);
			await settle();
			await component.smartTableSource.getElements();
		} else {
			component.onScroll();
			await settle();
		}
	};

	const showTask = (n: number) => component.viewTask(shown().find(({ id }) => id === `task-${n}`));

	describe.each([
		['Tasks', 'dashboard'],
		['My Tasks', 'me'],
		['Team Tasks', 'team']
	] as const)('%s, card grid', (_page, path) => {
		it('keeps the pages, the selection and the drawer when one task is saved, and shows its new values', async () => {
			await open(path);
			await toSecondPage();
			expect(shown()).toHaveLength(2 * PAGE_SIZE);
			showTask(15);
			loadingSeen = [];

			dialogResult = dialogValues();
			await component.editTaskDialog();
			await settle();

			expect(tasksService.editTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-15' }));
			// Both pages already scrolled through are read again, in one read, and none is dropped.
			expect(lastRead()).toEqual({ page: 1, size: 2 * PAGE_SIZE });
			expect(shown()).toHaveLength(2 * PAGE_SIZE);
			expect(shown().find(({ id }) => id === 'task-15').priority).toBe(TaskPriorityEnum.HIGH);
			expect(component.pagination.activePage).toBe(2);
			// No full-card loading state for a change to one card.
			expect(loadingSeen).not.toContain(true);
			// The drawer stays on the task and shows what was saved; the task stays selected.
			expect(component.viewedTask?.id).toBe('task-15');
			expect(component.viewedTask.priority).toBe(TaskPriorityEnum.HIGH);
			expect(component.selectedTask?.id).toBe('task-15');
			expect(component.selectedTask.priority).toBe(TaskPriorityEnum.HIGH);
			expect(component.disableButton).toBe(false);
		});
	});

	describe('Tasks, card grid', () => {
		it('keeps the pages, the selection and the drawer when a task is duplicated', async () => {
			await open('dashboard');
			await toSecondPage();
			showTask(15);
			loadingSeen = [];

			dialogResult = dialogValues({ title: 'Task 15 (copy)' });
			await component.duplicateTaskDialog();
			await settle();

			expect(tasksService.createTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Task 15 (copy)' }));
			expect(lastRead()).toEqual({ page: 1, size: 2 * PAGE_SIZE });
			expect(shown()).toHaveLength(2 * PAGE_SIZE);
			expect(component.pagination.activePage).toBe(2);
			expect(component.pagination.totalItems).toBe(26);
			expect(loadingSeen).not.toContain(true);
			expect(component.viewedTask?.id).toBe('task-15');
			expect(component.selectedTask?.id).toBe('task-15');
		});

		it('takes a deleted task out of the list, closes its drawer and keeps the rest where it was', async () => {
			await open('dashboard');
			await toSecondPage();
			showTask(15);
			loadingSeen = [];

			dialogResult = true;
			await component.deleteTask();
			await settle();

			expect(tasksService.deleteTask).toHaveBeenCalledWith('task-15');
			expect(lastRead()).toEqual({ page: 1, size: 2 * PAGE_SIZE });
			// The task that moved up from the third page fills the gap, so the next scroll skips nothing.
			expect(shown().map(({ id }) => id)).not.toContain('task-15');
			expect(shown().map(({ id }) => id)).toContain('task-21');
			expect(shown()).toHaveLength(2 * PAGE_SIZE);
			expect(component.pagination.activePage).toBe(2);
			expect(loadingSeen).not.toContain(true);
			// The deleted task cannot stay open or selected.
			expect(component.viewedTask).toBeFalsy();
			expect(component.selectedTask).toBeFalsy();
			expect(component.disableButton).toBe(true);
		});

		it('still shows the loading state for a page change and a filter change', async () => {
			await open('dashboard');
			loadingSeen = [];

			component.onScroll();
			await settle();
			expect(loadingSeen).toContain(true);
			expect(loadingSeen[loadingSeen.length - 1]).toBe(false);

			loadingSeen = [];
			internals().setFilter({ field: 'title', search: 'Task 1' });
			await settle();
			expect(loadingSeen).toContain(true);
		});

		it('drops the result of a read in place that a page change overtook', async () => {
			await open('dashboard');
			await toSecondPage();
			showTask(15);

			// The edit's read answers only after the next page was read.
			const late = new Subject<HttpResponse<unknown>>();
			http.get.mockImplementationOnce(() => late.asObservable());
			dialogResult = dialogValues();
			await component.editTaskDialog();

			component.onScroll();
			await settle();
			expect(shown()).toHaveLength(25);
			late.next(new HttpResponse({ body: { items: server.slice(0, 2 * PAGE_SIZE), total: server.length } }));
			late.complete();
			await settle(50);

			expect(component.pagination.activePage).toBe(3);
			expect(shown()).toHaveLength(25);
		});
	});

	describe('Tasks, table', () => {
		beforeEach(() => (layout = ComponentLayoutStyleEnum.TABLE));

		it('reads the page again in place when one task is saved, and keeps the selection and the drawer', async () => {
			await open('dashboard');
			await toSecondPage();
			const source = component.smartTableSource;
			showTask(15);
			loadingSeen = [];

			dialogResult = dialogValues();
			await component.editTaskDialog();
			await settle();

			// The same source reads the same page again: the table keeps its page and draws no loading state.
			expect(component.smartTableSource).toBe(source);
			expect(lastRead()).toEqual({ page: 2, size: PAGE_SIZE });
			expect(component.pagination.activePage).toBe(2);
			expect(loadingSeen).not.toContain(true);
			expect(component.viewedTask?.id).toBe('task-15');
			expect(component.viewedTask.priority).toBe(TaskPriorityEnum.HIGH);
			expect(component.selectedTask?.id).toBe('task-15');
		});

		it("keeps the selected task's row highlighted, whatever objects the table rebuilds its rows from", async () => {
			await open('dashboard');
			showTask(3);
			const { rowClassFunction: rowClass } = component.settingsSmartTable as {
				rowClassFunction: (row: { getData: () => ITask }) => string;
			};

			expect(rowClass({ getData: () => ({ ...taskNumbered(3) }) })).toContain('selected');
			expect(rowClass({ getData: () => ({ ...taskNumbered(4) }) })).not.toContain('selected');
		});
	});
});
