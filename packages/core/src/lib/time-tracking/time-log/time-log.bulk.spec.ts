/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids: an entity decorator is undefined when the
 * entity applies it if the graph is entered through the validators rather than through the entities.
 */
import '../../core/entities/internal';

import { ExecutionContext, ForbiddenException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { environment as env } from '@gauzy/config';
import { PermissionsEnum, RolesEnum, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { BulkExecutor } from '../../api/bulk-executor.service';
import { readBulkOperation } from '../../api/bulk.decorator';
import { FieldVisibility } from '../../api/field-visibility.service';
import { RequestContext } from '../../core/context';
import { ApiErrorCode } from '../../core/errors/api-error-codes';
import { ApiException } from '../../core/errors/api-exception';
import { IDEMPOTENT_METADATA_KEY } from '../../idempotency/idempotency.policy';
import { OrganizationBelongsToUserConstraint } from '../../shared/validators/constraints/organization-belongs-to-user.constraint';
import { DeleteTimeSpanCommand, IGetConflictTimeLogCommand, TimeLogCreateCommand } from './commands';
import { TimeLogController } from './time-log.controller';
import { TimeLogResolver } from './time-log.resolver';
import { TimeLogService } from './time-log.service';

/**
 * `POST /timesheet/time-log/bulk` and `bulkCreateTimeLogs`: many hand-entered intervals in one request,
 * each recorded exactly as `POST /timesheet/time-log` and `addManualTime` record one.
 *
 * The service under the batch is the real `TimeLogService.addManualTime`, over scripted collaborators,
 * because a manual interval is the create with the most rules a batch could bypass: the organization's
 * manual-time policy (a guard that reads the organization the body names), the employee resolved inside the
 * caller's tenant and refused when the caller may not record time for them, the organization's future-date
 * rule, and the trimming of whatever the interval overlaps. These assertions hold a batch to every one of
 * them, item by item, and to resolving each item's overlaps against the intervals the items before it
 * recorded — which is what recording the same intervals one by one leaves.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const NO_MANUAL_TIME_ORGANIZATION = '00000000-0000-4000-8000-000000000003';
const EMPLOYEE = '00000000-0000-4000-8000-000000000020';
const UNMANAGED_EMPLOYEE = '00000000-0000-4000-8000-000000000021';
const OWN_EMPLOYEE = '00000000-0000-4000-8000-000000000022';
/** An employee of the organization whose policy forbids manual time — reachable by a caller who may choose one. */
const NO_MANUAL_TIME_EMPLOYEE = '00000000-0000-4000-8000-000000000023';
/** What the manual-time create answers for an employee whose organization's policy forbids manual time. */
const MANUAL_TIME_FORBIDDEN = "Manual time is not allowed in the employee's organization";

/** The grants of the caller, as the platform's field visibility reads them. */
function visibilityFor(granted: PermissionsEnum[]): FieldVisibility {
	return {
		canSee: (permission: PermissionsEnum) => granted.includes(permission),
		assertCanSee: (permission: PermissionsEnum) => {
			if (!granted.includes(permission)) {
				throw new ApiException(403, ApiErrorCode.PERMISSION_DENIED, 'Denied.', { permission });
			}
		}
	} as unknown as FieldVisibility;
}

/** One stored interval. */
interface IStoredLog {
	id: string;
	employeeId: string;
	organizationId: string;
	startedAt: Date;
	stoppedAt: Date;
}

/**
 * Both surfaces over the real manual-time service and scripted collaborators: the employees of the tenant,
 * the employees the caller manages, the stored intervals the conflict lookup reads and the create writes,
 * and the organization-policy guard, which admits an organization whose policy allows manual time.
 */
function surfaces(options: { granted?: PermissionsEnum[] } = {}) {
	const logs: IStoredLog[] = [];
	const trimmed: string[] = [];
	const guarded: Array<{ handler: unknown; organizationId: unknown }> = [];

	const allowsManualTime = { futureDateAllowed: false, allowManualTime: true };
	const employees: Record<string, object> = {
		[EMPLOYEE]: { id: EMPLOYEE, organizationId: ORGANIZATION, organization: allowsManualTime },
		[UNMANAGED_EMPLOYEE]: { id: UNMANAGED_EMPLOYEE, organizationId: ORGANIZATION, organization: allowsManualTime },
		[OWN_EMPLOYEE]: { id: OWN_EMPLOYEE, organizationId: ORGANIZATION, organization: allowsManualTime },
		[NO_MANUAL_TIME_EMPLOYEE]: {
			id: NO_MANUAL_TIME_EMPLOYEE,
			organizationId: NO_MANUAL_TIME_ORGANIZATION,
			organization: { futureDateAllowed: false, allowManualTime: false }
		}
	};
	const employeeRepository = {
		findOne: jest.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
			where.tenantId === TENANT ? (employees[where.id] ?? null) : null
		)
	};
	const managedEmployeeService = {
		canManageEmployee: jest.fn(async (employeeId: string) => employeeId !== UNMANAGED_EMPLOYEE)
	};
	const commandBus = {
		execute: jest.fn(async (command: unknown) => {
			if (command instanceof IGetConflictTimeLogCommand) {
				const { employeeId, startDate, endDate } = command.input as {
					employeeId: string;
					startDate: Date;
					endDate: Date;
				};

				return logs
					.filter(
						(log) =>
							log.employeeId === employeeId &&
							log.startedAt < new Date(endDate) &&
							log.stoppedAt > new Date(startDate)
					)
					.map((log) => ({ ...log, timeSlots: [{ id: `${log.id}-slot` }] }));
			}
			if (command instanceof DeleteTimeSpanCommand) {
				// The overlapped log is cut back to where the new interval starts.
				const stored = logs.find((log) => log.id === command.timeLog.id);
				trimmed.push(command.timeLog.id);
				if (stored && stored.stoppedAt > new Date(command.newTime.start)) {
					stored.stoppedAt = new Date(command.newTime.start);
				}

				return undefined;
			}
			if (command instanceof TimeLogCreateCommand) {
				const log = {
					...(command.input as Record<string, any>),
					id: `log-${logs.length + 1}`,
					startedAt: new Date(command.input.startedAt as Date),
					stoppedAt: new Date(command.input.stoppedAt as Date)
				} as IStoredLog;
				logs.push(log);

				return log;
			}

			throw new Error(`Unexpected command ${String(command)}`);
		})
	};
	const service = new TimeLogService(
		{} as never,
		{} as never,
		employeeRepository as never,
		{} as never,
		{} as never,
		commandBus as never,
		managedEmployeeService as never
	);
	// The employee filter is the CRUD base's request-scoped switch, which has no request here.
	jest.spyOn(service as any, 'withoutEmployeeFilter').mockImplementation((callback: () => Promise<unknown>) =>
		callback()
	);

	const guard = {
		canActivate: jest.fn(async (context: ExecutionContext) => {
			const organizationId = context.switchToHttp().getRequest().body?.organizationId;
			guarded.push({ handler: context.getHandler(), organizationId });

			return organizationId !== NO_MANUAL_TIME_ORGANIZATION;
		})
	};

	const executor = new BulkExecutor(visibilityFor(options.granted ?? [PermissionsEnum.ALLOW_MANUAL_TIME]));

	return {
		logs,
		trimmed,
		guarded,
		service,
		controller: new TimeLogController(service, executor, guard as never),
		resolver: new TimeLogResolver(service, commandBus as never, executor, guard as never)
	};
}

/** A manual interval as `POST /timesheet/time-log` takes it: the dates, the employee, the log type and source. */
const interval = (start: string, stop: string, extra: Record<string, unknown> = {}) => ({
	organizationId: ORGANIZATION,
	employeeId: EMPLOYEE,
	startedAt: start,
	stoppedAt: stop,
	logType: TimeLogType.MANUAL,
	source: TimeLogSourceEnum.WEB_TIMER,
	...extra
});

/** Whether the caller may record time for an employee other than its own. */
function callerMayChooseEmployee(may: boolean): void {
	jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
		permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE ? may : false
	);
}

beforeEach(() => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(OWN_EMPLOYEE);
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-1', employeeId: OWN_EMPLOYEE } as never);
	callerMayChooseEmployee(true);
	jest.spyOn(OrganizationBelongsToUserConstraint.prototype, 'checkOrganizationExistence').mockImplementation(
		async (organizationId: string) => [ORGANIZATION, NO_MANUAL_TIME_ORGANIZATION].includes(organizationId)
	);
});

afterEach(() => jest.restoreAllMocks());

describe('POST /timesheet/time-log/bulk — each item is POST /timesheet/time-log', () => {
	it('resolves each item’s overlap against the intervals the items before it recorded, as single calls would', async () => {
		const batch = surfaces();
		const single = surfaces();
		const items = [
			interval('2026-10-01T09:00:00.000Z', '2026-10-01T10:00:00.000Z'),
			interval('2026-10-01T09:30:00.000Z', '2026-10-01T11:00:00.000Z')
		];

		const result = await batch.controller.bulk({ items: items as never });

		for (const item of items) {
			await single.controller.addManualTime({ ...item } as never);
		}

		expect(result).toMatchObject({ total: 2, succeededCount: 2, failedCount: 0 });
		// The second interval found the first, recorded by the same batch, and cut it back to 09:30.
		expect(batch.trimmed).toEqual(['log-1']);
		expect(batch.logs.map((log) => [log.id, log.startedAt.toISOString(), log.stoppedAt.toISOString()])).toEqual([
			['log-1', '2026-10-01T09:00:00.000Z', '2026-10-01T09:30:00.000Z'],
			['log-2', '2026-10-01T09:30:00.000Z', '2026-10-01T11:00:00.000Z']
		]);
		expect(batch.trimmed).toEqual(single.trimmed);
		expect(batch.logs.map((log) => [log.startedAt, log.stoppedAt])).toEqual(
			single.logs.map((log) => [log.startedAt, log.stoppedAt])
		);
		// The route states the log type and the source for itself, as the single route does.
		expect(batch.logs.map((log: any) => [log.logType, log.source])).toEqual([
			[TimeLogType.MANUAL, TimeLogSourceEnum.WEB_TIMER],
			[TimeLogType.MANUAL, TimeLogSourceEnum.WEB_TIMER]
		]);
	});

	it('asks the organization-policy guard about every item, as the single route asks it about its body', async () => {
		const { controller, guarded, logs } = surfaces();

		const result = await controller.bulk({
			items: [
				interval('2026-10-01T09:00:00.000Z', '2026-10-01T10:00:00.000Z'),
				interval('2026-10-02T09:00:00.000Z', '2026-10-02T10:00:00.000Z', {
					organizationId: NO_MANUAL_TIME_ORGANIZATION
				})
			] as never
		});

		expect(guarded).toEqual([
			{ handler: TimeLogController.prototype.addManualTime, organizationId: ORGANIZATION },
			{ handler: TimeLogController.prototype.addManualTime, organizationId: NO_MANUAL_TIME_ORGANIZATION }
		]);
		expect(result.failed).toEqual([
			expect.objectContaining({ index: 1, code: ApiErrorCode.PERMISSION_DENIED, message: 'Forbidden resource' })
		]);
		expect(logs).toHaveLength(1);
	});

	it('refuses an item whose employee belongs to an organization without manual time, whatever organization it names — as the single route does', async () => {
		const { controller, guarded, logs } = surfaces();

		// The policy guard judges the organization the body names and the caller's own, never the employee's, and a
		// caller who may choose the employee reaches every employee of the tenant: this item names a permissive
		// organization, the guard admits it, and the write would land in the employee's organization, whose policy
		// forbids manual time. The service now asks that organization's policy itself.
		const result = await controller.bulk({
			items: [
				interval('2026-10-01T09:00:00.000Z', '2026-10-01T10:00:00.000Z'),
				interval('2026-10-02T09:00:00.000Z', '2026-10-02T10:00:00.000Z', {
					employeeId: NO_MANUAL_TIME_EMPLOYEE
				})
			] as never
		});
		const single = await controller
			.addManualTime(
				interval('2026-10-03T09:00:00.000Z', '2026-10-03T10:00:00.000Z', {
					employeeId: NO_MANUAL_TIME_EMPLOYEE
				}) as never
			)
			.catch((thrown) => thrown);

		expect(guarded.map((entry) => entry.organizationId)).toEqual([ORGANIZATION, ORGANIZATION]);
		expect(result.failed).toEqual([
			expect.objectContaining({ index: 1, code: ApiErrorCode.PERMISSION_DENIED, message: MANUAL_TIME_FORBIDDEN })
		]);
		expect(single).toBeInstanceOf(ForbiddenException);
		expect((single as ForbiddenException).message).toBe(MANUAL_TIME_FORBIDDEN);
		expect(logs.map((log) => log.employeeId)).toEqual([EMPLOYEE]);
	});

	it('CONTROL: records that item for a SUPER_ADMIN only while the installation lets the role bypass the policy, as the guard does', async () => {
		jest.spyOn(RequestContext, 'hasRoles').mockImplementation((roles: RolesEnum[]) =>
			roles.includes(RolesEnum.SUPER_ADMIN)
		);
		const previous = (env as any).allowSuperAdminRole;
		const item = interval('2026-10-02T09:00:00.000Z', '2026-10-02T10:00:00.000Z', {
			employeeId: NO_MANUAL_TIME_EMPLOYEE
		});

		try {
			(env as any).allowSuperAdminRole = true;
			const exempt = surfaces();
			const applied = await exempt.controller.bulk({ items: [item] as never });

			(env as any).allowSuperAdminRole = false;
			const bound = surfaces();
			const refused = await bound.controller
				.bulk({ items: [item, { ...item }] as never })
				.catch((thrown) => thrown);

			expect(applied).toMatchObject({ succeededCount: 1, failedCount: 0 });
			expect(exempt.logs.map((log) => log.employeeId)).toEqual([NO_MANUAL_TIME_EMPLOYEE]);
			expect((refused as ApiException).code).toBe(ApiErrorCode.BULK_ALL_ITEMS_FAILED);
			expect(bound.logs).toEqual([]);
		} finally {
			(env as any).allowSuperAdminRole = previous;
		}
	});

	it('refuses, item by item, the employee the caller may not record for and the date the organization forbids', async () => {
		const { controller, logs } = surfaces();

		const result = await controller.bulk({
			items: [
				interval('2026-10-01T09:00:00.000Z', '2026-10-01T10:00:00.000Z'),
				interval('2026-10-01T11:00:00.000Z', '2026-10-01T12:00:00.000Z', { employeeId: UNMANAGED_EMPLOYEE }),
				interval('2099-01-01T09:00:00.000Z', '2099-01-01T10:00:00.000Z'),
				interval('2026-10-01T13:00:00.000Z', '2026-10-01T12:00:00.000Z')
			] as never
		});

		expect(result.succeeded.map((entry) => entry.index)).toEqual([0]);
		expect(result.failed).toEqual([
			expect.objectContaining({
				index: 1,
				code: ApiErrorCode.PERMISSION_DENIED,
				message: 'You do not have permission to log time for this employee'
			}),
			expect.objectContaining({
				index: 2,
				code: ApiErrorCode.VALIDATION_FAILED,
				message: 'Please select valid Date, start time and end time'
			}),
			expect.objectContaining({
				index: 3,
				code: ApiErrorCode.VALIDATION_FAILED,
				details: { messages: ['Started date must be before stopped date'] }
			})
		]);
		expect(logs).toHaveLength(1);
	});

	it('records an item for the caller’s own employee when the caller may not choose one, as the route’s pipe does', async () => {
		callerMayChooseEmployee(false);
		const { controller, logs } = surfaces();

		await controller.bulk({
			items: [
				interval('2026-10-01T09:00:00.000Z', '2026-10-01T10:00:00.000Z', { employeeId: undefined })
			] as never
		});

		expect(logs.map((log) => log.employeeId)).toEqual([OWN_EMPLOYEE]);
	});

	it('refuses an atomic batch before writing anything — not even the policy guard is asked', async () => {
		const { controller, logs, guarded } = surfaces();

		const refusal = await controller
			.bulk({
				atomic: true,
				items: [
					interval('2026-10-01T09:00:00.000Z', '2026-10-01T10:00:00.000Z'),
					interval('2026-10-01T11:00:00.000Z', '2026-10-01T12:00:00.000Z')
				] as never
			})
			.catch((thrown) => thrown);

		// Each item is the manual-time create, which writes through its own repositories (and trims what it
		// overlaps): no transaction could roll the batch back as one, so the route refuses the flag.
		expect((refusal as ApiException).getStatus()).toBe(400);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.BULK_ATOMIC_UNSUPPORTED);
		expect((refusal as ApiException).details).toEqual({ field: 'atomic', resource: 'time_log' });
		expect(guarded).toEqual([]);
		expect(logs).toEqual([]);
	});

	it('refuses a batch above its cap, and a caller without the manual-time grant, before recording anything', async () => {
		const capped = surfaces();
		const denied = surfaces({ granted: [PermissionsEnum.TIME_TRACKER] });
		const one = interval('2026-10-01T09:00:00.000Z', '2026-10-01T10:00:00.000Z');

		const tooMany = await capped.controller
			.bulk({ items: Array.from({ length: 201 }, () => one) as never })
			.catch((thrown) => thrown);
		const refused = await denied.controller.bulk({ items: [one] as never }).catch((thrown) => thrown);

		expect((tooMany as ApiException).code).toBe(ApiErrorCode.BULK_LIMIT_EXCEEDED);
		expect((refused as ApiException).code).toBe(ApiErrorCode.PERMISSION_DENIED);
		expect(capped.logs).toEqual([]);
		expect(denied.logs).toEqual([]);
	});
});

describe('bulkCreateTimeLogs — the same batch over GraphQL, each item `addManualTime`', () => {
	it('records each item as `addManualTime` does: the caller’s own employee unless it may choose one', async () => {
		callerMayChooseEmployee(false);
		const { resolver, logs } = surfaces();

		const payload = await resolver.bulkCreateTimeLogs({
			items: [
				{
					organizationId: ORGANIZATION,
					employeeId: EMPLOYEE,
					startedAt: new Date('2026-10-01T09:00:00.000Z'),
					stoppedAt: new Date('2026-10-01T10:00:00.000Z')
				}
			]
		});

		expect(payload).toMatchObject({ succeeded: 1, failed: 0, total: 1 });
		expect(logs.map((log: any) => [log.employeeId, log.logType, log.source])).toEqual([
			[OWN_EMPLOYEE, TimeLogType.MANUAL, TimeLogSourceEnum.WEB_TIMER]
		]);
	});

	it('refuses an atomic batch before writing anything, exactly as the route does', async () => {
		const { resolver, logs } = surfaces();

		const refusal = await resolver
			.bulkCreateTimeLogs({
				atomic: true,
				items: [
					{
						organizationId: ORGANIZATION,
						employeeId: EMPLOYEE,
						startedAt: new Date('2026-10-01T09:00:00.000Z'),
						stoppedAt: new Date('2026-10-01T10:00:00.000Z')
					}
				]
			})
			.catch((thrown) => thrown);

		expect((refusal as ApiException).getStatus()).toBe(400);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.BULK_ATOMIC_UNSUPPORTED);
		expect(logs).toEqual([]);
	});

	it('asks the organization-policy guard about every item, as the route does: an item naming an organization without manual time is refused alone', async () => {
		const { resolver, guarded, logs } = surfaces();
		const item = (organizationId: string, day: string) => ({
			organizationId,
			employeeId: EMPLOYEE,
			startedAt: new Date(`2026-10-${day}T09:00:00.000Z`),
			stoppedAt: new Date(`2026-10-${day}T10:00:00.000Z`)
		});

		// The field's own guard reads no organization out of `input.items`: the batch's body names none. Each item
		// has to be put to the guard as the single route's body, or the policy of the organization it names is
		// never asked — and a caller allowed manual time in one organization records it in another.
		const payload = await resolver.bulkCreateTimeLogs({
			items: [item(ORGANIZATION, '01'), item(NO_MANUAL_TIME_ORGANIZATION, '02'), item(ORGANIZATION, '03')]
		});

		expect(guarded).toEqual([
			{ handler: TimeLogController.prototype.addManualTime, organizationId: ORGANIZATION },
			{ handler: TimeLogController.prototype.addManualTime, organizationId: NO_MANUAL_TIME_ORGANIZATION },
			{ handler: TimeLogController.prototype.addManualTime, organizationId: ORGANIZATION }
		]);
		expect(payload).toMatchObject({ total: 3, succeeded: 2, failed: 1 });
		expect(payload.results.map((result) => [result.index, result.ok, result.error?.code])).toEqual([
			[0, true, undefined],
			[1, false, ApiErrorCode.PERMISSION_DENIED],
			[2, true, undefined]
		]);
		expect(payload.results[1].error).toMatchObject({ message: 'Forbidden resource', path: ['items', '1'] });
		expect(logs.map((log) => log.startedAt.toISOString())).toEqual([
			'2026-10-01T09:00:00.000Z',
			'2026-10-03T09:00:00.000Z'
		]);
	});

	it('refuses an item whose employee belongs to an organization without manual time, even when it names no organization', async () => {
		const { resolver, logs } = surfaces();
		const at = (day: string) => ({
			startedAt: new Date(`2026-10-${day}T09:00:00.000Z`),
			stoppedAt: new Date(`2026-10-${day}T10:00:00.000Z`)
		});

		// No organization in the item: the guard falls back to the caller's own and admits it; a permissive one: the
		// guard admits it too. Either way the log would be the employee's organization's, whose policy is off.
		const payload = await resolver.bulkCreateTimeLogs({
			items: [
				{ organizationId: ORGANIZATION, employeeId: EMPLOYEE, ...at('01') },
				{ employeeId: NO_MANUAL_TIME_EMPLOYEE, ...at('02') },
				{ organizationId: ORGANIZATION, employeeId: NO_MANUAL_TIME_EMPLOYEE, ...at('03') }
			] as never
		});
		const single = await resolver
			.addManualTime({ employeeId: NO_MANUAL_TIME_EMPLOYEE, ...at('04') } as never)
			.catch((thrown) => thrown);

		expect(
			payload.results.map((result) => [result.index, result.ok, result.error?.code, result.error?.message])
		).toEqual([
			[0, true, undefined, undefined],
			[1, false, ApiErrorCode.PERMISSION_DENIED, MANUAL_TIME_FORBIDDEN],
			[2, false, ApiErrorCode.PERMISSION_DENIED, MANUAL_TIME_FORBIDDEN]
		]);
		expect(single).toBeInstanceOf(ForbiddenException);
		expect(logs.map((log) => log.employeeId)).toEqual([EMPLOYEE]);
	});
});

describe('the declarations both surfaces run the batch from', () => {
	it('declares the batch as a POST on its own path, under the single route’s guard and grant', () => {
		expect(Reflect.getMetadata(PATH_METADATA, TimeLogController.prototype.bulk)).toBe('/bulk');
		expect(Reflect.getMetadata(METHOD_METADATA, TimeLogController.prototype.bulk)).toBe(RequestMethod.POST);
		expect(readBulkOperation(TimeLogController.prototype, 'bulk')).toEqual({
			resource: 'time_log',
			maxItems: 200,
			permission: PermissionsEnum.ALLOW_MANUAL_TIME,
			atomic: false
		});
		for (const [route, field] of [
			[TimeLogController.prototype.bulk, TimeLogResolver.prototype.bulkCreateTimeLogs],
			[TimeLogController.prototype.addManualTime, TimeLogResolver.prototype.addManualTime]
		]) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, route)).toEqual([PermissionsEnum.ALLOW_MANUAL_TIME]);
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, field)).toEqual([PermissionsEnum.ALLOW_MANUAL_TIME]);
		}
		expect(Reflect.getMetadata('__guards__', TimeLogController.prototype.bulk)).toEqual(
			Reflect.getMetadata('__guards__', TimeLogController.prototype.addManualTime)
		);
		expect(Reflect.getMetadata('__guards__', TimeLogResolver.prototype.bulkCreateTimeLogs)).toEqual(
			Reflect.getMetadata('__guards__', TimeLogResolver.prototype.addManualTime)
		);
	});

	it('declares one retry scope on both surfaces, honoured and not demanded', () => {
		const route = Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, TimeLogController.prototype.bulk);

		expect(route).toEqual({ scope: 'time_log.bulk', required: false, resourceType: 'time_log' });
		expect(Reflect.getMetadata(IDEMPOTENT_METADATA_KEY, TimeLogResolver.prototype.bulkCreateTimeLogs)).toEqual(
			route
		);
	});
});
