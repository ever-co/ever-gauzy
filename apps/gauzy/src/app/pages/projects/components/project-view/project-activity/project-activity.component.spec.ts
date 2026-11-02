import { SimpleChange } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ActionTypeEnum, BaseEntityEnum, IActivityLog } from '@gauzy/contracts';
import { CommentService } from '@gauzy/ui-core/core';
import { ProjectActivityComponent } from './project-activity.component';

const TASK_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const SUBTASK_ID = 'bbbbbbbb-2222-4222-8222-222222222222';
const ORGANIZATION = 'cccccccc-3333-4333-8333-333333333333';
const TENANT = 'dddddddd-4444-4444-8444-444444444444';

const log = (overrides: Partial<IActivityLog>): IActivityLog =>
	({
		id: `log-${Math.random()}`,
		entity: BaseEntityEnum.Task,
		entityId: TASK_ID,
		action: ActionTypeEnum.Updated,
		createdAt: new Date('2026-10-27T10:00:00Z'),
		...overrides
	}) as IActivityLog;

/**
 * The Activity feed, on the project page and on a task's page (`taskId`): a status move reads as one, with the
 * status before and after, rather than as an update of "status, task status id".
 */
describe('ProjectActivityComponent', () => {
	let logsByEntity: Record<string, IActivityLog[]>;
	let statuses: any[];
	let http: { get: jest.Mock };
	let comments: { getLatest: jest.Mock };

	beforeEach(() => {
		logsByEntity = {};
		statuses = [];
		http = {
			get: jest.fn((url: string, options: { params: HttpParams }) => {
				if (url.endsWith('/task-statuses')) return of({ items: statuses });
				const entityId = options.params.get('entityId');
				return of({ items: logsByEntity[entityId] || [], total: (logsByEntity[entityId] || []).length });
			})
		};
		comments = { getLatest: jest.fn(async () => []) };
		TestBed.configureTestingModule({
			providers: [
				{ provide: HttpClient, useValue: http },
				{ provide: CommentService, useValue: comments }
			]
		});
	});

	/** A task's feed, read to the end. */
	const taskFeed = async (subtasks: { id: string; title: string }[] = []) => {
		const component = TestBed.runInInjectionContext(() => new ProjectActivityComponent());
		Object.assign(component, {
			taskId: TASK_ID,
			taskTitle: 'Ship the board',
			subtasks,
			organizationId: ORGANIZATION,
			tenantId: TENANT
		});
		component.ngOnChanges({ taskId: new SimpleChange(undefined, TASK_ID, true) });
		for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve));
		return component;
	};

	it("reads the task's own log, each subtask's and the task's comments", async () => {
		logsByEntity[TASK_ID] = [log({ action: ActionTypeEnum.Created })];
		logsByEntity[SUBTASK_ID] = [log({ entityId: SUBTASK_ID, action: ActionTypeEnum.Created })];
		const component = await taskFeed([{ id: SUBTASK_ID, title: 'Wire the endpoint' }]);

		const ids = http.get.mock.calls
			.filter(([url]) => url.endsWith('/activity-log'))
			.map(([, options]) => options.params.get('entityId'));
		expect(ids).toEqual([TASK_ID, SUBTASK_ID]);
		expect(comments.getLatest).toHaveBeenCalledWith(
			BaseEntityEnum.Task,
			TASK_ID,
			{ organizationId: ORGANIZATION, tenantId: TENANT },
			expect.any(Number)
		);
		const entries = component.feed.value as any[];
		// The task's own entry is not a link (it is the page it is on); the subtask's opens the subtask.
		expect(entries.map((entry) => [entry.target, entry.taskId])).toEqual(
			expect.arrayContaining([
				['Ship the board', null],
				['Wire the endpoint', SUBTASK_ID]
			])
		);
	});

	it('tells a status move by its statuses before and after', async () => {
		logsByEntity[TASK_ID] = [
			log({
				updatedFields: ['status', 'taskStatusId'],
				previousValues: [{ status: 'open' }, { taskStatusId: 'one' }],
				updatedValues: [{ status: 'in-progress' }, { taskStatusId: 'two' }]
			} as any)
		];
		const [entry] = (await taskFeed()).feed.value as any[];

		expect(entry.sentence).toBe('PROJECT_VIEW.ACTIVITY_STATUS_CHANGED');
		expect(entry.status).toEqual({ from: { name: 'Open' }, to: { name: 'In progress' } });
		expect(entry.fields).toBe('');
		expect(entry.tone).toBe('status');
	});

	it("colours each side of a move as its status: by the status row's id, else by its value", async () => {
		statuses = [
			{ id: 'one', value: 'open', name: 'Open', color: '#D6E4F9', isSystem: true },
			{ id: 'two', value: 'in-review', name: 'In Review', color: '#F3D8B0', isSystem: true }
		];
		logsByEntity[TASK_ID] = [
			log({
				updatedFields: ['status', 'taskStatusId'],
				// The id names the status row; the value alone ("open") finds the other one.
				previousValues: [{ status: 'open' }],
				updatedValues: [{ status: 'something-else' }, { taskStatusId: 'two' }]
			} as any)
		];
		const [entry] = (await taskFeed()).feed.value as any[];

		expect(entry.status.from).toEqual({ name: 'Open', color: '#D6E4F9' });
		expect(entry.status.to.color).toBe('#F3D8B0');
	});

	it('names a move that logged only the status rows by their statuses', async () => {
		statuses = [
			{ id: 'one', value: 'open', name: 'Open', color: '#D6E4F9', isSystem: true },
			{ id: 'two', value: 'in-review', name: 'In Review', color: '#F3D8B0', isSystem: true }
		];
		// An update that sends `taskStatusId` without `status` (the GraphQL input allows it).
		logsByEntity[TASK_ID] = [
			log({
				updatedFields: ['taskStatusId'],
				previousValues: [{ taskStatusId: 'one' }],
				updatedValues: [{ taskStatusId: 'two' }]
			} as any)
		];
		const [entry] = (await taskFeed()).feed.value as any[];

		expect(entry.sentence).toBe('PROJECT_VIEW.ACTIVITY_STATUS_CHANGED');
		expect(entry.status).toEqual({
			from: { name: 'Open', color: '#D6E4F9' },
			to: { name: 'In Review', color: '#F3D8B0' }
		});
	});

	it('names and colours a side by the same status when its value disagrees with its row', async () => {
		statuses = [
			{ id: 'one', value: 'open', name: 'Open', color: '#D6E4F9', isSystem: true },
			{ id: 'two', value: 'in-review', name: 'In Review', color: '#F3D8B0', isSystem: true }
		];
		logsByEntity[TASK_ID] = [
			log({
				updatedFields: ['status', 'taskStatusId'],
				previousValues: [{ status: 'open' }, { taskStatusId: 'one' }],
				// The value says "done", the row it names is In Review: the row wins, for the name as for the colour.
				updatedValues: [{ status: 'done' }, { taskStatusId: 'two' }]
			} as any)
		];
		const [entry] = (await taskFeed()).feed.value as any[];

		expect(entry.status.to).toEqual({ name: 'In Review', color: '#F3D8B0' });
	});

	it('leaves a move uncoloured when the statuses cannot be read', async () => {
		http.get.mockImplementation((url: string, options: { params: HttpParams }) => {
			if (url.endsWith('/task-statuses')) return throwError(() => new Error('403'));
			return of({ items: logsByEntity[options.params.get('entityId')] || [] });
		});
		logsByEntity[TASK_ID] = [
			log({
				updatedFields: ['status'],
				previousValues: [{ status: 'open' }],
				updatedValues: [{ status: 'done' }]
			} as any)
		];
		const [entry] = (await taskFeed()).feed.value as any[];

		expect(entry.status).toEqual({ from: { name: 'Open' }, to: { name: 'Done' } });
	});

	it("names a status by its row when the update logged one, and keeps the edit's other fields", async () => {
		logsByEntity[TASK_ID] = [
			log({
				updatedFields: ['title', 'status', 'taskStatus'],
				previousValues: [{ title: 'Old' }, { status: 'todo' }, { taskStatus: { name: 'To do' } }],
				updatedValues: [{ title: 'New' }, { status: 'done' }, { taskStatus: { name: 'Shipped' } }]
			} as any)
		];
		const [entry] = (await taskFeed()).feed.value as any[];

		expect(entry.status).toEqual({ from: { name: 'To do' }, to: { name: 'Shipped' } });
		expect(entry.fields).toBe('title');
	});

	it('reads an edit that saved the same status back as a plain update', async () => {
		// The edit dialog sends the status row back with every save: a new object, so it is always "changed".
		logsByEntity[TASK_ID] = [
			log({
				updatedFields: ['title', 'taskStatus'],
				previousValues: [{ title: 'Old' }, { taskStatus: { name: 'To do' } }],
				updatedValues: [{ title: 'New' }, { taskStatus: { name: 'To do' } }]
			} as any)
		];
		const [entry] = (await taskFeed()).feed.value as any[];

		expect(entry.sentence).toBe('PROJECT_VIEW.ACTIVITY_UPDATED');
		expect(entry.status).toBeNull();
	});

	it('reads the feed again when the host bumps its reload key', async () => {
		const component = await taskFeed();
		http.get.mockClear();
		component.reloadKey = 1;
		component.ngOnChanges({ reloadKey: new SimpleChange(0, 1, false) });
		await new Promise((resolve) => setTimeout(resolve));

		expect(http.get).toHaveBeenCalled();
	});
});
