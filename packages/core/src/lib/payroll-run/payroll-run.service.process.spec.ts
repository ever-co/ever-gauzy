/**
 * Load the entity graph FIRST, as the application does (see payroll-run.resolver.spec.ts).
 */
import '../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PayrollItemCategoryEnum, PayrollItemTypeEnum, PayrollRunStatusEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { PayrollItem } from '../payroll-item/payroll-item.entity';
import { PayrollRun } from './payroll-run.entity';
import { PayrollRunService } from './payroll-run.service';
import { createPayrollStore, IPayrollStore, payrollRunServiceOver } from './testing/payroll-store.fixtures';

/**
 * #10184 item 7: the money paths of a payroll run, against a real SQLite store.
 *
 *  - `process()` claims the run with ONE conditional UPDATE (`... WHERE status IN (APPROVED, PROCESSING)`), so two
 *    calls that both read the run as approved cannot both pay it.
 *  - Totals are summed in integer cents, so `0.1 + 0.2` is `0.3`, not `0.30000000000000004`.
 *  - Statistics are grouped by currency, because a sum across currencies means nothing.
 */

const TENANT = 'tenant-1';
const ORG = 'org-1';
const OTHER_ORG = 'org-2';
const RUN = 'run-1';

describe('PayrollRunService — processing and totals', () => {
	let store: IPayrollStore;
	let service: PayrollRunService;

	beforeAll(async () => {
		store = await createPayrollStore();
	});

	afterAll(async () => {
		await store?.dataSource.destroy();
	});

	beforeEach(async () => {
		await store.items.clear();
		await store.runs.clear();
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		service = payrollRunServiceOver(store);
	});

	afterEach(() => jest.restoreAllMocks());

	/** Stores a run as it stands, bypassing the service. */
	const givenRun = (run: Partial<PayrollRun> & { id: string }) =>
		store.runs.insert({ tenantId: TENANT, organizationId: ORG, currency: 'USD', ...run } as PayrollRun);

	/** Stores a line as it stands, bypassing the service, so the run's stored totals do not count it yet. */
	const givenLine = (payrollRunId: string, category: PayrollItemCategoryEnum, amount: number, employeeId = 'e-1') =>
		store.items.insert({
			tenantId: TENANT,
			organizationId: ORG,
			payrollRunId,
			employeeId,
			type: PayrollItemTypeEnum.BASIC_SALARY,
			category,
			amount
		} as PayrollItem);

	const storedRun = async (id: string) => {
		const run = await store.runs.findOneOrFail({ where: { id } });
		return {
			status: run.status,
			paid: run.paidAt != null,
			totalGross: Number(run.totalGross),
			totalDeductions: Number(run.totalDeductions),
			totalNet: Number(run.totalNet)
		};
	};

	/**
	 * Holds each caller's first read of the run until `callers` reads have happened, so every call has seen the run
	 * as processable before any of them claims it: the interleaving in which a read-then-write would pay twice.
	 */
	const readTogether = (callers: number) => {
		const read = service.findOneRun.bind(service);
		let waiting = callers;
		let releaseAll: () => void;
		const allRead = new Promise<void>((resolve) => (releaseAll = resolve));

		jest.spyOn(service, 'findOneRun').mockImplementation(
			async (...args: Parameters<PayrollRunService['findOneRun']>) => {
				const run = await read(...args);
				if (waiting > 0) {
					waiting -= 1;
					if (waiting === 0) {
						releaseAll();
					}
					await allRead;
				}
				return run;
			}
		);
	};

	/**
	 * Runs the store's transactions one after another, as the row lock a database takes for the claiming UPDATE does:
	 * the second transaction's UPDATE waits for the first to commit, then re-reads the row. better-sqlite3 has one
	 * connection, so two overlapping transactions would otherwise nest as savepoints of each other, which no
	 * production database does.
	 */
	const serializeTransactions = (manager: EntityManager) => {
		const transaction = manager.transaction.bind(manager) as (...args: unknown[]) => Promise<unknown>;
		let queue: Promise<unknown> = Promise.resolve();

		jest.spyOn(manager, 'transaction').mockImplementation(((...args: unknown[]) => {
			const turn = queue.then(() => transaction(...args));
			queue = turn.catch(() => undefined);
			return turn;
		}) as never);
	};

	describe('process()', () => {
		it('pays an approved run exactly once when two calls race', async () => {
			await givenRun({ id: RUN, status: PayrollRunStatusEnum.APPROVED });
			await givenLine(RUN, PayrollItemCategoryEnum.EARNING, 1000);
			readTogether(2);
			serializeTransactions(store.dataSource.manager);

			const outcomes = await Promise.allSettled([service.process(RUN, ORG), service.process(RUN, ORG)]);

			const paid = outcomes.filter((outcome) => outcome.status === 'fulfilled');
			const refused = outcomes.filter(
				(outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected'
			);
			expect(paid).toHaveLength(1);
			expect(refused).toHaveLength(1);
			// Refused by the claim itself: both calls had already read the run as APPROVED.
			expect(refused[0].reason).toBeInstanceOf(BadRequestException);
			expect(refused[0].reason.message).toMatch(/already been processed/);
			expect(await storedRun(RUN)).toEqual({
				status: PayrollRunStatusEnum.PAID,
				paid: true,
				totalGross: 1000,
				totalDeductions: 0,
				totalNet: 1000
			});
		});

		it('refuses a run that is already paid, and leaves it as it was', async () => {
			await givenRun({ id: RUN, status: PayrollRunStatusEnum.APPROVED });
			await givenLine(RUN, PayrollItemCategoryEnum.EARNING, 500);
			await service.process(RUN, ORG);
			const afterFirst = await storedRun(RUN);

			await expect(service.process(RUN, ORG)).rejects.toBeInstanceOf(BadRequestException);
			expect(await storedRun(RUN)).toEqual(afterFirst);
		});

		it.each([PayrollRunStatusEnum.DRAFT, PayrollRunStatusEnum.PENDING_APPROVAL, PayrollRunStatusEnum.CANCELLED])(
			'refuses a %s run and leaves it unpaid',
			async (status) => {
				await givenRun({ id: RUN, status });

				await expect(service.process(RUN, ORG)).rejects.toBeInstanceOf(BadRequestException);
				expect(await storedRun(RUN)).toMatchObject({ status, paid: false });
			}
		);

		it('processes a run left in PROCESSING', async () => {
			await givenRun({ id: RUN, status: PayrollRunStatusEnum.PROCESSING });

			await service.process(RUN, ORG);

			expect(await storedRun(RUN)).toMatchObject({ status: PayrollRunStatusEnum.PAID, paid: true });
		});

		it('does not reach a run of another organization of the tenant', async () => {
			await givenRun({ id: RUN, organizationId: OTHER_ORG, status: PayrollRunStatusEnum.APPROVED });

			await expect(service.process(RUN, ORG)).rejects.toThrow(/was not found/);
			expect(await storedRun(RUN)).toMatchObject({ status: PayrollRunStatusEnum.APPROVED, paid: false });
		});

		it('pays the totals of the lines as they stand, summed in integer cents', async () => {
			// Stored totals are stale (0): the lines below were written behind the service's back.
			await givenRun({ id: RUN, status: PayrollRunStatusEnum.APPROVED });
			for (const amount of [0.1, 0.2, 2500.3]) {
				await givenLine(RUN, PayrollItemCategoryEnum.EARNING, amount);
			}
			for (const amount of [0.7, 0.1]) {
				await givenLine(RUN, PayrollItemCategoryEnum.DEDUCTION, amount);
			}

			const processed = await service.process(RUN, ORG);

			// Summed as binary floats: 0.1 + 0.2 + 2500.3 = 2500.6000000000004 and 0.7 + 0.1 = 0.7999999999999999.
			const totals = { totalGross: 2500.6, totalDeductions: 0.8, totalNet: 2499.8 };
			expect(processed).toMatchObject(totals);
			expect(await storedRun(RUN)).toMatchObject(totals);
		});
	});

	describe('getStatistics()', () => {
		it('totals the paid runs of the organization per currency, in integer cents', async () => {
			await givenRun({
				id: 'usd-1',
				status: PayrollRunStatusEnum.PAID,
				totalGross: 0.1,
				totalDeductions: 0.7,
				totalNet: -0.6
			});
			await givenRun({
				id: 'usd-2',
				status: PayrollRunStatusEnum.PAID,
				totalGross: 0.2,
				totalDeductions: 0.1,
				totalNet: 0.1
			});
			await givenRun({
				id: 'eur-1',
				currency: 'EUR',
				status: PayrollRunStatusEnum.PAID,
				totalGross: 300,
				totalDeductions: 30,
				totalNet: 270
			});
			// Not counted: not paid yet, or another organization's.
			await givenRun({
				id: 'usd-open',
				status: PayrollRunStatusEnum.APPROVED,
				totalGross: 999,
				totalDeductions: 0,
				totalNet: 999
			});
			await givenRun({
				id: 'usd-other',
				organizationId: OTHER_ORG,
				status: PayrollRunStatusEnum.PAID,
				totalGross: 999,
				totalDeductions: 0,
				totalNet: 999
			});
			await givenLine('usd-1', PayrollItemCategoryEnum.EARNING, 0.1, 'e-1');
			await givenLine('usd-2', PayrollItemCategoryEnum.EARNING, 0.1, 'e-1');
			await givenLine('usd-2', PayrollItemCategoryEnum.EARNING, 0.1, 'e-2');
			await givenLine('eur-1', PayrollItemCategoryEnum.EARNING, 300, 'e-3');

			const statistics = await service.getStatistics(ORG);

			expect(statistics).toHaveLength(2);
			expect(statistics).toEqual(
				expect.arrayContaining([
					{
						currency: 'USD',
						totalRuns: 2,
						totalEmployeesPaid: 2,
						totalGrossPaid: 0.3,
						totalDeductions: 0.8,
						totalNetPaid: -0.5
					},
					{
						currency: 'EUR',
						totalRuns: 1,
						totalEmployeesPaid: 1,
						totalGrossPaid: 300,
						totalDeductions: 30,
						totalNetPaid: 270
					}
				])
			);
		});

		it('answers no totals for an organization that has paid nothing', async () => {
			await givenRun({
				id: RUN,
				status: PayrollRunStatusEnum.APPROVED,
				totalGross: 10,
				totalDeductions: 0,
				totalNet: 10
			});

			expect(await service.getStatistics(ORG)).toEqual([]);
		});
	});
});
