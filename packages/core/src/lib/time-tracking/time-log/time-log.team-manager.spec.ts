/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../../core/entities/internal';

import { AsyncLocalStorage } from 'async_hooks';
import { HttpException } from '@nestjs/common';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { PermissionsEnum, RolesEnum, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { singleRouteBody } from '../../api/bulk-create';
import { BulkExecutor } from '../../api/bulk-executor.service';
import { FieldVisibility } from '../../api/field-visibility.service';
import { RequestContext } from '../../core/context';
import { CrudService } from '../../core/crud/crud.service';
import { ApiErrorCode } from '../../core/errors/api-error-codes';
import { ApiException } from '../../core/errors/api-exception';
import { MultiORMEnum } from '../../core/utils';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { OrganizationBelongsToUserConstraint } from '../../shared/validators/constraints/organization-belongs-to-user.constraint';
import { IGetConflictTimeLogCommand, TimeLogCreateCommand, TimeLogUpdateCommand } from './commands';
import { TimeLogController } from './time-log.controller';
import { TimeLogResolver } from './time-log.resolver';
import { TimeLogService } from './time-log.service';

/**
 * Whose time a manual-time write records, over REST and over GraphQL — Q15, Greptile P1 on #10637.
 *
 * `POST /timesheet/time-log` and `PUT /timesheet/time-log/:id` keep the employee a body names
 * (`TimeLogBodyTransformPipe` fills only a missing one with the caller's own) and leave the decision to
 * `TimeLogService`, which refuses an employee the caller is not, does not manage in a team of the
 * employee's organization, and may not choose (`CHANGE_SELECTED_EMPLOYEE`). The GraphQL twins replaced a
 * named employee with the caller's own whenever the caller lacked `CHANGE_SELECTED_EMPLOYEE` — the rule the
 * pipe had before team managers could write a member's time — so a team manager's `addManualTime` for a
 * member recorded the hours against the MANAGER, and `updateManualTime` of a member's log failed.
 *
 * These cases run the real controller (with the route's own body pipes), the real resolver, the real
 * `TimeLogService` and the real `ManagedEmployeeService` against a real SQLite database holding the tenant's
 * organization, employees, teams and time logs; only the create / update / overlap commands are scripted,
 * and they write and read the same database.
 */

const TENANT = 'b1500000-0000-4000-8000-00000000000a';
const ORGANIZATION = 'b1500000-0000-4000-8000-0000000000a1';
/** The team the manager manages: the manager, a member and a plain employee. */
const MANAGED_TEAM = 'b1500000-0000-4000-8000-0000000000d1';
/** A team the manager only belongs to, without managing it. */
const OTHER_TEAM = 'b1500000-0000-4000-8000-0000000000d2';

const MANAGER = 'b1500000-0000-4000-8000-0000000000e1';
const MEMBER = 'b1500000-0000-4000-8000-0000000000e2';
const PLAIN = 'b1500000-0000-4000-8000-0000000000e3';
/** A member of the team the manager does not manage. */
const OUTSIDER = 'b1500000-0000-4000-8000-0000000000e4';

const MEMBER_LOG = 'b1500000-0000-4000-8000-0000000000f1';
const PLAIN_LOG = 'b1500000-0000-4000-8000-0000000000f2';

/** What the service answers for an employee the caller may not write time for. */
const NOT_YOURS = 'You do not have permission to log time for this employee';

/** An instant of the test month, UTC — in the past, as the organization allows no future dates. */
const at = (day: string, time: string) => new Date(`2026-09-${day}T${time}:00.000Z`);

const TenantSchema = new EntitySchema<any>({
	name: 'Tenant',
	tableName: 'tenant',
	columns: { id: { primary: true, type: 'varchar' } }
});

const OrganizationSchema = new EntitySchema<any>({
	name: 'Organization',
	tableName: 'organization',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		allowManualTime: { type: 'boolean', default: false },
		futureDateAllowed: { type: 'boolean', default: false }
	}
});

const EmployeeSchema = new EntitySchema<any>({
	name: 'Employee',
	tableName: 'employee',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true }
	},
	relations: {
		organization: { type: 'many-to-one', target: 'Organization', joinColumn: { name: 'organizationId' } }
	}
});

const OrganizationTeamSchema = new EntitySchema<any>({
	name: 'OrganizationTeam',
	tableName: 'organization_team',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true }
	}
});

/** The membership columns `ManagedEmployeeService` reads, with the team relation it scopes the organization through. */
const OrganizationTeamEmployeeSchema = new EntitySchema<any>({
	name: 'OrganizationTeamEmployee',
	tableName: 'organization_team_employee',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		organizationTeamId: { type: 'varchar' },
		employeeId: { type: 'varchar' },
		isManager: { type: 'boolean', default: false },
		isActive: { type: 'boolean', nullable: true, default: true },
		isArchived: { type: 'boolean', nullable: true, default: false }
	},
	relations: {
		organizationTeam: {
			type: 'many-to-one',
			target: 'OrganizationTeam',
			joinColumn: { name: 'organizationTeamId' }
		}
	}
});

/**
 * The time log, with the two scope relations `TenantAwareCrudService` names beside their columns
 * (`tenant` with `tenantId`, `employee` with `employeeId`) when it reads a log back, and
 * the slots the service loads before it moves a log to another employee.
 */
const TimeLogSchema = new EntitySchema<any>({
	name: 'TimeLog',
	tableName: 'time_log',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		employeeId: { type: 'varchar', nullable: true },
		startedAt: { type: 'datetime' },
		stoppedAt: { type: 'datetime' },
		logType: { type: 'varchar', nullable: true },
		source: { type: 'varchar', nullable: true },
		description: { type: 'varchar', nullable: true },
		reason: { type: 'varchar', nullable: true },
		editedAt: { type: 'datetime', nullable: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	},
	relations: {
		tenant: { type: 'many-to-one', target: 'Tenant', joinColumn: { name: 'tenantId' } },
		employee: { type: 'many-to-one', target: 'Employee', joinColumn: { name: 'employeeId' } },
		timeSlots: {
			type: 'many-to-many',
			target: 'TimeSlot',
			inverseSide: 'timeLogs',
			joinTable: {
				name: 'time_slot_time_logs',
				joinColumn: { name: 'timeLogId' },
				inverseJoinColumn: { name: 'timeSlotId' }
			}
		}
	}
});

/**
 * A slot, with what `assertMovableToAnotherEmployee` reads to tell tracked work from a blank manual slot:
 * its keyboard and mouse counts, and the screenshots, activities and per-minute records it holds.
 */
const TimeSlotSchema = new EntitySchema<any>({
	name: 'TimeSlot',
	tableName: 'time_slot',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		keyboard: { type: 'integer', default: 0 },
		mouse: { type: 'integer', default: 0 }
	},
	relations: {
		timeLogs: { type: 'many-to-many', target: 'TimeLog', inverseSide: 'timeSlots' },
		screenshots: { type: 'one-to-many', target: 'Screenshot', inverseSide: 'timeSlot' },
		activities: { type: 'one-to-many', target: 'Activity', inverseSide: 'timeSlot' },
		timeSlotMinutes: { type: 'one-to-many', target: 'TimeSlotMinute', inverseSide: 'timeSlot' }
	}
});

/** Something captured in a slot while its employee was tracked, by the slot it belongs to. */
const capturedInSlot = (name: string, tableName: string) =>
	new EntitySchema<any>({
		name,
		tableName,
		columns: {
			id: { primary: true, type: 'varchar', generated: 'uuid' },
			timeSlotId: { type: 'varchar', nullable: true }
		},
		relations: { timeSlot: { type: 'many-to-one', target: 'TimeSlot', joinColumn: { name: 'timeSlotId' } } }
	});

/** A signed-in caller: an employee of the organization, with the role's permissions. */
interface ICaller {
	id: string;
	employeeId: string | null;
	permissions: PermissionsEnum[];
}

/** What every employee of the organization holds to record and edit their own time. */
const TIME_WRITER = [
	PermissionsEnum.TIME_TRACKER,
	PermissionsEnum.ALLOW_MANUAL_TIME,
	PermissionsEnum.ALLOW_MODIFY_TIME
];

/** Manages `MANAGED_TEAM`, holds no CHANGE_SELECTED_EMPLOYEE. */
const TEAM_MANAGER: ICaller = { id: 'user-manager', employeeId: MANAGER, permissions: TIME_WRITER };
/** A member of `MANAGED_TEAM` who manages nobody. */
const PLAIN_EMPLOYEE: ICaller = { id: 'user-plain', employeeId: PLAIN, permissions: TIME_WRITER };
/** May choose any employee of the tenant. */
const ADMIN: ICaller = {
	id: 'user-admin',
	employeeId: null,
	permissions: [...TIME_WRITER, PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]
};

/** The grants of the caller, as the platform's field visibility reads them (the batch executor's check). */
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

/** One in-memory database with the organization, its people, its teams and two stored logs. */
interface IWorld {
	dataSource: DataSource;
	logs: Repository<any>;
	controller: TimeLogController;
	resolver: TimeLogResolver;
}

async function world(): Promise<IWorld> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [
			TenantSchema,
			OrganizationSchema,
			EmployeeSchema,
			OrganizationTeamSchema,
			OrganizationTeamEmployeeSchema,
			TimeLogSchema,
			TimeSlotSchema,
			capturedInSlot('Screenshot', 'screenshot'),
			capturedInSlot('Activity', 'activity'),
			capturedInSlot('TimeSlotMinute', 'time_slot_minute')
		],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();

	await dataSource.getRepository('Tenant').save([{ id: TENANT }]);
	await dataSource
		.getRepository('Organization')
		.save([{ id: ORGANIZATION, tenantId: TENANT, allowManualTime: true, futureDateAllowed: false }]);
	await dataSource
		.getRepository('Employee')
		.save([MANAGER, MEMBER, PLAIN, OUTSIDER].map((id) => ({ id, tenantId: TENANT, organizationId: ORGANIZATION })));
	await dataSource.getRepository('OrganizationTeam').save([
		{ id: MANAGED_TEAM, tenantId: TENANT, organizationId: ORGANIZATION },
		{ id: OTHER_TEAM, tenantId: TENANT, organizationId: ORGANIZATION }
	]);
	const membership = (organizationTeamId: string, employeeId: string, isManager = false) => ({
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		organizationTeamId,
		employeeId,
		isManager
	});
	await dataSource
		.getRepository('OrganizationTeamEmployee')
		.save([
			membership(MANAGED_TEAM, MANAGER, true),
			membership(MANAGED_TEAM, MEMBER),
			membership(MANAGED_TEAM, PLAIN),
			membership(OTHER_TEAM, MANAGER),
			membership(OTHER_TEAM, OUTSIDER)
		]);

	const logs = dataSource.getRepository('TimeLog');
	const stored = (id: string, employeeId: string, day: string, from: string, to: string) => ({
		id,
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		employeeId,
		startedAt: at(day, from),
		stoppedAt: at(day, to),
		logType: 'MANUAL',
		source: 'BROWSER'
	});
	await logs.save([
		stored(MEMBER_LOG, MEMBER, '01', '09:00', '10:00'),
		stored(PLAIN_LOG, PLAIN, '01', '11:00', '12:00')
	]);

	// The three commands the manual-time writes dispatch, over the same table: the overlap lookup reads it
	// as `GetConflictTimeLogHandler` filters it (tenant, organization, employee, the interval, not the edited
	// log itself), the create inserts the row the service hands it, the update writes the members it changes.
	const commandBus: any = {
		execute: async (command: unknown) => {
			if (command instanceof IGetConflictTimeLogCommand) {
				const { tenantId, organizationId, employeeId, startDate, endDate, ignoreId } = command.input as any;
				const rows = await logs.find({ where: { tenantId, organizationId, employeeId } });

				return rows
					.filter(
						(row) =>
							row.id !== ignoreId &&
							new Date(row.startedAt) < new Date(endDate) &&
							new Date(row.stoppedAt) > new Date(startDate)
					)
					.map((row) => ({ ...row, timeSlots: [] }));
			}
			if (command instanceof TimeLogCreateCommand) {
				const input = command.input as any;

				return await logs.save({
					tenantId: RequestContext.currentTenantId(),
					organizationId: input.organizationId,
					employeeId: input.employeeId,
					startedAt: new Date(input.startedAt),
					stoppedAt: new Date(input.stoppedAt),
					logType: input.logType,
					source: input.source,
					description: input.description ?? null
				});
			}
			if (command instanceof TimeLogUpdateCommand) {
				const input = command.input as any;
				const id = typeof command.id === 'string' ? command.id : (command.id as any).id;
				await logs.update(id, {
					employeeId: input.employeeId,
					startedAt: new Date(input.startedAt),
					stoppedAt: new Date(input.stoppedAt),
					editedAt: input.editedAt ?? null
				});

				return await logs.findOneBy({ id });
			}

			throw new Error(`unexpected command ${(command as object)?.constructor?.name}`);
		}
	};

	const managedEmployees = new ManagedEmployeeService(
		dataSource.getRepository('OrganizationTeamEmployee') as any,
		{} as any
	);
	const service = new TimeLogService(
		logs as any,
		{} as any,
		dataSource.getRepository('Employee') as any,
		{} as any,
		{} as any,
		commandBus,
		managedEmployees
	);
	// The per-item organization-policy question of both batches: this organization allows manual time.
	const guard: any = { canActivate: async () => true };
	const executor = new BulkExecutor(visibilityFor(TIME_WRITER));

	return {
		dataSource,
		logs,
		controller: new TimeLogController(service, executor, guard),
		resolver: new TimeLogResolver(service, commandBus, executor, guard)
	};
}

/** A body as both surfaces take it: the organization, the employee (when named) and the two instants. */
const body = (employeeId: string | undefined, day: string, from: string, to: string) => ({
	organizationId: ORGANIZATION,
	...(employeeId ? { employeeId } : {}),
	startedAt: at(day, from),
	stoppedAt: at(day, to)
});

type Body = ReturnType<typeof body>;

/** One entry point: how a manual-time create, an update and a batch reach the service through it. */
interface ISurface {
	name: 'REST' | 'GraphQL';
	add(target: IWorld, input: Body): Promise<unknown>;
	update(target: IWorld, id: string, input: Body): Promise<unknown>;
	bulk(
		target: IWorld,
		items: Body[]
	): Promise<Array<{ index: number; ok: boolean; code?: string; message?: string }>>;
}

/**
 * A body as the web client sends it to the routes (`EditTimeLogModalComponent`): the GraphQL body plus the log
 * type and the source. `CreateManualTimeLogDTO` requires both — its transforms restate a value that was sent and
 * never supply a missing one — so a create without them is a 400 before the service is reached.
 */
const restBody = (input: Body) => ({ ...input, logType: TimeLogType.MANUAL, source: TimeLogSourceEnum.WEB_TIMER });

/** The routes, each with the body pipes the route declares (`TimeLogBodyTransformPipe`, then validation). */
const REST: ISurface = {
	name: 'REST',
	add: async (target, input) =>
		target.controller.addManualTime(
			await singleRouteBody<any>(TimeLogController, 'addManualTime')(restBody(input))
		),
	update: async (target, id, input) =>
		target.controller.updateManualTime(
			id,
			await singleRouteBody<any>(TimeLogController, 'updateManualTime')(restBody(input))
		),
	bulk: async (target, items) => {
		const result = await target.controller.bulk({ items: items.map(restBody) as never });

		return [
			...result.succeeded.map((entry) => ({ index: entry.index, ok: true })),
			...result.failed.map((entry) => ({
				index: entry.index,
				ok: false,
				code: entry.code,
				message: entry.message
			}))
		].sort((a, b) => a.index - b.index);
	}
};

/** The fields, as the GraphQL layer calls them with the input it parsed. */
const GRAPHQL: ISurface = {
	name: 'GraphQL',
	add: (target, input) => target.resolver.addManualTime({ ...input } as never),
	update: (target, id, input) => target.resolver.updateManualTime({ id, ...input } as never),
	bulk: async (target, items) => {
		const payload = await target.resolver.bulkCreateTimeLogs({
			items: items.map((item) => ({ ...item })) as never
		});

		return payload.results.map((result) => ({
			index: result.index,
			ok: result.ok,
			...(result.ok ? {} : { code: result.error?.code, message: result.error?.message })
		}));
	}
};

/** How a write ended: the employee of the row it answered, or the status and message of the refusal. */
async function outcomeOf(
	write: () => Promise<unknown>
): Promise<{ employeeId?: string; results?: unknown[]; status?: number; message?: string }> {
	try {
		const answer = await write();

		// A batch answers one outcome per item; a single write answers the row it wrote.
		return Array.isArray(answer)
			? { results: answer }
			: { employeeId: (answer as { employeeId?: string })?.employeeId };
	} catch (error) {
		if (error instanceof HttpException) {
			return { status: error.getStatus(), message: error.message };
		}
		throw error;
	}
}

/** Every stored log, as `id → employee day from-to`. */
async function storedLogs(target: IWorld): Promise<string[]> {
	const rows = await target.logs.find({ order: { startedAt: 'ASC' } });
	const clock = (value: Date | string) => new Date(value).toISOString().slice(8, 16).replace('T', ' ');

	return rows.map(
		(row) =>
			`${row.id === MEMBER_LOG ? 'MEMBER_LOG' : row.id === PLAIN_LOG ? 'PLAIN_LOG' : 'new'} ${nameOf(row.employeeId)} ${clock(row.startedAt)}-${clock(row.stoppedAt).slice(3)}`
	);
}

const nameOf = (employeeId: string | undefined | null) =>
	({ [MANAGER]: 'MANAGER', [MEMBER]: 'MEMBER', [PLAIN]: 'PLAIN', [OUTSIDER]: 'OUTSIDER' })[employeeId ?? ''] ??
	String(employeeId);

describe('Manual time — whose time a write records, over REST and GraphQL, on a real database', () => {
	// Stand-in for the per-request store the service's own-employee filter switch keeps its state in.
	const requestStorage = new AsyncLocalStorage<Map<string, unknown>>();
	const originalClsService = RequestContext['clsService'];
	const worlds: IWorld[] = [];

	/** A fresh database, closed after the case. */
	const fresh = async () => {
		const created = await world();
		worlds.push(created);
		return created;
	};

	/** Runs the rest of the case as this signed-in user, inside one request. */
	const as = <R>(caller: ICaller, callback: () => Promise<R>): Promise<R> => {
		const user = {
			id: caller.id,
			tenantId: TENANT,
			employeeId: caller.employeeId,
			permissions: caller.permissions,
			role: { name: RolesEnum.EMPLOYEE },
			// The organization of the caller's token, which `JwtStrategy` attaches after checking the membership.
			lastOrganizationId: ORGANIZATION
		};
		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({ _req: { user } } as any);

		return requestStorage.run(new Map(), callback);
	};

	beforeEach(() => {
		RequestContext['clsService'] = {
			get: (key: string) => requestStorage.getStore()?.get(key),
			set: (key: string, value: unknown) => requestStorage.getStore()?.set(key, value)
		} as any;
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		// The DTO's organization-membership check: the caller belongs to the organization.
		jest.spyOn(OrganizationBelongsToUserConstraint.prototype, 'checkOrganizationExistence').mockImplementation(
			async (organizationId: string) => organizationId === ORGANIZATION
		);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		RequestContext['clsService'] = originalClsService;
		for (const created of worlds.splice(0)) {
			if (created.dataSource.isInitialized) await created.dataSource.destroy();
		}
	});

	describe.each([GRAPHQL, REST])('a team manager without CHANGE_SELECTED_EMPLOYEE, over $name', (surface) => {
		it('records manual time for a member of the team they manage against the MEMBER', async () => {
			const target = await fresh();

			const outcome = await as(TEAM_MANAGER, () =>
				outcomeOf(() => surface.add(target, body(MEMBER, '02', '09:00', '10:00')))
			);

			expect(outcome).toEqual({ employeeId: MEMBER });
			expect(await storedLogs(target)).toEqual([
				'MEMBER_LOG MEMBER 01 09:00-10:00',
				'PLAIN_LOG PLAIN 01 11:00-12:00',
				'new MEMBER 02 09:00-10:00'
			]);
		});

		it("edits that member's manual log, which stays the member's", async () => {
			const target = await fresh();

			const outcome = await as(TEAM_MANAGER, () =>
				outcomeOf(() => surface.update(target, MEMBER_LOG, body(MEMBER, '01', '09:00', '10:30')))
			);

			expect(outcome).toEqual({ employeeId: MEMBER });
			expect(await storedLogs(target)).toEqual([
				'MEMBER_LOG MEMBER 01 09:00-10:30',
				'PLAIN_LOG PLAIN 01 11:00-12:00'
			]);
		});

		it('is refused (403) for a colleague of a team they belong to without managing it, and nothing is recorded', async () => {
			const target = await fresh();

			const outcome = await as(TEAM_MANAGER, () =>
				outcomeOf(() => surface.add(target, body(OUTSIDER, '03', '09:00', '10:00')))
			);

			expect(outcome).toEqual({ status: 403, message: NOT_YOURS });
			expect(await storedLogs(target)).toHaveLength(2);
		});

		it('records a batch item by item: the member’s for the member, the outsider’s refused, an unnamed one for the manager', async () => {
			const target = await fresh();

			const results = await as(TEAM_MANAGER, () =>
				surface.bulk(target, [
					body(MEMBER, '04', '09:00', '10:00'),
					body(OUTSIDER, '04', '11:00', '12:00'),
					body(undefined, '04', '13:00', '14:00')
				])
			);

			expect(results).toEqual([
				{ index: 0, ok: true },
				{ index: 1, ok: false, code: ApiErrorCode.PERMISSION_DENIED, message: NOT_YOURS },
				{ index: 2, ok: true }
			]);
			expect(await storedLogs(target)).toEqual([
				'MEMBER_LOG MEMBER 01 09:00-10:00',
				'PLAIN_LOG PLAIN 01 11:00-12:00',
				'new MEMBER 04 09:00-10:00',
				'new MANAGER 04 13:00-14:00'
			]);
		});
	});

	describe.each([GRAPHQL, REST])('a plain employee, over $name', (surface) => {
		it('naming a colleague they do not manage is refused with the 403 REST answers — never re-pointed to themselves', async () => {
			const target = await fresh();

			const outcome = await as(PLAIN_EMPLOYEE, () =>
				outcomeOf(() => surface.add(target, body(MEMBER, '05', '09:00', '10:00')))
			);

			expect(outcome).toEqual({ status: 403, message: NOT_YOURS });
			expect(await storedLogs(target)).toEqual([
				'MEMBER_LOG MEMBER 01 09:00-10:00',
				'PLAIN_LOG PLAIN 01 11:00-12:00'
			]);
		});

		it('an edit of their own log naming a colleague is refused, and the log is left as it was', async () => {
			const target = await fresh();

			const outcome = await as(PLAIN_EMPLOYEE, () =>
				outcomeOf(() => surface.update(target, PLAIN_LOG, body(MEMBER, '01', '11:00', '12:30')))
			);

			expect(outcome).toEqual({ status: 403, message: NOT_YOURS });
			expect(await storedLogs(target)).toEqual([
				'MEMBER_LOG MEMBER 01 09:00-10:00',
				'PLAIN_LOG PLAIN 01 11:00-12:00'
			]);
		});

		it("an edit of a colleague's log is refused, and the log is left as it was", async () => {
			const target = await fresh();

			const outcome = await as(PLAIN_EMPLOYEE, () =>
				outcomeOf(() => surface.update(target, MEMBER_LOG, body(MEMBER, '01', '09:00', '10:30')))
			);

			expect(outcome).toEqual({ status: 403, message: NOT_YOURS });
			expect(await storedLogs(target)).toEqual([
				'MEMBER_LOG MEMBER 01 09:00-10:00',
				'PLAIN_LOG PLAIN 01 11:00-12:00'
			]);
		});
	});

	/*
	 * Over the wire GraphQL never delivers an unnamed body — `employeeId` is `ID!` on both inputs — so for that
	 * surface these cases (and the unnamed batch item) pin the resolver's own fallback, which restates the pipe.
	 */
	describe.each([GRAPHQL, REST])('no employee named, over $name', (surface) => {
		it.each([
			['the team manager', TEAM_MANAGER, 'MANAGER'],
			['a plain employee', PLAIN_EMPLOYEE, 'PLAIN']
		])("records %s's time against their own employee", async (_label, caller, own) => {
			const target = await fresh();

			const outcome = await as(caller, () =>
				outcomeOf(() => surface.add(target, body(undefined, '06', '09:00', '10:00')))
			);

			expect(nameOf(outcome.employeeId)).toBe(own);
		});
	});

	describe.each([GRAPHQL, REST])('CONTROL: a caller with CHANGE_SELECTED_EMPLOYEE, over $name', (surface) => {
		it('records time for the employee it names, and moves a log to another employee of the organization', async () => {
			const target = await fresh();

			const added = await as(ADMIN, () =>
				outcomeOf(() => surface.add(target, body(OUTSIDER, '07', '09:00', '10:00')))
			);
			// MEMBER_LOG is the member's: naming OUTSIDER re-points it (its slots carry nothing tracked).
			const moved = await as(ADMIN, () =>
				outcomeOf(() => surface.update(target, MEMBER_LOG, body(OUTSIDER, '01', '09:00', '10:15')))
			);

			expect(added).toEqual({ employeeId: OUTSIDER });
			expect(moved).toEqual({ employeeId: OUTSIDER });
			expect(await storedLogs(target)).toEqual([
				'MEMBER_LOG OUTSIDER 01 09:00-10:15',
				'PLAIN_LOG PLAIN 01 11:00-12:00',
				'new OUTSIDER 07 09:00-10:00'
			]);
		});
	});

	/**
	 * The same request through both entry points ends the same way: the same row for the same employee, or the
	 * same refusal with the same status and message, and the same database afterwards.
	 */
	describe('one rule, two protocols: every case ends the same over REST and GraphQL', () => {
		type Case = [string, ICaller, (surface: ISurface, target: IWorld) => Promise<unknown>];
		const cases: Case[] = [
			[
				'a team manager records a member’s time',
				TEAM_MANAGER,
				(s, t) => s.add(t, body(MEMBER, '02', '09:00', '10:00'))
			],
			[
				'a team manager edits a member’s log',
				TEAM_MANAGER,
				(s, t) => s.update(t, MEMBER_LOG, body(MEMBER, '01', '09:00', '10:30'))
			],
			[
				'a team manager names a colleague of a team they do not manage',
				TEAM_MANAGER,
				(s, t) => s.add(t, body(OUTSIDER, '03', '09:00', '10:00'))
			],
			[
				'a team manager records their own time, unnamed',
				TEAM_MANAGER,
				(s, t) => s.add(t, body(undefined, '03', '11:00', '12:00'))
			],
			[
				'a plain employee names a colleague',
				PLAIN_EMPLOYEE,
				(s, t) => s.add(t, body(MEMBER, '05', '09:00', '10:00'))
			],
			[
				'a plain employee edits their own log naming a colleague',
				PLAIN_EMPLOYEE,
				(s, t) => s.update(t, PLAIN_LOG, body(MEMBER, '01', '11:00', '12:30'))
			],
			[
				'a plain employee edits a colleague’s log',
				PLAIN_EMPLOYEE,
				(s, t) => s.update(t, MEMBER_LOG, body(MEMBER, '01', '09:00', '10:30'))
			],
			[
				'a plain employee edits their own log',
				PLAIN_EMPLOYEE,
				(s, t) => s.update(t, PLAIN_LOG, body(PLAIN, '01', '11:00', '12:30'))
			],
			[
				'a plain employee records their own time, named',
				PLAIN_EMPLOYEE,
				(s, t) => s.add(t, body(PLAIN, '05', '11:00', '12:00'))
			],
			[
				'a CHANGE_SELECTED_EMPLOYEE caller names anyone',
				ADMIN,
				(s, t) => s.add(t, body(OUTSIDER, '07', '09:00', '10:00'))
			],
			[
				'a CHANGE_SELECTED_EMPLOYEE caller moves a member’s log to another employee',
				ADMIN,
				(s, t) => s.update(t, MEMBER_LOG, body(OUTSIDER, '01', '09:00', '10:15'))
			],
			[
				'a team manager’s batch',
				TEAM_MANAGER,
				(s, t) =>
					s.bulk(t, [
						body(MEMBER, '04', '09:00', '10:00'),
						body(OUTSIDER, '04', '11:00', '12:00'),
						body(undefined, '04', '13:00', '14:00')
					])
			]
		];

		it.each(cases)('%s', async (_label, caller, write) => {
			const viaRest = await fresh();
			const viaGraphql = await fresh();

			const rest = await as(caller, () => outcomeOf(() => write(REST, viaRest)));
			const graphql = await as(caller, () => outcomeOf(() => write(GRAPHQL, viaGraphql)));

			expect(graphql).toEqual(rest);
			expect(await storedLogs(viaGraphql)).toEqual(await storedLogs(viaRest));
		});
	});
});
