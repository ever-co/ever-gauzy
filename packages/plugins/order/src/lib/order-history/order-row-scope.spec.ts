/**
 * `@gauzy/core` is doubled at the module boundary: its barrel boots the whole application graph, and
 * the two things this file needs from it — whether a request is behind the write, and the name of each
 * ORM — are exactly the switches a test has to be able to throw.
 */
jest.mock('@gauzy/core', () => ({
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
	RequestContext: { currentTenantId: jest.fn(() => null) },
	// Marks what it serialised, so a case can tell the plain row from the managed entity.
	wrapSerialize: jest.fn((entity: Record<string, unknown>) => ({ ...entity, serialized: true }))
}));

import { RequestContext } from '@gauzy/core';
import { createUnderOrderScope, orderScopeColumns, scopeOfOrderRow } from './order-row-scope';

/**
 * A service a row about an order is written through, and the two repositories it was built with.
 *
 * @param ormType The ORM the service reads and writes through.
 */
function writerDouble(ormType: 'typeorm' | 'mikro-orm') {
	const writer = {
		ormType,
		create: jest.fn(async (entity: any) => ({ id: 'via-service', ...entity }))
	};
	const typeOrm = {
		create: jest.fn((entity: any) => ({ ...entity })),
		save: jest.fn(async (entity: any) => ({ id: 'via-typeorm', ...entity }))
	};
	const mikroOrm = {
		create: jest.fn((entity: any, _options?: unknown) => ({ ...entity })),
		persistAndFlush: jest.fn(async () => undefined)
	};

	return { writer, repositories: { typeOrm: typeOrm as never, mikroOrm: mikroOrm as never }, typeOrm, mikroOrm };
}

/** The row every case writes: one entry about order `order-1`, naming its order the way both ORMs write. */
const entry = { order: { id: 'order-1' }, orderId: 'order-1', action: 'CHANGE_CANCELED' };
const tenancy = { tenantId: 'tenant-1', organizationId: 'org-1' };

/**
 * A row written about an order belongs to the order's tenant and organization.
 *
 * The order's summary rows and timeline entries are written from a request and from the worker's
 * scheduled passes alike. On a request the tenant-aware create stamps the caller's tenant; with no
 * request it stamped **no** tenant — the create reads the tenant from the request context and overwrites
 * whatever the payload said — so the repair of a drifted order and the cancellation of a stale change
 * were written where the tenant whose order it was could never read them. The cases below pin both
 * positions, and the MikroORM write that has no scalar tenant column to fall back on.
 */
describe('createUnderOrderScope — the order’s tenancy on every row written about it', () => {
	afterEach(() => {
		(RequestContext.currentTenantId as jest.Mock).mockReturnValue(null);
	});

	it('keeps the tenant-aware create as the authority on a request, with the order’s organization', async () => {
		(RequestContext.currentTenantId as jest.Mock).mockReturnValue('tenant-1');

		const { writer, repositories, typeOrm, mikroOrm } = writerDouble('typeorm');

		await createUnderOrderScope(writer as never, repositories, entry, tenancy);

		expect(writer.create).toHaveBeenCalledWith({
			...entry,
			tenant: { id: 'tenant-1' },
			tenantId: 'tenant-1',
			organization: { id: 'org-1' },
			organizationId: 'org-1'
		});
		expect(typeOrm.save).not.toHaveBeenCalled();
		expect(mikroOrm.persistAndFlush).not.toHaveBeenCalled();
	});

	it('writes the order’s tenancy through the TypeORM repository when no request is behind the write', async () => {
		const { writer, repositories, typeOrm } = writerDouble('typeorm');

		const written = await createUnderOrderScope(writer as never, repositories, entry, tenancy);

		// The control: the tenant-aware create is not asked, because with no request it would overwrite
		// the tenant with the caller's — which is nobody's.
		expect(writer.create).not.toHaveBeenCalled();
		expect(typeOrm.save).toHaveBeenCalledTimes(1);
		expect(written).toMatchObject({ ...entry, ...tenancy, id: 'via-typeorm' });
	});

	it('writes the relation references under MikroORM, where the scalar tenancy columns are not persisted', async () => {
		const { writer, repositories, typeOrm, mikroOrm } = writerDouble('mikro-orm');

		const written = await createUnderOrderScope(writer as never, repositories, entry, tenancy);

		// `tenantId` and `organizationId` are relation ids on this ORM (`persist: false`), so only the
		// relation references reach the statement — a payload that stated the scalars alone would insert
		// the row with both columns empty.
		expect(mikroOrm.create).toHaveBeenCalledWith(
			expect.objectContaining({
				tenant: { id: 'tenant-1' },
				organization: { id: 'org-1' },
				order: { id: 'order-1' }
			}),
			{ partial: true, managed: true }
		);
		expect(mikroOrm.persistAndFlush).toHaveBeenCalledTimes(1);
		expect(writer.create).not.toHaveBeenCalled();
		expect(typeOrm.save).not.toHaveBeenCalled();
		// The caller is answered with the plain row the CRUD layer's own create answers on this ORM.
		expect(written).toMatchObject({ ...entry, ...tenancy, serialized: true });
	});

	it('leaves a caller that states no tenancy to the tenant-aware create, as before', async () => {
		const { writer, repositories, typeOrm } = writerDouble('typeorm');

		await createUnderOrderScope(writer as never, repositories, entry, undefined);

		expect(writer.create).toHaveBeenCalledWith(entry);
		expect(typeOrm.save).not.toHaveBeenCalled();
	});
});

describe('scopeOfOrderRow and orderScopeColumns — the tenancy a row states', () => {
	it('keeps only the members the row carries, so a spread never erases a value', () => {
		expect(scopeOfOrderRow({ tenantId: 'tenant-1', organizationId: null })).toEqual({ tenantId: 'tenant-1' });
		expect(scopeOfOrderRow(undefined)).toEqual({});
		expect({ ...tenancy, ...scopeOfOrderRow({}) }).toEqual(tenancy);
	});

	it('states each column beside the relation it is the key of', () => {
		expect(orderScopeColumns(tenancy)).toEqual({
			tenant: { id: 'tenant-1' },
			tenantId: 'tenant-1',
			organization: { id: 'org-1' },
			organizationId: 'org-1'
		});
		expect(orderScopeColumns(null)).toEqual({});
	});
});
