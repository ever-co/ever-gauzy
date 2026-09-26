import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ID as Id, IFavoriteCreateInput, IPagination } from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Favorite } from './favorite.entity';
import { FavoriteService } from './favorite.service';

/** The members `CreateFavoriteInput` declares in the schema. */
export interface ICreateFavoriteInput {
	entity: string;
	entityId: Id;
	employeeId?: Id;
	organizationId?: Id;
}

/** The members `UpdateFavoriteInput` declares in the schema. */
export interface IUpdateFavoriteInput extends ICreateFavoriteInput {
	id: Id;
}

/**
 * The fields a favorite list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `FavoriteFilter` and `FavoriteSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the favorite row, which is why the set is what it is: the delivered list
 * read answers the row itself and joins only the relations a REST caller names in its query string —
 * which this surface never names — so each member here narrows the rows the connection was handed
 * rather than a collection a reader would have had to load. The two relations the row owns are
 * deliberately absent from both lists, for the reason the object type states: neither the marked row
 * nor the employee behind `employeeId` is loaded by the reads behind this surface.
 */
const FAVORITE_FILTERABLE = {
	id: 'ID',
	entity: 'STRING',
	entityId: 'ID',
	employeeId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	deletedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const FAVORITE_SORTABLE = [
	'id',
	'entity',
	'entityId',
	'employeeId',
	'createdAt',
	'updatedAt',
	'deletedAt'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list method states no order of its own — it hands the store the criterion its caller
 * carried and takes the rows as they come back — so this is the platform's own: newest first, with the
 * identifier as the last key so that two rows marked in the same millisecond still have one order
 * between them, which is what makes a cursor walk over them total.
 */
const FAVORITE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The favorite over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `FavoriteService` method the `/api/favorite` routes
 * reach — including the seven whose routes the controller inherits from the CRUD base rather than
 * declaring.
 *
 * **The guard chain is the controller's, and no permission is stated anywhere — not even on a field.**
 * The delivered controller carries `TenantPermissionGuard` on the class and `PermissionGuard` nowhere
 * at all: it is not on the class, and no route adds it. `@Permissions` is stated nowhere either — not
 * on the four declared routes and not on the seven inherited ones — so every route asks for a
 * credential and a tenant and for no particular grant. The class here therefore carries the same one
 * guard plus the gate, and no field states a permission; adding `PermissionGuard` here would put every
 * field behind a guard its own route does not run under, which is the asymmetry the two-protocol rule
 * forbids.
 *
 * **The employee-scoped read is a root field of its own rather than a filter on the connection.** The
 * delivered read resolves the caller's own employee from the credential and overwrites the criterion's
 * employee with it, so the narrowing it performs is by who is asking rather than by a fact about the
 * rows — and a condition on `employeeId` cannot state it. Presenting it as a filter would either be
 * ignored or would let a caller read another employee's list, which is exactly what the read refuses.
 *
 * **The edit answers the row, and the delivered update answers the store's result.** `PUT /:id` inherits
 * the CRUD base's update, which reads the row — that read is how a marker of another tenant, or one
 * that is not there, is answered with the miss — and then persists the members a body states and
 * answers `{ affected }`. A statement about a write is not a row, so the field performs the same write
 * and then reads the row back through the same service, which is the shape this codebase's other
 * update fields take for the same reason.
 *
 * **`GET /type` is deliberately not surfaced.** Its read resolves, at runtime, the service of whichever
 * other domain the caller names in `entity` through the discovery registry, and answers that domain's
 * rows: one schema field has one type, and the only faithful renderings are a union of every domain's
 * type or an untyped document no client can select from. The api document states that gap where a
 * reader looks for the capability.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it
 * is appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('Favorite')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class FavoriteResolver {
	constructor(private readonly favoriteService: FavoriteService) {}

	/**
	 * The markers of the caller's tenant, newest first.
	 */
	@Query('favorites')
	async favorites(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	): Promise<GraphqlConnection<Favorite>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults — no
		// `where` and no `relations`. The tenant is applied to the criterion by the service, from the
		// credential rather than from the caller.
		const { items }: IPagination<Favorite> = await this.favoriteService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<Favorite>);

		return buildConnection<Favorite>({
			rows: items ?? [],
			filterable: FAVORITE_FILTERABLE,
			sortable: FAVORITE_SORTABLE,
			defaultSort: FAVORITE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One marker of the caller's tenant.
	 *
	 * A marker that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('favorite')
	async favorite(@Args('id', { type: () => ID }) id: Id): Promise<Favorite | null> {
		try {
			return await this.favoriteService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many markers the caller's tenant records.
	 *
	 * The same call the count route makes when it is given no query string, and the same absence of
	 * narrowing: that route binds its query string to the store's own `where` and hands it to `countBy`,
	 * and the connection protocol has no argument of that shape, so the field passes none and counts the
	 * caller's own rows.
	 */
	@Query('favoriteCount')
	async favoriteCount(): Promise<number> {
		return await this.favoriteService.countBy();
	}

	/**
	 * The markers of the caller's own employee record, newest first.
	 *
	 * The same read the delivered `GET /employee` route performs, with the same payload: the route binds
	 * its query DTO out of the query string and hands it over, and this surface has no query string to
	 * bind, so the read runs with exactly what that route hands over for a request that states nothing —
	 * the route's own defaults. The employee is not an argument here because the read does not read one:
	 * it resolves the caller's own employee from the credential and overwrites the criterion's employee
	 * with it, which is why this capability is a root field of its own rather than a filter on
	 * `favorites` — a narrowing by who is asking is not a fact about the rows.
	 */
	@Query('favoritesByEmployee')
	async favoritesByEmployee(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Favorite>> {
		const { items }: IPagination<Favorite> = await this.favoriteService.findFavoritesByEmployee(
			{} as BaseQueryDTO<Favorite>
		);

		return buildConnection<Favorite>({
			rows: items ?? [],
			filterable: FAVORITE_FILTERABLE,
			sortable: FAVORITE_SORTABLE,
			defaultSort: FAVORITE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * Marks a row as a favorite.
	 *
	 * The payload is the input as stated, and the tenant is the credential's: the delivered create
	 * stamps it and overwrites whatever a body states, so a caller states which row it is marking and
	 * never which tenant the marker is written into. The employee is resolved by the same service the
	 * same way — the caller's own record first, the stated member as the fallback that files an
	 * organization-level marker.
	 */
	@Mutation('createFavorite')
	async createFavorite(@Args('input') input: ICreateFavoriteInput): Promise<Favorite> {
		return (await this.favoriteService.create(input as unknown as IFavoriteCreateInput)) as Favorite;
	}

	/**
	 * Changes a marker that exists.
	 *
	 * The delivered route hands the service the body with the path identifier beside it, and the
	 * service's update reads the row the identifier names before it writes — a marker of another
	 * tenant, or one that is not there, is answered with the miss rather than with a write that
	 * recreates the row. A member the caller leaves out is left as it is, which is what makes this a
	 * partial update rather than a replacement of the row.
	 *
	 * The answer is the row the write produced, read back through the same service: the delivered
	 * update answers the store's own result — a statement about the write — and a field named
	 * `updateFavorite` owes its caller the row the write left behind.
	 */
	@Mutation('updateFavorite')
	async updateFavorite(@Args('input') input: IUpdateFavoriteInput): Promise<Favorite> {
		await this.favoriteService.update(input.id, input as unknown as QueryDeepPartialEntity<Favorite>);

		return await this.favoriteService.findOneByIdString(input.id);
	}

	/**
	 * Removes a marker outright.
	 *
	 * The service is the one the REST route calls, and it decides the scope itself: it refuses a caller
	 * who does not own the row and lets an administrator through, which is why the field states no
	 * extra scope beside it. The field answers whether the removal happened rather than the removed
	 * row, because the delivered route answers the store's delete result.
	 */
	@Mutation('deleteFavorite')
	async deleteFavorite(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.favoriteService.delete(id);

		return true;
	}

	/**
	 * Withdraws a marker: the row is marked rather than removed, and the recovery below reads it back.
	 */
	@Mutation('softDeleteFavorite')
	async softDeleteFavorite(@Args('id', { type: () => ID }) id: Id): Promise<Favorite> {
		return await this.favoriteService.softRemove(id);
	}

	/**
	 * Puts a withdrawn marker back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverFavorite')
	async recoverFavorite(@Args('id', { type: () => ID }) id: Id): Promise<Favorite> {
		return await this.favoriteService.softRecover(id);
	}
}
