// cspell:ignore issuetype issuelinks duedate Cloners duplicat
import { TaskPriorityEnum, TaskRelatedIssuesRelationEnum, TaskStatusEnum } from '@gauzy/contracts';
import { importJqlOf, JiraIssue, JiraStatus, JiraTransition } from '../client/jira-api.client';
import {
	attachmentLinkOf,
	chooseCreateIssueType,
	chooseTransition,
	commentHtmlOf,
	DEFAULT_STATUS_MAP,
	dueDateOf,
	invalidStatusMapKeys,
	isIssueTypeAllowed,
	issueUpdateOf,
	jiraDueDateOf,
	jiraPriorityFor,
	linkEndsOf,
	parseIssueTypeIds,
	parseStatusMap,
	serializeIssueTypeIds,
	serializeStatusMap,
	taskFieldsOf,
	taskPriorityOf,
	taskStatusOf
} from './jira-issue.mapper';

const status = (id: string, key: string, name = `S${id}`): JiraStatus => ({ id, name, statusCategory: { key } });
const transition = (id: string, to: JiraStatus, extra: Partial<JiraTransition> = {}): JiraTransition => ({ id, name: `to ${to.name}`, to, ...extra });

describe('the status map', () => {
	it('puts the category defaults under what the mapping says, and drops unknown keys and unusable values', () => {
		expect(parseStatusMap(null)).toEqual(DEFAULT_STATUS_MAP);
		expect(parseStatusMap('not json')).toEqual(DEFAULT_STATUS_MAP);
		expect(parseStatusMap(JSON.stringify({ done: 'shipped', 'status:10004': 'in review', team: 'x', 'status:abc': 'y', new: '', indeterminate: 7 }))).toEqual({
			new: TaskStatusEnum.OPEN,
			indeterminate: TaskStatusEnum.IN_PROGRESS,
			done: 'shipped',
			'status:10004': 'in review'
		});
	});

	it('stores only what differs from the defaults (every named status), or nothing at all', () => {
		expect(serializeStatusMap({ new: TaskStatusEnum.OPEN, indeterminate: TaskStatusEnum.IN_PROGRESS, done: TaskStatusEnum.COMPLETED })).toBeNull();
		expect(serializeStatusMap({ done: ' closed ', 'status:3': 'blocked', bogus: 'x' })).toBe(JSON.stringify({ done: 'closed', 'status:3': 'blocked' }));
		expect(serializeStatusMap(null)).toBeNull();
		expect(invalidStatusMapKeys({ done: 'a', 'status:12': 'b', 'status:x': 'c', other: 'd' })).toEqual(['status:x', 'other']);
	});

	it('reads a status by its own entry first, then by its category', () => {
		const map = parseStatusMap(JSON.stringify({ 'status:10004': 'ready-for-review' }));
		expect(taskStatusOf(status('10004', 'indeterminate'), map)).toBe('ready-for-review');
		expect(taskStatusOf(status('3', 'indeterminate'), map)).toBe(TaskStatusEnum.IN_PROGRESS);
		expect(taskStatusOf(status('5', 'done'), map)).toBe(TaskStatusEnum.COMPLETED);
		// An unknown category (or none) reads as `new`.
		expect(taskStatusOf(status('9', 'undefined'), map)).toBe(TaskStatusEnum.OPEN);
		expect(taskStatusOf(null, map)).toBe(TaskStatusEnum.OPEN);
	});
});

describe('chooseTransition', () => {
	const todo = status('1', 'new', 'To Do');
	const doing = status('3', 'indeterminate', 'In Progress');
	const review = status('10004', 'indeterminate', 'In Review');
	const done = status('10001', 'done', 'Done');
	const wontDo = status('10002', 'done', "Won't Do");

	it('takes the transition whose target maps to the task status', () => {
		const transitions = [transition('11', todo), transition('21', doing), transition('31', done)];
		expect(chooseTransition(transitions, todo, TaskStatusEnum.IN_PROGRESS, parseStatusMap(null))?.id).toBe('21');
		expect(chooseTransition(transitions, doing, TaskStatusEnum.COMPLETED, parseStatusMap(null))?.id).toBe('31');
	});

	it('does nothing when the issue is where the task status maps already, or nothing reaches it', () => {
		const transitions = [transition('21', doing), transition('31', done)];
		expect(chooseTransition(transitions, review, TaskStatusEnum.IN_PROGRESS, parseStatusMap(null))).toBeNull();
		expect(chooseTransition(transitions, todo, 'blocked', parseStatusMap(null))).toBeNull();
		expect(chooseTransition(transitions, todo, '', parseStatusMap(null))).toBeNull();
		expect(chooseTransition([], todo, TaskStatusEnum.COMPLETED, parseStatusMap(null))).toBeNull();
	});

	it('prefers a status named on its own over one reached by its category, whatever Jira’s order', () => {
		const map = parseStatusMap(JSON.stringify({ 'status:10002': TaskStatusEnum.CANCELLED, 'status:10004': TaskStatusEnum.READY_FOR_REVIEW, done: TaskStatusEnum.CANCELLED }));
		const transitions = [transition('31', done), transition('41', wontDo)];
		// Both targets are `done` statuses that map to "cancelled"; Won't Do is named on its own.
		expect(chooseTransition(transitions, doing, TaskStatusEnum.CANCELLED, map)?.id).toBe('41');
		expect(chooseTransition([transition('21', doing), transition('51', review)], todo, TaskStatusEnum.READY_FOR_REVIEW, map)?.id).toBe('51');
	});

	it('prefers a transition without a screen, then Jira’s own order; never one Jira says is unavailable', () => {
		const other = status('10010', 'done', 'Closed');
		expect(chooseTransition([transition('31', done, { hasScreen: true }), transition('32', other)], doing, TaskStatusEnum.COMPLETED, parseStatusMap(null))?.id).toBe('32');
		expect(chooseTransition([transition('31', done), transition('32', other)], doing, TaskStatusEnum.COMPLETED, parseStatusMap(null))?.id).toBe('31');
		expect(chooseTransition([transition('31', done, { isAvailable: false }), transition('32', other)], doing, TaskStatusEnum.COMPLETED, parseStatusMap(null))?.id).toBe('32');
	});

	it('matches task statuses whatever their case', () => {
		expect(chooseTransition([transition('31', done)], doing, 'COMPLETED', parseStatusMap(null))?.id).toBe('31');
	});
});

describe('priorities', () => {
	it('reads the usual names of a site’s priorities', () => {
		expect(taskPriorityOf({ name: 'Highest' })).toBe(TaskPriorityEnum.URGENT);
		expect(taskPriorityOf({ name: 'Blocker' })).toBe(TaskPriorityEnum.URGENT);
		expect(taskPriorityOf({ name: 'High' })).toBe(TaskPriorityEnum.HIGH);
		expect(taskPriorityOf({ name: 'Medium' })).toBe(TaskPriorityEnum.MEDIUM);
		expect(taskPriorityOf({ name: 'Low' })).toBe(TaskPriorityEnum.LOW);
		expect(taskPriorityOf({ name: 'Lowest' })).toBe(TaskPriorityEnum.LOW);
		expect(taskPriorityOf({ name: 'Whenever' })).toBeNull();
		expect(taskPriorityOf(null)).toBeNull();
	});

	it('finds the site’s priority for a task priority, or none (the issue’s is left alone)', () => {
		const site = [
			{ id: '1', name: 'Highest' },
			{ id: '2', name: 'High' },
			{ id: '3', name: 'Medium' },
			{ id: '4', name: 'Low' }
		];
		expect(jiraPriorityFor(TaskPriorityEnum.URGENT, site)?.id).toBe('1');
		expect(jiraPriorityFor(TaskPriorityEnum.LOW, site)?.id).toBe('4');
		expect(jiraPriorityFor(TaskPriorityEnum.HIGH, [{ id: '9', name: 'Major' }])?.id).toBe('9');
		expect(jiraPriorityFor(TaskPriorityEnum.MEDIUM, [{ id: '9', name: 'Critical' }])).toBeNull();
		expect(jiraPriorityFor(null, site)).toBeNull();
	});
});

describe('due dates', () => {
	it('keeps a calendar date as midnight UTC, and writes it back as the same day whatever the server’s zone', () => {
		expect(dueDateOf('2026-11-30')?.toISOString()).toBe('2026-11-30T00:00:00.000Z');
		expect(dueDateOf('30/11/2026')).toBeNull();
		expect(jiraDueDateOf(new Date('2026-11-30T00:00:00.000Z'))).toBe('2026-11-30');
		expect(jiraDueDateOf('2026-11-30T23:30:00.000Z')).toBe('2026-11-30');
		expect(jiraDueDateOf(null)).toBeNull();
		expect(jiraDueDateOf('nope')).toBeNull();
	});
});

describe('issue types', () => {
	it('stores the ids a mapping takes, and filters the issues by them (every type when none)', () => {
		expect(serializeIssueTypeIds(['10001', '10001', 'x', '10002'])).toBe('["10001","10002"]');
		expect(serializeIssueTypeIds([])).toBeNull();
		expect(parseIssueTypeIds('["10001","bad"]')).toEqual(['10001']);
		expect(parseIssueTypeIds('[]')).toBeNull();
		const issue = { fields: { issuetype: { id: '10002', name: 'Bug', subtask: false } } } as unknown as JiraIssue;
		expect(isIssueTypeAllowed(issue, null)).toBe(true);
		expect(isIssueTypeAllowed(issue, ['10002'])).toBe(true);
		expect(isIssueTypeAllowed(issue, ['10001'])).toBe(false);
	});

	it('creates a task as the mapping’s first type, else the project’s Task, never a sub-task', () => {
		const types = [
			{ id: '1', name: 'Epic', subtask: false, hierarchyLevel: 1 },
			{ id: '2', name: 'Bug', subtask: false, hierarchyLevel: 0 },
			{ id: '3', name: 'Task', subtask: false, hierarchyLevel: 0 },
			{ id: '4', name: 'Sub-task', subtask: true, hierarchyLevel: -1 }
		];
		expect(chooseCreateIssueType(types, null)?.id).toBe('3');
		expect(chooseCreateIssueType(types, ['4', '2'])?.id).toBe('2');
		expect(chooseCreateIssueType(types, ['4'])).toBeNull();
		expect(chooseCreateIssueType(types.filter((type) => type.name !== 'Task'), null)?.id).toBe('2');
	});
});

describe('the fields an issue sets and a task sends', () => {
	const issue: JiraIssue = {
		id: '10001',
		key: 'APP-1',
		fields: {
			summary: '  Fix login  ',
			description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Steps <here>' }] }] },
			status: status('3', 'indeterminate'),
			priority: { id: '2', name: 'High' },
			assignee: null,
			labels: ['backend'],
			duedate: '2026-12-01',
			issuetype: { id: '10002', name: 'Bug', subtask: false },
			project: { id: '10000', key: 'APP' },
			created: '2026-11-01T10:00:00.000+0000',
			updated: '2026-11-02T10:00:00.000+0000'
		}
	};

	it('reads an issue as the task’s fields, its description as escaped HTML', () => {
		expect(taskFieldsOf(issue, parseStatusMap(null))).toEqual({
			title: 'Fix login',
			description: '<p>Steps &lt;here&gt;</p>',
			status: TaskStatusEnum.IN_PROGRESS,
			priority: TaskPriorityEnum.HIGH,
			dueDate: new Date('2026-12-01T00:00:00.000Z')
		});
		expect(taskFieldsOf({ ...issue, fields: { ...issue.fields, summary: '', description: null } }, parseStatusMap(null))).toMatchObject({ title: 'APP-1', description: null });
	});

	it('sends what the task carries: the summary, the description as ADF, a priority the site has, the date', () => {
		const update = issueUpdateOf(
			{ title: ' New title ', description: '<p>Hi <strong>there</strong></p>', priority: TaskPriorityEnum.URGENT, dueDate: new Date('2026-12-24T00:00:00.000Z') },
			[{ id: '1', name: 'Highest' }]
		);
		expect(update).toEqual({
			summary: 'New title',
			description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi ' }, { type: 'text', text: 'there', marks: [{ type: 'strong' }] }] }] },
			priority: { id: '1' },
			duedate: '2026-12-24'
		});
		// A partial task leaves the rest alone; a cleared description and date clear the issue's.
		expect(issueUpdateOf({ priority: TaskPriorityEnum.LOW }, [])).toEqual({});
		expect(issueUpdateOf({ description: null, dueDate: null }, [])).toEqual({ description: null, duedate: null });
	});
});

describe('the JQL of an import', () => {
	it('names the project, the issue types, and a relative position (no time zone in it), oldest change first', () => {
		const now = Date.UTC(2026, 10, 11, 12, 0, 0);
		expect(importJqlOf({ projectId: '10000' })).toBe('project = 10000 ORDER BY updated ASC, key ASC');
		expect(importJqlOf({ projectId: '10000', issueTypeIds: ['1', '2'], updatedSince: new Date(now - 90 * 60_000).toISOString(), now })).toBe(
			'project = 10000 AND issuetype in (1, 2) AND updated >= "-91m" ORDER BY updated ASC, key ASC'
		);
		expect(importJqlOf({ projectId: 'A"B' })).toBe('project = "A\\"B" ORDER BY updated ASC, key ASC');
	});
});

describe('links, comments and attachments', () => {
	const link = (name: string, outward: string, ends: { inwardIssue?: { id: string; key: string }; outwardIssue?: { id: string; key: string } }) => ({
		id: 'l',
		type: { name, inward: 'is …', outward },
		...ends
	});

	it('reads a link from the issue it points out of, whichever end it was read from', () => {
		expect(linkEndsOf('1', link('Blocks', 'blocks', { outwardIssue: { id: '2', key: 'A-2' } }))).toEqual({ fromSourceId: '1', toSourceId: '2', action: TaskRelatedIssuesRelationEnum.BLOCKS });
		expect(linkEndsOf('2', link('Blocks', 'blocks', { inwardIssue: { id: '1', key: 'A-1' } }))).toEqual({ fromSourceId: '1', toSourceId: '2', action: TaskRelatedIssuesRelationEnum.BLOCKS });
		expect(linkEndsOf('1', link('Cloners', 'clones', { outwardIssue: { id: '2', key: 'A-2' } }))?.action).toBe(TaskRelatedIssuesRelationEnum.CLONES);
		expect(linkEndsOf('1', link('Duplicate', 'duplicates', { outwardIssue: { id: '2', key: 'A-2' } }))?.action).toBe(TaskRelatedIssuesRelationEnum.DUPLICATES);
		expect(linkEndsOf('1', link('Relates', 'relates to', { outwardIssue: { id: '2', key: 'A-2' } }))?.action).toBe(TaskRelatedIssuesRelationEnum.RELATES_TO);
		expect(linkEndsOf('1', link('Relates', 'relates to', {}))).toBeNull();
	});

	it('names the author of a comment nobody here wrote, escaped', () => {
		const comment = { body: { type: 'doc' as const, version: 1 as const, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ok' }] }] }, author: { accountId: 'a', displayName: '<Ada>' } };
		expect(commentHtmlOf(comment, true)).toBe('<p>ok</p>');
		expect(commentHtmlOf(comment, false)).toBe('<p><strong>&lt;Ada&gt;</strong> (Jira)</p><p>ok</p>');
		expect(commentHtmlOf({ body: null, author: null }, false)).toBe('');
	});

	it('keeps an attachment as a link only with an HTTPS address', () => {
		expect(attachmentLinkOf({ filename: 'a.png', content: 'https://site.atlassian.net/rest/api/3/attachment/content/1' })).toEqual({
			title: 'a.png',
			url: 'https://site.atlassian.net/rest/api/3/attachment/content/1'
		});
		expect(attachmentLinkOf({ filename: 'a.png', content: 'http://insecure/a' })).toBeNull();
		expect(attachmentLinkOf({ filename: null, content: null })).toBeNull();
	});
});
