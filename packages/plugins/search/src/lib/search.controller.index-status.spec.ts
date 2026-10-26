/**
 * `GET /search/index-status` read the reindex service's report directly, past the search service's filter that the
 * GraphQL `searchIndexStatus` field goes through: a caller with SEARCH_VIEW was told the size and freshness of the
 * index of entities they may not view.
 */
jest.mock('@gauzy/core', () => ({
	FeatureFlagGuard: class FeatureFlagGuard {},
	PermissionGuard: class PermissionGuard {},
	Permissions: () => () => undefined,
	SearchIndexDefinition: class SearchIndexDefinition {},
	TenantPermissionGuard: class TenantPermissionGuard {},
	UUIDValidationPipe: class UUIDValidationPipe {},
	UseValidationPipe: () => () => undefined
}));
jest.mock('./services/search.service', () => ({ SearchService: class SearchService {} }));
jest.mock('./services/search-reindex.service', () => ({ SearchReindexService: class SearchReindexService {} }));
jest.mock('./services/search-index-definition.service', () => ({
	SearchIndexDefinitionService: class SearchIndexDefinitionService {}
}));
jest.mock('./dto', () => new Proxy({}, { get: () => class {} }));

import { SearchController } from './search.controller';

describe('GET /search/index-status', () => {
	it('reports through the search service, which keeps to the entities the caller may view', async () => {
		const searchService = { indexStatus: jest.fn(async () => [{ entity: 'product' }]) };
		const reindexService = { status: jest.fn(async () => [{ entity: 'product' }, { entity: 'invoice' }]) };
		const controller = new SearchController(searchService as any, reindexService as any, {} as any);

		const answer = await controller.indexStatus({ entities: ['product', 'invoice'] } as any);

		expect(searchService.indexStatus).toHaveBeenCalledWith(['product', 'invoice']);
		expect(reindexService.status).not.toHaveBeenCalled();
		expect(answer).toEqual({ items: [{ entity: 'product' }], total: 1 });
	});
});
