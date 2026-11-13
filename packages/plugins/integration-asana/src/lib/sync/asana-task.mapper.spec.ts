import { TaskPriorityEnum, TaskStatusEnum } from '@gauzy/contracts';
import { AsanaTask } from '../client/asana-api.client';
import {
	asanaUpdateOf,
	attachmentLinkOf,
	commentHtmlOf,
	isCompletedStatus,
	parseSectionMap,
	sectionForStatus,
	serializeSectionMap,
	knownStatusesOf,
	statusKey,
	taskFieldsOf,
	taskPriorityOf
} from './asana-task.mapper';

const SECTIONS = [
	{ gid: 's-todo', name: 'To do' },
	{ gid: 's-doing', name: 'In Progress' },
	{ gid: 's-done', name: 'Done' }
];

function task(overrides: Partial<AsanaTask> = {}): AsanaTask {
	return {
		gid: 't1',
		name: ' Fix the thing ',
		notes: 'Body',
		completed: false,
		completed_at: null,
		created_at: '2026-01-01T00:00:00.000Z',
		modified_at: '2026-01-02T00:00:00.000Z',
		due_on: '2026-02-01',
		due_at: null,
		permalink_url: 'https://app.asana.com/0/p1/t1',
		resource_subtype: 'default_task',
		assignee: null,
		tags: [],
		parent: null,
		memberships: [{ project: { gid: 'p1' }, section: SECTIONS[1] }],
		custom_fields: [{ gid: 'cf', name: 'Priority', type: 'enum', enum_value: { gid: 'e', name: 'High' } }],
		...overrides
	};
}

describe('asana task mapper', () => {
	it('keeps a section map of gid → status and drops the rest', () => {
		expect(parseSectionMap('{"s-doing":"in-progress","bad":3,"":"x"}')).toEqual({ 's-doing': 'in-progress' });
		expect(parseSectionMap('nope')).toEqual({});
		expect(serializeSectionMap({ 's-doing': ' in-progress ', 's-x': '' })).toBe('{"s-doing":"in-progress"}');
		expect(serializeSectionMap({})).toBeNull();
	});

	it('reads the task fields: completed wins, then the map, then a section named like a status, then open', () => {
		const known = knownStatusesOf([TaskStatusEnum.IN_PROGRESS, TaskStatusEnum.OPEN, TaskStatusEnum.COMPLETED]);
		expect(taskFieldsOf(task(), 'p1', { 's-doing': 'in-review' }, known)).toEqual({
			title: 'Fix the thing',
			description: 'Body',
			status: 'in-review',
			priority: TaskPriorityEnum.HIGH,
			dueDate: new Date('2026-02-01T00:00:00.000Z')
		});
		expect(taskFieldsOf(task(), 'p1', {}, known).status).toBe(TaskStatusEnum.IN_PROGRESS);
		expect(taskFieldsOf(task({ memberships: [{ project: { gid: 'p1' }, section: { gid: 's-x', name: 'Someday' } }] }), 'p1', {}, known).status).toBe(TaskStatusEnum.OPEN);
		expect(taskFieldsOf(task({ completed: true }), 'p1', {}, known).status).toBe(TaskStatusEnum.COMPLETED);
		// A section named with spaces matches a hyphenated status, and a mapped value takes the name as the project stores it.
		const custom = knownStatusesOf(['Ready For Review', TaskStatusEnum.OPEN]);
		expect(taskFieldsOf(task({ memberships: [{ project: { gid: 'p1' }, section: { gid: 's-r', name: 'ready for review' } }] }), 'p1', {}, custom).status).toBe('Ready For Review');
		expect(taskFieldsOf(task(), 'p1', { 's-doing': 'READY_FOR_REVIEW' }, custom).status).toBe('Ready For Review');
		expect(statusKey(' In Progress ')).toBe('in-progress');
		expect(knownStatusesOf(['In Progress', 'in-progress', '', null]).get('in-progress')).toBe('In Progress');
		expect(taskFieldsOf(task({ name: '', notes: ' ', custom_fields: [], due_on: null }), 'p1', {}, known)).toMatchObject({ title: 'Asana t1', description: null, priority: null, dueDate: null });
	});

	it('reads a priority from a custom field by its words', () => {
		expect(taskPriorityOf(task({ custom_fields: [{ gid: 'c', name: 'Priority level', type: 'enum', enum_value: { gid: 'e', name: 'P0 – Urgent' } }] }))).toBe(TaskPriorityEnum.URGENT);
		expect(taskPriorityOf(task({ custom_fields: [{ gid: 'c', name: 'Priority', type: 'enum', enum_value: { gid: 'e', name: 'Someday' } }] }))).toBeNull();
	});

	it('maps a task status back: completion, and the section the map or the names point to', () => {
		expect(isCompletedStatus('Done')).toBe(true);
		expect(isCompletedStatus('in-progress')).toBe(false);
		expect(sectionForStatus('in-review', { 's-doing': 'in-review' }, SECTIONS)?.gid).toBe('s-doing');
		expect(sectionForStatus('in progress', {}, SECTIONS)?.gid).toBe('s-doing');
		expect(sectionForStatus('custom', {}, SECTIONS)).toBeNull();
		expect(asanaUpdateOf({ title: 'T', description: null, status: TaskStatusEnum.COMPLETED, dueDate: new Date('2026-03-04T10:00:00Z') })).toEqual({ name: 'T', notes: '', completed: true, due_on: '2026-03-04' });
		expect(asanaUpdateOf({ status: TaskStatusEnum.OPEN })).toEqual({ completed: false });
	});

	it('keeps a comment as escaped HTML paragraphs, naming an author who is nobody here', () => {
		const story = { text: 'Ship it <today>\n\nThen "rest"', created_by: { gid: 'u1', name: 'Ada & Co', email: null } };
		expect(commentHtmlOf(story, true)).toBe('<p>Ship it &lt;today&gt;</p><p>Then &quot;rest&quot;</p>');
		expect(commentHtmlOf(story, false)).toBe('<p><strong>Ada &amp; Co</strong> (Asana)</p><p>Ship it &lt;today&gt;</p><p>Then &quot;rest&quot;</p>');
		expect(commentHtmlOf({ text: '  ', created_by: null }, false)).toBe('');
		expect(commentHtmlOf({ text: 'x', created_by: null }, false)).toBe('<p><strong>Someone</strong> (Asana)</p><p>x</p>');
	});

	it('keeps an attachment as a link to what opens it, named, and none without an address', () => {
		expect(attachmentLinkOf({ name: 'spec.pdf', view_url: 'https://app.asana.com/v/1', permalink_url: 'https://p', download_url: null })).toEqual({ title: 'spec.pdf', url: 'https://app.asana.com/v/1' });
		expect(attachmentLinkOf({ name: '', view_url: null, permalink_url: null, download_url: 'https://d/x' })).toEqual({ title: 'https://d/x', url: 'https://d/x' });
		expect(attachmentLinkOf({ name: 'x', view_url: null, permalink_url: 'ftp://nope', download_url: null })).toBeNull();
	});
});
