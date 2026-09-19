import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, IPagination, PermissionsEnum } from '@gauzy/contracts';
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
import { OAuthClientService } from './oauth-client.service';
import {
	CreateOAuthClientDTO,
	OAuthClientResponseDTO,
	OAuthClientWithSecretResponseDTO,
	UpdateOAuthClientDTO
} from './dto';

/** The members `CreateOAuthClientInput` declares in the schema. */
export interface ICreateOAuthClientInput {
	name: string;
	description?: string | null;
	clientType?: string;
	redirectUris: string[];
	allowedScopes?: string[];
	allowedGrantTypes?: string[];
	pkceRequired?: boolean;
	accessTokenTtl?: number;
	refreshTokenTtl?: number;
}

/** The members `UpdateOAuthClientInput` declares in the schema. */
export interface IUpdateOAuthClientInput {
	id: Id;
	name?: string;
	description?: string | null;
	redirectUris?: string[];
	allowedScopes?: string[];
	allowedGrantTypes?: string[];
	pkceRequired?: boolean;
	accessTokenTtl?: number;
	refreshTokenTtl?: number;
	isActive?: boolean;
}

/**
 * The fields a registry list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OAuthClientFilter` and `OAuthClientSortField`
 * are its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * The three secret columns are in neither. A filter is a comparison against the row's own value, so a
 * condition on `clientSecretHash` would answer whether a guessed secret hashes to the stored one, one
 * character at a time; and a sort on a column the projection withholds is a second way to read it. The
 * three document columns are in neither either: the one operator the protocol offers on a document is a
 * substring match against its text form, so a condition on a redirect URI would answer a match on part
 * of a longer URL rather than on the URI a caller meant.
 *
 * `deletedAt` is absent because the delivered list read answers live rows only, so the column is absent
 * on every row this connection holds.
 */
const OAUTH_CLIENT_FILTERABLE = {
	id: 'ID',
	clientId: 'STRING',
	name: 'STRING',
	description: 'STRING',
	clientType: 'STRING',
	pkceRequired: 'BOOLEAN',
	accessTokenTtl: 'NUMBER',
	refreshTokenTtl: 'NUMBER',
	isActive: 'BOOLEAN',
	tenantId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const OAUTH_CLIENT_SORTABLE = [
	'createdAt',
	'updatedAt',
	'name',
	'clientId',
	'clientType',
	'accessTokenTtl',
	'refreshTokenTtl'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list read applies no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: newest registration first, because the row an administrator is looking for after
 * registering or rotating a client is the one that just changed, then the identifier, which is the key
 * that makes the order total and a cursor walk over it stable.
 */
const OAUTH_CLIENT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The OAuth client registry over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `OAuthClientService` method the `/api/oauth/clients` route
 * behind it calls, with the same payload and the same request facts.
 *
 * **The guard chain is the controller's, and the permission is each route's own.** The class carries
 * what the controller class carries — both guards — and states no permission, because the controller
 * states none on the class; every field then states the permission its own route runs under, so a field
 * is never narrower or wider than the route it mirrors.
 *
 * **The projection is the delivered one.** Every read answers the response DTO the routes answer, which
 * is what keeps the secret hash and the code-signing secret out of this surface: the entity marks both
 * `select: false` and the DTO strips them, and a resolver that reached past the DTO would be answering
 * members the delivered projection withholds. The plaintext secret is answered by the two operations
 * that generate one — the registration and the rotation — and by nothing else.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('OAuthClient')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class OAuthClientResolver {
	constructor(private readonly oauthClientService: OAuthClientService) {}

	/**
	 * The clients the caller's credential may see.
	 */
	@Query('oauthClients')
	@Permissions(PermissionsEnum.OAUTH_CLIENT_VIEW)
	async oauthClients(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<OAuthClientResponseDTO>> {
		// The same read the list route performs, through the same service method, with the options a
		// request that states no page carries: the route hands its `skip`/`take` to the store as a page
		// size, and this surface applies its own page to the whole filtered set instead — which is what
		// makes the connection's `totalCount` the count of what the filters selected rather than the
		// count of one page. Which rows are visible at all is the service's decision, taken from the
		// credential: a super administrator sees the installation-wide clients beside its tenant's.
		const { items }: IPagination<OAuthClientResponseDTO> = await this.oauthClientService.listForCurrentTenant();

		return buildConnection<OAuthClientResponseDTO>({
			rows: items ?? [],
			filterable: OAUTH_CLIENT_FILTERABLE,
			sortable: OAUTH_CLIENT_SORTABLE,
			defaultSort: OAUTH_CLIENT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One client, or null when there is none the caller may see.
	 *
	 * The read is the one the delivered node route performs, through the same service method, so the
	 * scoping rule is the service's: a regular administrator reaches its own tenant's rows, and a super
	 * administrator reaches those and the installation-wide ones.
	 */
	@Query('oauthClient')
	@Permissions(PermissionsEnum.OAUTH_CLIENT_VIEW)
	async oauthClient(@Args('id', { type: () => ID }) id: Id): Promise<OAuthClientResponseDTO | null> {
		try {
			return await this.oauthClientService.findOneSafe(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * Registers a client and answers the plaintext secret once.
	 *
	 * The same service method the delivered create route calls, with the same payload. The tenant is the
	 * credential's and never an argument, and whether the row may be installation-wide is the service's
	 * own decision about the caller's role — neither is restated here, because a resolver that decided
	 * either would be a second place the rule lives.
	 */
	@Mutation('createOAuthClient')
	@Permissions(PermissionsEnum.OAUTH_CLIENT_EDIT)
	async createOAuthClient(
		@Args('input') input: ICreateOAuthClientInput
	): Promise<OAuthClientWithSecretResponseDTO> {
		return await this.oauthClientService.createClient(input as unknown as CreateOAuthClientDTO);
	}

	/**
	 * Changes a client that exists.
	 *
	 * The delivered edit reads the row before it writes — which is what scopes the write to a row the
	 * caller is allowed to reach — and hands the store exactly the members the body carried, so a member
	 * the caller leaves out is left as it is. The answer is the read the route performs after the write.
	 */
	@Mutation('updateOAuthClient')
	@Permissions(PermissionsEnum.OAUTH_CLIENT_EDIT)
	async updateOAuthClient(@Args('input') input: IUpdateOAuthClientInput): Promise<OAuthClientResponseDTO> {
		const { id, ...values } = input;

		return await this.oauthClientService.updateClient(id, values as unknown as UpdateOAuthClientDTO);
	}

	/**
	 * Replaces the client secret and answers the plaintext once.
	 *
	 * The same service method the delivered rotation route calls. Nothing about the operation is
	 * restated here: which clients may have a secret rotated, and what happens to the tokens already
	 * issued under the previous one, are the service's statements.
	 */
	@Mutation('rotateOAuthClientSecret')
	@Permissions(PermissionsEnum.OAUTH_CLIENT_EDIT)
	async rotateOAuthClientSecret(
		@Args('id', { type: () => ID }) id: Id
	): Promise<OAuthClientWithSecretResponseDTO> {
		return await this.oauthClientService.rotateSecret(id);
	}

	/**
	 * Revokes a client.
	 *
	 * The delivered route answers no content, so there is no row and no projection to mirror: the field
	 * answers the fact of the revocation. The withdrawal itself is the service's, and it refuses a
	 * client the caller may not reach rather than reporting success for a write that matched nothing.
	 */
	@Mutation('deleteOAuthClient')
	@Permissions(PermissionsEnum.OAUTH_CLIENT_EDIT)
	async deleteOAuthClient(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.oauthClientService.softDeleteClient(id);

		return true;
	}
}
