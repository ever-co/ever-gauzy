import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ITask, TaskStatusEnum } from '@gauzy/contracts';
import { Store, TasksService } from '@gauzy/ui-core/core';
import { TaskViewPageComponent } from './task-view-page.component';
import { buildTaskViewSections, TASK_VIEW_RELATIONS } from './task-view-sections';

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
	let organization$: BehaviorSubject<{ id: string }>;
	let tasksService: { getById: jest.Mock };

	beforeEach(async () => {
		params$ = new BehaviorSubject(convertToParamMap({ id: TASK_ID }));
		organization$ = new BehaviorSubject({ id: ORGANIZATION });
		tasksService = { getById: jest.fn(async (id: string) => task({ id })) };
		await TestBed.configureTestingModule({
			declarations: [TaskViewPageComponent],
			providers: [
				{ provide: ActivatedRoute, useValue: { paramMap: params$.asObservable() } },
				{ provide: TasksService, useValue: tasksService },
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

		expect(tasksService.getById).toHaveBeenCalledWith(TASK_ID, TASK_VIEW_RELATIONS);
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

		expect(tasksService.getById).toHaveBeenLastCalledWith(OTHER_ID, TASK_VIEW_RELATIONS);
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
	 * Review (Greptile, #10589): the page used to keep showing a task after the header switched organization,
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
});
