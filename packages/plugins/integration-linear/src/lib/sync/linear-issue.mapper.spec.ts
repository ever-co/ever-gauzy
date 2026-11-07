import { TaskPriorityEnum, TaskStatusEnum } from '@gauzy/contracts';
import { LinearIssue, LinearWorkflowState } from '../client/linear-api.client';
import {
	attachmentLinkOf,
	commentHtmlOf,
	DEFAULT_STATE_MAP,
	issueUpdateOf,
	linearPriorityOf,
	linearStateFor,
	parseStateMap,
	serializeStateMap,
	stateTypeOfStatus,
	taskFieldsOf,
	taskPriorityOf
} from './linear-issue.mapper';

const STATES: LinearWorkflowState[] = [
	{ id: 's-backlog', name: 'Backlog', type: 'backlog', position: 0 },
	{ id: 's-todo', name: 'Todo', type: 'unstarted', position: 1 },
	{ id: 's-doing', name: 'In Progress', type: 'started', position: 2 },
	{ id: 's-review', name: 'In Review', type: 'started', position: 3 },
	{ id: 's-done', name: 'Done', type: 'completed', position: 4 },
	{ id: 's-cancel', name: 'Canceled', type: 'canceled', position: 5 }
];

function issue(overrides: Partial<LinearIssue> = {}): LinearIssue {
	return {
		id: 'i1',
		identifier: 'ENG-1',
		title: ' Fix the thing ',
		description: 'Body',
		priority: 2,
		url: 'https://linear.app/x/issue/ENG-1',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-02T00:00:00.000Z',
		archivedAt: null,
		completedAt: null,
		canceledAt: null,
		dueDate: '2026-02-01',
		estimate: 3,
		state: STATES[2],
		assignee: null,
		labels: { nodes: [] },
		parent: null,
		team: { id: 't1', key: 'ENG' },
		project: null,
		...overrides
	};
}

describe('linear issue mapper', () => {
	it('maps state kinds to task statuses with the defaults under the mapping', () => {
		const map = parseStateMap('{"completed":"done","bogus":"x","started":""}');
		expect(map.completed).toBe('done');
		expect(map.started).toBe(DEFAULT_STATE_MAP.started);
		expect(parseStateMap('not json')).toEqual(DEFAULT_STATE_MAP);
		expect(serializeStateMap({ completed: 'done', backlog: TaskStatusEnum.BACKLOG })).toBe('{"completed":"done"}');
		expect(serializeStateMap({ backlog: TaskStatusEnum.BACKLOG })).toBeNull();
	});

	it('reads the task fields of an issue', () => {
		const fields = taskFieldsOf(issue(), DEFAULT_STATE_MAP);
		expect(fields).toEqual({
			title: 'Fix the thing',
			description: 'Body',
			status: TaskStatusEnum.IN_PROGRESS,
			priority: TaskPriorityEnum.HIGH,
			dueDate: new Date('2026-02-01T00:00:00.000Z')
		});
		expect(taskFieldsOf(issue({ title: '', state: null, priority: 0, dueDate: null }), DEFAULT_STATE_MAP)).toMatchObject({
			title: 'ENG-1',
			status: TaskStatusEnum.OPEN,
			priority: null,
			dueDate: null
		});
	});

	it('maps priorities both ways', () => {
		expect([1, 2, 3, 4, 0].map(taskPriorityOf)).toEqual([TaskPriorityEnum.URGENT, TaskPriorityEnum.HIGH, TaskPriorityEnum.MEDIUM, TaskPriorityEnum.LOW, null]);
		expect(linearPriorityOf(TaskPriorityEnum.LOW)).toBe(4);
		expect(linearPriorityOf(null)).toBe(0);
		expect(linearPriorityOf('custom')).toBeNull();
	});

	it('finds the Linear state a task status moves an issue to: the first state of the mapped kind', () => {
		expect(stateTypeOfStatus('In-Progress', DEFAULT_STATE_MAP)).toBe('started');
		expect(linearStateFor(TaskStatusEnum.IN_PROGRESS, STATES, DEFAULT_STATE_MAP)?.id).toBe('s-doing');
		expect(linearStateFor(TaskStatusEnum.COMPLETED, STATES, DEFAULT_STATE_MAP)?.id).toBe('s-done');
		expect(linearStateFor('custom', STATES, DEFAULT_STATE_MAP)).toBeNull();
		const update = issueUpdateOf({ title: 'T', description: null, status: TaskStatusEnum.CANCELLED, priority: TaskPriorityEnum.URGENT, dueDate: new Date('2026-03-04T10:00:00Z') }, STATES, DEFAULT_STATE_MAP);
		expect(update).toEqual({ title: 'T', description: null, stateId: 's-cancel', priority: 1, dueDate: '2026-03-04' });
		// A partial task (a status change alone) leaves the issue's priority and due date as they are.
		expect(issueUpdateOf({ status: TaskStatusEnum.COMPLETED }, STATES, DEFAULT_STATE_MAP)).toEqual({ stateId: 's-done' });
		// A priority Linear has no number for is left alone; an explicit null clears it.
		expect(issueUpdateOf({ priority: 'custom' }, STATES, DEFAULT_STATE_MAP)).toEqual({});
		expect(issueUpdateOf({ priority: null }, STATES, DEFAULT_STATE_MAP)).toEqual({ priority: 0 });
	});

	it('keeps a comment as escaped HTML paragraphs, naming an author who is nobody here', () => {
		const comment = { body: 'Ship it <today>\n\nThen "rest"', user: { id: 'u1', name: 'ada', displayName: 'Ada & Co', email: null } };
		expect(commentHtmlOf(comment, true)).toBe('<p>Ship it &lt;today&gt;</p><p>Then &quot;rest&quot;</p>');
		expect(commentHtmlOf(comment, false)).toBe('<p><strong>Ada &amp; Co</strong> (Linear)</p><p>Ship it &lt;today&gt;</p><p>Then &quot;rest&quot;</p>');
		expect(commentHtmlOf({ body: '  ', user: null }, false)).toBe('');
		expect(commentHtmlOf({ body: 'x', user: { id: 'u2', name: 'grace', displayName: null, email: null } }, false)).toBe('<p><strong>grace</strong> (Linear)</p><p>x</p>');
	});

	it('keeps an attachment as a titled link to its address, and none without an HTTP(S) address', () => {
		expect(attachmentLinkOf({ title: 'Design', url: 'https://www.figma.com/file/1' })).toEqual({ title: 'Design', url: 'https://www.figma.com/file/1' });
		expect(attachmentLinkOf({ title: '', url: 'https://d/x' })).toEqual({ title: 'https://d/x', url: 'https://d/x' });
		expect(attachmentLinkOf({ title: 'x', url: 'ftp://nope' })).toBeNull();
	});
});
