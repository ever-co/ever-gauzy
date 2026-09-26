import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { IPagination, PermissionsEnum } from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../../api/graphql-connection';
import { Permissions } from '../../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../../shared/guards';
import { FEATURE_GRAPHQL } from '../../feature/graphql-feature.code';
import { ImportHistory } from './import-history.entity';
import { ImportHistoryService } from './import-history.service';

/**
 * The fields a ledger list may be filtered and sorted by, and the order it is returned in when the caller
 * states none.
 *
 * This declaration is the resolver's half of the SDL: `ImportHistoryFilter` and `ImportHistorySortField`
 * are its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `path` is in neither. It is the storage key of the uploaded archive, and the entity excludes it from
 * every plain serialisation; a filter is a comparison against the row's own value, so a condition on it
 * would answer a question about the delivered projection's withheld key, one character at a time.
 * `fullUrl` is in neither either: it is not stored, it is resolved from that key as the row is loaded,
 * so the delivered read has no criterion of its own for it.
 */
const IMPORT_HISTORY_FILTERABLE = {
	id: 'ID',
	file: 'STRING',
	size: 'NUMBER',
	status: 'STRING',
	importDate: 'DATE',
	tenantId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const IMPORT_HISTORY_SORTABLE = ['importDate', 'createdAt', 'updatedAt', 'file', 'size', 'status'] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * This is a place where the connection *reproduces* the delivered read rather than deciding for it: the
 * service orders the ledger by the import date, descending, so a client that states no sort is answered
 * in the order the REST route would have answered it. The identifier is added after it because that order
 * is not total — two entries recorded in the same instant have no order between them — and a cursor walk
 * needs one.
 */
const IMPORT_HISTORY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'importDate', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The import ledger over GraphQL.
 *
 * REST and GraphQL are two views of the same operation, so this resolver owns no business logic of its
 * own: the field below calls the same `ImportHistoryService.findAll` method the `GET /api/import/history`
 * route calls, and the ledger it answers is the same ledger.
 *
 * **The guard chain and the permissions are the controller's.** The class carries what the controller
 * class carries — both guards and both class-level permissions — and the field states the same pair,
 * because the controller states nothing on its handler. That pair is the delivered scope rather than one
 * grant stated twice: reading the ledger is granted to whoever may read the organization and to whoever
 * may import into it.
 *
 * **The ledger is written by the import and never by a caller.** No creation, edit or removal is
 * declared, because the controller serves none: an entry is recorded by the import path itself, through
 * its own command, and a write here would let a caller rewrite the record of what was imported. The
 * import route's own answer is this row — see the import domain's documents, which declare the ledger
 * here rather than there.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so the field below is behind the one capability.
 * `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the class, which
 * is why the gate is stated on the class rather than restated on the field — and why it is appended to
 * the guard chain the route below already carries rather than replacing any part of it.
 */
@Resolver('ImportHistory')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.IMPORT_ADD)
export class ImportHistoryResolver {
	constructor(private readonly importHistoryService: ImportHistoryService) {}

	/**
	 * The import ledger of the caller's tenant, in the ledger's own order.
	 */
	@Query('importHistories')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.IMPORT_ADD)
	async importHistories(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<ImportHistory>> {
		// The read is the one the delivered list route performs, through the same service method — which
		// takes no argument at all: the ledger is scoped to the caller's tenant by the service, and the
		// order is the service's own. This surface has no query string to bind, so the connection protocol
		// states the narrowing in `filter`, which is applied to the rows the service returned.
		const { items }: IPagination<ImportHistory> = await this.importHistoryService.findAll();

		return buildConnection<ImportHistory>({
			rows: items ?? [],
			filterable: IMPORT_HISTORY_FILTERABLE,
			sortable: IMPORT_HISTORY_SORTABLE,
			defaultSort: IMPORT_HISTORY_DEFAULT_SORT,
			request: { filter, sort, page, first, last, after, before, limit, offset }
		});
	}
}
