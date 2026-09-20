/**
 * The module boundaries are doubled for the reason this package's service specs state: `@gauzy/core`
 * boots the whole application graph from its barrel and `@gauzy/config` reads the environment at import
 * time, neither of which a resolver needs.
 *
 * The three guard classes and the `Permissions` decorator are the real production *shapes* — the
 * assertions below read the same metadata key `PermissionGuard` reads and compare against the same
 * guard classes `@UseGuards` was given — so a guard dropped from the chain, or reordered, fails here
 * rather than at the first request that reaches the endpoint.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

	class BaseEntity {}

	return {
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantAwareCrudService: class TenantAwareCrudService {},
		RolePermissionModule: class RolePermissionModule {},
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		FeatureFlagGuard: class FeatureFlagGuard {},
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		SearchDocument: class SearchDocument {},
		SearchIndexDefinition: class SearchIndexDefinition {}
	};
});

jest.mock('@gauzy/config', () => ({
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

// The collaborators the resolvers inject, doubled so nothing below them is loaded: the assertions are
// about the declarations on the classes, not about what the fields return.
jest.mock('../../services/search.service', () => ({
	SearchService: class SearchService {},
	decodeCursor: () => null
}));
jest.mock('../../services/search-index-definition.service', () => ({
	SearchIndexDefinitionService: class SearchIndexDefinitionService {}
}));
jest.mock('../../services/search-reindex.service', () => ({
	SearchReindexService: class SearchReindexService {}
}));

import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '@gauzy/core';
import { SearchPermissions } from '../../search.permissions';
import { SearchIndexDefinitionResolver } from './search-index-definition.resolver';
import { SearchResolver } from './search.resolver';

/**
 * The search domain's GraphQL authorisation, which was weaker than its own REST surface.
 *
 * `SearchController` carries `@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)`.
 * Both resolvers carried only `PermissionGuard` and `FeatureFlagGuard`, so an operation that stated a
 * `Tenant-Id` header naming a tenant other than the one its credential was issued for was never
 * compared against it — `TenantBaseGuard.canActivateGraphqlOperation` is what performs that comparison,
 * and it only runs if it is in the chain. The permission declarations below were already correct; what
 * was missing was the guard that has to run before them.
 *
 * The chain is asserted *whole and in order*, rather than by membership, on both classes: a guard
 * dropped while another was added would still satisfy a membership assertion, and the order is
 * deliberate — a caller that states the wrong tenant is refused as a tenancy problem before its grants
 * are consulted, and the feature gate runs last so a caller with no credential is refused as a
 * credential problem before a tenant's switches are read.
 */
describe('the search resolvers — the guard chain their controller carries (17 §6)', () => {
	it.each([
		['SearchResolver', SearchResolver],
		['SearchIndexDefinitionResolver', SearchIndexDefinitionResolver]
	])('%s carries the tenant guard, the permission guard and the feature gate, in that order', (_name, surface) => {
		expect(Reflect.getMetadata('__guards__', surface) ?? []).toEqual([
			TenantPermissionGuard,
			PermissionGuard,
			FeatureFlagGuard
		]);
	});

	it('states the read grant on every query field of both resolvers', () => {
		const reads: Array<[object, string, string]> = [
			[SearchResolver.prototype, 'search', SearchPermissions.SEARCH_VIEW],
			[SearchResolver.prototype, 'searchSuggest', SearchPermissions.SEARCH_VIEW],
			[SearchResolver.prototype, 'searchFacets', SearchPermissions.SEARCH_VIEW],
			[SearchResolver.prototype, 'searchIndexStatus', SearchPermissions.SEARCH_VIEW],
			[SearchIndexDefinitionResolver.prototype, 'searchIndexDefinitions', SearchPermissions.SEARCH_INDEX_DEFINITIONS_VIEW],
			[SearchIndexDefinitionResolver.prototype, 'searchIndexDefinition', SearchPermissions.SEARCH_INDEX_DEFINITIONS_VIEW]
		];

		for (const [prototype, handler, permission] of reads) {
			expect(Reflect.getMetadata(PERMISSIONS_METADATA, (prototype as never)[handler])).toEqual([permission]);
		}
	});

	it('keeps the operator grants separate from the reader grant', () => {
		// The control that matters: an operator who may read a declaration must not thereby be able to
		// rebuild an index or re-weight one, so the three writes below are asserted against the grants
		// they are *not* — a resolver that had copied `SEARCH_VIEW` onto them would fail here, and one
		// that had copied `SEARCH_REINDEX` onto the definition edits would too.
		const writes: Array<[string, string]> = [
			['updateSearchIndexDefinition', SearchPermissions.SEARCH_INDEX_DEFINITIONS_EDIT],
			['deleteSearchIndexDefinition', SearchPermissions.SEARCH_INDEX_DEFINITIONS_EDIT],
			['reindexEntity', SearchPermissions.SEARCH_REINDEX],
			['reindexAll', SearchPermissions.SEARCH_REINDEX],
			['dropSearchIndex', SearchPermissions.SEARCH_REINDEX]
		];

		for (const [handler, permission] of writes) {
			expect(
				Reflect.getMetadata(PERMISSIONS_METADATA, (SearchIndexDefinitionResolver.prototype as never)[handler])
			).toEqual([permission]);
		}
	});
});
