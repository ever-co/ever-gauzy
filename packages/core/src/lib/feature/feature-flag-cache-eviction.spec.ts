/**
 * A cached flag is an answer nothing used to take back.
 *
 * `FeatureFlagGuard` caches the resolved value of a flag per tenant and organization, so the read that
 * decides whether a route answers or refuses does not reach the rows an administrator just wrote. A
 * toggle that is stored and never evicted is a toggle the API keeps ignoring until the entry expires,
 * which is the defect these cases pin down: the write has to clear the entries its own write made wrong,
 * and it has to clear exactly those.
 *
 * Both halves of the pair are asserted against each other. An eviction built from a key shape of its own
 * would delete keys no resolution ever wrote, and from the outside that is indistinguishable from an
 * eviction that works — so the cases below build the key through the same builder the guard reads
 * through, and separately assert that the guard's request-scoped key equals the explicitly scoped one.
 */
jest.mock('uuid', () => {
	let counter = 0;
	return { v4: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}` };
});

/**
 * Loaded first, as `feature-flag-resolution.spec.ts` does: the subscriber reaches `core/file-storage`,
 * whose module graph re-enters the entity graph, and entering it from there leaves a decorator
 * mid-initialised.
 */
import '../core/entities/internal';

import { FeatureEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { featureFlagCacheKey, featureFlagCacheKeyFor, evictFeatureFlagEntries } from '../shared/guards/feature-flag.guard';
import { FeatureOrganizationService } from './feature-organization.service';

const TENANT = 'tenant-uuid-1';
const ORGANIZATION = 'organization-uuid-1';
const OTHER_ORGANIZATION = 'organization-uuid-2';
const FEATURE_ID = 'feature-uuid-warehouse';

const WAREHOUSE = 'FEATURE_WAREHOUSE' as unknown as FeatureEnum;

/** A `feature_organization` row as the repository double holds it. */
interface IToggleRow {
	id: string;
	tenantId: string;
	organizationId: string | null;
	featureId: string;
	isEnabled: boolean;
}

/** A row per organization, plus the tenant-wide row, all for the one catalogue entry. */
const rowsFor = (organizationIds: Array<string | null>): IToggleRow[] =>
	organizationIds.map((organizationId, index) => ({
		id: `toggle-${index}`,
		tenantId: TENANT,
		organizationId,
		featureId: FEATURE_ID,
		isEnabled: true
	}));

/** The cache the guard reads through, over a real map, as the installation's store is. */
const createCache = () => {
	const entries = new Map<string, unknown>();
	const del = jest.fn(async (key: string) => {
		entries.delete(key);
		return true;
	});
	return {
		entries,
		del,
		get: jest.fn(async (key: string) => entries.get(key) ?? null),
		set: jest.fn(async (key: string, value: unknown) => {
			entries.set(key, value);
			return true;
		})
	};
};

/**
 * The service under test.
 *
 * The repositories answer the two reads the write path makes — the toggle rows it is about to rewrite,
 * and the catalogue row whose code the guard caches under — and nothing else, so a resolution this
 * double cannot answer fails loudly instead of answering with the whole table.
 */
const createService = (rows: IToggleRow[], cache: ReturnType<typeof createCache>) => {
	const matches = (options: { where?: { organizationId?: string } } = {}) =>
		rows.filter(
			(row) =>
				row.tenantId === TENANT &&
				row.featureId === FEATURE_ID &&
				(options?.where?.organizationId === undefined || row.organizationId === options.where.organizationId)
		);
	const toggleRepository = {
		// the write path reads through `findAndCount`, which is what the base class calls
		findAndCount: jest.fn(async (options: { where?: { organizationId?: string } } = {}) => {
			const items = matches(options);
			return [items, items.length];
		}),
		find: jest.fn(async (options: { where?: { organizationId?: string } } = {}) => matches(options))
	};
	const featureService = {
		findOneByIdString: jest.fn(async (id: string) =>
			id === FEATURE_ID ? { id: FEATURE_ID, code: 'FEATURE_WAREHOUSE' } : null
		)
	};

	const service = new FeatureOrganizationService(
		toggleRepository as any,
		{ ...toggleRepository } as any,
		featureService as any,
		cache as any
	);

	// the write itself is not what these cases are about
	jest.spyOn(service, 'save').mockResolvedValue(undefined as any);
	jest.spyOn(service, 'saveMany').mockResolvedValue(undefined as any);

	return { service, cache, featureService };
};

/** Puts the caller inside a tenant, and inside one of its organizations when one is named. */
const actingIn = (tenantId: string, organizationId: string | null = null) => {
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(tenantId);
	jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(organizationId);
};

afterEach(() => jest.restoreAllMocks());

describe('the key the guard reads through and the key an eviction writes', () => {
	it('are the same key for the same scope', () => {
		actingIn(TENANT, null);

		expect(featureFlagCacheKey(WAREHOUSE)).toBe(featureFlagCacheKeyFor(WAREHOUSE, TENANT, null));
	});

	it('are the same key for the same organization scope', () => {
		actingIn(TENANT, ORGANIZATION);

		expect(featureFlagCacheKey(WAREHOUSE)).toBe(featureFlagCacheKeyFor(WAREHOUSE, TENANT, ORGANIZATION));
	});

	it('separate one organization from another, and from the tenant-wide answer', () => {
		const keys = [
			featureFlagCacheKeyFor(WAREHOUSE, TENANT, ORGANIZATION),
			featureFlagCacheKeyFor(WAREHOUSE, TENANT, OTHER_ORGANIZATION),
			featureFlagCacheKeyFor(WAREHOUSE, TENANT, null)
		];

		expect(new Set(keys).size).toBe(3);
	});
});

describe('evictFeatureFlagEntries', () => {
	it('removes one entry per scope it is given, and no more', async () => {
		const cache = createCache();
		const kept = featureFlagCacheKeyFor(WAREHOUSE, TENANT, OTHER_ORGANIZATION);

		await cache.set(featureFlagCacheKeyFor(WAREHOUSE, TENANT, null), true);
		await cache.set(featureFlagCacheKeyFor(WAREHOUSE, TENANT, ORGANIZATION), true);
		await cache.set(kept, true);

		const removed = await evictFeatureFlagEntries(cache as any, WAREHOUSE, TENANT, [null, ORGANIZATION]);

		expect(removed).toBe(2);
		expect(await cache.get(featureFlagCacheKeyFor(WAREHOUSE, TENANT, null))).toBeNull();
		expect(await cache.get(featureFlagCacheKeyFor(WAREHOUSE, TENANT, ORGANIZATION))).toBeNull();
		// an organization whose row this write did not touch keeps its answer
		expect(await cache.get(kept)).toBe(true);
	});

	it('clears an entry once when a scope is named twice', async () => {
		const cache = createCache();

		const removed = await evictFeatureFlagEntries(cache as any, WAREHOUSE, TENANT, [ORGANIZATION, ORGANIZATION]);

		expect(removed).toBe(1);
		expect(cache.del).toHaveBeenCalledTimes(1);
	});
});

describe('FeatureOrganizationService.updateFeatureOrganization', () => {
	it('clears the tenant-wide entry and every organization row a tenant-wide toggle rewrote', async () => {
		actingIn(TENANT, OTHER_ORGANIZATION);
		const cache = createCache();
		const { service } = createService(rowsFor([null, ORGANIZATION, OTHER_ORGANIZATION]), cache);

		const written = await service.updateFeatureOrganization({ featureId: FEATURE_ID, isEnabled: false } as any);

		expect(written).toBe(true);
		const removed = cache.del.mock.calls.map(([key]) => key as string);
		expect(removed).toContain(featureFlagCacheKeyFor(WAREHOUSE, TENANT, null));
		expect(removed).toContain(featureFlagCacheKeyFor(WAREHOUSE, TENANT, ORGANIZATION));
		expect(removed).toContain(featureFlagCacheKeyFor(WAREHOUSE, TENANT, OTHER_ORGANIZATION));
	});

	it('clears only the organization row an organization-scoped toggle rewrote', async () => {
		actingIn(TENANT, ORGANIZATION);
		const cache = createCache();
		const { service } = createService(rowsFor([null, ORGANIZATION]), cache);

		const written = await service.updateFeatureOrganization({
			featureId: FEATURE_ID,
			organizationId: ORGANIZATION,
			isEnabled: false
		} as any);

		expect(written).toBe(true);
		const removed = cache.del.mock.calls.map(([key]) => key as string);
		expect(removed).toEqual([featureFlagCacheKeyFor(WAREHOUSE, TENANT, ORGANIZATION)]);
	});

	it('clears the scope a newly created organization row belongs to', async () => {
		actingIn(TENANT, null);
		const cache = createCache();
		const { service } = createService([], cache);

		const written = await service.updateFeatureOrganization({
			featureId: FEATURE_ID,
			organizationId: ORGANIZATION,
			isEnabled: true
		} as any);

		expect(written).toBe(true);
		const removed = cache.del.mock.calls.map(([key]) => key as string);
		expect(removed).toEqual([featureFlagCacheKeyFor(WAREHOUSE, TENANT, ORGANIZATION)]);
	});

	it('reports the toggle as written when the cache cannot be reached', async () => {
		actingIn(TENANT, null);
		const cache = createCache();
		cache.del.mockRejectedValue(new Error('the cache is unreachable'));
		const { service } = createService(rowsFor([null]), cache);

		// the rows are committed; a cache that cannot be reached costs a slower answer, not a lost write
		await expect(
			service.updateFeatureOrganization({ featureId: FEATURE_ID, isEnabled: false } as any)
		).resolves.toBe(true);
	});

	it('reports the toggle as written when the catalogue entry cannot be read', async () => {
		actingIn(TENANT, null);
		const cache = createCache();
		const { service, featureService } = createService(rowsFor([null]), cache);
		featureService.findOneByIdString.mockRejectedValue(new Error('the catalogue is unreachable'));

		await expect(
			service.updateFeatureOrganization({ featureId: FEATURE_ID, isEnabled: false } as any)
		).resolves.toBe(true);
		expect(cache.del).not.toHaveBeenCalled();
	});
});
