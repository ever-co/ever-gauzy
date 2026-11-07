import { TaskPriorityEnum, TaskStatusEnum } from '@gauzy/contracts';
import { TrelloCard } from '../client/trello-api.client';
import {
	attachmentLinkOf,
	commentHtmlOf,
	isChangedSince,
	isCompletedStatus,
	knownStatusesOf,
	listForStatus,
	parseListMap,
	serializeListMap,
	statusKey,
	taskFieldsOf,
	taskPriorityOf,
	trelloColorOf,
	trelloUpdateOf
} from './trello-card.mapper';

const LISTS = [
	{ id: 'l-todo', name: 'To Do', closed: false, pos: 1 },
	{ id: 'l-doing', name: 'In Progress', closed: false, pos: 2 },
	{ id: 'l-done', name: 'Done', closed: false, pos: 3 }
];
const LIST_NAMES = new Map(LISTS.map((list) => [list.id, list.name]));

function card(overrides: Partial<TrelloCard> = {}): TrelloCard {
	return {
		id: 'c1',
		name: ' Ship it ',
		desc: 'notes',
		closed: false,
		idBoard: 'b1',
		idList: 'l-doing',
		due: '2026-02-01T10:00:00.000Z',
		dueComplete: false,
		dateLastActivity: '2026-01-10T00:00:00.000Z',
		shortUrl: null,
		pos: 1,
		idMembers: [],
		idLabels: [],
		labels: [{ id: 'lb1', name: 'Priority: High', color: 'red' }],
		members: [],
		...overrides
	};
}

describe('trello-card.mapper', () => {
	it('parses and serializes the list map, keeping only entries with a status', () => {
		expect(parseListMap('{"l-doing":"in-progress","bad":3,"":"x"}')).toEqual({ 'l-doing': 'in-progress' });
		expect(parseListMap('not json')).toEqual({});
		expect(serializeListMap({ 'l-doing': ' in-progress ', 'l-x': '' })).toBe('{"l-doing":"in-progress"}');
		expect(serializeListMap({})).toBeNull();
	});

	it('maps a card to the task fields: status by map, by list name, done by archive or due complete', () => {
		const known = knownStatusesOf([TaskStatusEnum.IN_PROGRESS, TaskStatusEnum.OPEN, TaskStatusEnum.COMPLETED]);
		expect(taskFieldsOf(card(), LIST_NAMES, { 'l-doing': 'in-review' }, known)).toEqual({
			title: 'Ship it',
			description: 'notes',
			status: 'in-review',
			priority: TaskPriorityEnum.HIGH,
			dueDate: new Date('2026-02-01T10:00:00.000Z')
		});
		// No map: a list named like a status (spaces as hyphens) gives it; an unknown list gives open.
		expect(taskFieldsOf(card(), LIST_NAMES, {}, known).status).toBe(TaskStatusEnum.IN_PROGRESS);
		expect(taskFieldsOf(card({ idList: 'l-todo' }), LIST_NAMES, {}, known).status).toBe(TaskStatusEnum.OPEN);
		expect(taskFieldsOf(card({ closed: true }), LIST_NAMES, {}, known).status).toBe(TaskStatusEnum.COMPLETED);
		expect(taskFieldsOf(card({ dueComplete: true }), LIST_NAMES, {}, known).status).toBe(TaskStatusEnum.COMPLETED);
		// A mapped value takes the name as the project stores it.
		const custom = knownStatusesOf(['Ready For Review', TaskStatusEnum.OPEN]);
		expect(taskFieldsOf(card(), LIST_NAMES, { 'l-doing': 'READY_FOR_REVIEW' }, custom).status).toBe('Ready For Review');
		expect(taskFieldsOf(card({ name: '', desc: ' ', labels: [], due: null }), LIST_NAMES, {}, known)).toMatchObject({ title: 'Trello c1', description: null, priority: null, dueDate: null });
		expect(statusKey(' In Progress ')).toBe('in-progress');
	});

	it('reads a priority from the labels, in their forms', () => {
		expect(taskPriorityOf([{ name: 'urgent' }])).toBe(TaskPriorityEnum.URGENT);
		expect(taskPriorityOf([{ name: 'Priority - Low' }])).toBe(TaskPriorityEnum.LOW);
		expect(taskPriorityOf([{ name: 'Bug' }, { name: 'P2' }])).toBe(TaskPriorityEnum.MEDIUM);
		expect(taskPriorityOf([{ name: 'Bug' }])).toBeNull();
	});

	it('finds the list of a status through the map first, then by name', () => {
		expect(listForStatus('in-review', { 'l-done': 'in-review' }, LISTS)?.id).toBe('l-done');
		expect(listForStatus('in progress', {}, LISTS)?.id).toBe('l-doing');
		expect(listForStatus('blocked', {}, LISTS)).toBeNull();
		expect(isCompletedStatus('Completed')).toBe(true);
		expect(isCompletedStatus('in-progress')).toBe(false);
	});

	it('sends a task back as a card update: name, description, due complete by status, due date', () => {
		expect(trelloUpdateOf({ title: ' T ', description: null, status: TaskStatusEnum.DONE, dueDate: new Date('2026-03-01T00:00:00.000Z') })).toEqual({
			name: 'T',
			desc: '',
			dueComplete: true,
			due: '2026-03-01T00:00:00.000Z'
		});
		expect(trelloUpdateOf({ title: '' })).toEqual({});
	});

	it('tells the cards changed since the import position', () => {
		const cards = [card({ dateLastActivity: '2026-01-01T00:00:00.000Z' }), card({ dateLastActivity: '2026-01-05T00:00:00.000Z' })];
		expect(isChangedSince(cards[0], '2026-01-03T00:00:00.000Z')).toBe(false);
		expect(isChangedSince(cards[1], '2026-01-03T00:00:00.000Z')).toBe(true);
		expect(isChangedSince(cards[0], null)).toBe(true);
	});

	it('turns a label colour into a hex, the light and dark variants alike', () => {
		expect(trelloColorOf('green')).toBe('#4BCE97');
		expect(trelloColorOf('red_dark')).toBe('#F87168');
		expect(trelloColorOf(null)).toBe('#6E7681');
	});

	it('keeps a comment as escaped HTML paragraphs, always named after its member', () => {
		const action = { data: { text: 'Ship it <today>\n\nThen "rest"' }, memberCreator: { id: 'm1', username: 'ada', fullName: 'Ada & Co' } };
		expect(commentHtmlOf(action)).toBe('<p><strong>Ada &amp; Co</strong> (Trello)</p><p>Ship it &lt;today&gt;</p><p>Then &quot;rest&quot;</p>');
		expect(commentHtmlOf({ data: { text: '  ' }, memberCreator: null })).toBe('');
		expect(commentHtmlOf({ data: { text: 'x' }, memberCreator: { id: 'm2', username: 'grace', fullName: '' } })).toBe('<p><strong>grace</strong> (Trello)</p><p>x</p>');
	});

	it('keeps an attachment as a named link to its address, and none without an HTTP(S) address', () => {
		expect(attachmentLinkOf({ name: 'spec.pdf', url: 'https://trello.com/1/cards/c/attachments/a/download/spec.pdf' })).toEqual({ title: 'spec.pdf', url: 'https://trello.com/1/cards/c/attachments/a/download/spec.pdf' });
		expect(attachmentLinkOf({ name: '', url: 'https://d/x' })).toEqual({ title: 'https://d/x', url: 'https://d/x' });
		expect(attachmentLinkOf({ name: 'x', url: 'ftp://nope' })).toBeNull();
	});
});
