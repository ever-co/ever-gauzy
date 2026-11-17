/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — see the note in
 * `custom-tracking.service.spec.ts`.
 */
import '../../core/entities/internal';
import { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { HiddenProjectsInterceptor } from '../../organization-project/hidden-projects.interceptor';
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

const TENANT_ID = '6a1f0c2e-3b4d-4e5f-8a6b-7c8d9e0f1a21';
const ORGANIZATION_ID = '1b2c3d4e-5f60-4718-9a2b-3c4d5e6f7a22';
const OTHER_ORGANIZATION_ID = '2c3d4e5f-6071-4829-8b3c-4d5e6f7a8b23';
const TEAM_ID = '3d4e5f60-7182-4930-9c4d-5e6f7a8b9c24';
const PROJECT_ID = '4e5f6071-8293-4a41-8d5e-6f7a8b9c0d25';

const OWN_EMPLOYEE_ID = '5f607182-93a4-4b52-9e6f-7a8b9c0d1e26';
const COLLEAGUE_EMPLOYEE_ID = '60718293-a4b5-4c63-8f70-8b9c0d1e2f27';
const MANAGER_EMPLOYEE_ID = '718293a4-b5c6-4d74-9081-9c0d1e2f3a28';
const PROJECT_MANAGER_EMPLOYEE_ID = '8293a4b5-c6d7-4e85-8192-0d1e2f3a4b29';
const TEAM_CREATOR_EMPLOYEE_ID = '93a4b5c6-d7e8-4f96-8a2b-1e2f3a4b5c34';
const CREATED_TEAM_ID = 'a4b5c6d7-e8f9-4a07-9b3c-2f3a4b5c6d35';

const OWN_SLOT_ID = '93a4b5c6-d7e8-4f96-92a3-1e2f3a4b5c30';
const COLLEAGUE_SLOT_ID = 'a4b5c6d7-e8f9-4a07-83b4-2f3a4b5c6d31';
const OTHER_ORGANIZATION_SLOT_ID = 'b5c6d7e8-f90a-4b18-94c5-3a4b5c6d7e32';
const MISSING_SLOT_ID = 'c6d7e8f9-0a1b-4c29-85d6-4b5c6d7e8f33';

const TRACKING_SESSIONS = [{ sessionId: 'session-1', session: { title: 'Private document' } }];

/** A slot as the repository answers it, with the time entries the route returns. */
const slot = (id: string, employeeId: string, organizationId: string = ORGANIZATION_ID) => ({
	id,
	employeeId,
	organizationId,
	tenantId: TENANT_ID,
	startedAt: new Date('2026-11-17T08:00:00.000Z'),
	duration: 600,
	customActivity: { trackingSessions: TRACKING_SESSIONS },
	timeLogs: [{ id: `log-of-${id}`, employeeId }]
});

const SLOTS = [
	slot(OWN_SLOT_ID, OWN_EMPLOYEE_ID),
	slot(COLLEAGUE_SLOT_ID, COLLEAGUE_EMPLOYEE_ID),
	slot(OTHER_ORGANIZATION_SLOT_ID, COLLEAGUE_EMPLOYEE_ID, OTHER_ORGANIZATION_ID)
];

/**
 * Team and project memberships. The manager and the project manager hold the `isManager` flag, which an admin hands on;
 * the team creator made a team of their own with the colleague in it, and holds its MANAGER role without the flag, as
 * `OrganizationTeamService.create` leaves an employee who creates a team. Which predicates the reads apply (active,
 * organization) is asserted in `managed-employee.service.manages-in-organization.spec.ts`.
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

/** The values of an `In(...)` operator, or the plain value. */
const valuesOf = (operand: any): unknown[] => (Array.isArray(operand?.value) ? operand.value : [operand]);

/**
 * Callers as the JWT strategy leaves them on the request: `employeeId` and `lastOrganizationId` are the validated
 * claims, and there is no `employee` (the user entity has no such relation).
 */
const EMPLOYEE_PERMISSIONS = [PermissionsEnum.TIME_TRACKER, PermissionsEnum.ORG_MEMBERS_VIEW];
const ADMIN_PERMISSIONS = [
	PermissionsEnum.TIME_TRACKER,
	PermissionsEnum.ALL_ORG_VIEW,
	PermissionsEnum.ALL_ORG_EDIT,
	PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
];

const asEmployee = (employeeId: string) => ({
	user: { id: `user-of-${employeeId}`, tenantId: TENANT_ID, employeeId, lastOrganizationId: ORGANIZATION_ID },
	permissions: EMPLOYEE_PERMISSIONS
});
const ADMIN = {
	user: { id: 'admin-user', tenantId: TENANT_ID, employeeId: null, lastOrganizationId: ORGANIZATION_ID },
	permissions: ADMIN_PERMISSIONS
};

/**
 * `GET /timesheet/custom-tracking/time-slot/:id` was scoped by tenant and organization only, so any TIME_TRACKER
 * holder (every default employee) could read a colleague's slot, its custom-tracking sessions and its time entries,
 * by the slot's id. `EmployeeTrackedDataGuard` judges an organization setting and no employee. The route now answers
 * the caller's own slots, those of the members of a team or project they manage, and every slot to a caller who may
 * act for every employee; any other slot answers exactly as a missing one.
 *
 * It also read the organization from `currentUser().employee`, which the request's user never carries, so it
 * answered 400 to every real request; it reads the organization the JWT strategy validated.
 */
describe('GET /timesheet/custom-tracking/time-slot/:id — whose slot a caller may read', () => {
	let app: INestApplication;
	let service: CustomTrackingService;
	let caller: { user: Record<string, unknown>; permissions: PermissionsEnum[] };

	const allow = { canActivate: () => true };

	beforeAll(async () => {
		const timeSlotRepository = {
			findOne: jest.fn(async ({ where }) => {
				return (
					SLOTS.find(
						(row) =>
							row.id === where.id &&
							row.tenantId === where.tenantId &&
							row.organizationId === where.organizationId
					) ?? null
				);
			})
		};
		const teamEmployeeRepository = {
			find: jest.fn(async ({ where }) =>
				TEAM_MEMBERS.filter(
					(row) =>
						row.employeeId === where.employeeId &&
						(where.isManager === undefined || row.isManager === where.isManager)
				)
			),
			existsBy: jest.fn(async (where) =>
				TEAM_MEMBERS.some(
					(row) =>
						row.employeeId === where.employeeId &&
						valuesOf(where.organizationTeamId).includes(row.organizationTeamId)
				)
			)
		};
		const projectEmployeeRepository = {
			find: jest.fn(async ({ where }) =>
				PROJECT_MEMBERS.filter(
					(row) => row.employeeId === where.employeeId && row.isManager === where.isManager
				)
			),
			existsBy: jest.fn(async (where) =>
				PROJECT_MEMBERS.some(
					(row) =>
						row.employeeId === where.employeeId &&
						valuesOf(where.organizationProjectId).includes(row.organizationProjectId)
				)
			)
		};

		const moduleRef = await Test.createTestingModule({
			controllers: [CustomTrackingController],
			providers: [
				CustomTrackingService,
				ManagedEmployeeService,
				{ provide: TypeOrmTimeSlotRepository, useValue: timeSlotRepository },
				{ provide: MikroOrmTimeSlotRepository, useValue: {} },
				{ provide: TypeOrmTimeSlotSessionRepository, useValue: {} },
				{ provide: MikroOrmTimeSlotSessionRepository, useValue: {} },
				{ provide: TypeOrmOrganizationTeamEmployeeRepository, useValue: teamEmployeeRepository },
				{ provide: TypeOrmOrganizationProjectEmployeeRepository, useValue: projectEmployeeRepository },
				{ provide: CommandBus, useValue: {} }
			]
		})
			// The route's permission and organization-setting guards, and the hidden-project masking, have their own
			// suites (`employee-tracked-data-routes.spec.ts`, `hidden-projects.routes.spec.ts`); this one is about the
			// employee whose slot is read.
			.overrideGuard(TenantPermissionGuard)
			.useValue(allow)
			.overrideGuard(PermissionGuard)
			.useValue(allow)
			.overrideGuard(EmployeeTrackedDataGuard)
			.useValue(allow)
			.overrideInterceptor(HiddenProjectsInterceptor)
			.useValue({ intercept: (_context, next) => next.handle() })
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

	const read = (slotId: string) =>
		request(app.getHttpServer()).get(`/api/timesheet/custom-tracking/time-slot/${slotId}`);

	it('answers an employee their own slot, with its tracking sessions and time entries', async () => {
		caller = asEmployee(OWN_EMPLOYEE_ID);

		const response = await read(OWN_SLOT_ID).expect(200);

		expect(response.body).toEqual({
			timeSlotId: OWN_SLOT_ID,
			hasTrackingData: true,
			timeSlot: {
				startedAt: '2026-11-17T08:00:00.000Z',
				duration: 600,
				timeLogs: [{ id: `log-of-${OWN_SLOT_ID}`, employeeId: OWN_EMPLOYEE_ID }]
			},
			trackingSessions: TRACKING_SESSIONS
		});
	});

	it("answers an employee a colleague's slot exactly as a slot that does not exist (404)", async () => {
		caller = asEmployee(OWN_EMPLOYEE_ID);

		const refused = await read(COLLEAGUE_SLOT_ID).expect(404);
		const missing = await read(MISSING_SLOT_ID).expect(404);

		expect(refused.body).toEqual(missing.body);
		expect(JSON.stringify(refused.body)).not.toContain('session-1');
	});

	it("answers a team manager (the `isManager` flag an admin handed on) a member's slot", async () => {
		caller = asEmployee(MANAGER_EMPLOYEE_ID);

		const response = await read(COLLEAGUE_SLOT_ID).expect(200);

		expect(response.body.trackingSessions).toEqual(TRACKING_SESSIONS);
	});

	it('answers 404 to an employee who made a team of their own with the colleague in it (MANAGER role, no flag)', async () => {
		// An employee may create a team, pick its members and get its MANAGER role; that must not open their slots.
		caller = asEmployee(TEAM_CREATOR_EMPLOYEE_ID);

		await read(COLLEAGUE_SLOT_ID).expect(404);
	});

	it("answers a project manager a member's slot", async () => {
		caller = asEmployee(PROJECT_MANAGER_EMPLOYEE_ID);

		await read(COLLEAGUE_SLOT_ID).expect(200);
	});

	it('answers a project manager 404 for the slot of someone outside their projects', async () => {
		caller = asEmployee(PROJECT_MANAGER_EMPLOYEE_ID);

		await read(OWN_SLOT_ID).expect(404);
	});

	it('answers an admin (CHANGE_SELECTED_EMPLOYEE) any slot of the organization', async () => {
		caller = ADMIN;

		await read(OWN_SLOT_ID).expect(200);
		const response = await read(COLLEAGUE_SLOT_ID).expect(200);

		expect(response.body.trackingSessions).toEqual(TRACKING_SESSIONS);
	});

	it('answers an admin 404 for a slot of another organization: the organization scope is unchanged', async () => {
		caller = ADMIN;

		await read(OTHER_ORGANIZATION_SLOT_ID).expect(404);
	});

	it('answers 404 to a caller who may not act for other employees and has no employee record, as the time-slot reads do', async () => {
		// Time slots are personal (GHSA-6qvm-3wg4-26w4): `TimeSlotService` gives such a caller no slot, ALL_ORG_VIEW or not.
		for (const permissions of [
			[PermissionsEnum.TIME_TRACKER],
			[PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ALL_ORG_EDIT]
		]) {
			caller = { user: { ...ADMIN.user }, permissions };

			await read(COLLEAGUE_SLOT_ID).expect(404);
		}
	});

	it('keeps the organization of a user that carries `employee`, and scopes it the same way', async () => {
		const { lastOrganizationId, ...user } = asEmployee(OWN_EMPLOYEE_ID).user;
		caller = {
			user: { ...user, employee: { id: OWN_EMPLOYEE_ID, organizationId: lastOrganizationId } },
			permissions: EMPLOYEE_PERMISSIONS
		};

		await read(OWN_SLOT_ID).expect(200);
		await read(COLLEAGUE_SLOT_ID).expect(404);
	});

	it('still answers 400 when the caller has no organization at all', async () => {
		caller = { user: { id: 'no-organization', tenantId: TENANT_ID, employeeId: OWN_EMPLOYEE_ID }, permissions: [] };

		await read(OWN_SLOT_ID).expect(400);
	});

	it('answers null over GraphQL for a slot the caller may not read, as for a missing one', async () => {
		const resolver = new CustomTrackingResolver(service);

		caller = asEmployee(OWN_EMPLOYEE_ID);
		await expect(resolver.timeSlotTrackingData(COLLEAGUE_SLOT_ID)).resolves.toBeNull();
		await expect(resolver.timeSlotTrackingData(MISSING_SLOT_ID)).resolves.toBeNull();

		caller = asEmployee(MANAGER_EMPLOYEE_ID);
		await expect(resolver.timeSlotTrackingData(COLLEAGUE_SLOT_ID)).resolves.toMatchObject({
			trackingSessions: TRACKING_SESSIONS
		});
	});
});
