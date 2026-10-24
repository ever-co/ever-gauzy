/**
 * `grant` wrote the customer, order, subscription and catalogue ids of a right as the caller named them, on the
 * transaction's manager, past the platform's cross-tenant check. `customer` is a relation the right's reads load
 * without a tenant filter, so `POST /entitlements {"customerId":"<tenant B's contact>"}` and a read of the new right
 * returned tenant B's contact.
 */
const mockContext = { tenantId: 'tenant-a' as string | null };
// Function declarations, not constants: `jest.mock` factories are hoisted above every statement of the file
function mockClass() {
	return class {};
}
function mockModule() {
	return new Proxy({ __esModule: true }, { get: (module, name) => module[name] ?? mockClass() });
}
jest.mock('@gauzy/core', () => ({
	assertPlainReferencesNotForeign: jest.requireActual(
		'../../../../../core/src/lib/core/crud/plain-reference-ownership.helper'
	).assertPlainReferencesNotForeign,
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
	RequestContext: {
		currentTenantId: () => mockContext.tenantId,
		currentOrganizationId: () => 'organization-a'
	},
	TenantAwareCrudService: class {
		get ormType() {
			return 'typeorm';
		}
	}
}));
jest.mock('./entitlement.entity', mockModule);
jest.mock('../entitlement-activation/entitlement-activation.entity', mockModule);
jest.mock('../entitlement-key/entitlement-key.entity', mockModule);
jest.mock('../events/entitlement.events', mockModule);
jest.mock('../entitlement-conditions', mockModule);
jest.mock('../entitlement-counts', mockModule);
jest.mock('../entitlement-lock', mockModule);
jest.mock('../entitlement-persistence', mockModule);
jest.mock('../entitlement-activation/entitlement-activation.service', mockModule);
jest.mock('../entitlement-key/entitlement-key.service', mockModule);
jest.mock('./dto/entitlement.dto', mockModule);
jest.mock('./repository/mikro-orm-entitlement.repository', mockModule);
jest.mock('./repository/type-orm-entitlement.repository', mockModule);
jest.mock('../entitlement.writable', mockModule);

import { ForbiddenException } from '@nestjs/common';
import { EntitlementService } from './entitlement.service';

describe('EntitlementService.grant references', () => {
	// The tenant of each referenced row, by id, as the database would answer it
	const tenantOf: Record<string, string | null> = {
		'contact-a': 'tenant-a',
		'contact-b': 'tenant-b',
		'order-b': 'tenant-b',
		'line-b': 'tenant-b',
		'subscription-b': 'tenant-b',
		'product-b': 'tenant-b',
		'variant-b': 'tenant-b',
		'variant-shared': null
	};
	const manager = {
		connection: {
			hasMetadata: () => true,
			getMetadata: (table: string) => ({
				target: table,
				primaryColumns: [{ propertyName: 'id' }],
				hasColumnWithPropertyPath: (path: string) => path === 'tenantId'
			})
		},
		createQueryBuilder: () => {
			let ids: string[] = [];
			const builder: any = {
				withDeleted: () => builder,
				select: () => builder,
				where: (_: string, parameters: { ids: string[] }) => ((ids = parameters.ids), builder),
				getRawMany: async () => ids.filter((id) => id in tenantOf).map((id) => ({ tenantId: tenantOf[id] }))
			};
			return builder;
		}
	};
	let service: EntitlementService;
	let findExistingGrant: jest.SpyInstance;

	beforeEach(() => {
		mockContext.tenantId = 'tenant-a';
		service = new EntitlementService(
			{ manager } as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			{} as any
		);
		// The grant goes on to its idempotency lookup only past the check; answering there keeps the test off the write
		findExistingGrant = jest
			.spyOn(service as any, 'findExistingGrant')
			.mockResolvedValue({ id: 'entitlement-1' } as any);
	});

	it.each([
		['customerId', 'contact-b'],
		['orderId', 'order-b'],
		['orderLineId', 'line-b'],
		['subscriptionId', 'subscription-b'],
		['productId', 'product-b'],
		['variantId', 'variant-b']
	])('refuses %s of another tenant before anything is looked up or written', async (column, id) => {
		await expect(service.grant({ number: 'X1', [column]: id } as any)).rejects.toThrow(ForbiddenException);
		expect(findExistingGrant).not.toHaveBeenCalled();
	});

	it('grants to a customer of the caller’s tenant, and with a row of no tenant', async () => {
		await expect(
			service.grant({ number: 'X1', customerId: 'contact-a', variantId: 'variant-shared' } as any)
		).resolves.toEqual({ entitlement: { id: 'entitlement-1' }, created: false });
	});

	it('holds a replayed order event to the tenant it names', async () => {
		mockContext.tenantId = null;

		await expect(
			service.grant({ number: 'X1', customerId: 'contact-b' } as any, { tenantId: 'tenant-b' } as any)
		).resolves.toEqual(expect.objectContaining({ created: false }));
		await expect(
			service.grant({ number: 'X1', customerId: 'contact-a' } as any, { tenantId: 'tenant-b' } as any)
		).rejects.toThrow(ForbiddenException);
	});
});
