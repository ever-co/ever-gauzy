// Must stay first: loads the entity graph before the module pulls an entity (see activity.controller.spec.ts).
import '../../core/entities/internal';

import {
	Employee,
	Organization,
	OrganizationProject,
	OrganizationProjectEmployee,
	TimeLog
} from '../../core/entities/internal';
import { billingRateOfLog, findClientRates, findRatesToStore, findStoredRatesOf, storesRates } from './time-log-rates';

/** A manager over fixed rows: the employee, the project and the membership as the database holds them. */
function managerOver(rows: {
	employee?: object | null;
	project?: object | null;
	membership?: object | null;
	organization?: object | null;
}) {
	const reads: Array<{ entity: unknown; options: any }> = [];
	const manager = {
		findOne: jest.fn(async (entity: unknown, options: any) => {
			reads.push({ entity, options });
			if (entity === Employee) return rows.employee ?? null;
			if (entity === OrganizationProject) return rows.project ?? null;
			if (entity === OrganizationProjectEmployee) return rows.membership ?? null;
			if (entity === Organization) return rows.organization ?? null;
			return null;
		}),
		find: jest.fn(async () => [])
	};
	return { manager: manager as any, reads };
}

const SCOPE = { tenantId: 'tenant-1', organizationId: 'organization-1', employeeId: 'marie', projectId: 'site' };

describe('time log rates', () => {
	describe('findRatesToStore', () => {
		it("reads the member's rates by name, the hidden pay rate included, and the project's client rates", async () => {
			const { manager, reads } = managerOver({
				employee: {
					id: 'marie',
					billRateValue: '40.00',
					billRateCurrency: 'USD',
					payRateValue: 25,
					payRateCurrency: 'EUR'
				},
				project: { id: 'site', billRateValue: 90, currency: 'EUR' },
				membership: { id: 'm1', billRateValue: '95.50' }
			});

			const rates = await findRatesToStore(manager, SCOPE);

			expect(rates).toEqual({
				billRateValue: 40,
				billRateCurrency: 'USD',
				payRateValue: 25,
				payRateCurrency: 'EUR',
				projectBillRateValue: 90,
				projectMemberBillRateValue: 95.5,
				projectBillRateCurrency: 'EUR',
				projectMemberBillRateCurrency: 'EUR',
				ratesStored: true
			});
			expect(reads[0].options.select).toMatchObject({ payRateValue: true, payRateCurrency: true });
			expect(reads[0].options.where).toEqual({ id: 'marie', tenantId: 'tenant-1' });
		});

		it("stores the organization's currency for a rate that states none, so a later change cannot relabel it", async () => {
			const { manager } = managerOver({
				employee: {
					id: 'marie',
					billRateValue: 40,
					billRateCurrency: null,
					payRateValue: 25,
					payRateCurrency: null
				},
				project: { id: 'site', billRateValue: 90, currency: null },
				organization: { id: 'organization-1', currency: 'BGN' }
			});

			const rates = await findRatesToStore(manager, SCOPE);

			expect(rates).toMatchObject({
				billRateCurrency: 'BGN',
				payRateCurrency: 'BGN',
				projectBillRateCurrency: 'BGN'
			});
		});

		it('stores no rate for a member who has none: their time stays without a price', async () => {
			const { manager } = managerOver({
				employee: {
					id: 'paul',
					billRateValue: null,
					billRateCurrency: null,
					payRateValue: null,
					payRateCurrency: null
				}
			});

			const rates = await findRatesToStore(manager, {
				tenantId: 'tenant-1',
				employeeId: 'paul',
				projectId: null
			});

			expect(rates).toMatchObject({ billRateValue: null, payRateValue: null, ratesStored: true });
		});

		it('reads the membership rate of a current membership only, and nothing without a project', async () => {
			const withProject = managerOver({ project: { id: 'site', billRateValue: null, currency: null } });
			await findClientRates(withProject.manager, SCOPE);
			const membershipRead = withProject.reads.find((read) => read.entity === OrganizationProjectEmployee);
			expect(Object.keys(membershipRead.options.where)).toEqual(
				expect.arrayContaining(['organizationProjectId', 'employeeId', 'tenantId', 'isActive', 'isArchived'])
			);

			const withoutProject = managerOver({});
			const rates = await findClientRates(withoutProject.manager, { ...SCOPE, projectId: null });
			expect(rates).toEqual({
				projectBillRateValue: null,
				projectMemberBillRateValue: null,
				projectBillRateCurrency: null,
				projectMemberBillRateCurrency: null
			});
			expect(withoutProject.reads).toHaveLength(0);
		});
	});

	describe('findStoredRatesOf', () => {
		it('reads the stored rates of the logs by name, removed logs included, in the caller tenant', async () => {
			const manager = {
				find: jest.fn(async () => [
					{
						id: 'log-1',
						billRateValue: '40.00',
						billRateCurrency: 'USD',
						payRateValue: '25.00',
						payRateCurrency: null,
						projectBillRateValue: null,
						projectMemberBillRateValue: null,
						projectBillRateCurrency: null,
						ratesStored: 1
					}
				])
			};

			const stored = await findStoredRatesOf(manager as any, ['log-1'], 'tenant-1');

			expect(stored.get('log-1')).toMatchObject({ billRateValue: 40, payRateValue: 25, ratesStored: 1 });
			const [entity, options] = manager.find.mock.calls[0] as unknown as [unknown, any];
			expect(entity).toBe(TimeLog);
			expect(options.withDeleted).toBe(true);
			expect(options.where.tenantId).toBe('tenant-1');
		});

		it('reads a long list of logs in batches, under every driver parameter limit', async () => {
			const manager = { find: jest.fn(async () => []) };
			const timeLogIds = Array.from({ length: 1200 }, (_, index) => `log-${index}`);

			await findStoredRatesOf(manager as any, timeLogIds, 'tenant-1');

			expect(manager.find).toHaveBeenCalledTimes(3);
		});

		it('reads nothing for no log', async () => {
			const manager = { find: jest.fn() };

			expect((await findStoredRatesOf(manager as any, [], 'tenant-1')).size).toBe(0);
			expect(manager.find).not.toHaveBeenCalled();
		});
	});

	describe('storesRates', () => {
		it('reads the marker whichever way a driver returns a boolean', () => {
			expect([true, 1, '1', 'true'].map((ratesStored) => storesRates({ ratesStored } as any))).toEqual([
				true,
				true,
				true,
				true
			]);
			expect([false, 0, null, undefined].map((ratesStored) => storesRates({ ratesStored } as any))).toEqual([
				false,
				false,
				false,
				false
			]);
		});
	});

	describe('billingRateOfLog', () => {
		const employee = { billRateValue: 50, billRateCurrency: 'USD' as any };

		it('prices a log that stores its rates at its own rate, even an empty one', () => {
			expect(
				billingRateOfLog({ ratesStored: true, billRateValue: 40, billRateCurrency: 'EUR', employee })
			).toEqual({
				rate: 40,
				currency: 'EUR'
			});
			expect(
				billingRateOfLog({ ratesStored: true, billRateValue: null, billRateCurrency: null, employee })
			).toEqual({
				rate: null,
				currency: null
			});
		});

		it("prices a log recorded around the API at the member's current rate, as before", () => {
			expect(
				billingRateOfLog({ ratesStored: null, billRateValue: null, billRateCurrency: null, employee })
			).toEqual({
				rate: 50,
				currency: 'USD'
			});
		});
	});
});
