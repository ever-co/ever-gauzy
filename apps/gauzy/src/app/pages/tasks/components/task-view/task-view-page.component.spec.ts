import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import {
	ITask,
	PermissionsEnum,
	TaskPriorityEnum,
	TaskRelatedIssuesRelationEnum,
	TaskStatusEnum
} from '@gauzy/contracts';
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
	let tasksService: { getById: jest.Mock; editTask: jest.Mock; createTask: jest.Mock };
	let statisticsService: { getTasksStatistics: jest.Mock; getTaskEmployees: jest.Mock };
	let timesheetService: { getDailyReportChart: jest.Mock; getTimeLogs: jest.Mock };
	let http: { get: jest.Mock; put: jest.Mock };
	let toastr: { success: jest.Mock; danger: jest.Mock };
	let dialogService: { open: jest.Mock };
	let router: { navigate: jest.Mock; createUrlTree: jest.Mock; serializeUrl: jest.Mock<string, [any]> };
	let permissions: PermissionsEnum[];
	/** Emits when the test loads permissions, as the store does once they arrive. */
	let permissions$: BehaviorSubject<PermissionsEnum[]>;

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
			editTask: jest.fn(() => of({})),
			createTask: jest.fn(() => of({}))
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
			createUrlTree: jest.fn((commands: string[], extras?: { queryParams?: Record<string, string> }) => ({
				commands,
				queryParams: extras?.queryParams || {}
			})),
			serializeUrl: jest.fn(({ commands, queryParams }: { commands: string[]; queryParams: Record<string, string> }) => {
				const query = new URLSearchParams(queryParams).toString();
				return commands.join('/') + (query ? `?${query}` : '');
			})
		};
		permissions = [];
		permissions$ = new BehaviorSubject<PermissionsEnum[]>([]);
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
						userRolePermissions$: permissions$.asObservable(),
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

	describe('back button', () => {
		const PARENT = { id: OTHER_ID, title: 'The main task' } as ITask;

		it('leads a task to the list it belongs to', async () => {
			const page = create();
			await settle();

			expect(page.backLink).toBe('/pages/tasks/dashboard');
			expect(page.backLabel).toBe('RECORD_VIEW_PAGE.BACK_TO_LIST');
		});

		it('leads a subtask to its main task, and says so', async () => {
			tasksService.getById.mockImplementation(async (id: string) => task({ id, parentId: OTHER_ID, parent: PARENT }));
			const page = create();
			await settle();

			expect(page.backLink).toBe(`/pages/tasks/view/${OTHER_ID}`);
			expect(page.backLabel).toBe('TASKS_PAGE.PARENT_TASK');
		});

		it('leads to the list while the task loads, with no task to go by', () => {
			const page = create();

			expect(page.backLink).toBe('/pages/tasks/dashboard');
		});

		it('leads to the list from a subtask whose main task is gone: its page would read "not found"', async () => {
			tasksService.getById.mockImplementation(async (id: string) => task({ id, parentId: OTHER_ID, parent: null }));
			const page = create();
			await settle();

			expect(page.backLink).toBe('/pages/tasks/dashboard');
			expect(page.backLabel).toBe('RECORD_VIEW_PAGE.BACK_TO_LIST');
		});
	});

	describe('project panel', () => {
		const PROJECT = { id: PROJECT_ID, name: 'Gauzy Platform' };
		const panel = (): HTMLElement => fixture.nativeElement.querySelector('.task-project');

		beforeEach(() => {
			tasksService.getById.mockImplementation(async (id: string) =>
				task({ id, projectId: PROJECT_ID, project: PROJECT as any })
			);
		});

		it("links the task's project to the project's own page for those who may view projects", async () => {
			permissions = [PermissionsEnum.ORG_PROJECT_VIEW];
			create();
			await settle();

			const row = panel();
			expect(row.tagName).toBe('A');
			expect(row.querySelector('.task-project-name').textContent.trim()).toBe(PROJECT.name);
			expect((row as any).routerLink).toEqual(['/pages/organization/projects/view', PROJECT_ID]);
		});

		it('names the project without a link for those who may not view projects', async () => {
			create();
			await settle();

			const row = panel();
			expect(row.tagName).toBe('SPAN');
			expect(row.querySelector('.task-project-name').textContent.trim()).toBe(PROJECT.name);
			expect(fixture.nativeElement.querySelector('a.task-project')).toBeNull();
		});

		it('links the project once the permission loads after the page is built', async () => {
			const page = create();
			await settle();
			expect(panel().tagName).toBe('SPAN');

			permissions = [PermissionsEnum.ALL_ORG_VIEW];
			permissions$.next(permissions);
			fixture.detectChanges();

			expect(page.canViewProject).toBe(true);
			expect(panel().tagName).toBe('A');
			expect((panel() as any).routerLink).toEqual(['/pages/organization/projects/view', PROJECT_ID]);
		});

		it('says so when the task has no project', async () => {
			tasksService.getById.mockImplementation(async (id: string) => task({ id }));
			create();
			await settle();

			expect(panel()).toBeNull();
			expect(fixture.nativeElement.textContent).toContain('TASK_VIEW.NO_PROJECT');
		});
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

		describe("a subtask's row", () => {
			const member = (id: string, firstName: string) => ({ id, user: { firstName, lastName: 'Brown' } });
			const child = (id: string, overrides: Record<string, unknown> = {}) => ({
				id,
				title: 'A subtask',
				status: TaskStatusEnum.OPEN,
				...overrides
			});
			const load = async (children: unknown[]) => {
				tasksService.getById.mockResolvedValueOnce(task({ children: children as ITask[] }));
				const page = create();
				await settle();
				return page;
			};
			const rows = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('.task-row'));

			it('reads the relations the rows show', () => {
				expect(TASK_PAGE_RELATIONS).toEqual(
					expect.arrayContaining(['children.taskPriority', 'children.members', 'children.members.user'])
				);
			});

			it('shows the assignees', async () => {
				const page = await load([child('s1', { members: [member('e1', 'Ann'), member('e2', 'Bob')] })]);

				expect(page.subtasks[0].people.map((person) => person.name)).toEqual(['Ann Brown', 'Bob Brown']);
				expect(rows()[0].querySelector('.task-row-people').getAttribute('aria-label')).toBe('Ann Brown, Bob Brown');
				expect(rows()[0].querySelectorAll('.project-task-worker-avatar').length).toBe(2);
				expect(rows()[0].querySelector('.task-row-unassigned')).toBeNull();
			});

			it('shows three assignees, then how many more', async () => {
				await load([
					child('s1', { members: ['Ann', 'Bob', 'Cid', 'Dee', 'Eve'].map((name) => member(name, name)) })
				]);

				const circles = rows()[0].querySelectorAll('.project-task-worker-avatar');
				expect(circles.length).toBe(4);
				expect(circles[3].textContent.trim()).toBe('+2');
			});

			it('marks a subtask with no assignee, keeping the column', async () => {
				const page = await load([child('s1')]);

				expect(page.subtasks[0].people).toEqual([]);
				expect(rows()[0].querySelector('.task-row-people')).not.toBeNull();
				expect(rows()[0].querySelector('.task-row-unassigned')).not.toBeNull();
			});

			it('shows the priority, named for those who cannot see the arrow', async () => {
				await load([child('s1', { priority: TaskPriorityEnum.URGENT })]);

				const priority = rows()[0].querySelector('.task-row-priority');
				expect(priority.classList).toContain('tone-danger');
				expect(priority.querySelector('nb-icon').getAttribute('aria-label')).toBe(TaskPriorityEnum.URGENT);
			});

			it('keeps the priority column empty for a subtask with none, so the rows line up', async () => {
				await load([child('s1')]);

				const priority = rows()[0].querySelector('.task-row-priority');
				expect(priority).not.toBeNull();
				expect(priority.querySelector('nb-icon')).toBeNull();
			});

			it('draws the status in its own colour, or in its tone when it has none', async () => {
				await load([
					child('s1', { taskStatus: { name: 'Open', color: '#D6E4F9' } }),
					child('s2', { status: TaskStatusEnum.BLOCKED })
				]);

				const [coloured, toned] = rows().map((row): HTMLElement => row.querySelector('.task-status-tag'));
				expect(coloured.style.getPropertyValue('--status-color')).toBe('#D6E4F9');
				expect(toned.classList).toContain('tone-danger');
				expect(toned.style.getPropertyValue('--status-color')).toBe('');
			});

			it('keeps a linked issue to its key, title and status', async () => {
				outgoingLinks = of({
					items: [{ id: 'l1', action: TaskRelatedIssuesRelationEnum.BLOCKS, taskTo: { id: 't2', title: 'Ship it' } }]
				});
				create();
				await settle();
				await flush();
				fixture.detectChanges();

				expect(rows().length).toBe(1);
				expect(rows()[0].querySelector('.task-row-people')).toBeNull();
				expect(rows()[0].querySelector('.task-row-priority')).toBeNull();
			});

			describe('status menu', () => {
				const MENU = [
					{ id: 'st-open', name: 'Open', value: 'open', color: '#112233', order: 1, organizationId: ORGANIZATION },
					{ id: 'st-done', name: 'Done', value: 'done', order: 2, organizationId: ORGANIZATION },
					{ id: 'st-ready', name: 'ready-for-review', value: 'ready-for-review', order: 3, organizationId: ORGANIZATION }
				];
				const select = (row: HTMLElement) => row.querySelector('nb-select');

				/** The page, once the statuses are in, for one who may edit: the task stays as read across a refresh. */
				const editable = async (children: unknown[], allowed = [PermissionsEnum.ORG_TASK_EDIT]) => {
					permissions = allowed;
					statuses = MENU;
					tasksService.getById.mockImplementation(async (id: string) => task({ id, children: children as ITask[] }));
					const page = create();
					await settle();
					await flush();
					fixture.detectChanges();
					return page;
				};

				it('offers the menu beside the link, so a choice opens no page', async () => {
					await editable([child('s1')]);

					expect(select(rows()[0])).not.toBeNull();
					expect(rows()[0].tagName).toBe('DIV');
					expect(rows()[0].querySelector('.task-row-link').tagName).toBe('A');
					expect(rows()[0].querySelector('.task-row-link nb-select')).toBeNull();
				});

				it('names the subtask it moves', async () => {
					await editable([child('s1', { title: 'Write docs' })]);

					expect(select(rows()[0]).getAttribute('aria-label')).toContain('Write docs');
				});

				it("finds each subtask's status in the menu by its row, else by its value", async () => {
					const page = await editable([
						child('s1', { status: 'Whatever', taskStatusId: 'st-done' }),
						child('s2', { status: TaskStatusEnum.OPEN })
					]);

					expect(page.subtasks.find((row) => row.id === 's1').statusId).toBe('st-done');
					expect(page.subtasks.find((row) => row.id === 's2').statusId).toBe('st-open');
				});

				it('names the status on the button, as the menu has it', async () => {
					const page = await editable([child('s1', { status: TaskStatusEnum.OPEN })]);

					expect(page.menuStatusOf(page.subtasks[0]).name).toBe('Open');
					expect(rows()[0].querySelector('nb-select-label .task-status-tag').textContent.trim()).toBe('Open');
				});

				it('reads a status named by its slug as words, on the button and in the menu', async () => {
					await editable([child('s1', { status: TaskStatusEnum.READY_FOR_REVIEW })]);

					expect(rows()[0].querySelector('nb-select-label .task-status-tag').textContent.trim()).toBe('Ready for review');
					const options = Array.from(rows()[0].querySelectorAll('nb-option .task-status-tag'));
					expect(options.map((option) => option.textContent.trim())).toEqual(['Open', 'Done', 'Ready for review']);
				});

				it('keeps the plain tag for those who may not edit', async () => {
					await editable([child('s1')], [PermissionsEnum.ORG_TASK_VIEW, PermissionsEnum.ORG_TASK_ADD]);

					expect(select(rows()[0])).toBeNull();
					expect(rows()[0].querySelector('.task-status-tag')).not.toBeNull();
				});

				describe('a subtask of another project', () => {
					const OTHER_PROJECT = 'ffffffff-7777-4777-8777-777777777777';

					it("keeps the plain tag: the menu lists this task's project's statuses", async () => {
						const page = await editable([child('s1', { projectId: OTHER_PROJECT })]);

						expect(page.subtasks[0].sameProject).toBe(false);
						expect(select(rows()[0])).toBeNull();
						expect(rows()[0].querySelector('.task-status-tag')).not.toBeNull();
					});

					it('saves no status of this project on it, whatever calls the save', async () => {
						const page = await editable([child('s1', { projectId: OTHER_PROJECT })]);

						await page.changeSubtaskStatus(page.subtasks[0], 'st-done');

						expect(http.put).not.toHaveBeenCalled();
						expect(page.subtasks[0].statusId).not.toBe('st-done');
					});

					it('treats a subtask with no project under a task with none as the same project', async () => {
						const page = await editable([child('s1', { projectId: null })]);

						expect(page.subtasks[0].sameProject).toBe(true);
					});
				});

				it('names the status on a tooltip, as a long name is cut short', async () => {
					await editable([child('s1', { status: TaskStatusEnum.READY_FOR_REVIEW })]);

					const label: any = rows()[0].querySelector('nb-select-label .task-status-tag');
					expect(label.nbTooltip).toBe('Ready for review');
				});

				it('keeps the plain tag on a linked issue', async () => {
					outgoingLinks = of({
						items: [{ id: 'l1', action: TaskRelatedIssuesRelationEnum.BLOCKS, taskTo: { id: 't2', title: 'Ship it' } }]
					});
					await editable([]);

					expect(rows().length).toBe(1);
					expect(select(rows()[0])).toBeNull();
				});

				it('saves the status alone, on the subtask', async () => {
					const page = await editable([child('s1', { status: TaskStatusEnum.OPEN })]);

					await page.changeSubtaskStatus(page.subtasks[0], 'st-done');

					expect(http.put).toHaveBeenCalledTimes(1);
					expect(http.put).toHaveBeenCalledWith(expect.stringContaining('/tasks/s1/status'), {
						status: 'done',
						taskStatusId: 'st-done',
						organizationId: ORGANIZATION,
						tenantId: undefined
					});
				});

				it('reads the task again, so the count and the Board follow', async () => {
					const page = await editable([child('s1', { status: TaskStatusEnum.OPEN })]);
					const reads = tasksService.getById.mock.calls.length;
					const { boardReloadKey, activityReloadKey } = page;
					tasksService.getById.mockImplementation(async (id: string) =>
						task({ id, children: [child('s1', { status: TaskStatusEnum.DONE })] as unknown as ITask[] })
					);

					await page.changeSubtaskStatus(page.subtasks[0], 'st-done');

					expect(tasksService.getById.mock.calls.length).toBe(reads + 1);
					expect(page.subtaskCount).toEqual(expect.objectContaining({ done: 1, total: 1 }));
					expect(page.boardReloadKey).toBe(boardReloadKey + 1);
					expect(page.activityReloadKey).toBe(activityReloadKey + 1);
				});

				it('shows the new status at once, and holds the menu while it saves', async () => {
					const save$ = new Subject<ITask>();
					http.put.mockReturnValueOnce(save$);
					const page = await editable([child('s1', { status: TaskStatusEnum.OPEN })]);
					const row = page.subtasks[0];

					const saving = page.changeSubtaskStatus(row, 'st-done');

					expect(row.statusId).toBe('st-done');
					expect(page.savingSubtasks.has('s1')).toBe(true);
					save$.next({} as ITask);
					save$.complete();
					await saving;
					expect(page.savingSubtasks.has('s1')).toBe(false);
				});

				it('puts the row back and says so when the save fails', async () => {
					const error = new HttpErrorResponse({ status: 500 });
					http.put.mockReturnValueOnce(throwError(() => error));
					const page = await editable([child('s1', { status: TaskStatusEnum.OPEN })]);
					const { boardReloadKey } = page;

					await page.changeSubtaskStatus(page.subtasks[0], 'st-done');

					expect(page.subtasks[0].statusId).toBe('st-open');
					expect(toastr.danger).toHaveBeenCalledWith(error);
					expect(page.savingSubtasks.size).toBe(0);
					expect(page.boardReloadKey).toBe(boardReloadKey);
				});

				it('saves nothing for the status it is in, a status it does not know, or a second move', async () => {
					const save$ = new Subject<ITask>();
					http.put.mockReturnValueOnce(save$);
					const page = await editable([child('s1', { status: TaskStatusEnum.OPEN })]);
					const row = page.subtasks[0];

					await page.changeSubtaskStatus(row, 'st-open');
					await page.changeSubtaskStatus(row, 'nowhere');
					expect(http.put).not.toHaveBeenCalled();

					const saving = page.changeSubtaskStatus(row, 'st-done');
					row.statusId = 'st-open';
					await page.changeSubtaskStatus(row, 'st-done');
					expect(http.put).toHaveBeenCalledTimes(1);

					save$.next({} as ITask);
					save$.complete();
					await saving;
				});

				it('moves one subtask without holding another', async () => {
					const save$ = new Subject<ITask>();
					http.put.mockReturnValueOnce(save$);
					const page = await editable([
						child('s1', { status: TaskStatusEnum.OPEN, number: 1 }),
						child('s2', { status: TaskStatusEnum.OPEN, number: 2 })
					]);

					const first = page.changeSubtaskStatus(page.subtasks[0], 'st-done');
					await page.changeSubtaskStatus(page.subtasks[1], 'st-done');

					expect(http.put).toHaveBeenCalledTimes(2);
					save$.next({} as ITask);
					save$.complete();
					await first;
				});
			});
		});

		it('has no subtask count for a task without subtasks', async () => {
			const page = create();
			await settle();

			expect(page.subtasks).toEqual([]);
			expect(page.subtaskCount).toBeNull();
		});
	});

	describe('adding a subtask', () => {
		const PARENT_ID = 'ffffffff-6666-4666-8666-666666666666';
		const PROJECT = { id: PROJECT_ID, name: 'Gauzy Platform' };
		const addButton = (): HTMLButtonElement => fixture.nativeElement.querySelector('.task-subtask-add');
		const panel = (): HTMLElement => fixture.nativeElement.querySelector('.task-subtasks-actions');
		const context = () => dialogService.open.mock.calls[0][1].context;
		const answerDialog = (data: any) => dialogService.open.mockReturnValue({ onClose: of(data) });
		const ANSWER = { title: 'A subtask', status: 'Open', estimateDays: 1, estimateHours: 2, estimateMinutes: 30 };

		const ready = async () => {
			const page = create();
			await settle();
			await flush();
			return page;
		};

		beforeEach(() => {
			permissions = [PermissionsEnum.ORG_TASK_ADD];
		});

		it('offers the button to those the create route admits', async () => {
			await ready();

			expect(panel()).not.toBeNull();
			expect(addButton()).not.toBeNull();
		});

		it('offers no button to those it does not', async () => {
			permissions = [PermissionsEnum.ORG_TASK_VIEW];
			await ready();

			expect(panel()).not.toBeNull();
			expect(addButton()).toBeNull();
		});

		it('offers the button once the permission loads after the page is built', async () => {
			permissions = [];
			await ready();
			expect(addButton()).toBeNull();

			permissions = [PermissionsEnum.ALL_ORG_EDIT];
			permissions$.next(permissions);
			fixture.detectChanges();

			expect(addButton()).not.toBeNull();
		});

		it('opens the task dialog on a new task under this one, with its project, teams and opening status', async () => {
			const teams = [{ id: 'team-1', name: 'Core' }];
			tasksService.getById.mockImplementation(async (id: string) =>
				task({ id, projectId: PROJECT_ID, project: PROJECT as any, teams: teams as any })
			);
			statuses = [
				{ id: 'backlog', value: TaskStatusEnum.BACKLOG, name: 'Backlog', isTodo: true, order: 0 },
				{ id: 'open', value: TaskStatusEnum.OPEN, name: 'Open', isTodo: true, order: 1 }
			];
			await ready();

			addButton().click();
			await flush();

			expect(dialogService.open).toHaveBeenCalledTimes(1);
			expect(context().parentLocked).toBe(true);
			const { selectedTask } = context();
			// No id: the dialog creates; it edits a task that has one.
			expect(selectedTask.id).toBeUndefined();
			expect(selectedTask.parent.id).toBe(TASK_ID);
			expect(selectedTask.project).toEqual(PROJECT);
			expect(selectedTask.teams).toEqual(teams);
			expect(selectedTask.status).toBe(TaskStatusEnum.OPEN);
			expect(selectedTask.taskStatus.id).toBe('open');
		});

		it('gives the dialog a status even when none can be read: its form requires one', async () => {
			const page = await ready();

			await page.addSubtask();

			expect(context().selectedTask.status).toBe(TaskStatusEnum.OPEN);
		});

		describe('before the statuses are read', () => {
			const OPEN = { id: 'open', value: TaskStatusEnum.OPEN, name: 'Open', isTodo: true, order: 1 };

			/** The statuses' read, held until the test answers it. */
			const holdStatuses = () => {
				const read$ = new Subject<{ items: unknown[] }>();
				http.get.mockImplementation((url: string) => (url.endsWith('/task-statuses') ? read$ : of({ items: [] })));
				return read$;
			};
			const answer = (read$: Subject<{ items: unknown[] }>) => {
				read$.next({ items: [OPEN] });
				read$.complete();
			};

			it("reads them first, for a permission that came too late for the page's own read", async () => {
				permissions = [];
				const page = await ready();
				expect(http.get).not.toHaveBeenCalledWith(expect.stringMatching(/\/task-statuses$/), expect.anything());
				statuses = [OPEN];
				permissions = [PermissionsEnum.ORG_TASK_ADD];
				permissions$.next(permissions);

				await page.addSubtask();

				expect(context().selectedTask.taskStatus.id).toBe('open');
			});

			it('reads nothing more when the statuses are already in', async () => {
				statuses = [OPEN];
				const page = await ready();
				const reads = () => http.get.mock.calls.filter(([url]) => url.endsWith('/task-statuses')).length;
				const before = reads();

				await page.addSubtask();

				expect(reads()).toBe(before);
			});

			it('opens one dialog however many times the button is pressed while they are read', async () => {
				const page = await ready();
				const read$ = holdStatuses();

				const first = page.addSubtask();
				await page.addSubtask();
				expect(dialogService.open).not.toHaveBeenCalled();
				answer(read$);
				await first;

				expect(dialogService.open).toHaveBeenCalledTimes(1);
			});

			it('opens no dialog when the page moves to another task while they are read', async () => {
				const page = await ready();
				const read$ = holdStatuses();

				const opening = page.addSubtask();
				params$.next(convertToParamMap({ id: OTHER_ID }));
				await settle();
				answer(read$);
				await opening;

				expect(page.task.id).toBe(OTHER_ID);
				expect(dialogService.open).not.toHaveBeenCalled();
			});
		});

		it('saves what the dialog answers, under this task and in its organization', async () => {
			answerDialog(ANSWER);
			const page = await ready();

			await page.addSubtask();

			expect(tasksService.createTask).toHaveBeenCalledTimes(1);
			expect(tasksService.createTask).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'A subtask',
					status: 'Open',
					estimate: 1 * 24 * 60 * 60 + 2 * 60 * 60 + 30 * 60,
					parentId: TASK_ID,
					organizationId: ORGANIZATION
				})
			);
		});

		it('saves as Open when the dialog answers no status, which the server would refuse', async () => {
			answerDialog({ title: 'A subtask', status: undefined });
			const page = await ready();

			await page.addSubtask();

			expect(tasksService.createTask).toHaveBeenCalledWith(
				expect.objectContaining({ status: TaskStatusEnum.OPEN, estimate: null })
			);
		});

		it('shows the new subtask, and reads the Board and the Activity again', async () => {
			answerDialog(ANSWER);
			const page = await ready();
			const reads = tasksService.getById.mock.calls.length;
			const { boardReloadKey, activityReloadKey } = page;
			tasksService.getById.mockResolvedValue(
				task({ children: [{ id: 's1', title: 'A subtask', status: TaskStatusEnum.OPEN }] as unknown as ITask[] })
			);

			await page.addSubtask();

			expect(tasksService.getById.mock.calls.length).toBe(reads + 1);
			expect(page.subtasks.map((row) => row.id)).toEqual(['s1']);
			expect(page.boardReloadKey).toBe(boardReloadKey + 1);
			expect(page.activityReloadKey).toBe(activityReloadKey + 1);
		});

		it('saves nothing when the dialog is cancelled', async () => {
			const page = await ready();
			const { boardReloadKey } = page;

			await page.addSubtask();

			expect(dialogService.open).toHaveBeenCalledTimes(1);
			expect(tasksService.createTask).not.toHaveBeenCalled();
			expect(page.boardReloadKey).toBe(boardReloadKey);
		});

		it('leaves the toast of a failed save to the service', async () => {
			answerDialog(ANSWER);
			tasksService.createTask.mockReturnValue(throwError(() => 'Bad request'));
			const page = await ready();
			const { boardReloadKey } = page;

			await page.addSubtask();

			expect(toastr.danger).not.toHaveBeenCalled();
			expect(page.boardReloadKey).toBe(boardReloadKey);
		});

		it('reads the statuses for those who may add but not edit, without showing them the menu', async () => {
			statuses = [{ id: 'open', value: TaskStatusEnum.OPEN, name: 'Open' }];
			const page = await ready();

			expect(page.statuses.map((status) => status.id)).toEqual(['open']);
			expect(page.canEdit).toBe(false);
			fixture.detectChanges();
			expect(fixture.nativeElement.querySelector('.task-status-select')).toBeNull();
		});

		describe('on a task that is itself a subtask', () => {
			it('offers no button and draws no Subtasks panel when the task has a parent', async () => {
				tasksService.getById.mockImplementation(async (id: string) => task({ id, parentId: PARENT_ID }));
				const page = await ready();

				expect(page.isSubtask).toBe(true);
				expect(page.canAddSubtask).toBe(false);
				expect(panel()).toBeNull();
			});

			it('does likewise when only the parent relation came back', async () => {
				tasksService.getById.mockImplementation(async (id: string) =>
					task({ id, parent: { id: PARENT_ID, title: 'The parent' } as ITask })
				);
				await ready();

				expect(panel()).toBeNull();
			});

			it('opens no dialog, whatever calls it', async () => {
				tasksService.getById.mockImplementation(async (id: string) => task({ id, parentId: PARENT_ID }));
				const page = await ready();

				await page.addSubtask();

				expect(dialogService.open).not.toHaveBeenCalled();
			});

			it('reads no statuses for those who could only have added one', async () => {
				tasksService.getById.mockImplementation(async (id: string) => task({ id, parentId: PARENT_ID }));
				await ready();

				expect(http.get).not.toHaveBeenCalledWith(expect.stringMatching(/\/task-statuses$/), expect.anything());
			});

			it('still lists the subtasks it already has, with nothing to add more', async () => {
				tasksService.getById.mockImplementation(async (id: string) =>
					task({
						id,
						parentId: PARENT_ID,
						children: [{ id: 's1', title: 'Nested', status: TaskStatusEnum.OPEN }] as unknown as ITask[]
					})
				);
				const page = await ready();

				expect(page.subtasks.map((row) => row.id)).toEqual(['s1']);
				expect(panel()).not.toBeNull();
				expect(addButton()).toBeNull();
			});
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
		expect(writeText).not.toHaveBeenCalledWith(expect.stringContaining('tab='));
		expect(toastr.success).toHaveBeenCalledWith('TASK_VIEW.LINK_COPIED');
	});

	it('copies the open tab with the address, so the link opens on it', async () => {
		const writeText = jest.fn(async () => undefined);
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		window.location.hash = '#/pages/tasks/view/x';
		queryParams$.next(convertToParamMap({ tab: 'board' }));
		const page = create();
		await settle();

		await page.copyLink();

		expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`#/pages/tasks/view/${TASK_ID}?tab=board`));
	});

	describe('reloading the Board and the Activity', () => {
		it('reads the Activity again once a board move has saved, but not the Board', async () => {
			const page = create();
			await settle();
			const { boardReloadKey, activityReloadKey } = page;

			await page.onBoardTaskMoved();

			// The Board's own moves still saving would be dropped by a reload of the board.
			expect(page.boardReloadKey).toBe(boardReloadKey);
			expect(page.activityReloadKey).toBe(activityReloadKey + 1);
		});

		it('reads both again after a status move from the header', async () => {
			permissions = [PermissionsEnum.ORG_TASK_EDIT];
			statuses = [
				{ id: 'st-1', name: 'In Progress', value: 'in-progress', order: 1, organizationId: ORGANIZATION },
				{ id: 'st-2', name: 'Done', value: 'done', order: 2, organizationId: ORGANIZATION }
			];
			const page = create();
			await settle();
			// The status menu reads its statuses once the task has loaded.
			await flush();
			const { boardReloadKey, activityReloadKey } = page;

			await page.changeStatus('st-2');

			expect(page.boardReloadKey).toBe(boardReloadKey + 1);
			expect(page.activityReloadKey).toBe(activityReloadKey + 1);
		});
	});
});
