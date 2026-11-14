/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller (see
 * `time-log.service.spec.ts` for the cycle it breaks).
 */
import '../../core/entities/internal';
import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus } from '@nestjs/cqrs';
import { IGetTimeLogReportInput } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { mockRequestContext, RecordingQueryBuilder, slotFiguresQueryBuilder } from '../testing/recording-query-builder';
import { Organization } from '../../organization/organization.entity';
import { TypeOrmTimeLogRepository } from './repository/type-orm-time-log.repository';
import { TimeLogService } from './time-log.service';

const TENANT_ID = '5a1c2f0e-6d3b-4c8a-9e2f-1b7d4a6c8e90';
const ORGANIZATION_ID = '0f9e8d7c-6b5a-4c3d-8e2f-1a0b9c8d7e6f';
const USER_ID = 'c3b2a190-8f7e-4d6c-9b5a-4e3d2c1b0a9f';
const CURRENT_EMPLOYEE_ID = '7e6d5c4b-3a29-4180-9f8e-7d6c5b4a3928';
const RATED_EMPLOYEE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const UNRATED_EMPLOYEE_ID = '9c8b7a69-5847-4362-9150-4f3e2d1c0b9a';

/**
 * Issue #11919: an organization's default billing rate is the last link of the price chain. Where the API prices time
 * at a member's billing rate (the weekly report's cost, the project and client budgets' spent amounts), a member
 * without a rate is priced at the default when one is set; a member with a rate keeps it; and an organization without
 * a default gets the answers it got before.
 */
describe('TimeLogService and the organization default billing rate', () => {
	let service: TimeLogService;
	let builder: RecordingQueryBuilder;

	const request: IGetTimeLogReportInput = {
		organizationId: ORGANIZATION_ID,
		startDate: '2026-01-05T00:00:00.000Z',
		endDate: '2026-01-12T00:00:00.000Z',
		timeZone: 'UTC'
	};

	beforeEach(async () => {
		builder = new RecordingQueryBuilder('time_log');
		const module: TestingModule = await Test.createTestingModule({ providers: [TimeLogService] })
			.useMocker((token) => {
				if (token === TypeOrmTimeLogRepository) {
					return { metadata: { tableName: 'time_log' }, createQueryBuilder: () => builder };
				}
				if (token === ManagedEmployeeService) {
					return { canManageEmployees: jest.fn() };
				}
				if (token === CommandBus) {
					return { execute: jest.fn().mockResolvedValue([]) };
				}
				return {};
			})
			.compile();
		service = module.get<TimeLogService>(TimeLogService);
		Object.defineProperty(service, 'ormType', { value: MultiORMEnum.TypeORM });
		mockRequestContext({
			tenantId: TENANT_ID,
			user: { id: USER_ID, employeeId: CURRENT_EMPLOYEE_ID },
			canChangeSelectedEmployee: true
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	/** Hands the TypeORM repository an entity manager whose organization read answers `organization`. */
	const organizationLookup = (organization: Partial<Organization> | null) => {
		const findOne = jest.fn().mockResolvedValue(organization);
		Object.assign(service.typeOrmTimeLogRepository, {
			manager: { findOne, createQueryBuilder: () => slotFiguresQueryBuilder(() => builder.rows) }
		});
		return findOne;
	};

	describe('weekly report', () => {
		type WeeklyEntry = { employee: { id: string }; spent: number | null; currency: string | null };

		const log = (
			employee: Record<string, unknown>,
			organization: Partial<Organization>,
			id: string,
			duration: number
		) => ({
			id,
			employeeId: employee.id,
			startedAt: '2026-01-06T09:00:00.000Z',
			stoppedAt: '2026-01-06T10:00:00.000Z',
			duration,
			employee,
			organization,
			timeSlots: [{ id: `${id}-slot`, overall: 300, duration: 600 }]
		});

		const weekOf = async (organization: Partial<Organization>) => {
			organizationLookup(organization);
			const rated = { id: RATED_EMPLOYEE_ID, billRateValue: 60, billRateCurrency: 'EUR' };
			const unrated = { id: UNRATED_EMPLOYEE_ID, billRateValue: 0, billRateCurrency: null };
			builder.rows = [
				log(rated, organization, 'f1a2b3c4-0000-4000-8000-000000000001', 36000),
				log(unrated, organization, 'f1a2b3c4-0000-4000-8000-000000000002', 36000)
			];
			const report = (await service.getWeeklyReport(request)) as WeeklyEntry[];
			return new Map(report.map((entry) => [entry.employee.id, entry]));
		};

		it("prices the 10 hours of a member without a rate at the organization's default: 800 EUR", async () => {
			const byEmployee = await weekOf({
				currency: 'USD',
				defaultBillRateValue: 80,
				defaultBillRateCurrency: 'EUR' as never
			});

			expect(byEmployee.get(UNRATED_EMPLOYEE_ID)).toEqual(
				expect.objectContaining({ spent: 800, currency: 'EUR' })
			);
		});

		it('keeps the rate of a member who has one: 10 hours at 60 EUR', async () => {
			const byEmployee = await weekOf({
				currency: 'USD',
				defaultBillRateValue: 80,
				defaultBillRateCurrency: 'EUR' as never
			});

			expect(byEmployee.get(RATED_EMPLOYEE_ID)).toEqual(expect.objectContaining({ spent: 600, currency: 'EUR' }));
		});

		it('leaves the member without a rate unpriced, as before, when the organization sets no default', async () => {
			const byEmployee = await weekOf({
				currency: 'USD',
				defaultBillRateValue: null,
				defaultBillRateCurrency: null
			});

			expect(byEmployee.get(UNRATED_EMPLOYEE_ID)).toEqual(
				expect.objectContaining({ spent: null, currency: null })
			);
			expect(byEmployee.get(RATED_EMPLOYEE_ID)).toEqual(expect.objectContaining({ spent: 600, currency: 'EUR' }));
		});

		it("states a default without a currency in the organization's", async () => {
			const byEmployee = await weekOf({
				currency: 'USD',
				defaultBillRateValue: 80,
				defaultBillRateCurrency: null
			});

			expect(byEmployee.get(UNRATED_EMPLOYEE_ID)).toEqual(
				expect.objectContaining({ spent: 800, currency: 'USD' })
			);
		});

		it('reads the default with the logs, in the same query: the organization and its default columns', async () => {
			const setFindOptions = jest.spyOn(builder, 'setFindOptions');

			await weekOf({ currency: 'USD', defaultBillRateValue: 80 });

			const [{ select, relations }] = setFindOptions.mock.calls[0] as unknown as [
				{ select: Record<string, unknown>; relations: Record<string, unknown> }
			];
			expect(select.organization).toEqual(
				expect.objectContaining({ currency: true, defaultBillRateValue: true, defaultBillRateCurrency: true })
			);
			expect(relations.organization).toBe(true);
		});

		it('populates the organization under MikroORM, where a numeric column may arrive as text', async () => {
			const organization = { currency: 'USD', defaultBillRateValue: '80.00', defaultBillRateCurrency: 'EUR' };
			const unrated = { id: UNRATED_EMPLOYEE_ID, billRateValue: '0.00', billRateCurrency: null };
			const find = jest
				.fn()
				.mockResolvedValue([
					log(unrated, organization as never, 'f1a2b3c4-0000-4000-8000-000000000003', 36000)
				]);
			const self = Object.create(TimeLogService.prototype, {
				ormType: { value: MultiORMEnum.MikroORM },
				mikroOrmRepository: { value: { find, getEntityManager: () => ({ findOne: jest.fn() }) } },
				typeOrmRepository: { value: { manager: { find: jest.fn().mockResolvedValue([]) } } },
				buildMikroOrmTimeLogWhere: { value: jest.fn().mockResolvedValue({}) },
				serialize: { value: (entity: unknown) => entity }
			});

			const report = (await TimeLogService.prototype.getWeeklyReport.call(self, request)) as WeeklyEntry[];

			expect(find.mock.calls[0][1].populate).toEqual(expect.arrayContaining(['employee', 'organization']));
			expect(report[0]).toEqual(expect.objectContaining({ spent: 800, currency: 'EUR' }));
		});
	});

	describe('budget reports', () => {
		const PROJECT_ID = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
		const CLIENT_ID = '4e3d2c1b-0a98-4765-8432-10fedcba9877';

		/** Ten hours by a member at 60, and two by a member without a rate. */
		const timeLogs = [
			{ duration: 36000, employee: { billRateValue: 60 } },
			{ duration: 7200, employee: { billRateValue: 0 } }
		];

		const projectBudget = async (budgetType: string) => {
			const projectBuilder = new RecordingQueryBuilder('organization_project');
			projectBuilder.rows = [{ id: PROJECT_ID, name: 'Site', budget: 1000, budgetType, timeLogs }];
			Object.assign(service.typeOrmOrganizationProjectRepository, { createQueryBuilder: () => projectBuilder });
			const [report] = await service.getProjectBudgetLimit(request);
			return report;
		};

		const clientBudget = async (budgetType: string) => {
			const clientBuilder = new RecordingQueryBuilder('organization_contact');
			clientBuilder.rows = [{ id: CLIENT_ID, name: 'Acme', budget: 1000, budgetType, timeLogs }];
			Object.assign(service.typeOrmOrganizationContactRepository, { createQueryBuilder: () => clientBuilder });
			const [report] = await service.getClientBudgetLimit(request);
			return report;
		};

		it("prices a cost budget's time of a member without a rate at the default: 600 + 160", async () => {
			const findOrganization = organizationLookup({ currency: 'EUR', defaultBillRateValue: 80 });

			expect(await projectBudget('cost')).toEqual(expect.objectContaining({ spent: 760 }));
			expect(await clientBudget('cost')).toEqual(expect.objectContaining({ spent: 760 }));
			// Read once per report, scoped to the caller's tenant
			expect(findOrganization).toHaveBeenCalledTimes(2);
			expect(findOrganization).toHaveBeenCalledWith(
				Organization,
				expect.objectContaining({ where: { id: ORGANIZATION_ID, tenantId: TENANT_ID } })
			);
		});

		it('prices it as before, at no price, when the organization sets no default', async () => {
			organizationLookup({ currency: 'EUR', defaultBillRateValue: null });

			expect(await projectBudget('cost')).toEqual(expect.objectContaining({ spent: 600 }));
			expect(await clientBudget('cost')).toEqual(expect.objectContaining({ spent: 600 }));
		});

		it('reads no organization for an hour budget, which prices nothing', async () => {
			const findOrganization = organizationLookup({ currency: 'EUR', defaultBillRateValue: 80 });

			expect(await projectBudget('hours')).toEqual(expect.objectContaining({ spent: 12 }));
			expect(findOrganization).not.toHaveBeenCalled();
		});
	});
});
