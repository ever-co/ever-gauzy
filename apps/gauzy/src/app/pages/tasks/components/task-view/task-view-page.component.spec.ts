import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { ITask, PermissionsEnum, TaskRelatedIssuesRelationEnum, TaskStatusEnum } from '@gauzy/contracts';
import {
	Store,
	TasksService,
	TimesheetService,
	TimesheetStatisticsService,
	ToastrService
} from '@gauzy/ui-core/core';
import { TimeZoneService } from '@gauzy/ui-core/shared';
import { TASK_EDIT_RELATIONS, TASK_PAGE_RELATIONS, TaskViewPageComponent } from './task-view-page.component';
import { buildTaskViewSections } from './task-view-sections';

const TASK_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const OTHER_ID = 'bbbbbbbb-2222-4222-8222-222222222222';
const ORGANIZATION = 'cccccccc-3333-4333-8333-333333333333';
const OTHER_ORGANIZATION = 'dddddddd-4444-4444-8444-444444444444';
const PROJECT_ID = 'eeeeeeee-5555-4555-8555-555555555555';

const task = (overrides: Partial<ITask> = {}): ITask =>
	({
		id: TASK_ID,
		title: 'chore(deps): bump dompurify',
		status: TaskStatusEnum.IN_PROGRESS,
		taskNumber: '12',
		organizationId: ORGANIZATION,
		...overrides
	}) as ITask;

/**
 * `/pages/tasks/view/:id` — the task on a full-width page of its own, which a task favorite opens
 * (owner, 2026-10-13, handover §4.P: the favorite used to open the dashboard LIST at `?taskId=`, which the
 * dashboard never even read). Laid out as Jira's issue page, with Hubstaff's time panels.
 */
describe('TaskViewPageComponent', () => {
	let fixture: ComponentFixture<TaskViewPageComponent>;
	let params$: BehaviorSubject<ParamMap>;
	let queryParams$: BehaviorSubject<ParamMap>;
	let organization$: BehaviorSubject<{ id: string }>;
	let tasksService: { getById: jest.Mock; editTask: jest.Mock };
	let statisticsService: { getTasksStatistics: jest.Mock; getTaskEmployees: jest.Mock };
	let timesheetService: { getDailyReportChart: jest.Mock; getTimeLogs: jest.Mock };
	let http: { get: jest.Mock; put: jest.Mock };
	let toastr: { success: jest.Mock; danger: jest.Mock };
	let dialogService: { open: jest.Mock };
	let router: { navigate: jest.Mock; createUrlTree: jest.Mock; serializeUrl: jest.Mock };
	let permissions: PermissionsEnum[];

	/** The HTTP reads the page makes itself: task statuses and linked issues. */
	let statuses: any[];
	let outgoingLinks: any;
	let incomingLinks: any;

	beforeEach(async () => {
		params$ = new BehaviorSubject(convertToParamMap({ id: TASK_ID }));
		queryParams$ = new BehaviorSubject(convertToParamMap({}));
		organization$ = new BehaviorSubject({ id: ORGANIZATION });
		tasksService = {
			getById: jest.fn(async (id: string) => task({ id })),
			editTask: jest.fn(() => of({}))
		};
		statisticsService = {
			getTasksStatistics: jest.fn(async () => []),
			getTaskEmployees: jest.fn(async () => [])
		};
		timesheetService = {
			getDailyReportChart: jest.fn(async () => []),
			getTimeLogs: jest.fn(async () => [])
		};
		statuses = [];
		outgoingLinks = of({ items: [] });
		incomingLinks = of({ items: [] });
		http = {
			get: jest.fn((url: string, options: any) => {
				if (url.endsWith('/task-statuses')) return of({ items: statuses });
				const where = options?.params?.toString() || '';
				return where.includes('taskFromId') ? outgoingLinks : incomingLinks;
			}),
			put: jest.fn(() => of({}))
		};
		toastr = { success: jest.fn(), danger: jest.fn() };
		dialogService = { open: jest.fn(() => ({ onClose: of(null) })) };
		router = {
			navigate: jest.fn(async () => true),
			createUrlTree: jest.fn((commands: string[]) => commands),
			serializeUrl: jest.fn((commands: string[]) => commands.join('/'))
		};
		permissions = [];
		await TestBed.configureTestingModule({
			declarations: [TaskViewPageComponent],
			providers: [
				{
					provide: ActivatedRoute,
					useValue: { paramMap: params$.asObservable(), queryParamMap: queryParams$.asObservable() }
				},
				{ provide: Router, useValue: router },
				{ provide: HttpClient, useValue: http },
				{ provide: NbDialogService, useValue: dialogService },
				{ provide: TasksService, useValue: tasksService },
				{ provide: TimesheetService, useValue: timesheetService },
				{ provide: TimesheetStatisticsService, useValue: statisticsService },
				{ provide: TimeZoneService, useValue: { currentTimeZone: 'UTC' } },
				{ provide: ToastrService, useValue: toastr },
				{
					provide: Store,
					useValue: {
						selectedOrganization$: organization$.asObservable(),
						hasAnyPermission: (...wanted: PermissionsEnum[]) => wanted.some((p) => permissions.includes(p))
					}
				}
			],
			// The record view, the page frame, the panels' components and the favorite star have their own specs.
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
	});

	/** Created once the permissions of the test are set: the page reads them when it is built. */
	const create = () => {
		fixture = TestBed.createComponent(TaskViewPageComponent);
		return fixture.componentInstance;
	};

	const settle = async () => {
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	};

	/**
	 * The panels read once the task has loaded: let them answer. Microtasks only — a timer turn would also run
	 * the zone's late "uncaught" reports of the error tests' already-handled rejections.
	 */
	const flush = async () => {
		for (let i = 0; i < 10; i++) await Promise.resolve();
	};

	it('loads the task the URL names, with the relations the page reads', async () => {
		const page = create();
		await settle();

		expect(tasksService.getById).toHaveBeenCalledWith(TASK_ID, TASK_PAGE_RELATIONS);
		expect(page.state).toBe('ready');
		expect(page.task.id).toBe(TASK_ID);
		expect(page.detailsSections.length).toBeGreaterThan(0);
		expect(page.status).toEqual(expect.objectContaining({ text: 'in progress', tone: 'info' }));
	});

	it('renders the drawer sections, the description in the wide column, the details and stamps beside', async () => {
		const page = create();
		await settle();

		const expected = buildTaskViewSections(page.task, { translate: (key) => key, hash: (value) => `#${value}` });
		expect([...page.detailsSections, ...page.mainSections, ...page.metaSections].map((s) => s.title)).toEqual(
			expected.map((section) => section.title)
		);
		expect(page.mainSections.every((section) => section.variant === 'plain')).toBe(true);
		expect(page.metaSections.every((section) => section.variant === 'meta')).toBe(true);
	});

	it('leaves the status out of the details: the header is its button', async () => {
		const page = create();
		await settle();

		const labels = page.detailsSections.flatMap((section) => section.fields.map((field) => field.label));
		expect(labels).not.toContain('TASKS_PAGE.TASKS_STATUS');
		expect(labels).toContain('TASKS_PAGE.TASK_PRIORITY');
	});

	it('leaves the project out of the details: it has a panel of its own', async () => {
		const page = create();
		await settle();

		const labels = page.detailsSections.flatMap((section) => section.fields.map((field) => field.label));
		expect(labels).not.toContain('TASKS_PAGE.TASKS_PROJECT');
	});

	it('follows the URL to the next task when the page is reused', async () => {
		const page = create();
		await settle();
		params$.next(convertToParamMap({ id: OTHER_ID }));
		await settle();

		expect(tasksService.getById).toHaveBeenLastCalledWith(OTHER_ID, TASK_PAGE_RELATIONS);
		expect(page.task.id).toBe(OTHER_ID);
	});

	it.each([
		[404, 'not-found'],
		[400, 'not-found'],
		[403, 'forbidden'],
		[500, 'error']
	])('answers a %s with the "%s" state and shows no record', async (status, state) => {
		tasksService.getById.mockRejectedValueOnce(new HttpErrorResponse({ status }));
		const page = create();
		await settle();

		expect(page.state).toBe(state);
		expect(page.task).toBeNull();
	});

	it('reloads on retry after an error', async () => {
		tasksService.getById.mockRejectedValueOnce(new HttpErrorResponse({ status: 500 }));
		const page = create();
		await settle();
		await page.load();

		expect(page.state).toBe('ready');
	});

	/*
	 * Review on #10589: the page used to keep showing a task after the header switched organization,
	 * while its favorite star already used the new one — so the star could file organization A's task under
	 * organization B.
	 */
	it('reloads when the header switches organization, and refuses a task of another organization', async () => {
		const page = create();
		await settle();
		expect(page.state).toBe('ready');

		organization$.next({ id: OTHER_ORGANIZATION });
		await settle();

		expect(tasksService.getById).toHaveBeenCalledTimes(2);
		expect(page.state).toBe('not-found');
		expect(page.task).toBeNull();
	});

	it('discards a load that a newer organization switch overtook', async () => {
		let answerFirst: (task: ITask) => void;
		tasksService.getById.mockImplementationOnce(() => new Promise<ITask>((resolve) => (answerFirst = resolve)));
		const page = create();
		fixture.detectChanges(); // first load, still pending
		tasksService.getById.mockResolvedValueOnce(task({ organizationId: OTHER_ORGANIZATION, title: 'B task' }));
		organization$.next({ id: OTHER_ORGANIZATION });
		await settle();

		answerFirst(task({ title: 'A task' })); // the stale answer arrives last
		await settle();

		expect(page.task.title).toBe('B task');
		expect(page.state).toBe('ready');
	});

	describe('time', () => {
		it('tracks the time logged against the estimate, and lists who worked most on the task', async () => {
			tasksService.getById.mockResolvedValueOnce(task({ estimate: 4 * 3600, projectId: PROJECT_ID }));
			statisticsService.getTasksStatistics.mockResolvedValueOnce([{ id: TASK_ID, duration: 3 * 3600 }]);
			statisticsService.getTaskEmployees.mockResolvedValueOnce([
				{ id: 'e1', duration: 2 * 3600, user: { firstName: 'Ann', lastName: 'Brown' } },
				{ id: 'e2', duration: 3600, user: { firstName: 'Carl', lastName: 'Diaz' } }
			]);
			const page = create();
			await settle();
			await flush();

			// The project lets a manager of it see its members' time.
			expect(statisticsService.getTaskEmployees).toHaveBeenCalledWith(
				expect.objectContaining({ organizationId: ORGANIZATION, taskIds: [TASK_ID], projectIds: [PROJECT_ID] })
			);
			expect(page.tracking.value).toEqual(
				expect.objectContaining({ logged: '3h 00m', estimate: '4h 00m', remaining: '1h 00m', over: null })
			);
			expect(page.workers.map((worker) => worker.person.name)).toEqual(['Ann Brown', 'Carl Diaz']);
		});

		it('reads the hours per day and the recent entries of the task only', async () => {
			create();
			await settle();
			await flush();

			expect(timesheetService.getDailyReportChart).toHaveBeenCalledWith(
				expect.objectContaining({ taskIds: [TASK_ID], organizationId: ORGANIZATION })
			);
			expect(timesheetService.getTimeLogs).toHaveBeenCalledWith(
				expect.objectContaining({ taskIds: [TASK_ID] }),
				['employee', 'employee.user', 'timeSlots']
			);
		});

		it('keeps the page when the time reads fail, blanking only their panels', async () => {
			statisticsService.getTasksStatistics.mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }));
			statisticsService.getTaskEmployees.mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }));
			timesheetService.getDailyReportChart.mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }));
			timesheetService.getTimeLogs.mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }));
			const page = create();
			await settle();
			await flush();

			expect(page.state).toBe('ready');
			expect(page.tracking.failed).toBe(true);
			expect(page.hours.failed).toBe(true);
			expect(page.entries.failed).toBe(true);
			expect(page.workers).toEqual([]);
		});
	});

	describe('subtasks', () => {
		it('lists the subtasks, open ones first, and counts the ones done', async () => {
			tasksService.getById.mockResolvedValueOnce(
				task({
					children: [
						{ id: 's1', title: 'Write docs', status: TaskStatusEnum.DONE, number: 3, taskNumber: '3' },
						{ id: 's2', title: 'Fix bug', status: TaskStatusEnum.OPEN, number: 5, taskNumber: '5' },
						{ id: 's3', title: 'Add test', status: TaskStatusEnum.IN_PROGRESS, number: 4, taskNumber: '4' }
					] as unknown as ITask[]
				})
			);
			const page = create();
			await settle();

			expect(page.subtasks.map((row) => row.id)).toEqual(['s3', 's2', 's1']);
			expect(page.subtasks.map((row) => row.done)).toEqual([false, false, true]);
			expect(page.subtaskCount).toEqual(expect.objectContaining({ done: 1, total: 3 }));
			expect(page.taskLink('s1')).toEqual(['/pages/tasks/view', 's1']);
		});

		it('has no subtask count for a task without subtasks', async () => {
			const page = create();
			await settle();

			expect(page.subtasks).toEqual([]);
			expect(page.subtaskCount).toBeNull();
		});
	});

	describe('linked issues', () => {
		it('groups the links the task starts and the ones that end at it, read from its side', async () => {
			outgoingLinks = of({
				items: [{ id: 'l1', action: TaskRelatedIssuesRelationEnum.BLOCKS, taskTo: { id: 't2', title: 'Ship it' } }]
			});
			incomingLinks = of({
				items: [{ id: 'l2', action: TaskRelatedIssuesRelationEnum.BLOCKS, taskFrom: { id: 't3', title: 'Design' } }]
			});
			const page = create();
			await settle();
			await flush();

			expect(page.links.value.map((group) => [group.label, group.rows.map((row) => row.taskId)])).toEqual([
				['TASK_VIEW.LINKS.IS_BLOCKED_BY', ['t3']],
				['TASK_VIEW.LINKS.BLOCKS', ['t2']]
			]);
		});

		it('says the links are unavailable only when both reads fail', async () => {
			outgoingLinks = throwError(() => new HttpErrorResponse({ status: 403 }));
			incomingLinks = throwError(() => new HttpErrorResponse({ status: 403 }));
			const page = create();
			await settle();
			await flush();

			expect(page.links.failed).toBe(true);
		});
	});

	describe('status', () => {
		const STATUSES = [
			{ id: 'st-2', name: 'Done', value: 'done', order: 2, organizationId: ORGANIZATION },
			{ id: 'st-1', name: 'In Progress', value: 'in-progress', order: 1, organizationId: ORGANIZATION }
		];

		it('offers the statuses, in their order, to those who may edit the task', async () => {
			permissions = [PermissionsEnum.ORG_TASK_EDIT];
			statuses = STATUSES;
			const page = create();
			await settle();
			await flush();

			expect(page.canEdit).toBe(true);
			expect(page.statuses.map((status) => status.id)).toEqual(['st-1', 'st-2']);
		});

		it("finds the task's status in the menu by its row, else by its value", async () => {
			permissions = [PermissionsEnum.ORG_TASK_EDIT];
			statuses = STATUSES;
			// Many tasks carry only the status value, with no status row.
			tasksService.getById.mockResolvedValueOnce(task({ status: TaskStatusEnum.IN_PROGRESS, taskStatusId: null }));
			const page = create();
			await settle();
			await flush();

			expect(page.currentStatusId).toBe('st-1');
			expect(page.currentStatus?.name).toBe('In Progress');
		});

		it('reads no statuses for those who may not edit the task', async () => {
			statuses = STATUSES;
			const page = create();
			await settle();
			await flush();

			expect(page.canEdit).toBe(false);
			expect(page.statuses).toEqual([]);
			expect(http.get).not.toHaveBeenCalledWith(expect.stringContaining('/task-statuses'), expect.anything());
		});

		it('saves the status alone, then reads the task again', async () => {
			permissions = [PermissionsEnum.ALL_ORG_EDIT];
			statuses = STATUSES;
			const page = create();
			await settle();
			await flush();

			await page.changeStatus('st-2');

			expect(http.put).toHaveBeenCalledWith(`/api/tasks/${TASK_ID}/status`, {
				status: 'done',
				taskStatusId: 'st-2',
				organizationId: ORGANIZATION,
				tenantId: undefined
			});
			expect(tasksService.getById).toHaveBeenCalledTimes(2);
			expect(page.savingStatus).toBe(false);
		});

		it('says why a status change failed, and keeps the task', async () => {
			permissions = [PermissionsEnum.ALL_ORG_EDIT];
			statuses = STATUSES;
			http.put.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 400 })));
			const page = create();
			await settle();
			await flush();

			await page.changeStatus('st-2');

			expect(toastr.danger).toHaveBeenCalled();
			expect(page.task.id).toBe(TASK_ID);
			expect(page.savingStatus).toBe(false);
		});
	});

	describe('edit', () => {
		it('opens the dialog on the task read with its modules, which the dialog saves back', async () => {
			permissions = [PermissionsEnum.ORG_TASK_EDIT];
			const page = create();
			await settle();
			const modules = [{ id: 'm1', name: 'Auth' }];
			tasksService.getById.mockResolvedValueOnce(task({ modules } as any));

			await page.edit();

			expect(tasksService.getById).toHaveBeenLastCalledWith(TASK_ID, TASK_EDIT_RELATIONS);
			expect(TASK_EDIT_RELATIONS).toContain('modules');
			expect(dialogService.open).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ context: { selectedTask: expect.objectContaining({ modules }) } })
			);
		});

		it('opens no dialog when the task cannot be read with its modules', async () => {
			permissions = [PermissionsEnum.ORG_TASK_EDIT];
			const page = create();
			await settle();
			tasksService.getById.mockRejectedValueOnce(new HttpErrorResponse({ status: 500 }));

			await page.edit();

			expect(dialogService.open).not.toHaveBeenCalled();
			expect(toastr.danger).toHaveBeenCalled();
		});
	});

	describe('moving to another task', () => {
		const STATUSES = [{ id: 'st-1', name: 'In Progress', value: 'in-progress', order: 1, organizationId: ORGANIZATION }];

		it("drops the previous task's statuses and figures while the next one loads", async () => {
			permissions = [PermissionsEnum.ORG_TASK_EDIT];
			statuses = STATUSES;
			statisticsService.getTaskEmployees.mockResolvedValueOnce([
				{ id: 'e1', duration: 3600, user: { firstName: 'Ann', lastName: 'Brown' } }
			]);
			const page = create();
			await settle();
			await flush();
			expect(page.statuses.length).toBe(1);
			expect(page.workers.length).toBe(1);

			tasksService.getById.mockImplementationOnce(() => new Promise<ITask>(() => undefined)); // the next task waits
			params$.next(convertToParamMap({ id: OTHER_ID }));
			fixture.detectChanges();

			expect(page.state).toBe('loading');
			expect(page.statuses).toEqual([]);
			expect(page.currentStatusId).toBeNull();
			expect(page.workers).toEqual([]);
			expect(page.tracking).toEqual(expect.objectContaining({ loading: true, value: null }));
		});

		it('lets the next task finish loading when a status save for the previous one lands after it', async () => {
			permissions = [PermissionsEnum.ORG_TASK_EDIT];
			statuses = [...STATUSES, { id: 'st-2', name: 'Done', value: 'done', order: 2, organizationId: ORGANIZATION }];
			let answerSave: (value: unknown) => void;
			http.put.mockReturnValueOnce({
				subscribe: (observer: any) => {
					answerSave = (value) => {
						observer.next?.(value);
						observer.complete?.();
					};
					return { unsubscribe: () => undefined };
				}
			});
			const page = create();
			await settle();
			await flush();

			const saving = page.changeStatus('st-2'); // still saving
			params$.next(convertToParamMap({ id: OTHER_ID })); // the user follows a linked task
			await settle();
			answerSave({});
			await saving;
			await settle();

			expect(page.task.id).toBe(OTHER_ID);
			expect(page.state).toBe('ready');
		});

		it('reads the panels again when the read after a change fails', async () => {
			permissions = [PermissionsEnum.ORG_TASK_EDIT];
			statuses = [
				...STATUSES,
				{ id: 'st-2', name: 'Done', value: 'done', order: 2, organizationId: ORGANIZATION }
			];
			const page = create();
			await settle();
			await flush();
			const reads = timesheetService.getTimeLogs.mock.calls.length;
			tasksService.getById.mockRejectedValueOnce(new HttpErrorResponse({ status: 500 }));

			await page.changeStatus('st-2');
			await flush();

			expect(timesheetService.getTimeLogs.mock.calls.length).toBe(reads + 1);
			expect(page.task.id).toBe(TASK_ID);
			expect(page.entries.loading).toBe(false);
		});
	});

	it("copies the page's address, keeping to the app's hash routes", async () => {
		const writeText = jest.fn(async () => undefined);
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		window.location.hash = '#/pages/tasks/view/x';
		const page = create();
		await settle();

		await page.copyLink();

		expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`#/pages/tasks/view/${TASK_ID}`));
		expect(toastr.success).toHaveBeenCalledWith('TASK_VIEW.LINK_COPIED');
	});
});
