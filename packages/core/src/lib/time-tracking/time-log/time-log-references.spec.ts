import '../../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import * as graph from '../../core/crud/nested-graph-ownership.helper';
import { RequestContext } from '../../core/context';
import { TimeLogCreateCommand } from './commands/time-log-create.command';
import { TimeLogUpdateCommand } from './commands/time-log-update.command';
import { TimeLogCreateHandler } from './commands/handlers/time-log-create.handler';
import { TimeLogUpdateHandler } from './commands/handlers/time-log-update.handler';
import { assertTimeLogReferencesOfTenant } from './time-log-references';

/**
 * The timer and the manual-time routes take a log's project, task, client and team from the body, and the time-log
 * handlers wrote them through the repository, past the cross-tenant check of the base service: a caller could file
 * time against another tenant's task or client and read that row back through their own log.
 */
describe('time-log references', () => {
	const TENANT = 'tenant-a';
	const repository = { manager: { name: 'manager' }, metadata: { name: 'TimeLog', relations: [] } } as any;

	let check: jest.SpyInstance;

	beforeEach(() => {
		check = jest.spyOn(graph, 'assertGraphNotForeign').mockResolvedValue(undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('assertTimeLogReferencesOfTenant', () => {
		it('holds only the project, task, client and team ids to the tenant', async () => {
			await assertTimeLogReferencesOfTenant(
				repository,
				{
					taskId: 'task-b',
					projectId: null,
					organizationContactId: 'contact-b',
					description: 'not a reference',
					employeeId: 'employee-a'
				} as any,
				TENANT
			);

			expect(check).toHaveBeenCalledWith(
				repository.manager,
				repository.metadata,
				[{ taskId: 'task-b', projectId: null, organizationContactId: 'contact-b' }],
				TENANT
			);
		});
	});

	describe('TimeLogCreateHandler', () => {
		it('refuses a foreign reference before anything is written', async () => {
			check.mockRejectedValue(new ForbiddenException());
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
			const commandBus = { execute: jest.fn() };
			const save = jest.fn();
			const handler: TimeLogCreateHandler = Object.create(TimeLogCreateHandler.prototype);
			Object.assign(handler, {
				_commandBus: commandBus,
				typeOrmTimeLogRepository: { ...repository, save }
			});

			await expect(
				handler.execute(
					new TimeLogCreateCommand({
						employeeId: 'employee-a',
						organizationId: 'org-a',
						startedAt: new Date(),
						taskId: 'task-of-tenant-b'
					} as any)
				)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(check.mock.calls[0][2]).toEqual([{ taskId: 'task-of-tenant-b' }]);
			expect(check.mock.calls[0][3]).toBe(TENANT);
			expect(commandBus.execute).not.toHaveBeenCalled();
			expect(save).not.toHaveBeenCalled();
		});
	});

	describe('TimeLogUpdateHandler', () => {
		it('holds the changes to the stored log’s tenant, and writes nothing when refused', async () => {
			check.mockRejectedValue(new ForbiddenException());
			const update = jest.fn();
			const handler: TimeLogUpdateHandler = Object.create(TimeLogUpdateHandler.prototype);
			Object.assign(handler, {
				logger: { debug: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() },
				commandBus: { execute: jest.fn() },
				typeOrmTimeLogRepository: { ...repository, update }
			});
			jest.spyOn(handler as any, 'getTimeLogByIdOrInstance').mockResolvedValue({
				id: 'log-1',
				tenantId: TENANT,
				organizationId: 'org-a',
				employeeId: 'employee-a'
			});

			await expect(
				handler.execute(
					new TimeLogUpdateCommand(
						{ organizationContactId: 'contact-of-tenant-b', tenantId: 'tenant-b' } as any,
						'log-1'
					)
				)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(check.mock.calls[0][2]).toEqual([{ organizationContactId: 'contact-of-tenant-b' }]);
			expect(check.mock.calls[0][3]).toBe(TENANT);
			expect(update).not.toHaveBeenCalled();
		});
	});
});
