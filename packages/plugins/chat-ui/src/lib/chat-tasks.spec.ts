import { ChatConversationKindEnum, ChatTaskReferenceKindEnum, ChatVisibilityEnum, IChatConversationWithState, IChatMessageWithRelations, TaskStatusEnum } from '@gauzy/contracts';
import { conversationChoices, sendToChatBody, statusChoicesOf, taskSummaryOf, taskTitleFromBody, toggledAssignees, withTaskReference } from './chat-tasks';
import { ChatPerson } from './chat-ui.helpers';

const ANNA = '11111111-1111-4111-8111-111111111111';
const people = new Map<string, ChatPerson>([[ANNA, { employeeId: ANNA, userId: 'u1', name: 'Anna', imageUrl: null }]]);

function conversation(id: string, name: string, extra: Partial<IChatConversationWithState> = {}): IChatConversationWithState {
	return {
		id,
		kind: ChatConversationKindEnum.CHANNEL,
		name,
		visibility: ChatVisibilityEnum.PUBLIC,
		position: 0,
		isDefault: false,
		messageCount: 0,
		memberCount: 2,
		state: { conversationId: id, role: 'member', notifyLevel: 'all', isFavorite: false, unreadCount: 0, mentionCount: 0, lastReadMessageId: null, lastReadAt: null },
		...extra
	} as IChatConversationWithState;
}

describe('chat tasks', () => {
	it('names a task by its project key and number, its title and its status column', () => {
		expect(taskSummaryOf({ id: 't1', title: ' Fix login ', number: 142, prefix: 'gz', status: TaskStatusEnum.OPEN, taskStatus: { name: 'In review' } as never })).toEqual({
			id: 't1',
			key: 'GZ-142',
			title: 'Fix login',
			status: 'In review',
			statusId: null,
			priority: null,
			assigneeIds: [],
			projectId: null,
			organizationId: null
		});
		expect(taskSummaryOf({ id: 't2', title: 'No prefix', number: 7, status: TaskStatusEnum.OPEN })).toMatchObject({ key: '#7', status: TaskStatusEnum.OPEN });
		expect(taskSummaryOf({ id: 't3', title: 'Draft' })).toMatchObject({ key: null, status: null });
	});

	it('reads what a card changes: the status record, the priority, the assignees, the project', () => {
		expect(
			taskSummaryOf({
				id: 't1',
				title: 'Fix login',
				status: TaskStatusEnum.OPEN,
				taskStatus: { id: 's1', name: 'Open' } as never,
				priority: 'high' as never,
				members: [{ id: 'e1' }, { id: 'e2' }, {}] as never,
				projectId: 'p1',
				organizationId: 'o1'
			})
		).toMatchObject({ status: 'Open', statusId: 's1', priority: 'high', assigneeIds: ['e1', 'e2'], projectId: 'p1', organizationId: 'o1' });
		expect(taskSummaryOf({ id: 't2', title: 'x', taskStatusId: 's2' } as never).statusId).toBe('s2');
	});

	it("offers the project's statuses in their order, each name once, and never hides the task's own", () => {
		const records = [
			{ id: 's2', name: 'In Review', order: 2 },
			{ id: 's1', name: 'Open', order: 1 },
			{ id: 's3', name: 'open', order: 3 },
			{ id: 's4', value: 'done', order: 4 },
			{ id: null, name: '  ', order: 0 }
		];
		expect(statusChoicesOf(records, 'Open')).toEqual([
			{ name: 'Open', id: 's1' },
			{ name: 'In Review', id: 's2' },
			{ name: 'done', id: 's4' }
		]);
		expect(statusChoicesOf(records, 'Blocked')[0]).toEqual({ name: 'Blocked', id: null });
		expect(statusChoicesOf([], null)).toEqual([]);
	});

	it('adds or takes off one assignee at a time, keeping the others', () => {
		expect(toggledAssignees(['e1', 'e2'], 'e3')).toEqual(['e1', 'e2', 'e3']);
		expect(toggledAssignees(['e1', 'e2', 'e1'], 'e1')).toEqual(['e2']);
		expect(toggledAssignees(undefined, 'e1')).toEqual(['e1']);
	});

	describe('taskTitleFromBody', () => {
		it('takes the first line of text, mentions as names and Markdown marks taken off', () => {
			expect(taskTitleFromBody(`\n> **Ask** <@${ANNA}> about the [report](https://example.com)\nmore`, people, new Map())).toBe('Ask @Anna about the report');
			expect(taskTitleFromBody('- `deploy` the API\n', people, new Map())).toBe('deploy the API');
			expect(taskTitleFromBody('```\ncode only\n```\nThen this', people, new Map())).toBe('Then this');
		});

		it('shortens a long line and gives nothing for an empty message', () => {
			const title = taskTitleFromBody('x'.repeat(300), people, new Map(), 50);
			expect(title).toHaveLength(50);
			expect(title.endsWith('…')).toBe(true);
			expect(taskTitleFromBody('   \n ', people, new Map())).toBe('');
		});
	});

	it('sends the note written beside a task, or else its key and title', () => {
		const task = { id: 't1', key: 'GZ-142', title: 'Fix login', status: null };
		expect(sendToChatBody('  Can someone take this?  ', task)).toBe('Can someone take this?');
		expect(sendToChatBody('', task)).toBe('GZ-142 Fix login');
		expect(sendToChatBody('', { ...task, key: null })).toBe('Fix login');
		expect(sendToChatBody('', null)).toBe('Task');
	});

	it('offers the conversations I am in and that are not archived, favourites first, then the latest', () => {
		const list = [
			conversation('a', 'alpha', { lastMessageAt: new Date('2026-11-01') }),
			conversation('b', 'beta', { lastMessageAt: new Date('2026-11-09') }),
			conversation('c', 'gamma', { state: { ...(conversation('c', 'gamma').state as NonNullable<IChatConversationWithState['state']>), isFavorite: true } }),
			conversation('d', 'delta', { archivedAt: new Date() }),
			conversation('e', 'epsilon', { state: null })
		];
		const titleOf = (item: IChatConversationWithState) => String(item.name);
		expect(conversationChoices(list, '', titleOf).map((item) => item.id)).toEqual(['c', 'b', 'a']);
		expect(conversationChoices(list, 'ALP', titleOf).map((item) => item.id)).toEqual(['a']);
	});

	it('adds a created task to the message once', () => {
		const message = { id: 'm1', taskReferences: [{ messageId: 'm1', taskId: 't0', kind: ChatTaskReferenceKindEnum.MENTION }] } as IChatMessageWithRelations;
		const reference = { messageId: 'm1', taskId: 't1', kind: ChatTaskReferenceKindEnum.CREATED };
		const once = withTaskReference(message, reference);
		expect(once.taskReferences?.map((item) => item.taskId)).toEqual(['t0', 't1']);
		expect(withTaskReference(once, reference)).toBe(once);
		expect(withTaskReference({ id: 'm2' } as IChatMessageWithRelations, reference).taskReferences).toEqual([reference]);
	});
});
