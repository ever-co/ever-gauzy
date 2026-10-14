/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `product.service.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { HttpStatus } from '@nestjs/common';
import { RequestContext } from '../core/context/request-context';
import { ApiErrorCode } from '../core/errors/api-error-codes';
import { ApiException } from '../core/errors/api-exception';
import { ProductService } from './product.service';
import { IBulkProductItem } from './product.bulk';

/**
 * The bulk item writes only what the item contract declares.
 *
 * The REST bulk route declares no body type, so an item can carry any key. The tenant and the
 * organization a row belongs to are the credential's, never the item's: an update must not move the
 * caller's product into another tenant or organization, and a create must not be filed under an
 * organization the caller is not acting in.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const OTHER_TENANT = '00000000-0000-4000-8000-0000000000ff';
const ORGANIZATION = '00000000-0000-4000-8000-000000000002';
const OTHER_ORGANIZATION = '00000000-0000-4000-8000-0000000000fe';
const PRODUCT = '00000000-0000-4000-8000-000000000010';

function harness() {
	const service = new ProductService({} as never, {} as never, {} as never);
	const stored = { id: PRODUCT, code: 'WIDGET-1', tenantId: TENANT, organizationId: ORGANIZATION };
	const repository = {
		save: jest.fn(async (row: unknown) => row),
		softRemove: jest.fn(async (row: unknown) => row)
	};
	const manager = { getRepository: jest.fn(() => repository) };

	jest.spyOn(service, 'findOneByIdString').mockResolvedValue({ ...stored } as never);
	jest.spyOn(service as never, 'assertNotForeignRow' as never).mockResolvedValue(undefined as never);
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);

	return { service, repository, manager };
}

afterEach(() => jest.restoreAllMocks());

describe('ProductService.applyBulkItem — an item writes only its declared members', () => {
	it('ignores tenant, organization and audit keys an update item was never offered', async () => {
		const { service, repository, manager } = harness();
		const item = {
			op: 'update',
			id: PRODUCT,
			code: 'WIDGET-2',
			tenantId: OTHER_TENANT,
			tenant: { id: OTHER_TENANT },
			organizationId: OTHER_ORGANIZATION,
			createdByUserId: 'someone-else',
			deletedAt: new Date(0)
		} as unknown as IBulkProductItem;

		await service.applyBulkItem(item, manager as never);

		const written = repository.save.mock.calls[0][0] as Record<string, unknown>;
		expect(written.code).toBe('WIDGET-2');
		expect(written.tenantId).toBe(TENANT);
		expect(written.organizationId).toBe(ORGANIZATION);
		expect(written).not.toHaveProperty('tenant');
		expect(written).not.toHaveProperty('createdByUserId');
		expect(written).not.toHaveProperty('deletedAt');
	});

	it('stamps the credential tenant and organization on a create and keeps a stated identifier', async () => {
		const { service, repository, manager } = harness();
		const item = {
			op: 'create',
			id: PRODUCT,
			code: 'WIDGET-3',
			enabled: true,
			tenantId: OTHER_TENANT,
			createdByUserId: 'someone-else'
		} as unknown as IBulkProductItem;

		await service.applyBulkItem(item, manager as never);

		const written = repository.save.mock.calls[0][0] as Record<string, unknown>;
		expect(written).toEqual(
			expect.objectContaining({
				id: PRODUCT,
				code: 'WIDGET-3',
				enabled: true,
				tenantId: TENANT,
				organizationId: ORGANIZATION
			})
		);
		expect(written).not.toHaveProperty('createdByUserId');
	});

	it('accepts a create that states the organization the request acts in', async () => {
		const { service, repository, manager } = harness();

		await service.applyBulkItem({ op: 'create', code: 'WIDGET-4', organizationId: ORGANIZATION }, manager as never);

		expect((repository.save.mock.calls[0][0] as Record<string, unknown>).organizationId).toBe(ORGANIZATION);
	});

	it('refuses a create that names another organization, writing nothing', async () => {
		const { service, repository, manager } = harness();

		const refusal = await service
			.applyBulkItem({ op: 'create', code: 'WIDGET-5', organizationId: OTHER_ORGANIZATION }, manager as never)
			.catch((thrown) => thrown);

		expect(refusal).toBeInstanceOf(ApiException);
		expect((refusal as ApiException).getStatus()).toBe(HttpStatus.FORBIDDEN);
		expect((refusal as ApiException).code).toBe(ApiErrorCode.ORGANIZATION_MISMATCH);
		expect(repository.save).not.toHaveBeenCalled();
	});
});
