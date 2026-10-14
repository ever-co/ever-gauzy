import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IIdempotencyKey, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { IdempotencyKeyView, IdempotencyService } from './idempotency.service';

/**
 * The fields a key list may be filtered and sorted by, and the order it is returned in when the caller
 * states none.
 *
 * This declaration is the resolver's half of the SDL: `IdempotencyKeyFilter` and
 * `IdempotencyKeySortField` are its two renderings, and keeping the three in one file is what makes a
 * member that is filterable in the schema but unknown to the evaluator — or the reverse — impossible
 * to introduce quietly.
 *
 * The filterable set is the columns an operator actually searches by, and it is deliberately wider
 * than what the REST list accepts: the connection protocol narrows rows the read has already been
 * handed, so offering `lockedAt` or `expiresAt` here costs a comparison rather than a query, while a
 * route parameter would cost a second evaluation path that could disagree with this one.
 * `deletedAt` is absent because a released key is removed rather than withdrawn, so there is no
 * withdrawn row for it to select.
 */
const IDEMPOTENCY_KEY_FILTERABLE = {
	id: 'ID',
	key: 'STRING',
	scope: 'STRING',
	requestHash: 'STRING',
	status: 'ENUM',
	responseStatus: 'NUMBER',
	resourceType: 'STRING',
	resourceId: 'ID',
	expiresAt: 'DATE',
	lockedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const IDEMPOTENCY_KEY_SORTABLE = ['createdAt', 'expiresAt', 'lockedAt', 'scope', 'status'] as const;

/**
 * The order the connection means when the caller states none.
 *
 * Newest first, which is the order the delivered list read answers in and the one an operator chasing
 * a stuck client reads: the rows that matter are the retries that just happened. The identifier makes
 * the order total, because two keys written in the same millisecond are otherwise equal to each other
 * — and a cursor names a row rather than a position among equals.
 */
const IDEMPOTENCY_KEY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The stored retry keys over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `IdempotencyService` method the `/api/idempotency-keys`
 * route behind it calls. Nothing here claims, settles or sweeps a key — a key is claimed by the
 * retry-safety interceptor on the request that presented it, and swept by the cleanup job.
 *
 * **The guard chain and the permission are the controller's.** The class carries what the controller
 * class carries — both protocol guards, and the read permission an operator's reads run under — and
 * every field then states the permission its own route states, so a field is never narrower or wider
 * than the route it mirrors. The two reads carry `IDEMPOTENCY_KEYS_VIEW` and the release carries
 * `IDEMPOTENCY_KEYS_DELETE`, which is the pair the permission catalogue declares for this resource.
 *
 * **The gate is the catalogue's, and it is declared once for every field.** `FeatureFlagGuard` is
 * appended to the chain above — after the controller's two, so a caller with no credential is refused
 * as a credential problem before a tenant's switches are consulted — and the code it reads is
 * `FEATURE_GRAPHQL`, the catalogue's own entry for "the GraphQL endpoint and its resolvers, under the
 * same guards and permissions as REST". The code is imported rather than restated here because the
 * value has to agree with the catalogue's `code` and nothing checks one string against another: a
 * literal that drifted names a code no catalogue row carries, which the guard resolves as disabled —
 * so every field below would answer `Cannot query field <name>` for every caller, with nothing red
 * anywhere. One statement on the class puts every field behind it, and its effect is the REST one in
 * this protocol's vocabulary: a tenant that switched the capability off is answered
 * `Cannot query field <name>`, the same refusal a disabled capability's routes answer with a 404.
 *
 * This resolver is declared by `IdempotencyModule`, beside the service it calls, so the GraphQL host
 * can scan that module for it — a resolver injects services, and a module is what reaches them.
 */
@Resolver('IdempotencyKey')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.IDEMPOTENCY_KEYS_VIEW)
export class IdempotencyKeyResolver {
	constructor(private readonly idempotencyService: IdempotencyService) {}

	/**
	 * The stored keys of the caller's tenant and organization, newest first.
	 */
	@Query('idempotencyKeys')
	@Permissions(PermissionsEnum.IDEMPOTENCY_KEYS_VIEW)
	async idempotencyKeys(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IdempotencyKeyView>> {
		// The read takes the narrowing the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter` and
		// applies it to the rows the service returns, so the read runs with the route's own defaults
		// rather than narrowing twice down two code paths that could come to disagree.
		const { items } = await this.idempotencyService.listKeys();

		return buildConnection<IdempotencyKeyView>({
			rows: items ?? [],
			filterable: IDEMPOTENCY_KEY_FILTERABLE,
			sortable: IDEMPOTENCY_KEY_SORTABLE,
			defaultSort: IDEMPOTENCY_KEY_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One stored key of the caller's tenant and organization.
	 *
	 * A key that is not there — or that belongs to another tenant, which the service's scope makes the
	 * same fact for this caller — answers `null` rather than a refusal, because GraphQL has one answer
	 * for "no such row" on a field that may have none, and the REST route's `404` is that same fact
	 * stated in the other protocol's vocabulary.
	 */
	@Query('idempotencyKey')
	@Permissions(PermissionsEnum.IDEMPOTENCY_KEYS_VIEW)
	async idempotencyKey(@Args('id', { type: () => ID }) id: Id): Promise<IIdempotencyKey | null> {
		try {
			return (await this.idempotencyService.findKeyOrFail(id)) as IIdempotencyKey;
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * Releases a key, so the next attempt under it is a true first attempt.
	 *
	 * The same service method the REST removal route calls, with the same argument and the same
	 * refusals reaching the caller unchanged: a key whose claim is still live is answered
	 * `IDEMPOTENCY_IN_PROGRESS`, and a key that is not there is answered `RESOURCE_NOT_FOUND`.
	 */
	@Mutation('releaseIdempotencyKey')
	@Permissions(PermissionsEnum.IDEMPOTENCY_KEYS_DELETE)
	async releaseIdempotencyKey(@Args('id', { type: () => ID }) id: Id): Promise<IIdempotencyKey> {
		return (await this.idempotencyService.release(id)) as IIdempotencyKey;
	}
}
