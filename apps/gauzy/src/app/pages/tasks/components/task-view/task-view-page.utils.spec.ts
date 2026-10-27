import { ITaskLinkedIssue, ITimeLog, TaskRelatedIssuesRelationEnum, TaskStatusEnum, TimeLogType } from '@gauzy/contracts';
import { hoursDaysOf, linkedIssueGroupsOf, timeEntriesOf, timeTrackingOf } from './task-view-page.utils';

const TASK_ID = 'task-1';
const hash = (value: number | string) => `#${value}`;

const link = (overrides: Partial<ITaskLinkedIssue>): ITaskLinkedIssue =>
	({ id: 'l', action: TaskRelatedIssuesRelationEnum.RELATES_TO, ...overrides }) as ITaskLinkedIssue;

describe('linkedIssueGroupsOf', () => {
	it('reads a link the task starts as written, and one that ends at it turned round', () => {
		const groups = linkedIssueGroupsOf(
			[link({ id: 'a', action: TaskRelatedIssuesRelationEnum.BLOCKS, taskTo: { id: 'b', title: 'B' } as any })],
			[link({ id: 'c', action: TaskRelatedIssuesRelationEnum.DUPLICATES, taskFrom: { id: 'd', title: 'D' } as any })],
			TASK_ID,
			hash
		);

		expect(groups.map((group) => [group.relation, group.rows.map((row) => row.taskId)])).toEqual([
			[TaskRelatedIssuesRelationEnum.BLOCKS, ['b']],
			[TaskRelatedIssuesRelationEnum.IS_DUPLICATED_BY, ['d']]
		]);
	});

	it('puts what holds the task up first', () => {
		const groups = linkedIssueGroupsOf(
			[
				link({ id: 'a', action: TaskRelatedIssuesRelationEnum.RELATES_TO, taskTo: { id: 'r' } as any }),
				link({ id: 'b', action: TaskRelatedIssuesRelationEnum.IS_BLOCKED_BY, taskTo: { id: 'x' } as any })
			],
			[],
			TASK_ID,
			hash
		);

		expect(groups.map((group) => group.relation)).toEqual([
			TaskRelatedIssuesRelationEnum.IS_BLOCKED_BY,
			TaskRelatedIssuesRelationEnum.RELATES_TO
		]);
	});

	it('lists a task linked twice the same way once, and leaves out links to itself or to no task', () => {
		const groups = linkedIssueGroupsOf(
			[
				link({ id: 'a', taskTo: { id: 'b' } as any }),
				link({ id: 'b', taskTo: { id: TASK_ID } as any }),
				link({ id: 'c', taskTo: undefined })
			],
			[link({ id: 'd', taskFrom: { id: 'b' } as any })],
			TASK_ID,
			hash
		);

		expect(groups).toHaveLength(1);
		expect(groups[0].rows.map((row) => row.id)).toEqual(['a']);
	});

	it("shows the linked task's key, title, status and whether it is done", () => {
		const [group] = linkedIssueGroupsOf(
			[
				link({
					taskTo: { id: 'b', title: 'Ship it', taskNumber: '7', status: TaskStatusEnum.DONE } as any
				})
			],
			[],
			TASK_ID,
			hash
		);

		expect(group.rows[0]).toEqual(
			expect.objectContaining({ key: '#7', title: 'Ship it', done: true, status: expect.objectContaining({ tone: 'success' }) })
		);
	});
});

describe('timeEntriesOf', () => {
	const log = (overrides: Partial<ITimeLog>): ITimeLog =>
		({
			id: 'log',
			startedAt: new Date('2026-10-20T09:00:00Z'),
			stoppedAt: new Date('2026-10-20T11:30:00Z'),
			duration: 9000,
			logType: TimeLogType.TRACKED,
			employee: { id: 'e1', user: { firstName: 'Ann', lastName: 'Brown' } },
			timeSlots: [],
			...overrides
		}) as ITimeLog;

	it('puts the newest entries first, at most the limit', () => {
		const rows = timeEntriesOf(
			[
				log({ id: 'old', startedAt: new Date('2026-10-01T09:00:00Z') }),
				log({ id: 'new', startedAt: new Date('2026-10-21T09:00:00Z') }),
				log({ id: 'mid', startedAt: new Date('2026-10-10T09:00:00Z') })
			],
			2
		);

		expect(rows.map((row) => row.id)).toEqual(['new', 'mid']);
	});

	it("works out the activity from the slots' active seconds over their seconds", () => {
		const [row] = timeEntriesOf([
			log({ timeSlots: [{ duration: 600, overall: 300 }, { duration: 600, overall: 600 }] as any })
		]);

		expect(row.activity).toBe(75);
		expect(row.duration).toBe('2h 30m');
		expect(row.person?.name).toBe('Ann Brown');
		expect(row.personLink).toEqual(['/pages/employees/view', 'e1']);
	});

	it('gives a manual entry, or one without slots, no activity', () => {
		const rows = timeEntriesOf([
			log({ id: 'manual', logType: TimeLogType.MANUAL, timeSlots: [{ duration: 600, overall: 600 }] as any }),
			log({ id: 'bare', startedAt: new Date('2026-10-19T09:00:00Z') })
		]);

		expect(rows.map((row) => [row.id, row.manual, row.activity])).toEqual([
			['manual', true, null],
			['bare', false, null]
		]);
	});

	it('counts a running entry until now', () => {
		const [row] = timeEntriesOf(
			[log({ stoppedAt: undefined, isRunning: true, duration: 0 })],
			8,
			new Date('2026-10-20T10:15:00Z')
		);

		expect(row.running).toBe(true);
		expect(row.duration).toBe('1h 15m');
	});
});

describe('timeTrackingOf', () => {
	it('says what is left of the estimate', () => {
		expect(timeTrackingOf(3 * 3600, 8 * 3600)).toEqual({
			logged: '3h 00m',
			estimate: '8h 00m',
			remaining: '5h 00m',
			over: null,
			fill: 37.5
		});
	});

	it('says how far over the estimate it went, with a full bar', () => {
		expect(timeTrackingOf(10 * 3600, 8 * 3600)).toEqual(
			expect.objectContaining({ remaining: null, over: '2h 00m', fill: 100 })
		);
	});

	it('draws no bar without an estimate', () => {
		expect(timeTrackingOf(3600, null)).toEqual({
			logged: '1h 00m',
			estimate: null,
			remaining: null,
			over: null,
			fill: null
		});
	});
});

describe('hoursDaysOf', () => {
	it('counts resumed time as tracked, and keeps manual time apart', () => {
		expect(
			hoursDaysOf([
				{
					date: '2026-10-20',
					value: { [TimeLogType.TRACKED]: 2, [TimeLogType.RESUMED]: 0.5, [TimeLogType.MANUAL]: 1 }
				}
			])
		).toEqual([{ label: '20 Oct', tracked: 2.5, manual: 1 }]);
	});

	it('answers no days for no rows', () => {
		expect(hoursDaysOf(null)).toEqual([]);
	});
});
