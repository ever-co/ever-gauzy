import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { ComponentLayoutStyleEnum, ITask, TaskListTypeEnum, TaskPriorityEnum } from '@gauzy/contracts';
import {
	ErrorHandlingService,
	GenericFavoriteService,
	Store,
	TasksService,
	TasksStoreService,
	TaskTrashService
} from '@gauzy/ui-core/core';
import { HashNumberPipe } from '@gauzy/ui-core/shared';
import { TaskComponent } from './task.component';

const ORGANIZATION = { id: 'org-1', tenantId: 'tenant-1', name: 'Ever' };
const OTHER_ORGANIZATION = { id: 'org-2', tenantId: 'tenant-1', name: 'Other' };

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
	/** The project selected in the header: a sprint project opens the sprint view. */
	let project: { id: string; taskListType: TaskListTypeEnum } | null;
	let organization$: BehaviorSubject<typeof ORGANIZATION>;
	let errors: { handleError: jest.Mock };
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
				// The other organization holds tasks of its own.
				const tasks =
					options.params.get('where[organizationId]') === OTHER_ORGANIZATION.id
						? [{ ...taskNumbered(901), organizationId: OTHER_ORGANIZATION.id } as ITask]
						: server;
				const items = tasks.slice((page - 1) * size, page * size).map((task) => ({ ...task }));
				return of(new HttpResponse({ body: { items, total: tasks.length } }));
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
		project = null;
		organization$ = new BehaviorSubject(ORGANIZATION);
		errors = { handleError: jest.fn() };
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
				{ provide: ErrorHandlingService, useValue: errors },
				{ provide: HashNumberPipe, useValue: { transform: (value: string) => `#${value}` } },
				{
					provide: Store,
					useValue: {
						user: { tenantId: ORGANIZATION.tenantId },
						selectedOrganization: ORGANIZATION,
						selectedOrganization$: organization$.asObservable(),
						selectedEmployee$: of(null),
						selectedProject$: of(project),
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
		if (layout === ComponentLayoutStyleEnum.TABLE && !project) {
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
			// Both pages already scrolled through are read again, in one read of the API's largest page, and none is dropped.
			expect(lastRead()).toEqual({ page: 1, size: 100 });
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
			expect(lastRead()).toEqual({ page: 1, size: 100 });
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
			expect(lastRead()).toEqual({ page: 1, size: 100 });
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

		/** The answer of the next list read waits until the test sends it, or fails it with `.fail()`. */
		const holdNextRead = () => {
			const late = new Subject<HttpResponse<unknown>>();
			http.get.mockImplementationOnce(() => late.asObservable());
			const answer = (items: ITask[], total = server.length) => {
				late.next(new HttpResponse({ body: { items: items.map((task) => ({ ...task })), total } }));
				late.complete();
			};
			return Object.assign(answer, { fail: () => late.error(new Error('API unreachable')) });
		};
		/** The page's read of `page` and the answer of size `PAGE_SIZE` it gets from the API. */
		const pageOf = (page: number) => server.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
		const ids = () => shown().map(({ id }) => id);

		it('keeps the next page after the pages read again when the read in place answers after it', async () => {
			await open('dashboard');
			await toSecondPage();
			showTask(15);

			const answer = holdNextRead();
			dialogResult = dialogValues();
			await component.editTaskDialog();
			const readAgain = server.slice(0, 2 * PAGE_SIZE);

			component.onScroll();
			await settle();
			expect(shown()).toHaveLength(25);
			answer(readAgain);
			await settle(50);

			expect(component.pagination.activePage).toBe(3);
			expect(ids()).toEqual(server.map(({ id }) => id));
			expect(shown().find(({ id }) => id === 'task-15').priority).toBe(TaskPriorityEnum.HIGH);
		});

		it('does not show a page twice when a save is read again while that page is still loading', async () => {
			await open('dashboard');

			// The second page is asked for, and its answer is late. A task of the first page is then saved.
			const answerPage = holdNextRead();
			component.onScroll();
			await settle();
			expect(component.loading).toBe(true);
			showTask(3);

			dialogResult = dialogValues({ title: 'Task 3' });
			await component.editTaskDialog();
			await settle(50);
			// The read in place covers both pages already.
			expect(ids()).toEqual(server.slice(0, 2 * PAGE_SIZE).map(({ id }) => id));
			expect(component.loading).toBe(false);

			answerPage(server.slice(PAGE_SIZE, 2 * PAGE_SIZE));
			await settle(50);
			expect(ids()).toEqual(server.slice(0, 2 * PAGE_SIZE).map(({ id }) => id));
		});

		it("keeps a later save's values when an earlier save's read answers last", async () => {
			await open('dashboard');
			showTask(3);

			const answerFirst = holdNextRead();
			dialogResult = dialogValues({ title: 'First' });
			await component.editTaskDialog();
			const firstRead = server.slice(0, PAGE_SIZE).map((task) => ({ ...task }));

			dialogResult = dialogValues({ title: 'Second' });
			await component.editTaskDialog();
			await settle(50);
			expect(shown().find(({ id }) => id === 'task-3').title).toBe('Second');

			answerFirst(firstRead);
			await settle(50);
			expect(shown().find(({ id }) => id === 'task-3').title).toBe('Second');
			expect(component.viewedTask.title).toBe('Second');
		});

		it("does not bring an organization's tasks back after another organization is selected", async () => {
			await open('dashboard');
			showTask(3);

			const answer = holdNextRead();
			dialogResult = dialogValues({ title: 'Task 3' });
			await component.editTaskDialog();

			organization$.next(OTHER_ORGANIZATION);
			answer(server.slice(0, PAGE_SIZE));
			await settle();

			expect(ids()).toEqual(['task-901']);
		});

		it('does not put rows back over a column filter applied while a read in place is under way', async () => {
			await open('dashboard');
			showTask(3);

			const answer = holdNextRead();
			dialogResult = dialogValues({ title: 'Task 3' });
			await component.editTaskDialog();

			internals().setFilter({ field: 'title', search: 'Task 1' });
			answer(server.slice(0, PAGE_SIZE).map((task) => ({ ...task, title: 'Unfiltered' }) as ITask));
			await settle();

			expect(shown().some(({ title }) => title === 'Unfiltered')).toBe(false);
		});

		it('leaves the loading state on while a page read that started after the read in place is under way', async () => {
			await open('dashboard');
			showTask(3);

			const answerReadAgain = holdNextRead();
			dialogResult = dialogValues({ title: 'Task 3' });
			await component.editTaskDialog();

			const answerPage = holdNextRead();
			component.onScroll();
			await settle();
			expect(component.loading).toBe(true);

			answerReadAgain(pageOf(1));
			await settle(50);
			// The second page is still loading.
			expect(component.loading).toBe(true);

			answerPage(pageOf(2));
			await settle(50);
			expect(component.loading).toBe(false);
			expect(ids()).toEqual(server.slice(0, 2 * PAGE_SIZE).map(({ id }) => id));
		});

		it("does not turn off another organization's loading state when an older read in place fails", async () => {
			await open('dashboard');
			showTask(3);

			const failReadAgain = holdNextRead();
			dialogResult = dialogValues({ title: 'Task 3' });
			await component.editTaskDialog();

			const answerOther = holdNextRead();
			organization$.next(OTHER_ORGANIZATION);
			await settle();
			expect(component.loading).toBe(true);

			failReadAgain.fail();
			await settle(50);
			expect(component.loading).toBe(true);

			answerOther([{ ...taskNumbered(901), organizationId: OTHER_ORGANIZATION.id } as ITask], 1);
			await settle(50);
			expect(component.loading).toBe(false);
			expect(ids()).toEqual(['task-901']);
		});

		it('puts back a page that answered while a read in place covered it, when that read fails', async () => {
			await open('dashboard');

			const answerPage = holdNextRead();
			component.onScroll();
			await settle();
			showTask(3);

			const failReadAgain = holdNextRead();
			dialogResult = dialogValues({ title: 'Task 3' });
			await component.editTaskDialog();

			answerPage(pageOf(2));
			await settle(50);
			// Covered by the read in place, it waits.
			expect(ids()).toEqual(pageOf(1).map(({ id }) => id));

			failReadAgain.fail();
			await settle(50);
			expect(ids()).toEqual(server.slice(0, 2 * PAGE_SIZE).map(({ id }) => id));
			expect(component.loading).toBe(false);
		});

		it('lets a page still loading write the list when the read in place covering it fails', async () => {
			await open('dashboard');

			const answerPage = holdNextRead();
			component.onScroll();
			await settle();
			showTask(3);

			const failReadAgain = holdNextRead();
			dialogResult = dialogValues({ title: 'Task 3' });
			await component.editTaskDialog();

			failReadAgain.fail();
			await settle(50);
			answerPage(pageOf(2));
			await settle(50);

			expect(ids()).toEqual(server.slice(0, 2 * PAGE_SIZE).map(({ id }) => id));
			expect(component.loading).toBe(false);
		});

		it('does not put back a page that a successful read in place already showed when a later one fails', async () => {
			await open('dashboard');

			// Page 2 is under way when save A is read again; A answers first and shows page 2.
			const page = holdNextRead();
			component.onScroll();
			await settle();
			showTask(3);
			const readAgainA = holdNextRead();
			dialogResult = dialogValues({ title: 'First' });
			await component.editTaskDialog();
			readAgainA(server.slice(0, 2 * PAGE_SIZE));
			await settle(50);
			expect(ids()).toEqual(server.slice(0, 2 * PAGE_SIZE).map(({ id }) => id));

			// The original page 2 answers late, then save B's read fails.
			page(pageOf(2));
			await settle(50);
			const readAgainB = holdNextRead();
			dialogResult = dialogValues({ title: 'Second' });
			await component.editTaskDialog();
			readAgainB.fail();
			await settle(50);

			expect(ids()).toEqual(server.slice(0, 2 * PAGE_SIZE).map(({ id }) => id));
			expect(component.loading).toBe(false);
		});

		it('turns the loading state off when a covered page read and the read in place covering it both fail', async () => {
			await open('dashboard');

			const page = holdNextRead();
			component.onScroll();
			await settle();
			showTask(3);
			expect(component.loading).toBe(true);

			const readAgain = holdNextRead();
			dialogResult = dialogValues({ title: 'Task 3' });
			await component.editTaskDialog();

			page.fail();
			await settle(50);
			readAgain.fail();
			await settle(50);

			expect(component.loading).toBe(false);
			expect(ids()).toEqual(pageOf(1).map(({ id }) => id));
			// One report: the read in place answered for the page read it covered.
			expect(errors.handleError).toHaveBeenCalledTimes(1);
		});

		it('puts back a covered page when the last read in place fails after an earlier one failed', async () => {
			await open('dashboard');

			// P: the second page, under way.
			const page = holdNextRead();
			component.onScroll();
			await settle();
			showTask(3);

			// A, then B: two saves read again.
			const readAgainA = holdNextRead();
			dialogResult = dialogValues({ title: 'First' });
			await component.editTaskDialog();
			const readAgainB = holdNextRead();
			dialogResult = dialogValues({ title: 'Second' });
			await component.editTaskDialog();

			page(pageOf(2));
			await settle(50);
			readAgainA.fail();
			await settle(50);
			readAgainB.fail();
			await settle(50);

			expect(ids()).toEqual(server.slice(0, 2 * PAGE_SIZE).map(({ id }) => id));
			expect(component.loading).toBe(false);
		});

		it("reads a long list again in reads of at most 100 tasks, the API's largest page", async () => {
			server = Array.from({ length: 120 }, (_, index) => taskNumbered(index + 1));
			await open('dashboard');
			// Scrolled down to the eleventh page.
			for (let page = 2; page <= 11; page++) {
				component.onScroll();
				await settle(600);
			}
			expect(component.pagination.activePage).toBe(11);
			showTask(105);
			const readsBefore = http.get.mock.calls.length;

			dialogResult = dialogValues({ title: 'Task 105' });
			await component.editTaskDialog();
			await settle(50);

			const reads = http.get.mock.calls.slice(readsBefore).map(pagingOf);
			expect(reads).toEqual([
				{ page: 1, size: 100 },
				{ page: 2, size: 100 }
			]);
			expect(ids()).toEqual(server.slice(0, 11 * PAGE_SIZE).map(({ id }) => id));
			expect(component.viewedTask?.id).toBe('task-105');
		}, 30000);
	});

	describe('Tasks, sprint view in the table layout', () => {
		beforeEach(() => {
			layout = ComponentLayoutStyleEnum.TABLE;
			project = { id: 'project-1', taskListType: TaskListTypeEnum.SPRINT };
			server = server.slice(0, PAGE_SIZE);
		});

		it('reads its page again through the source its pager follows, so a new task shows a second page', async () => {
			await open('dashboard');
			const source = component.smartTableSource;
			const changes: string[] = [];
			source.onChanged().subscribe(({ action }) => changes.push(action));
			expect(source.count()).toBe(PAGE_SIZE);

			dialogResult = dialogValues({ title: 'Task 11' });
			await component.createTaskDialog();
			await settle(50);

			expect(component.smartTableSource).toBe(source);
			expect(source.count()).toBe(PAGE_SIZE + 1);
			expect(component.pagination.totalItems).toBe(PAGE_SIZE + 1);
			// The pager redraws on the source's change.
			expect(changes).toContain('refresh');
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

		it('reports a failed read of the page once, and keeps the list, when one task is saved', async () => {
			await open('dashboard');
			await toSecondPage();
			showTask(15);
			const loadAllTasks = jest.spyOn(TestBed.inject(TasksStoreService), 'loadAllTasks');
			loadAllTasks.mockClear();
			errors.handleError.mockClear();

			http.get.mockImplementationOnce(() => throwError(() => new Error('API unreachable')));
			dialogResult = dialogValues();
			await component.editTaskDialog();
			await settle(50);

			expect(errors.handleError).toHaveBeenCalledTimes(1);
			expect(loadAllTasks).not.toHaveBeenCalled();
			expect(component.loading).toBe(false);
			expect(component.viewedTask?.id).toBe('task-15');
		});

		it('keeps what the list shows when a read fails, instead of the answer before it', async () => {
			await open('dashboard');
			showTask(3);
			const store = TestBed.inject(TasksStoreService);
			const loadAllTasks = jest.spyOn(store, 'loadAllTasks');

			http.get.mockImplementationOnce(() => throwError(() => new Error('API unreachable')));
			await component.smartTableSource.getElements().catch(() => undefined);

			expect(loadAllTasks).not.toHaveBeenCalled();
			expect(component.loading).toBe(false);
			expect(component.viewedTask?.id).toBe('task-3');
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
