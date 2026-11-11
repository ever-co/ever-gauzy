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
			runWithRequest: (request: { user: unknown }, fn: () => unknown) => {
				mockContext.users.push(request.user);
				const previous = current;
				current = request.user;
				try {
					return fn();
				} finally {
					current = previous;
				}
			},
			currentTenantId: () => (current as { tenantId?: string } | null)?.tenantId ?? null,
			currentUser: () => current,
			setClsService: () => undefined
		}
	};
});

import 'reflect-metadata';
import { BaseEntityEnum, EmployeeNotificationTypeEnum, InboxItemKindEnum } from '@gauzy/contracts';
import { automationUser } from './task-automation-context';
import { TaskAutomationWriter } from './task-automation-writer.service';
import { task } from '../engine/testing/fixtures';

const marker = { ruleId: 'rule-a', ruleName: 'Close parents', runId: 'run-1', depth: 1, chain: ['rule-a'] };

describe('TaskAutomationWriter', () => {
	beforeEach(() => {
		mockContext.users = [];
	});

	it('runs the task update as the rule’s system actor, with only the fields the plan changes', async () => {
		const commandBus = { execute: jest.fn(async () => ({})) };
		const writer = new TaskAutomationWriter(commandBus as never, { publish: jest.fn() } as never, {} as never);
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
	});

	it('files one Inbox notice per rule and change, addressed to the assignees’ users', async () => {
		const inbox = { upsertExternal: jest.fn(async () => ({ recipientUserIds: ['u-1'] })), create: jest.fn() };
		const reader = { userIdsOfEmployees: jest.fn(async () => new Map([['e-1', 'u-1']])) };
		const writer = new TaskAutomationWriter({} as never, { publish: jest.fn() } as never, reader as never, inbox as never);
		const sent = await writer.notify(task({ reference: 'API-7' }), { employeeIds: ['e-1', 'e-2'], message: null }, marker, 'due:task-1:x');
		expect(sent).toEqual({ channel: 'inbox', recipients: 1 });
		expect(inbox.upsertExternal).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: InboxItemKindEnum.NOTICE,
				entity: BaseEntityEnum.Task,
				taskId: 'task-1',
				externalSource: 'task-automation',
				externalId: 'rule-a:due:task-1:x',
				title: 'API-7 Ship the release notes — Close parents',
				recipients: [{ userId: 'u-1' }]
			})
		);
		expect(writer.inboxLoaded).toBe(true);
	});

	it('without the Inbox, sends a platform notification to each assignee', async () => {
		const eventBus = { publish: jest.fn() };
		const writer = new TaskAutomationWriter({} as never, eventBus as never, {} as never);
		const sent = await writer.notify(task(), { employeeIds: ['e-1', 'e-2'], message: 'Overdue' }, marker, 'k');
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
