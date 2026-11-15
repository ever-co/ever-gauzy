// Must stay first: loads the entity graph before the service pulls an entity (see activity.controller.spec.ts).
import '../../core/entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { TimeLogController } from './time-log.controller';
import { TimeLogHistoryService } from './time-log-history.service';

/**
 * The history of time entries (ever-co/ever-gauzy#11922) is read under the time scoping: a member reads their own
 * entries' history, people who manage a member or may see everyone's time read theirs, nobody else.
 */
describe('TimeLogHistoryService scoping', () => {
	type Stored = { organizationId?: string } & Record<string, unknown>;
	type Read = { where?: { organizationId?: string } };

	/** What a database answers to a read: the records of the organization it names (`org-1` unless stated), if any. */
	const ofOrganization = (record: Stored, read?: Read) =>
		read?.where?.organizationId === undefined || (record.organizationId ?? 'org-1') === read.where.organizationId;

	function setup(options: { entry?: Stored | null; rows?: Stored[]; manages?: boolean } = {}) {
		const manager = {
			findOne: jest.fn<Promise<unknown>, [unknown, Read?]>(async (_entity, read) => {
				const entry = options.entry ?? null;
				return entry && ofOrganization(entry, read) ? entry : null;
			}),
			find: jest.fn<Promise<unknown[]>, [unknown, Read?]>(async (_entity, read) =>
				(options.rows ?? []).filter((row) => ofOrganization(row, read))
			),
			createQueryBuilder: jest.fn()
		};
		const timeLogService = {
			assertCanReadEmployeeTimeLogs: jest.fn(async (employeeId: string) => {
				if (employeeId !== 'employee-paul') {
					throw new ForbiddenException('You do not have permission to read time logs for this employee');
				}
			})
		};
		const managedEmployeeService = { canManageEmployees: jest.fn(async () => options.manages ?? false) };
		const service = new TimeLogHistoryService(
			{ manager } as never,
			timeLogService as never,
			managedEmployeeService as never
		);
		return { service, manager, timeLogService, managedEmployeeService };
	}

	const signedInAs = (employeeId: string | null, permissions: PermissionsEnum[] = []) => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(employeeId);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ employeeId } as never);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
			permissions.includes(permission)
		);
	};

	afterEach(() => jest.restoreAllMocks());

	const PERIOD = { organizationId: 'org-1', startDate: new Date('2026-11-01'), endDate: new Date('2026-11-30') };

	/** A query builder that keeps each call with its SQL, the conditions in brackets included, and answers no row. */
	function recordingBuilder() {
		const calls: string[] = [];
		const builder: object = new Proxy(
			{},
			{
				get: (_target, name) => {
					if (name === 'then') {
						return undefined;
					}
					if (name === 'getManyAndCount') {
						return async () => [[], 0];
					}
					return (...args: unknown[]) => {
						args.filter((arg) => arg instanceof Brackets).forEach((arg) =>
							arg.whereFactory(builder as never)
						);
						calls.push([String(name), ...args.filter((arg) => typeof arg === 'string')].join(' '));
						return builder;
					};
				}
			}
		);
		return { builder, calls };
	}

	describe('readableEmployeeIds', () => {
		it('lets a caller who may see everyone read every member, or the members named', async () => {
			signedInAs(null, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);
			const { service } = setup();

			expect(await service.readableEmployeeIds(undefined)).toBeUndefined();
			expect(await service.readableEmployeeIds(['employee-marie'])).toEqual(['employee-marie']);
		});

		it("keeps a member to their own entries, even when they name another member's", async () => {
			signedInAs('employee-paul');
			const { service } = setup({ manages: false });

			expect(await service.readableEmployeeIds(undefined)).toEqual(['employee-paul']);
			expect(await service.readableEmployeeIds(['employee-marie'])).toEqual(['employee-paul']);
		});

		it('lets a team manager read the members they manage', async () => {
			signedInAs('employee-manager');
			const { service, managedEmployeeService } = setup({ manages: true });

			expect(await service.readableEmployeeIds(['employee-paul', 'employee-manager'])).toEqual([
				'employee-paul',
				'employee-manager'
			]);
			expect(managedEmployeeService.canManageEmployees).toHaveBeenCalledWith(['employee-paul'], []);
		});

		it('reads nobody for a caller without an employee record who may not see everyone', async () => {
			signedInAs(null);
			const { service } = setup();

			expect(await service.readableEmployeeIds(['employee-paul'])).toEqual([]);
		});
	});

	describe('findEntryHistory', () => {
		it("answers the entry's rows, newest first, to a caller who may read its owner's time", async () => {
			signedInAs('employee-paul');
			const rows = [{ id: 'row-2' }, { id: 'row-1' }];
			const { service, manager, timeLogService } = setup({ entry: { employeeId: 'employee-paul' }, rows });

			expect(await service.findEntryHistory('log-1', 'org-1')).toEqual(rows);
			expect(timeLogService.assertCanReadEmployeeTimeLogs).toHaveBeenCalledWith('employee-paul');
			expect(manager.find.mock.calls[0][1]).toMatchObject({
				where: { entity: 'TimeLog', entityId: 'log-1', tenantId: 'tenant-1', organizationId: 'org-1' },
				order: { createdAt: 'DESC' }
			});
			expect(manager.findOne.mock.calls[0][1]).toMatchObject({
				where: { id: 'log-1', tenantId: 'tenant-1', organizationId: 'org-1' },
				withDeleted: true
			});
		});

		it('refuses the history of another member to a caller who may not read their time', async () => {
			signedInAs('employee-amina');
			const { service } = setup({ entry: { employeeId: 'employee-marie' }, rows: [{ id: 'row-1' }] });

			await expect(service.findEntryHistory('log-1', 'org-1')).rejects.toBeInstanceOf(ForbiddenException);
		});

		it('knows a hard-deleted entry by the owner its rows keep', async () => {
			signedInAs('employee-paul');
			const rows = [{ id: 'row-1', data: { employeeId: 'employee-paul' } }];
			const { service, timeLogService } = setup({ entry: null, rows });

			expect(await service.findEntryHistory('log-1', 'org-1')).toEqual(rows);
			expect(timeLogService.assertCanReadEmployeeTimeLogs).toHaveBeenCalledWith('employee-paul');
		});

		it('answers 404 for an entry the tenant never had', async () => {
			signedInAs('employee-paul');
			const { service } = setup({ entry: null, rows: [] });

			await expect(service.findEntryHistory('log-1', 'org-1')).rejects.toBeInstanceOf(NotFoundException);
		});

		it('answers 404 for an entry of another organization, to a caller who may read its owner', async () => {
			signedInAs('employee-paul');
			const rows = [{ id: 'row-1', organizationId: 'org-2', data: { employeeId: 'employee-paul' } }];
			const { service } = setup({ entry: { employeeId: 'employee-paul', organizationId: 'org-2' }, rows });

			await expect(service.findEntryHistory('log-1', 'org-1')).rejects.toBeInstanceOf(NotFoundException);
		});

		it('is read by the route in the organization its query names', async () => {
			const history = { findEntryHistory: jest.fn(async () => []) };
			const controller = new TimeLogController({} as never, {} as never, {} as never, history as never);

			await controller.getEntryHistory('log-1', { organizationId: 'org-1' } as never);

			expect(history.findEntryHistory).toHaveBeenCalledWith('log-1', 'org-1');
		});
	});

	describe('findPeriodHistory', () => {
		it('answers an empty page, without querying, to a caller who reads nobody', async () => {
			signedInAs(null);
			const { service, manager } = setup();

			const page = await service.findPeriodHistory({
				organizationId: 'org-1',
				startDate: new Date('2026-11-01'),
				endDate: new Date('2026-11-30')
			} as never);

			expect(page).toEqual({ items: [], total: 0 });
			expect(manager.createQueryBuilder).not.toHaveBeenCalled();
		});

		it('orders the rows of one moment by id, so pages neither repeat nor skip a row', async () => {
			signedInAs(null, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);
			const { service, manager } = setup();
			const { builder, calls } = recordingBuilder();
			manager.createQueryBuilder.mockReturnValue(builder);

			await service.findPeriodHistory(PERIOD as never);

			const order = calls.filter((call) => /^(orderBy|addOrderBy) /.test(call));
			expect(order).toEqual(['orderBy history.createdAt DESC', 'addOrderBy history.id DESC']);
		});

		it('keeps the rows of an entry deleted for good, read by the owner they keep', async () => {
			signedInAs('employee-manager');
			const { service, manager } = setup({ manages: true });
			const { builder, calls } = recordingBuilder();
			manager.createQueryBuilder.mockReturnValue(builder);

			await service.findPeriodHistory({ ...PERIOD, employeeIds: ['employee-paul'] } as never);

			const joins = calls.filter((call) => /^(innerJoin|leftJoin) /.test(call)).map((call) => call.split(' ')[0]);
			expect(joins).toEqual(['leftJoin']);
			expect(calls).toEqual(
				expect.arrayContaining([
					expect.stringMatching(/entry.{1,3}id.{0,2} IS NULL/),
					expect.stringMatching(/data.*employeeId.* IN \(:\.\.\.employeeIds\)/)
				])
			);
		});
	});
});
