// `@gauzy/core` and the entities drag in the whole graph; the service only needs the request's tenant.
const mockContext = { tenantId: 'tenant-a' as string | null };
jest.mock('@gauzy/core', () => ({
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
	parseFindOptionsRelations: (relations: string[]) => relations,
	RequestContext: { currentTenantId: () => mockContext.tenantId }
}));
jest.mock('./registry-crud.service', () => ({
	RegistryTenantAwareCrudService: class {
		get ormType() {
			return 'typeorm';
		}
	}
}));
jest.mock('../entities/plugin-billing.entity', () => ({ PluginBilling: class PluginBilling {} }));
jest.mock('../repositories', () => ({}));

import { PluginBillingService } from './plugin-billing.service';

/**
 * `GET /plugins/:pluginId/subscriptions/:subscriptionId/billings` (with or without `?status=`) and `.../summary` read
 * through the repository, past the base service's tenant scope, filtered by the subscription id of the path alone: a
 * subscription id of another tenant read that tenant's billing records and totals.
 */
describe('PluginBillingService tenant scope', () => {
	let where: Array<[string, Record<string, unknown>?]>;
	let find: jest.Mock;
	let service: PluginBillingService;

	beforeEach(() => {
		mockContext.tenantId = 'tenant-a';
		where = [];
		const queryBuilder: any = {
			leftJoinAndSelect: () => queryBuilder,
			where: (clause: string, params?: Record<string, unknown>) => (where.push([clause, params]), queryBuilder),
			andWhere: (clause: string, params?: Record<string, unknown>) => (where.push([clause, params]), queryBuilder),
			orderBy: () => queryBuilder,
			getMany: async () => []
		};
		find = jest.fn(async () => []);
		service = new PluginBillingService({ createQueryBuilder: () => queryBuilder, find } as any, {} as any);
	});

	it('lists the billings of a subscription in the caller’s tenant only', async () => {
		await service.findBillings({ subscriptionId: 'subscription-b' } as any);

		expect(where).toContainEqual(['billing.tenantId = :tenantId', { tenantId: 'tenant-a' }]);
		expect(where).toContainEqual(['billing.subscriptionId = :subscriptionId', { subscriptionId: 'subscription-b' }]);
	});

	it('sums the billings of a subscription in the caller’s tenant only', async () => {
		await service.getBillingSummary('subscription-b');

		expect(find).toHaveBeenCalledWith(
			expect.objectContaining({ where: { subscriptionId: 'subscription-b', tenantId: 'tenant-a' } })
		);
	});

	it('lists the overdue billings of the caller’s tenant only', async () => {
		await service.getOverdueBillings();

		expect(find.mock.calls[0][0].where).toMatchObject({ tenantId: 'tenant-a' });
	});

	it('reads nothing without a tenant', async () => {
		mockContext.tenantId = null;

		await expect(service.findBillings({ subscriptionId: 'subscription-b' } as any)).resolves.toEqual([]);
		await expect(service.getOverdueBillings()).resolves.toEqual([]);
		await expect(service.getBillingSummary('subscription-b')).resolves.toMatchObject({ totalBillings: 0 });
		expect(where).toEqual([]);
		expect(find).not.toHaveBeenCalled();
	});
});
