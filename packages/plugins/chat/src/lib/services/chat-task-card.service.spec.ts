/**
 * `ChatTaskCardService`: a change from a task card is the task page's update, under the task page's permission and the
 * card's own rules.
 *
 * `@gauzy/core` is doubled at the module boundary (its barrel boots the whole application); its `RequestContext` grants
 * what each test signs in with, and `TaskUpdateCommand` records what it was given.
 */
const granted = new Set<string>();
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	const explicit: Record<string, unknown> = {
		__esModule: true,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		TenantOrganizationBaseEntity: class {},
		MikroOrmBaseEntityRepository: class {},
		RequestContext: { hasPermission: (permission: string) => granted.has(permission) },
		TaskUpdateCommand: class {
			constructor(
				public readonly id: string,
				public readonly input: unknown
			) {}
		}
	};
	return new Proxy(explicit, { get: (target, name) => (name in target ? target[name as string] : function Anything() {}) });
});

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { IChatTaskUpdateInput, PermissionsEnum } from '@gauzy/contracts';
import { ChatRealtime } from '../realtime/chat-realtime';
import { ChatAccessService, IChatCaller } from './chat-access.service';
import { ChatTaskCardService, taskPatchOf } from './chat-task-card.service';

const caller: IChatCaller = { tenantId: 'ten', organizationId: 'org', userId: 'u1', employeeId: 'e1', canManage: false };

function over(options: { reference?: boolean; task?: boolean; employees?: number; status?: boolean; archived?: boolean } = {}) {
	const message = { id: 'm1', conversationId: 'c1', kind: 'message', tenantId: 'ten', organizationId: 'org', deletedAt: null };
	const repositories: Record<string, Record<string, jest.Mock>> = {
		ChatMessage: { findOne: jest.fn(async () => message), find: jest.fn(async () => [message, { ...message, id: 'm2', conversationId: 'c2' }]) },
		ChatTaskReference: {
			findOne: jest.fn(async () => (options.reference === false ? null : { messageId: 'm1', taskId: 't1' })),
			find: jest.fn(async () => [{ messageId: 'm1' }, { messageId: 'm2' }])
		},
		Task: { findOne: jest.fn(async () => (options.task === false ? null : { id: 't1', organizationId: 'org' })) },
		TaskStatus: { findOne: jest.fn(async () => (options.status === false ? null : { id: 's1' })) },
		TaskPriority: { findOne: jest.fn(async () => ({ id: 'p1' })) },
		Employee: { find: jest.fn(async () => Array.from({ length: options.employees ?? 2 }, (_, index) => ({ id: `e${index + 1}` }))) }
	};
	const manager = { getRepository: (entity: string | { name?: string }) => repositories[typeof entity === 'string' ? entity : String(entity?.name)] };
	const dataSource = {
		getRepository: manager.getRepository,
		transaction: jest.fn(async (work: (m: typeof manager) => Promise<unknown>) => work(manager))
	} as unknown as DataSource;
	const access = {
		requireMember: jest.fn(async () => ({ conversation: { id: 'c1', organizationId: 'org', archivedAt: options.archived ? new Date() : undefined }, member: { id: 'mb1' } })),
		members: jest.fn(async (_tenantId: string, conversationId: string) => (conversationId === 'c1' ? [{ userId: 'u1' }, { userId: 'u2' }] : [{ userId: 'u3' }]))
	} as unknown as ChatAccessService;
	const realtime = {
		messageFact: jest.fn((name: string, row: { id: string }, recipients: string[]) => ({ name, id: row.id, recipients })),
		append: jest.fn(async (_manager: unknown, fact: { name: string; id: string; recipients: string[] }) => ({ name: fact.name, data: { messageId: fact.id, to: fact.recipients } }))
	};
	const commandBus = { execute: jest.fn(async (command: { id: string; input: Record<string, unknown> }) => ({ id: command.id, ...command.input })) };
	const service = new ChatTaskCardService(dataSource, access, realtime as unknown as ChatRealtime, commandBus as unknown as CommandBus);
	return { service, commandBus, repositories };
}

describe('taskPatchOf', () => {
	it('writes only what the card changes, as the task page writes it', () => {
		expect(taskPatchOf({ status: ' In Review ', taskStatusId: 's1' }, null)).toEqual({ status: 'In Review', taskStatusId: 's1' });
		expect(taskPatchOf({ priority: '', taskPriorityId: null }, null)).toEqual({ priority: null, taskPriorityId: null });
		expect(taskPatchOf({}, [])).toEqual({ members: [] });
	});

	it('refuses a change that names nothing, or a nameless status', () => {
		expect(() => taskPatchOf({}, null)).toThrow(BadRequestException);
		expect(() => taskPatchOf({ status: '  ' }, null)).toThrow(BadRequestException);
	});
});

describe('ChatTaskCardService.update', () => {
	beforeEach(() => {
		granted.clear();
		granted.add(PermissionsEnum.ORG_TASK_EDIT).add(PermissionsEnum.ORG_TASK_VIEW);
	});

	it("runs the task page's update command, then tells every conversation that shows the task", async () => {
		const { service, commandBus } = over();
		const result = await service.update(caller, 'm1', 't1', { status: 'done', taskStatusId: 's1', assigneeEmployeeIds: ['e1', 'e2', 'e1'] });
		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		expect(commandBus.execute.mock.calls[0][0]).toEqual(
			expect.objectContaining({ id: 't1', input: { status: 'done', taskStatusId: 's1', members: [{ id: 'e1' }, { id: 'e2' }] } })
		);
		expect(result.task).toEqual(expect.objectContaining({ id: 't1', status: 'done' }));
		expect(result.events).toEqual([
			{ name: 'chat_message.updated', data: { messageId: 'm1', to: ['u1', 'u2'] } },
			{ name: 'chat_message.updated', data: { messageId: 'm2', to: ['u3'] } }
		]);
	});

	it("asks the task page's permission, and task view", async () => {
		granted.clear();
		granted.add(PermissionsEnum.ORG_TASK_VIEW);
		await expect(over().service.update(caller, 'm1', 't1', { status: 'done' })).rejects.toBeInstanceOf(ForbiddenException);
		granted.clear();
		granted.add(PermissionsEnum.ALL_ORG_EDIT);
		await expect(over().service.update(caller, 'm1', 't1', { status: 'done' })).rejects.toBeInstanceOf(ForbiddenException);
		granted.add(PermissionsEnum.ALL_ORG_VIEW);
		await expect(over().service.update(caller, 'm1', 't1', { status: 'done' })).resolves.toBeDefined();
	});

	it("changes nothing for a task the message does not show, another organization's task, an unknown status or assignee", async () => {
		const cases: Array<[Parameters<typeof over>[0], IChatTaskUpdateInput]> = [
			[{ reference: false }, { status: 'done' }],
			[{ task: false }, { status: 'done' }],
			[{ status: false }, { taskStatusId: 's9' }],
			[{ employees: 1 }, { assigneeEmployeeIds: ['e1', 'e9'] }]
		];
		for (const [options, input] of cases) {
			const { service, commandBus } = over(options);
			await expect(service.update(caller, 'm1', 't1', input)).rejects.toBeInstanceOf(NotFoundException);
			expect(commandBus.execute).not.toHaveBeenCalled();
		}
	});

	it('refuses an archived conversation, and an empty change before reading anything', async () => {
		const archived = over({ archived: true });
		await expect(archived.service.update(caller, 'm1', 't1', { status: 'done' })).rejects.toBeInstanceOf(BadRequestException);
		const empty = over();
		await expect(empty.service.update(caller, 'm1', 't1', {})).rejects.toBeInstanceOf(BadRequestException);
		expect(empty.repositories['ChatMessage']['findOne']).not.toHaveBeenCalled();
	});
});
