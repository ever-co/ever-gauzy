import { AsyncLocalStorage } from 'async_hooks';
import { ClsService } from 'nestjs-cls';
import { NotFoundException } from '@nestjs/common';
import {
	IGetTimeLogReportInput,
	PermissionsEnum,
	SavedReportGroupingEnum,
	SavedReportKindEnum,
	SavedReportPeriodRuleEnum,
	WeekDaysEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { SavedReportPublicService } from './saved-report-public.service';
import { generateSavedReportToken, hashSavedReportToken } from './saved-report-token';

const TENANT = 'a0000000-0000-4000-8000-000000000001';
const ORGANIZATION = 'a0000000-0000-4000-8000-000000000002';
const REPORT = 'a0000000-0000-4000-8000-000000000003';
const MARIE_USER = 'a0000000-0000-4000-8000-0000000000a1';
const MARIE = 'a0000000-0000-4000-8000-0000000000e1';
const PAUL = 'a0000000-0000-4000-8000-0000000000e2';
const TEAM = 'a0000000-0000-4000-8000-0000000000f1';
const CLIENT_A = 'a0000000-0000-4000-8000-0000000000c1';
const WEBSITE = 'a0000000-0000-4000-8000-0000000000b1';
const MEETINGS = 'a0000000-0000-4000-8000-0000000000b2';

const ADMIN_PERMISSIONS = [
	PermissionsEnum.ALL_ORG_VIEW,
	PermissionsEnum.TIME_TRACKER,
	PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
];

/** What the daily report answers for a day with Client A's website and the internal meetings. */
function dailyReport() {
	return [
		{
			date: '2026-11-02',
			sum: 5 * 3600,
			activity: 55,
			logs: [
				{
					project: { id: WEBSITE, name: 'Website', organizationContact: { id: CLIENT_A, name: 'Client A' } },
					employeeLogs: [
						{
							employee: {
								id: MARIE,
								fullName: 'Marie Curie',
								user: {
									firstName: 'Marie',
									lastName: 'Curie',
									name: 'Marie Curie',
									email: 'marie@example.com'
								}
							},
							sum: 3 * 3600,
							activity: 60,
							tasks: [
								{
									task: { id: 'task-1', title: 'Fix the login page' },
									description: 'notes',
									duration: 3 * 3600,
									client: { id: CLIENT_A, name: 'Client A' }
								}
							]
						}
					]
				},
				{
					project: { id: MEETINGS, name: 'Meetings', organizationContact: null },
					employeeLogs: [
						{
							employee: {
								id: PAUL,
								fullName: 'Paul Dirac',
								user: { firstName: 'Paul', lastName: 'Dirac', name: 'Paul Dirac' }
							},
							sum: 2 * 3600,
							activity: 40,
							tasks: [{ task: null, description: 'private', duration: 2 * 3600, client: null }]
						}
					]
				}
			]
		}
	];
}

interface FakeMembership {
	id: string;
	userId: string;
	organizationId: string;
}

interface FakeEmployee {
	id: string;
	userId: string;
	organizationId: string;
	isActive: boolean;
	isArchived: boolean;
	billRateValue: number | null;
	billRateCurrency: string | null;
}

interface State {
	report: Record<string, unknown>;
	user: Record<string, unknown> | null;
	permissions: PermissionsEnum[];
	memberships: FakeMembership[];
	employees: FakeEmployee[];
	allowEmployeeToSeeTrackedData: boolean;
	managedTeams: string[];
	teamMembers: string[];
}

/** A link of Marie's "Client A, last month", and Marie an admin with an employee record in the organization. */
function stateWith(token: string, changes: Partial<State> = {}): State {
	return {
		report: {
			id: REPORT,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			authorId: MARIE_USER,
			name: 'Client A, last month',
			kind: SavedReportKindEnum.TIME_AND_ACTIVITY,
			periodRule: SavedReportPeriodRuleEnum.LAST_MONTH,
			startDate: null,
			endDate: null,
			timeZone: 'Africa/Kinshasa',
			filters: { clientIds: [CLIENT_A] },
			grouping: SavedReportGroupingEnum.PROJECT,
			includeAmounts: false,
			shareTokenHash: hashSavedReportToken(token),
			sharedAt: new Date('2026-11-03T10:00:00Z'),
			shareExpiresAt: null
		},
		user: { id: MARIE_USER, tenantId: TENANT, isActive: true, isArchived: false, roleId: 'role' },
		permissions: ADMIN_PERMISSIONS,
		memberships: [{ id: 'm1', userId: MARIE_USER, organizationId: ORGANIZATION }],
		employees: [
			{
				id: MARIE,
				userId: MARIE_USER,
				organizationId: ORGANIZATION,
				isActive: true,
				isArchived: false,
				billRateValue: 40,
				billRateCurrency: 'EUR'
			},
			{
				id: PAUL,
				userId: 'paul-user',
				organizationId: ORGANIZATION,
				isActive: true,
				isArchived: false,
				billRateValue: 50,
				billRateCurrency: null
			}
		],
		allowEmployeeToSeeTrackedData: true,
		managedTeams: [],
		teamMembers: [],
		...changes
	};
}

/** The conditions a fake repository is read with. */
interface FindArgs {
	where: Record<string, unknown>;
}

/** The name a repository is asked for by: the string, or the entity class name. */
function entityNameOf(entity: string | { name: string }): string {
	if (typeof entity === 'string') {
		return entity;
	}
	return entity.name;
}

/** The ids an `In(...)` condition holds. */
function idsOf(condition: unknown): string[] {
	return (condition as { value?: string[] })?.value ?? [];
}

function serviceFor(state: State) {
	const seen: { request?: IGetTimeLogReportInput; userIdInReport?: string; employeeIdInReport?: string } = {};
	const repositories: Record<string, object> = {
		Organization: {
			findOne: async () => ({ id: ORGANIZATION, startWeekOn: WeekDaysEnum.MONDAY, currency: 'USD' }),
			find: async () => [{ id: ORGANIZATION, allowEmployeeToSeeTrackedData: state.allowEmployeeToSeeTrackedData }]
		},
		UserOrganization: {
			findOne: async ({ where }: FindArgs) =>
				state.memberships.find((m) => m.userId === where.userId && m.organizationId === where.organizationId) ??
				null
		},
		Employee: {
			find: async ({ where }: FindArgs) => {
				if (where.userId) {
					return state.employees.filter((e) => e.userId === where.userId);
				}
				return state.employees.filter((e) => idsOf(where.id).includes(e.id));
			},
			findOne: async ({ where }: FindArgs) => state.employees.find((e) => e.id === where.id) ?? null
		},
		OrganizationProject: {
			find: async () => [
				{ id: WEBSITE, organizationContactId: CLIENT_A },
				{ id: MEETINGS, organizationContactId: null }
			]
		},
		OrganizationTeamEmployee: { existsBy: async () => false },
		OrganizationProjectEmployee: { existsBy: async () => false }
	};
	const dataSource = { getRepository: (entity: string | { name: string }) => repositories[entityNameOf(entity)] };
	const typeOrmRepository = {
		findOne: jest.fn(async ({ where }: FindArgs) => {
			if (where.shareTokenHash !== state.report.shareTokenHash) {
				return null;
			}
			return { ...state.report };
		})
	};
	const userService = {
		getIfExists: jest.fn(async () => {
			if (!state.user) {
				return null;
			}
			return { ...state.user };
		})
	};
	const roleAuthorizationService = {
		attachAuthorizationState: jest.fn(
			async (user: { permissions?: PermissionsEnum[]; role?: { name: string } }) => {
				user.permissions = state.permissions;
				user.role = { name: 'ADMIN' };
				return user;
			}
		)
	};
	const timeLogService = {
		getDailyReport: jest.fn(async (request: IGetTimeLogReportInput) => {
			seen.request = request;
			seen.userIdInReport = RequestContext.currentUserId();
			seen.employeeIdInReport = RequestContext.currentUser()?.employeeId;
			return dailyReport();
		})
	};
	const managedEmployeeService = {
		managesAnyTeam: jest.fn(async (_employeeId: string, teamIds: string[]) =>
			teamIds.every((id) => state.managedTeams.includes(id))
		),
		findMembersOfReadableTeams: jest.fn(async () => state.teamMembers)
	};
	const service = new SavedReportPublicService(
		typeOrmRepository as never,
		{} as never,
		dataSource as never,
		userService as never,
		roleAuthorizationService as never,
		timeLogService as never,
		managedEmployeeService as never
	);
	return { service, seen, typeOrmRepository, timeLogService };
}

describe('SavedReportPublicService', () => {
	const originalClsService = RequestContext['clsService'];
	const token = generateSavedReportToken();

	beforeEach(() => {
		RequestContext.setClsService(new ClsService(new AsyncLocalStorage()));
		jest.useFakeTimers({
			now: new Date('2026-12-02T09:00:00Z'),
			doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask']
		});
	});

	afterEach(() => {
		jest.useRealTimers();
		RequestContext['clsService'] = originalClsService;
	});

	it('opened on 2 December, runs the report page query for November, as Marie, with the saved filters', async () => {
		const { service, seen } = serviceFor(stateWith(token));

		const answer = await service.read(token);

		expect(seen.userIdInReport).toBe(MARIE_USER);
		expect(seen.employeeIdInReport).toBe(MARIE);
		expect(seen.request).toMatchObject({
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			startDate: '2026-10-31T23:00:00.000Z',
			endDate: '2026-11-30T22:59:59.999Z',
			timeZone: 'Africa/Kinshasa',
			groupBy: 'date',
			employeeIds: [],
			activityLevel: { start: 0, end: 100 },
			includeTimeWithoutTeam: false,
			billableOnly: false
		});
		expect(answer.period).toEqual({
			rule: SavedReportPeriodRuleEnum.LAST_MONTH,
			startDate: '2026-11-01',
			endDate: '2026-11-30',
			timeZone: 'Africa/Kinshasa'
		});
		expect(answer.name).toBe('Client A, last month');
		expect(answer.grouping).toBe(SavedReportGroupingEnum.PROJECT);
	});

	it("keeps only Client A's time, with its total, and no rate, amount, notes, activity or e-mail", async () => {
		const { service } = serviceFor(stateWith(token));

		const answer = await service.read(token);
		const text = JSON.stringify(answer);

		expect(answer.days[0].logs.map((log) => log.project?.name)).toEqual(['Website']);
		expect(answer.totals).toEqual({ duration: 3 * 3600 });
		for (const field of ['billRateValue', 'amount', 'description', 'activity', 'email']) {
			expect(text).not.toContain(`"${field}"`);
		}
	});

	it('states the rates and amounts per currency when Marie included amounts, in the organization currency when a rate has none', async () => {
		const state = stateWith(token);
		state.report.filters = {};
		state.report.includeAmounts = true;
		const { service } = serviceFor(state);

		const answer = await service.read(token);

		expect(answer.totals.amounts).toEqual([
			{ currency: 'EUR', amount: 120 },
			{ currency: 'USD', amount: 100 }
		]);
		expect(answer.days[0].logs[1].employeeLogs[0].employee).toMatchObject({
			billRateValue: 50,
			billRateCurrency: 'USD'
		});
	});

	it('names the members of the picked team for a manager of it, as the report page does', async () => {
		const state = stateWith(token, {
			permissions: [PermissionsEnum.TIME_TRACKER],
			managedTeams: [TEAM],
			teamMembers: [MARIE, PAUL]
		});
		state.report.filters = { teamIds: [TEAM] };
		const { service, seen } = serviceFor(state);

		await service.read(token);

		expect(seen.request?.employeeIds).toEqual([MARIE, PAUL]);
		expect(seen.request?.includeTimeWithoutTeam).toBe(true);
	});

	it('names nobody for a member who does not manage the picked team, so the query reads their own time only', async () => {
		const state = stateWith(token, { permissions: [PermissionsEnum.TIME_TRACKER], teamMembers: [MARIE, PAUL] });
		state.report.filters = { teamIds: [TEAM] };
		const { service, seen } = serviceFor(state);

		await service.read(token);

		expect(seen.request?.employeeIds).toEqual([]);
	});

	describe('answers the same 404 for every link that does not open a report', () => {
		const refused = async (state: State, presented = token) => {
			const { service, timeLogService } = serviceFor(state);
			await expect(service.read(presented)).rejects.toThrow(NotFoundException);
			expect(timeLogService.getDailyReport).not.toHaveBeenCalled();
		};

		it('a malformed token, without reading the database', async () => {
			const { service, typeOrmRepository } = serviceFor(stateWith(token));
			await expect(service.read('not-a-token')).rejects.toThrow('This report link does not work.');
			expect(typeOrmRepository.findOne).not.toHaveBeenCalled();
		});

		it('an unknown token', async () => refused(stateWith(token), generateSavedReportToken()));

		it('a link turned off', async () => {
			const state = stateWith(token);
			state.report.shareTokenHash = null;
			await refused(state);
		});

		it('a link past its end date', async () => {
			const state = stateWith(token);
			state.report.shareExpiresAt = new Date('2026-12-01T00:00:00Z');
			await refused(state);
		});

		it('an author whose account was deactivated', async () =>
			refused(
				stateWith(token, { user: { id: MARIE_USER, tenantId: TENANT, isActive: false, isArchived: false } })
			));

		it('an author whose account is not stated as kept, as a sign-in refuses it', async () =>
			refused(
				stateWith(token, { user: { id: MARIE_USER, tenantId: TENANT, isActive: true, isArchived: null } })
			));

		it('an author who left the organization', async () => refused(stateWith(token, { memberships: [] })));

		it('an author whose employee record was ended', async () => {
			const state = stateWith(token);
			state.employees[0].isActive = false;
			await refused(state);
		});

		it('an author whose role lost the permissions the reports are read with', async () =>
			refused(stateWith(token, { permissions: [] })));

		it('an employee author once the organization hides tracked data from employees', async () =>
			refused(
				stateWith(token, { permissions: [PermissionsEnum.TIME_TRACKER], allowEmployeeToSeeTrackedData: false })
			));
	});
});
