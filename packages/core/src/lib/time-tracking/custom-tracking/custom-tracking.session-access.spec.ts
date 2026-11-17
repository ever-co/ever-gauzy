/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — see the note in
 * `custom-tracking.service.spec.ts`.
 */
import '../../core/entities/internal';
import { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { FindOperator } from 'typeorm';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { TypeOrmOrganizationProjectEmployeeRepository } from '../../organization-project/repository/type-orm-organization-project-employee.repository';
import { TypeOrmOrganizationTeamEmployeeRepository } from '../../organization-team-employee/repository/type-orm-organization-team-employee.repository';
import { EmployeeTrackedDataGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { MikroOrmTimeSlotRepository } from '../time-slot/repository/mikro-orm-time-slot.repository';
import { TypeOrmTimeSlotRepository } from '../time-slot/repository/type-orm-time-slot.repository';
import { MikroOrmTimeSlotSessionRepository } from '../time-slot-session/repository/mikro-orm-time-slot-session.repository';
import { TypeOrmTimeSlotSessionRepository } from '../time-slot-session/repository/type-orm-time-slot-session.repository';
import { CustomTrackingController } from './custom-tracking.controller';
import { CustomTrackingResolver } from './custom-tracking.resolver';
import { CustomTrackingService } from './custom-tracking.service';

const TENANT_ID = '6a1f0c2e-3b4d-4e5f-8a6b-7c8d9e0f1a41';
const ORGANIZATION_ID = '1b2c3d4e-5f60-4718-9a2b-3c4d5e6f7a42';
const OTHER_ORGANIZATION_ID = '2c3d4e5f-6071-4829-8b3c-4d5e6f7a8b43';
const TEAM_ID = '3d4e5f60-7182-4930-9c4d-5e6f7a8b9c44';
const PROJECT_ID = '4e5f6071-8293-4a41-8d5e-6f7a8b9c0d45';
const CREATED_TEAM_ID = 'a4b5c6d7-e8f9-4a07-9b3c-2f3a4b5c6d46';

const OWN_EMPLOYEE_ID = '5f607182-93a4-4b52-9e6f-7a8b9c0d1e47';
const COLLEAGUE_EMPLOYEE_ID = '60718293-a4b5-4c63-8f70-8b9c0d1e2f48';
const MANAGER_EMPLOYEE_ID = '718293a4-b5c6-4d74-9081-9c0d1e2f3a49';
const PROJECT_MANAGER_EMPLOYEE_ID = '8293a4b5-c6d7-4e85-8192-0d1e2f3a4b50';
const TEAM_CREATOR_EMPLOYEE_ID = '93a4b5c6-d7e8-4f96-8a2b-1e2f3a4b5c51';

/** Session identifiers are chosen by the tracker that reports them, so two employees can report the same one. */
const OWN_SESSION = 'own-session';
const COLLEAGUE_SESSION = 'colleague-session';
const SHARED_SESSION = 'shared-session';
const MISSING_SESSION = 'missing-session';

const NOW = Date.now();
const minutesAgo = (minutes: number) => new Date(NOW - minutes * 60 * 1000);

/** The payload a session carries, named after its employee so a response shows whose data it holds. */
const payloadOf = (employeeId: string) => `payload-of-${employeeId}`;

/** A time-slot session as the repository answers it, with the slot whose custom activity holds the tracking session. */
const row = (
	id: string,
	sessionId: string,
	employeeId: string,
	organizationId: string = ORGANIZATION_ID,
	lastActivity: Date = minutesAgo(5)
) => ({
	id,
	sessionId,
	employeeId,
	organizationId,
	tenantId: TENANT_ID,
	createdAt: minutesAgo(10),
	lastActivity,
	timeSlot: {
		id: `slot-of-${id}`,
		startedAt: minutesAgo(10),
		duration: 600,
		customActivity: {
			trackingSessions: [
				{
					sessionId,
					startTime: minutesAgo(10),
					lastActivity,
					createdAt: minutesAgo(10),
					updatedAt: lastActivity,
					payloads: [{ timestamp: minutesAgo(6), encodedData: payloadOf(employeeId) }]
				}
			]
		},
		timeLogs: [{ id: `log-of-${id}`, employeeId }]
	}
});

const ROWS = [
	row('row-own', OWN_SESSION, OWN_EMPLOYEE_ID),
	row('row-colleague', COLLEAGUE_SESSION, COLLEAGUE_EMPLOYEE_ID),
	row('row-shared-own', SHARED_SESSION, OWN_EMPLOYEE_ID),
	row('row-shared-colleague', SHARED_SESSION, COLLEAGUE_EMPLOYEE_ID),
	row('row-colleague-elsewhere', COLLEAGUE_SESSION, COLLEAGUE_EMPLOYEE_ID, OTHER_ORGANIZATION_ID),
	// Reported two hours ago: in the identifier route's default day, outside the active route's half hour.
	row('row-colleague-idle', 'colleague-idle-session', COLLEAGUE_EMPLOYEE_ID, ORGANIZATION_ID, minutesAgo(120))
];

/**
 * Team and project memberships, as in `custom-tracking.time-slot-access.spec.ts`. The manager and the project manager
 * hold the `isManager` flag, which an admin hands on; the team creator made a team of their own with the colleague in
 * it, and holds its MANAGER role without the flag, as `OrganizationTeamService.create` leaves an employee who creates
 * a team. Which predicates the reads apply (active, organization) is asserted in
 * `managed-employee.service.manages-in-organization.spec.ts`.
 */
const TEAM_MEMBERS = [
	{
		employeeId: MANAGER_EMPLOYEE_ID,
		organizationTeamId: TEAM_ID,
		isManager: true,
		role: { name: RolesEnum.MANAGER }
	},
	{ employeeId: COLLEAGUE_EMPLOYEE_ID, organizationTeamId: TEAM_ID, isManager: false, role: null },
	{ employeeId: OWN_EMPLOYEE_ID, organizationTeamId: TEAM_ID, isManager: false, role: null },
	{
		employeeId: TEAM_CREATOR_EMPLOYEE_ID,
		organizationTeamId: CREATED_TEAM_ID,
		isManager: false,
		role: { name: RolesEnum.MANAGER }
	},
	{ employeeId: COLLEAGUE_EMPLOYEE_ID, organizationTeamId: CREATED_TEAM_ID, isManager: false, role: null }
];
const PROJECT_MEMBERS = [
	{ employeeId: PROJECT_MANAGER_EMPLOYEE_ID, organizationProjectId: PROJECT_ID, isManager: true },
	{ employeeId: COLLEAGUE_EMPLOYEE_ID, organizationProjectId: PROJECT_ID, isManager: false }
];

/** Whether a stored value satisfies a find condition: a plain value, or a `Between` / `In` operator. */
const satisfies = (condition: unknown, actual: any): boolean => {
	if (condition instanceof FindOperator) {
		const operand = condition.value as any;
		switch (condition.type) {
			case 'between':
				return actual >= operand[0] && actual <= operand[1];
			case 'in':
				return operand.includes(actual);
			default:
				throw new Error(`The spec's repository does not read a '${condition.type}' condition`);
		}
	}
	return actual === condition;
};

/** The values of an `In(...)` operator, or the plain value. */
const valuesOf = (operand: any): unknown[] => (Array.isArray(operand?.value) ? operand.value : [operand]);

/**
 * Callers as the JWT strategy leaves them on the request: `employeeId` and `lastOrganizationId` are the validated
 * claims, and there is no `employee` (the user entity has no such relation). The permissions are those of the default
 * EMPLOYEE and ADMIN roles that reach these routes (`default-role-permissions.ts`).
 */
const EMPLOYEE_PERMISSIONS = [PermissionsEnum.TIME_TRACKER, PermissionsEnum.ORG_MEMBERS_VIEW];
const ADMIN_PERMISSIONS = [
	PermissionsEnum.TIME_TRACKER,
	PermissionsEnum.ALL_ORG_VIEW,
	PermissionsEnum.ALL_ORG_EDIT,
	PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
];

type SignedInCaller = { user: Record<string, unknown>; permissions: PermissionsEnum[] };
/** `user: null` is a call outside any request: a plugin or job that states the tenant and organization itself. */
type Caller = SignedInCaller | { user: null; permissions: PermissionsEnum[] };

const asEmployee = (employeeId: string): SignedInCaller => ({
	user: { id: `user-of-${employeeId}`, tenantId: TENANT_ID, employeeId, lastOrganizationId: ORGANIZATION_ID },
	permissions: EMPLOYEE_PERMISSIONS
});
const ADMIN: SignedInCaller = {
	user: { id: 'admin-user', tenantId: TENANT_ID, employeeId: null, lastOrganizationId: ORGANIZATION_ID },
	permissions: ADMIN_PERMISSIONS
};

/** Whose sessions a response holds: the employee of each session's time entries. */
const employeesIn = (body: any[]): string[] =>
	body.flatMap((session) => session.timeLogs.map((log: { employeeId: string }) => log.employeeId)).sort();

/**
 * `GET /timesheet/custom-tracking/session/:sessionId` and `GET /timesheet/custom-tracking/active` read the organization
 * from `currentUser().employee`, which the request's user never carries, so both answered 400 to every real request.
 * Behind that, neither had an employee scope: the identifier route answered every employee's sessions that carry the
 * identifier, and the active route took any `employeeId` from the query (and every employee's, when a caller without
 * an employee record named none). `EmployeeTrackedDataGuard` judges an organization setting and no employee. Fixing the
 * organization alone would have opened a colleague's sessions and payloads to any TIME_TRACKER holder.
 *
 * Both routes now read the organization the JWT strategy validated and answer the caller's own sessions, those of the
 * members of a team or project they manage (by the `isManager` flag), and every session of the organization to a caller
 * who may act for every employee. A session the caller may not read is left out, exactly as one that does not exist.
 */
describe('GET /timesheet/custom-tracking/session/:sessionId and /active — whose sessions a caller may read', () => {
	let app: INestApplication;
	let service: CustomTrackingService;
	let caller: Caller;

	const allow = { canActivate: () => true };

	beforeAll(async () => {
		const timeSlotSessionRepository = {
			find: jest.fn(async ({ where }) =>
				ROWS.filter((candidate) =>
					Object.entries(where).every(([column, condition]) => satisfies(condition, candidate[column]))
				)
			)
		};
		const teamEmployeeRepository = {
			find: jest.fn(async ({ where }) =>
				TEAM_MEMBERS.filter(
					(member) =>
						member.employeeId === where.employeeId &&
						(where.isManager === undefined || member.isManager === where.isManager)
				)
			),
			existsBy: jest.fn(async (where) =>
				TEAM_MEMBERS.some(
					(member) =>
						member.employeeId === where.employeeId &&
						valuesOf(where.organizationTeamId).includes(member.organizationTeamId)
				)
			)
		};
		const projectEmployeeRepository = {
			find: jest.fn(async ({ where }) =>
				PROJECT_MEMBERS.filter(
					(member) => member.employeeId === where.employeeId && member.isManager === where.isManager
				)
			),
			existsBy: jest.fn(async (where) =>
				PROJECT_MEMBERS.some(
					(member) =>
						member.employeeId === where.employeeId &&
						valuesOf(where.organizationProjectId).includes(member.organizationProjectId)
				)
			)
		};

		const moduleRef = await Test.createTestingModule({
			controllers: [CustomTrackingController],
			providers: [
				CustomTrackingService,
				ManagedEmployeeService,
				{ provide: TypeOrmTimeSlotRepository, useValue: {} },
				{ provide: MikroOrmTimeSlotRepository, useValue: {} },
				{ provide: TypeOrmTimeSlotSessionRepository, useValue: timeSlotSessionRepository },
				{ provide: MikroOrmTimeSlotSessionRepository, useValue: {} },
				{ provide: TypeOrmOrganizationTeamEmployeeRepository, useValue: teamEmployeeRepository },
				{ provide: TypeOrmOrganizationProjectEmployeeRepository, useValue: projectEmployeeRepository },
				{ provide: CommandBus, useValue: {} }
			]
		})
			// The routes' permission and organization-setting guards have their own suite
			// (`employee-tracked-data-routes.spec.ts`); this one is about the employee whose sessions are read.
			.overrideGuard(TenantPermissionGuard)
			.useValue(allow)
			.overrideGuard(PermissionGuard)
			.useValue(allow)
			.overrideGuard(EmployeeTrackedDataGuard)
			.useValue(allow)
			.compile();

		app = moduleRef.createNestApplication();
		app.setGlobalPrefix('api');
		await app.init();
		service = moduleRef.get(CustomTrackingService);
	});

	afterAll(() => app?.close());

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentUser').mockImplementation(() => caller.user as any);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) =>
			caller.permissions.includes(permission)
		);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('GET /timesheet/custom-tracking/session/:sessionId', () => {
		const read = (sessionId: string) =>
			request(app.getHttpServer()).get(`/api/timesheet/custom-tracking/session/${sessionId}`);

		it('answers an employee their own session, with its payloads and time entries', async () => {
			caller = asEmployee(OWN_EMPLOYEE_ID);

			const response = await read(OWN_SESSION).expect(200);

			expect(response.body).toHaveLength(1);
			expect(response.body[0]).toMatchObject({
				sessionId: OWN_SESSION,
				timeLogs: [{ id: 'log-of-row-own', employeeId: OWN_EMPLOYEE_ID }],
				session: { sessionId: OWN_SESSION, payloads: [{ encodedData: payloadOf(OWN_EMPLOYEE_ID) }] },
				timeSlots: [{ timeSlotId: 'slot-of-row-own' }]
			});
		});

		it("answers an employee a colleague's session exactly as an identifier that does not exist (an empty list)", async () => {
			caller = asEmployee(OWN_EMPLOYEE_ID);

			const refused = await read(COLLEAGUE_SESSION).expect(200);
			const missing = await read(MISSING_SESSION).expect(200);

			expect(refused.body).toEqual([]);
			expect(refused.body).toEqual(missing.body);
		});

		it('answers an employee only their own sessions of an identifier a colleague reported too', async () => {
			caller = asEmployee(OWN_EMPLOYEE_ID);

			const response = await read(SHARED_SESSION).expect(200);

			expect(employeesIn(response.body)).toEqual([OWN_EMPLOYEE_ID]);
			expect(JSON.stringify(response.body)).not.toContain(payloadOf(COLLEAGUE_EMPLOYEE_ID));
		});

		it("answers a team manager (the `isManager` flag an admin handed on) a member's session", async () => {
			caller = asEmployee(MANAGER_EMPLOYEE_ID);

			const response = await read(COLLEAGUE_SESSION).expect(200);

			// The colleague's session in another organization stays out: the organization scope is unchanged.
			expect(employeesIn(response.body)).toEqual([COLLEAGUE_EMPLOYEE_ID]);
			expect(response.body[0].timeSlots).toEqual([
				expect.objectContaining({ timeSlotId: 'slot-of-row-colleague' })
			]);
		});

		it('answers nothing to an employee who made a team of their own with the colleague in it (MANAGER role, no flag)', async () => {
			// An employee may create a team, pick its members and get its MANAGER role; that must not open their sessions.
			caller = asEmployee(TEAM_CREATOR_EMPLOYEE_ID);

			const response = await read(COLLEAGUE_SESSION).expect(200);

			expect(response.body).toEqual([]);
		});

		it("answers a project manager a member's session, and nothing of someone outside their projects", async () => {
			caller = asEmployee(PROJECT_MANAGER_EMPLOYEE_ID);

			expect(employeesIn((await read(COLLEAGUE_SESSION).expect(200)).body)).toEqual([COLLEAGUE_EMPLOYEE_ID]);
			expect((await read(OWN_SESSION).expect(200)).body).toEqual([]);
			expect(employeesIn((await read(SHARED_SESSION).expect(200)).body)).toEqual([COLLEAGUE_EMPLOYEE_ID]);
		});

		it('answers an admin (CHANGE_SELECTED_EMPLOYEE) every session of the identifier in the organization', async () => {
			caller = ADMIN;

			expect(employeesIn((await read(SHARED_SESSION).expect(200)).body)).toEqual(
				[OWN_EMPLOYEE_ID, COLLEAGUE_EMPLOYEE_ID].sort()
			);
			// Not the colleague's session of the same identifier in another organization.
			const response = await read(COLLEAGUE_SESSION).expect(200);
			expect(response.body).toHaveLength(1);
			expect(response.body[0].timeSlots[0].timeSlotId).toBe('slot-of-row-colleague');
		});

		it('answers nothing to a caller who may not act for other employees and has no employee record', async () => {
			// As the time-slot reads decide it: tracked data is personal (GHSA-6qvm-3wg4-26w4), ALL_ORG_VIEW or not.
			for (const permissions of [
				[PermissionsEnum.TIME_TRACKER],
				[PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ALL_ORG_EDIT]
			]) {
				caller = { user: { ...ADMIN.user }, permissions };

				expect((await read(SHARED_SESSION).expect(200)).body).toEqual([]);
			}
		});

		it('keeps the organization of a user that carries `employee`, and scopes it the same way', async () => {
			const { lastOrganizationId, ...user } = asEmployee(OWN_EMPLOYEE_ID).user;
			caller = {
				user: { ...user, employee: { id: OWN_EMPLOYEE_ID, organizationId: lastOrganizationId } },
				permissions: EMPLOYEE_PERMISSIONS
			};

			expect(employeesIn((await read(SHARED_SESSION).expect(200)).body)).toEqual([OWN_EMPLOYEE_ID]);
		});

		it('still answers 400 when the caller has no organization at all', async () => {
			caller = {
				user: { id: 'no-organization', tenantId: TENANT_ID, employeeId: OWN_EMPLOYEE_ID },
				permissions: []
			};

			await read(OWN_SESSION).expect(400);
		});
	});

	/**
	 * The route's `UUIDValidationPipe` answers 404 to a request that names no employee, so over REST the id is always
	 * there; the GraphQL field may leave it out, and is read in the next block.
	 */
	describe('GET /timesheet/custom-tracking/active', () => {
		const read = (employeeId: string) =>
			request(app.getHttpServer()).get('/api/timesheet/custom-tracking/active').query({ employeeId });

		it('answers an employee their own active sessions when they name themselves', async () => {
			caller = asEmployee(OWN_EMPLOYEE_ID);

			expect(employeesIn((await read(OWN_EMPLOYEE_ID).expect(200)).body)).toEqual([
				OWN_EMPLOYEE_ID,
				OWN_EMPLOYEE_ID
			]);
		});

		it('answers an employee who names a colleague an empty list, as for a colleague who is not tracking', async () => {
			caller = asEmployee(OWN_EMPLOYEE_ID);

			const response = await read(COLLEAGUE_EMPLOYEE_ID).expect(200);

			expect(response.body).toEqual([]);
		});

		it("answers a team manager (the `isManager` flag) a member's active sessions", async () => {
			caller = asEmployee(MANAGER_EMPLOYEE_ID);

			const response = await read(COLLEAGUE_EMPLOYEE_ID).expect(200);

			// Active ones only, and only in the organization the caller works in.
			expect(response.body.map((session) => session.sessionId).sort()).toEqual([
				COLLEAGUE_SESSION,
				SHARED_SESSION
			]);
			expect(employeesIn(response.body)).toEqual([COLLEAGUE_EMPLOYEE_ID, COLLEAGUE_EMPLOYEE_ID]);
		});

		it('answers an empty list to an employee who made a team of their own with the colleague in it (MANAGER role, no flag)', async () => {
			caller = asEmployee(TEAM_CREATOR_EMPLOYEE_ID);

			expect((await read(COLLEAGUE_EMPLOYEE_ID).expect(200)).body).toEqual([]);
		});

		it("answers a project manager a member's active sessions, and nothing of someone outside their projects", async () => {
			caller = asEmployee(PROJECT_MANAGER_EMPLOYEE_ID);

			expect(employeesIn((await read(COLLEAGUE_EMPLOYEE_ID).expect(200)).body)).toEqual([
				COLLEAGUE_EMPLOYEE_ID,
				COLLEAGUE_EMPLOYEE_ID
			]);
			expect((await read(OWN_EMPLOYEE_ID).expect(200)).body).toEqual([]);
		});

		it("answers an admin (CHANGE_SELECTED_EMPLOYEE) any employee's active sessions in the organization", async () => {
			caller = ADMIN;

			expect(employeesIn((await read(COLLEAGUE_EMPLOYEE_ID).expect(200)).body)).toEqual([
				COLLEAGUE_EMPLOYEE_ID,
				COLLEAGUE_EMPLOYEE_ID
			]);
			expect(employeesIn((await read(OWN_EMPLOYEE_ID).expect(200)).body)).toEqual([
				OWN_EMPLOYEE_ID,
				OWN_EMPLOYEE_ID
			]);
		});

		it('answers nothing to a caller who may not act for other employees and has no employee record', async () => {
			for (const permissions of [
				[PermissionsEnum.TIME_TRACKER],
				[PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ALL_ORG_EDIT]
			]) {
				caller = { user: { ...ADMIN.user }, permissions };

				expect((await read(COLLEAGUE_EMPLOYEE_ID).expect(200)).body).toEqual([]);
			}
		});

		it('keeps the organization of a user that carries `employee`, and scopes it the same way', async () => {
			const { lastOrganizationId, ...user } = asEmployee(OWN_EMPLOYEE_ID).user;
			caller = {
				user: { ...user, employee: { id: OWN_EMPLOYEE_ID, organizationId: lastOrganizationId } },
				permissions: EMPLOYEE_PERMISSIONS
			};

			expect(employeesIn((await read(OWN_EMPLOYEE_ID).expect(200)).body)).toEqual([
				OWN_EMPLOYEE_ID,
				OWN_EMPLOYEE_ID
			]);
			expect((await read(COLLEAGUE_EMPLOYEE_ID).expect(200)).body).toEqual([]);
		});

		it('still answers 400 when the caller has no organization at all', async () => {
			caller = {
				user: { id: 'no-organization', tenantId: TENANT_ID, employeeId: OWN_EMPLOYEE_ID },
				permissions: []
			};

			await read(OWN_EMPLOYEE_ID).expect(400);
		});
	});

	describe('GraphQL `trackingSessionsBySessionId` and `activeTrackingSessions` (the same service methods)', () => {
		let resolver: CustomTrackingResolver;

		beforeAll(() => {
			resolver = new CustomTrackingResolver(service);
		});

		it("answers an employee who names no employee their own active sessions, and not a colleague's", async () => {
			caller = asEmployee(OWN_EMPLOYEE_ID);

			const sessions = await resolver.activeTrackingSessions();

			expect(sessions.map((session) => session.sessionId).sort()).toEqual([OWN_SESSION, SHARED_SESSION]);
			expect(employeesIn(sessions)).toEqual([OWN_EMPLOYEE_ID, OWN_EMPLOYEE_ID]);
		});

		it("answers an admin who names no employee every employee's active sessions in the organization", async () => {
			caller = ADMIN;

			expect(employeesIn(await resolver.activeTrackingSessions())).toEqual(
				[OWN_EMPLOYEE_ID, OWN_EMPLOYEE_ID, COLLEAGUE_EMPLOYEE_ID, COLLEAGUE_EMPLOYEE_ID].sort()
			);
		});

		it('answers nothing to a caller without an employee record who names no employee', async () => {
			// Naming no employee used to drop the employee predicate and read every employee's sessions.
			for (const permissions of [
				[PermissionsEnum.TIME_TRACKER],
				[PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ALL_ORG_EDIT]
			]) {
				caller = { user: { ...ADMIN.user }, permissions };

				await expect(resolver.activeTrackingSessions()).resolves.toEqual([]);
			}
		});

		it('scopes both fields as the routes do', async () => {
			caller = asEmployee(OWN_EMPLOYEE_ID);
			expect(employeesIn(await resolver.trackingSessionsBySessionId(SHARED_SESSION))).toEqual([OWN_EMPLOYEE_ID]);
			await expect(resolver.activeTrackingSessions(COLLEAGUE_EMPLOYEE_ID)).resolves.toEqual([]);

			caller = asEmployee(TEAM_CREATOR_EMPLOYEE_ID);
			await expect(resolver.trackingSessionsBySessionId(COLLEAGUE_SESSION)).resolves.toEqual([]);
			await expect(resolver.activeTrackingSessions(COLLEAGUE_EMPLOYEE_ID)).resolves.toEqual([]);

			caller = asEmployee(MANAGER_EMPLOYEE_ID);
			expect(employeesIn(await resolver.trackingSessionsBySessionId(COLLEAGUE_SESSION))).toEqual([
				COLLEAGUE_EMPLOYEE_ID
			]);
			expect(employeesIn(await resolver.activeTrackingSessions(COLLEAGUE_EMPLOYEE_ID))).toEqual([
				COLLEAGUE_EMPLOYEE_ID,
				COLLEAGUE_EMPLOYEE_ID
			]);
		});
	});

	it('leaves a call with no request user (a plugin or job that states the tenant and organization) scoped by its caller, as before', async () => {
		// `CustomTrackingService` is exported from `@gauzy/core`, and both methods take the tenant and the organization
		// for such callers. Every REST and GraphQL request has a user (the global `AuthGuard`), so this is never a request.
		caller = { user: null, permissions: [] };

		expect(employeesIn(await service.getSessionsBySessionId(SHARED_SESSION, TENANT_ID, ORGANIZATION_ID))).toEqual(
			[OWN_EMPLOYEE_ID, COLLEAGUE_EMPLOYEE_ID].sort()
		);
		expect(
			employeesIn(await service.getActiveSessions(COLLEAGUE_EMPLOYEE_ID, 30, TENANT_ID, ORGANIZATION_ID))
		).toEqual([COLLEAGUE_EMPLOYEE_ID, COLLEAGUE_EMPLOYEE_ID]);
		expect(employeesIn(await service.getActiveSessions(undefined, 30, TENANT_ID, ORGANIZATION_ID))).toEqual(
			[OWN_EMPLOYEE_ID, OWN_EMPLOYEE_ID, COLLEAGUE_EMPLOYEE_ID, COLLEAGUE_EMPLOYEE_ID].sort()
		);
	});
});
