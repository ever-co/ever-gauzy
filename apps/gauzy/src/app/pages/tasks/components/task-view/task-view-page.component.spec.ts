import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ITask, TaskStatusEnum } from '@gauzy/contracts';
import { Store, TasksService, TimesheetStatisticsService } from '@gauzy/ui-core/core';
import { TASK_PAGE_RELATIONS, TaskViewPageComponent } from './task-view-page.component';
import { buildTaskViewSections } from './task-view-sections';

const TASK_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const OTHER_ID = 'bbbbbbbb-2222-4222-8222-222222222222';
const ORGANIZATION = 'cccccccc-3333-4333-8333-333333333333';
const OTHER_ORGANIZATION = 'dddddddd-4444-4444-8444-444444444444';

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
 * dashboard never even read).
 */
describe('TaskViewPageComponent', () => {
	let fixture: ComponentFixture<TaskViewPageComponent>;
	let params$: BehaviorSubject<ParamMap>;
	let queryParams$: BehaviorSubject<ParamMap>;
	let organization$: BehaviorSubject<{ id: string }>;
	let tasksService: { getById: jest.Mock };
	let statisticsService: { getTasksStatistics: jest.Mock; getTaskEmployees: jest.Mock };
	let router: { navigate: jest.Mock };

	beforeEach(async () => {
		params$ = new BehaviorSubject(convertToParamMap({ id: TASK_ID }));
		queryParams$ = new BehaviorSubject(convertToParamMap({}));
		organization$ = new BehaviorSubject({ id: ORGANIZATION });
		tasksService = { getById: jest.fn(async (id: string) => task({ id })) };
		statisticsService = {
			getTasksStatistics: jest.fn(async () => []),
			getTaskEmployees: jest.fn(async () => [])
		};
		router = { navigate: jest.fn(async () => true) };
		await TestBed.configureTestingModule({
			declarations: [TaskViewPageComponent],
			providers: [
				{
					provide: ActivatedRoute,
					useValue: { paramMap: params$.asObservable(), queryParamMap: queryParams$.asObservable() }
				},
				{ provide: Router, useValue: router },
				{ provide: TasksService, useValue: tasksService },
				{ provide: TimesheetStatisticsService, useValue: statisticsService },
				{ provide: Store, useValue: { selectedOrganization$: organization$.asObservable() } }
			],
			// The record view, the page frame and the favorite star are covered by their own specs.
			schemas: [NO_ERRORS_SCHEMA]
		}).compileComponents();
		fixture = TestBed.createComponent(TaskViewPageComponent);
	});

	const settle = async () => {
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	};

	it('loads the task the URL names, with the relations its View reads', async () => {
		await settle();

		expect(tasksService.getById).toHaveBeenCalledWith(TASK_ID, TASK_PAGE_RELATIONS);
		expect(fixture.componentInstance.state).toBe('ready');
		expect(fixture.componentInstance.task.id).toBe(TASK_ID);
		expect(fixture.componentInstance.sections.length).toBeGreaterThan(0);
		expect(fixture.componentInstance.status).toEqual(
			expect.objectContaining({ text: 'in progress', tone: 'info' })
		);
	});

	it('renders the same sections the drawer does', async () => {
		await settle();

		const expected = buildTaskViewSections(fixture.componentInstance.task, {
			translate: (key) => key,
			hash: (value) => `#${value}`
		});
		expect(fixture.componentInstance.sections.map((section) => section.title)).toEqual(
			expected.map((section) => section.title)
		);
	});

	it('follows the URL to the next task when the page is reused', async () => {
		await settle();
		params$.next(convertToParamMap({ id: OTHER_ID }));
		await settle();

		expect(tasksService.getById).toHaveBeenLastCalledWith(OTHER_ID, TASK_PAGE_RELATIONS);
		expect(fixture.componentInstance.task.id).toBe(OTHER_ID);
	});

	it.each([
		[404, 'not-found'],
		[400, 'not-found'],
		[403, 'forbidden'],
		[500, 'error']
	])('answers a %s with the "%s" state and shows no record', async (status, state) => {
		tasksService.getById.mockRejectedValueOnce(new HttpErrorResponse({ status }));
		await settle();

		expect(fixture.componentInstance.state).toBe(state);
		expect(fixture.componentInstance.task).toBeNull();
	});

	it('reloads on retry after an error', async () => {
		tasksService.getById.mockRejectedValueOnce(new HttpErrorResponse({ status: 500 }));
		await settle();
		await fixture.componentInstance.load();

		expect(fixture.componentInstance.state).toBe('ready');
	});

	/*
	 * Review on #10589: the page used to keep showing a task after the header switched organization,
	 * while its favorite star already used the new one — so the star could file organization A's task under
	 * organization B.
	 */
	it('reloads when the header switches organization, and refuses a task of another organization', async () => {
		await settle();
		expect(fixture.componentInstance.state).toBe('ready');

		organization$.next({ id: OTHER_ORGANIZATION });
		await settle();

		expect(tasksService.getById).toHaveBeenCalledTimes(2);
		expect(fixture.componentInstance.state).toBe('not-found');
		expect(fixture.componentInstance.task).toBeNull();
	});

	it('discards a load that a newer organization switch overtook', async () => {
		let answerFirst: (task: ITask) => void;
		tasksService.getById.mockImplementationOnce(() => new Promise<ITask>((resolve) => (answerFirst = resolve)));
		fixture.detectChanges(); // first load, still pending
		tasksService.getById.mockResolvedValueOnce(task({ organizationId: OTHER_ORGANIZATION, title: 'B task' }));
		organization$.next({ id: OTHER_ORGANIZATION });
		await settle();

		answerFirst(task({ title: 'A task' })); // the stale answer arrives last
		await settle();

		expect(fixture.componentInstance.task.title).toBe('B task');
		expect(fixture.componentInstance.state).toBe('ready');
	});

	it('shows the time worked against the estimate and who worked most on the task', async () => {
		tasksService.getById.mockResolvedValueOnce(task({ estimate: 4 * 3600 }));
		statisticsService.getTasksStatistics.mockResolvedValueOnce([{ id: TASK_ID, duration: 3 * 3600 }]);
		statisticsService.getTaskEmployees.mockResolvedValueOnce([
			{ id: 'e1', duration: 2 * 3600, user: { firstName: 'Ann', lastName: 'Brown' } },
			{ id: 'e2', duration: 3600, user: { firstName: 'Carl', lastName: 'Diaz' } }
		]);
		await settle();
		// The time reads start once the task has loaded: let them answer. Microtasks only — a timer turn would
		// also run the zone's late "uncaught" reports of the error tests' already-handled rejections.
		for (let i = 0; i < 10; i++) await Promise.resolve();

		expect(statisticsService.getTaskEmployees).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: ORGANIZATION, taskIds: [TASK_ID] })
		);
		expect(fixture.componentInstance.progress).toEqual(
			expect.objectContaining({ worked: '3h 00m', share: 75, over: false })
		);
		expect(fixture.componentInstance.workers.map((worker) => worker.person.name)).toEqual(['Ann Brown', 'Carl Diaz']);
	});

	it('keeps the page when the time reads fail', async () => {
		statisticsService.getTasksStatistics.mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }));
		statisticsService.getTaskEmployees.mockRejectedValueOnce(new HttpErrorResponse({ status: 403 }));
		await settle();

		expect(fixture.componentInstance.state).toBe('ready');
		expect(fixture.componentInstance.progress).toBeNull();
		expect(fixture.componentInstance.workers).toEqual([]);
	});

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
		await settle();

		const page = fixture.componentInstance;
		expect(page.subtasks.map((row) => row.id)).toEqual(['s3', 's2', 's1']);
		expect(page.subtasks.map((row) => row.done)).toEqual([false, false, true]);
		expect(page.subtaskCount).toEqual(expect.objectContaining({ done: 1, total: 3 }));
		expect(page.subtaskLink('s1')).toEqual(['/pages/tasks/view', 's1']);
	});

	it('has no subtask count for a task without subtasks', async () => {
		await settle();

		expect(fixture.componentInstance.subtasks).toEqual([]);
		expect(fixture.componentInstance.subtaskCount).toBeNull();
	});

	it('says how far off the due date is, and that a past one is overdue', async () => {
		const due = new Date();
		due.setDate(due.getDate() - 2);
		tasksService.getById.mockResolvedValueOnce(task({ dueDate: due }));
		await settle();

		expect(fixture.componentInstance.due).toEqual(
			expect.objectContaining({
				overdue: true,
				words: { key: 'EMPLOYEES_PAGE.VIEW.DUE.OVERDUE_DAYS', count: 2 }
			})
		);
	});

	it('no longer calls a finished task overdue', async () => {
		tasksService.getById.mockResolvedValueOnce(
			task({ status: TaskStatusEnum.DONE, dueDate: new Date(Date.now() - 5 * 86400000) })
		);
		await settle();

		expect(fixture.componentInstance.due).toEqual(
			expect.objectContaining({ overdue: false, words: { key: 'EMPLOYEES_PAGE.VIEW.DUE.WAS_DUE' } })
		);
	});

	it('opens the tab the URL names, and keeps a picked tab in the URL', async () => {
		queryParams$.next(convertToParamMap({ tab: 'activity' }));
		await settle();
		expect(fixture.componentInstance.tab).toBe('activity');

		fixture.componentInstance.selectTab('overview');
		expect(fixture.componentInstance.tab).toBe('overview');
		expect(router.navigate).toHaveBeenCalledWith(
			[],
			expect.objectContaining({ queryParams: { tab: null }, replaceUrl: true })
		);

		queryParams$.next(convertToParamMap({ tab: 'unknown' }));
		await settle();
		expect(fixture.componentInstance.tab).toBe('overview');
	});
});
