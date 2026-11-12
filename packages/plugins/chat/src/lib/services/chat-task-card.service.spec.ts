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
	// Any other export: a stand-in nothing here calls.
	const anything = function Anything() {
		return undefined;
	};
	return new Proxy(explicit, { get: (target, name) => (name in target ? target[name as string] : anything) });
});

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { IChatTaskUpdateInput, PermissionsEnum } from '@gauzy/contracts';
import { ChatRealtime } from '../realtime/chat-realtime';
import { ChatAccessService, IChatCaller } from './chat-access.service';
import { ChatTaskCardService, taskPatchOf } from './chat-task-card.service';

const caller: IChatCaller = { tenantId: 'ten', organizationId: 'org', userId: 'u1', employeeId: 'e1', canManage: false };

function over(
	options: {
		reference?: boolean;
		task?: boolean;
		taskOrganization?: string;
		employees?: number;
		status?: boolean;
		statusProject?: string;
		archived?: boolean;
		member?: boolean;
	} = {}
) {
	const message = { id: 'm1', conversationId: 'c1', kind: 'message', tenantId: 'ten', organizationId: 'org', deletedAt: null };
	const repositories: Record<string, Record<string, jest.Mock>> = {
		ChatMessage: { findOne: jest.fn(async () => message), find: jest.fn(async () => [message, { ...message, id: 'm2', conversationId: 'c2' }]) },
		ChatTaskReference: {
			findOne: jest.fn(async () => (options.reference === false ? null : { messageId: 'm1', taskId: 't1' })),
			find: jest.fn(async () => [{ messageId: 'm1' }, { messageId: 'm2' }])
		},
		// The stored task is found only by a lookup that keeps to its organization (or to none).
		Task: {
			findOne: jest.fn(async ({ where }: { where: { organizationId?: string } }) => {
				if (options.task === false) return null;
				const task = { id: 't1', organizationId: options.taskOrganization ?? 'org', projectId: 'p1' };
				return !where.organizationId || where.organizationId === task.organizationId ? task : null;
			})
		},
		TaskStatus: {
			findOne: jest.fn(async () => (options.status === false ? null : { id: 's1', name: 'Done', value: 'done', projectId: options.statusProject ?? null })),
			// The statuses of the task's scope: the organization's, its project's own twin, and another project's.
			find: jest.fn(async () => [
				{ id: 's-org', name: 'In Review', value: 'in-review', organizationId: 'org', projectId: null },
				{ id: 's-project', name: 'In Review', value: 'in-review', organizationId: 'org', projectId: 'p1' },
				{ id: 's-other', name: 'Blocked', value: 'blocked', organizationId: 'org', projectId: 'p9' },
				// A team's own status: a name alone never takes it (whose team would it be?).
				{ id: 's-team', name: 'Done', value: 'done', tenantId: 'ten', organizationId: 'org', projectId: null, organizationTeamId: 'team-9' },
				// The platform's default and the tenant's shared record of one name: the tenant's wins.
				{ id: 's-default', name: 'Done', value: 'done', tenantId: null, organizationId: null, projectId: null, organizationTeamId: null },
				{ id: 's-tenant', name: 'Done', value: 'done', tenantId: 'ten', organizationId: null, projectId: null, organizationTeamId: null }
			])
		},
		TaskPriority: {
			findOne: jest.fn(async () => ({ id: 'pr1', name: 'High', value: 'high' })),
			find: jest.fn(async () => [{ id: 'pr-high', name: 'High', value: 'high', organizationId: null, projectId: null }])
		},
		Employee: { find: jest.fn(async () => Array.from({ length: options.employees ?? 2 }, (_, index) => ({ id: `e${index + 1}` }))) }
	};
	const manager = { getRepository: (entity: string | { name?: string }) => repositories[typeof entity === 'string' ? entity : String(entity?.name)] };
	const dataSource = {
		getRepository: manager.getRepository,
		transaction: jest.fn(async (work: (m: typeof manager) => Promise<unknown>) => work(manager))
	} as unknown as DataSource;
	const access = {
		requireMember: jest.fn(async () => ({
			conversation: { id: 'c1', organizationId: 'org', archivedAt: options.archived ? new Date() : undefined },
			member: options.member === false ? null : { id: 'mb1' }
		})),
		members: jest.fn(async (_tenantId: string, conversationId: string) => (conversationId === 'c1' ? [{ userId: 'u1' }, { userId: 'u2' }] : [{ userId: 'u3' }]))
	} as unknown as ChatAccessService;
	const realtime = {
		messageFact: jest.fn((name: string, row: { id: string }, recipients: string[]) => ({ name, id: row.id, recipients })),
		append: jest.fn(async (_manager: unknown, fact: { name: string; id: string; recipients: string[] }) => ({ name: fact.name, data: { messageId: fact.id, to: fact.recipients } }))
	};
	const commandBus = { execute: jest.fn(async (command: { id: string; input: Record<string, unknown> }) => ({ id: command.id, ...command.input })) };
	const service = new ChatTaskCardService(dataSource, access, realtime as unknown as ChatRealtime, commandBus as unknown as CommandBus);
	return { service, commandBus, repositories, realtime };
}

describe('taskPatchOf', () => {
	it('writes only what the card changes, as the task page writes it', () => {
		expect(taskPatchOf({ status: ' In Review ', taskStatusId: 's1' }, null)).toEqual({ status: 'In Review', taskStatusId: 's1' });
		expect(taskPatchOf({ priority: '', taskPriorityId: null }, null)).toEqual({ priority: null, taskPriorityId: null });
		expect(taskPatchOf({}, [])).toEqual({ members: [] });
	});

	it('clears the priority record with the priority, unless the change names the record', () => {
		expect(taskPatchOf({ priority: null }, null)).toEqual({ priority: null, taskPriorityId: null });
		expect(taskPatchOf({ priority: '  ' }, null)).toEqual({ priority: null, taskPriorityId: null });
		expect(taskPatchOf({ priority: 'high' }, null)).toEqual({ priority: 'high' });
		expect(taskPatchOf({ priority: 'high', taskPriorityId: 'p1' }, null)).toEqual({ priority: 'high', taskPriorityId: 'p1' });
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
		const { service, commandBus, realtime } = over();
		const result = await service.update(caller, 'm1', 't1', { status: 'done', taskStatusId: 's1', assigneeEmployeeIds: ['e1', 'e2', 'e1'] });
		expect(commandBus.execute).toHaveBeenCalledTimes(1);
		expect(commandBus.execute.mock.calls[0][0]).toEqual(
			expect.objectContaining({ id: 't1', input: { status: 'done', taskStatusId: 's1', members: [{ id: 'e1' }, { id: 'e2' }] } })
		);
		expect(commandBus.execute.mock.calls[0][0].input).toEqual({ status: 'done', taskStatusId: 's1', members: [{ id: 'e1' }, { id: 'e2' }] });
		expect(result.task).toEqual(expect.objectContaining({ id: 't1', status: 'done' }));
		// Both conversations are told; the answer shows only the caller's own (c2 is not the caller's to learn of).
		expect(realtime.append).toHaveBeenCalledTimes(2);
		expect(result.events).toEqual([{ name: 'chat_message.updated', data: { messageId: 'm1', to: ['u1', 'u2'] } }]);
	});

	it('keeps a status and its record together, as the task page writes them', async () => {
		const run = async (input: IChatTaskUpdateInput) => {
			const { service, commandBus } = over();
			await service.update(caller, 'm1', 't1', input);
			return commandBus.execute.mock.calls[0][0].input;
		};
		// A record named gives its name.
		expect(await run({ taskStatusId: 's1' })).toEqual({ taskStatusId: 's1', status: 'done' });
		expect(await run({ status: 'Finished', taskStatusId: 's1' })).toEqual({ taskStatusId: 's1', status: 'done' });
		// A name alone takes the matching record of the task's project first.
		expect(await run({ status: 'in review' })).toEqual({ status: 'in-review', taskStatusId: 's-project' });
		// A name no record of the scope holds clears the record, so the card never shows the one it had.
		expect(await run({ status: 'Blocked' })).toEqual({ status: 'Blocked', taskStatusId: null });
		expect(await run({ status: 'Someday' })).toEqual({ status: 'Someday', taskStatusId: null });
		// Another team's record of that name is passed over for the shared one: the tenant's before the platform's.
		expect(await run({ status: 'Done' })).toEqual({ status: 'done', taskStatusId: 's-tenant' });
		// A record cleared leaves the name as given.
		expect(await run({ status: 'Someday', taskStatusId: null })).toEqual({ status: 'Someday', taskStatusId: null });
	});

	it('keeps a priority and its record together too', async () => {
		const run = async (input: IChatTaskUpdateInput) => {
			const { service, commandBus } = over();
			await service.update(caller, 'm1', 't1', input);
			return commandBus.execute.mock.calls[0][0].input;
		};
		expect(await run({ priority: 'HIGH' })).toEqual({ priority: 'high', taskPriorityId: 'pr-high' });
		expect(await run({ taskPriorityId: 'pr1' })).toEqual({ taskPriorityId: 'pr1', priority: 'high' });
		expect(await run({ priority: null })).toEqual({ priority: null, taskPriorityId: null });
	});

	it('refuses a channel manager who has not joined the channel, before the task is changed', async () => {
		const { service, commandBus } = over({ member: false });
		await expect(service.update(caller, 'm1', 't1', { status: 'done' })).rejects.toBeInstanceOf(NotFoundException);
		expect(commandBus.execute).not.toHaveBeenCalled();
	});

	it("takes a status or priority of the task's organization, a shared one or a platform default, never another organization's", async () => {
		const { service, repositories } = over();
		await service.update(caller, 'm1', 't1', { taskStatusId: 's1', taskPriorityId: 'p1' });
		for (const entity of ['TaskStatus', 'TaskPriority']) {
			const where = repositories[entity]['findOne'].mock.calls[0][0].where as Array<Record<string, unknown>>;
			expect(where).toHaveLength(3);
			expect(where[0]).toEqual({ id: entity === 'TaskStatus' ? 's1' : 'p1', tenantId: 'ten', organizationId: 'org' });
			expect(where[1]).toEqual(expect.objectContaining({ tenantId: 'ten', organizationId: expect.objectContaining({ _type: 'isNull' }) }));
			expect(where[2]).toEqual(
				expect.objectContaining({ tenantId: expect.objectContaining({ _type: 'isNull' }), organizationId: expect.objectContaining({ _type: 'isNull' }) })
			);
		}
	});

	it('assigns only active, unarchived employees of the organization', async () => {
		const { service, repositories } = over();
		await service.update(caller, 'm1', 't1', { assigneeEmployeeIds: ['e1', 'e2'] });
		expect(repositories['Employee']['find'].mock.calls[0][0].where).toEqual(
			expect.objectContaining({ tenantId: 'ten', organizationId: 'org', isActive: true, isArchived: false })
		);
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
			[{ taskOrganization: 'other' }, { status: 'done' }],
			// A status record of another project of the organization.
			[{ statusProject: 'p9' }, { taskStatusId: 's1' }],
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
