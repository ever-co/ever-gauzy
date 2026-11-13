/**
 * The writer: the update a rule's plan becomes (`TaskUpdateCommand`, run as the rule's system actor), and its notices
 * (an Inbox notice keyed by the rule and the change, or platform notifications without the Inbox).
 */
const mockContext: { users: unknown[] } = { users: [] };

jest.mock('@gauzy/core', () => {
	class TaskUpdateCommand {
		constructor(
			public readonly id: string,
			public readonly input: unknown
		) {}
	}
	class EmployeeCreateNotificationEvent {
		constructor(public readonly input: unknown) {}
	}
	let current: unknown = null;
	return {
		TaskUpdateCommand,
		EmployeeCreateNotificationEvent,
		RequestContext: {
			// As the platform's context: the user stays the current one until the work it runs has settled, awaited
			// work included.
			runWithRequest: (request: { user: unknown }, fn: () => unknown) => {
				mockContext.users.push(request.user);
				const previous = current;
				current = request.user;
				let result: unknown;
				try {
					result = fn();
				} catch (error) {
					current = previous;
					throw error;
				}
				if (result instanceof Promise) {
					return result.finally(() => {
						current = previous;
					});
				}
				current = previous;
				return result;
			},
			currentTenantId: () => (current as { tenantId?: string } | null)?.tenantId ?? null,
			currentUser: () => current,
			setClsService: () => undefined
		}
	};
});

// The reader is injected by type only: its module graph (entities, repositories) stays out of this suite.
jest.mock('./task-automation-task-reader.service', () => ({ TaskAutomationTaskReader: class TaskAutomationTaskReader {} }));

import 'reflect-metadata';
import { BaseEntityEnum, EmployeeNotificationTypeEnum, InboxItemKindEnum } from '@gauzy/contracts';
import { automationUser } from './task-automation-context';
import { applyListEdit, listEdit, TaskAutomationTaskGoneError, TaskAutomationWriter } from './task-automation-writer.service';
import { task } from '../engine/testing/fixtures';

const marker = { ruleId: 'rule-a', ruleName: 'Close parents', runId: 'run-1', depth: 1, chain: ['rule-a'] };

describe('TaskAutomationWriter', () => {
	beforeEach(() => {
		mockContext.users = [];
	});

	it('runs the task update as the rule’s system actor, with only the fields the plan changes', async () => {
		const { RequestContext } = jest.requireMock('@gauzy/core') as { RequestContext: { currentUser: () => unknown } };
		const actors: unknown[] = [];
		// The command reads the actor after an await, as the platform's handler does.
		const commandBus = {
			execute: jest.fn(async () => {
				await Promise.resolve();
				actors.push(RequestContext.currentUser());
				return {};
			})
		};
		const reader = { lists: jest.fn(async () => ({ memberIds: [], tagIds: [] })) };
		const writer = new TaskAutomationWriter(commandBus as never, { publish: jest.fn() } as never, reader as never);
		await writer.applyUpdate(task(), { status: 'done', taskStatusId: 'st-done', memberIds: ['e-1'], tagIds: ['t-1'] }, marker);
		const [command] = commandBus.execute.mock.calls[0] as unknown as [{ id: string; input: Record<string, unknown> }];
		expect(command.id).toBe('task-1');
		expect(command.input).toEqual({
			organizationId: 'org-1',
			status: 'done',
			taskStatusId: 'st-done',
			members: [{ id: 'e-1' }],
			tags: [{ id: 't-1' }]
		});
		// The last context opened is the rule's (a probe of the request-context store may come first).
		expect(mockContext.users.at(-1)).toEqual(automationUser({ tenantId: 'tenant-1', organizationId: 'org-1' }, marker));
		expect(mockContext.users.at(-1)).toMatchObject({ id: undefined, employeeId: undefined, permissions: [], name: 'Automation: Close parents' });
		expect(actors).toEqual([automationUser({ tenantId: 'tenant-1', organizationId: 'org-1' }, marker)]);
	});

	describe('a person’s edit made after the run read the task', () => {
		/** The task as the run read it, and the lists as a person left them before the write. */
		const writeWith = async (
			snapshot: { memberIds?: string[]; tagIds?: string[] },
			update: { memberIds?: string[]; tagIds?: string[]; status?: string; taskStatusId?: string },
			now: { memberIds: string[]; tagIds: string[] } | null
		) => {
			const commandBus = { execute: jest.fn(async () => ({})) };
			const reader = { lists: jest.fn(async () => now) };
			const writer = new TaskAutomationWriter(commandBus as never, { publish: jest.fn() } as never, reader as never);
			const written = writer.applyUpdate(task(snapshot), update, marker);
			return { written, commandBus, reader };
		};
		const inputOf = (commandBus: { execute: jest.Mock }) =>
			(commandBus.execute.mock.calls[0] as unknown as [{ input: Record<string, unknown> }])[0].input;

		it('does not put back an assignee removed since: an added assignee joins the list as it is now', async () => {
			// The run read A and B; a person removed A; the rule adds C.
			const { written, commandBus, reader } = await writeWith({ memberIds: ['A', 'B'] }, { memberIds: ['A', 'B', 'C'] }, { memberIds: ['B'], tagIds: [] });
			await expect(written).resolves.toEqual({ written: true, lists: { memberIds: ['B'], tagIds: [] }, unchanged: [] });
			expect(reader.lists).toHaveBeenCalledWith('tenant-1', 'task-1');
			expect(inputOf(commandBus)['members']).toEqual([{ id: 'B' }, { id: 'C' }]);
			expect(inputOf(commandBus)).not.toHaveProperty('tags');
		});

		it('keeps an assignee added since when the rule replaces the assignees', async () => {
			// SET_ASSIGNEES to C, planned on [A]; a person added D meanwhile.
			const { written, commandBus } = await writeWith({ memberIds: ['A'] }, { memberIds: ['C'] }, { memberIds: ['A', 'D'], tagIds: [] });
			await written;
			expect(inputOf(commandBus)['members']).toEqual([{ id: 'D' }, { id: 'C' }]);
		});

		it('keeps a label added since, and removes only the label the rule removes', async () => {
			const { written, commandBus } = await writeWith({ tagIds: ['L1', 'L2'] }, { tagIds: ['L2'] }, { memberIds: [], tagIds: ['L1', 'L2', 'L3'] });
			await written;
			expect(inputOf(commandBus)['tags']).toEqual([{ id: 'L2' }, { id: 'L3' }]);
			expect(inputOf(commandBus)).not.toHaveProperty('members');
		});

		it('writes no list the edit already left as the rule wanted, and nothing when nothing else changes', async () => {
			const { written, commandBus } = await writeWith({ memberIds: ['A'] }, { memberIds: ['A', 'C'] }, { memberIds: ['C', 'A'], tagIds: [] });
			await expect(written).resolves.toEqual({ written: false, lists: { memberIds: ['C', 'A'], tagIds: [] }, unchanged: ['members'] });
			expect(commandBus.execute).not.toHaveBeenCalled();

			const withStatus = await writeWith(
				{ memberIds: ['A'] },
				{ memberIds: ['A', 'C'], status: 'done', taskStatusId: 'st-done' },
				{ memberIds: ['A', 'C'], tagIds: [] }
			);
			await withStatus.written;
			expect(inputOf(withStatus.commandBus)).toEqual({ organizationId: 'org-1', status: 'done', taskStatusId: 'st-done' });
		});

		it('writes nothing to a task that is gone', async () => {
			const { written, commandBus } = await writeWith({ memberIds: ['A'] }, { memberIds: ['A', 'C'] }, null);
			await expect(written).rejects.toThrow(TaskAutomationTaskGoneError);
			expect(commandBus.execute).not.toHaveBeenCalled();
		});

		it('reads nothing more for an update without lists', async () => {
			const { written, commandBus, reader } = await writeWith({}, { status: 'done', taskStatusId: 'st-done' }, null);
			await expect(written).resolves.toEqual({ written: true, lists: null, unchanged: [] });
			expect(reader.lists).not.toHaveBeenCalled();
			expect(inputOf(commandBus)).toEqual({ organizationId: 'org-1', status: 'done', taskStatusId: 'st-done' });
		});

		it('turns a plan into additions and removals, and applies them to any list', () => {
			expect(listEdit(['A', 'B'], ['B', 'C', 'C'])).toEqual({ add: ['C'], remove: ['A'] });
			expect(applyListEdit(['B', 'D', 'D'], { add: ['C', 'D'], remove: ['A'] })).toEqual(['B', 'D', 'C']);
		});
	});

	it('files one Inbox notice per rule and change, addressed to the assignees’ users', async () => {
		const inbox = { upsertExternal: jest.fn(async () => ({ recipientUserIds: ['u-1'] })), create: jest.fn() };
		const reader = { userIdsOfEmployees: jest.fn(async () => new Map([['e-1', 'u-1']])) };
		const writer = new TaskAutomationWriter({} as never, { publish: jest.fn() } as never, reader as never, inbox as never);
		const sent = await writer.notify(task({ reference: 'API-7' }), { employeeIds: ['e-1', 'e-2'], message: null, actionIndex: 0 }, marker, 'due:task-1:x');
		expect(sent).toEqual({ channel: 'inbox', recipients: 1 });
		expect(inbox.upsertExternal).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: InboxItemKindEnum.NOTICE,
				entity: BaseEntityEnum.Task,
				taskId: 'task-1',
				externalSource: 'task-automation',
				externalId: 'rule-a:0:due:task-1:x',
				title: 'API-7 Ship the release notes — Close parents',
				recipients: [{ userId: 'u-1' }]
			})
		);
		expect(writer.inboxLoaded).toBe(true);
	});

	it('without the Inbox, sends a platform notification to each assignee', async () => {
		const eventBus = { publish: jest.fn() };
		const writer = new TaskAutomationWriter({} as never, eventBus as never, {} as never);
		const sent = await writer.notify(task(), { employeeIds: ['e-1', 'e-2'], message: 'Overdue', actionIndex: 2 }, marker, 'k');
		expect(sent).toEqual({ channel: 'notification', recipients: 2 });
		expect(eventBus.publish).toHaveBeenCalledTimes(2);
		expect((eventBus.publish.mock.calls[0] as unknown as [{ input: Record<string, unknown> }])[0].input).toMatchObject({
			type: EmployeeNotificationTypeEnum.TASK_UPDATE,
			receiverEmployeeId: 'e-1',
			title: 'Overdue',
			entityId: 'task-1'
		});
		expect(writer.inboxLoaded).toBe(false);
	});
});
