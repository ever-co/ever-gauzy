import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { OrganizationPosition } from './organization-position.entity';
import { OrganizationPositionService } from './organization-position.service';

/** The members `CreateOrganizationPositionInput` declares in the schema. */
export interface ICreateOrganizationPositionInput {
	organizationId: Id;
	name: string;
}

/** The members `UpdateOrganizationPositionInput` declares in the schema. */
export interface IUpdateOrganizationPositionInput {
	id: Id;
	organizationId?: Id;
	name?: string;
}

/**
 * The fields a position list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OrganizationPositionFilter` and
 * `OrganizationPositionSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * The tag pivot is in neither. It is joined only when a REST caller names the relation in its query
 * string, and this surface names none — so a filter on it would be evaluated against a row that carries
 * none of it and would select nothing at all.
 */
const ORGANIZATION_POSITION_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	organizationId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN'
} as const;

/** The fields the sort enum offers. */
const ORGANIZATION_POSITION_SORTABLE = ['createdAt', 'updatedAt', 'name'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list method applies no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is not a reproduction of the route's order but the order that makes
 * a cursor walk total: newest first, with the identifier as the last key so that two rows written in
 * the same millisecond still have one order between them.
 */
const ORGANIZATION_POSITION_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The organization position over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `OrganizationPositionService` method the
 * `/api/organization-positions` routes call — including the six whose routes the controller inherits
 * from the CRUD base rather than declaring.
 *
 * **The delivered edit is an upsert, and the field says so by being one.** The route hands the service
 * the stated body with the path identifier merged in, which is the create path: the row is written
 * where the members are stated and left alone where they are not, and the answer is the row rather
 * than a statement about the write. The field calls the same method with the same merge, so a caller
 * gets the same behaviour and the same answer over either protocol.
 *
 * **The guard is the controller's guard, and no permission is stated above it.** The delivered
 * controller carries `TenantPermissionGuard` on the class and states no `@Permissions` anywhere, so
 * every one of its routes is tenant-guarded and otherwise unpermissioned. A resolver that demanded a
 * permission here would refuse a caller the REST route serves, which is exactly the asymmetry the
 * two-protocol rule forbids.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('OrganizationPosition')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class OrganizationPositionResolver {
	constructor(private readonly organizationPositionService: OrganizationPositionService) {}

	/**
	 * The positions of the caller's tenant.
	 */
	@Query('organizationPositions')
	async organizationPositions(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<OrganizationPosition>> {
		// The delivered list route binds `relations` and `findInput` out of its `data` query parameter
		// and hands them to the service. This surface has no query string to bind, so the read runs with
		// the route's own default for an unstated request — no criterion, no relations — and the
		// connection protocol's `filter` is applied to the rows the service returns. The tenant is
		// applied to the criterion by the service, from the credential rather than from the caller.
		const { items }: IPagination<OrganizationPosition> = await this.organizationPositionService.findAll({});

		return buildConnection<OrganizationPosition>({
			rows: items ?? [],
			filterable: ORGANIZATION_POSITION_FILTERABLE,
			sortable: ORGANIZATION_POSITION_SORTABLE,
			defaultSort: ORGANIZATION_POSITION_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One position of the caller's tenant.
	 *
	 * A position that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('organizationPosition')
	async organizationPosition(
		@Args('id', { type: () => ID }) id: Id
	): Promise<OrganizationPosition | null> {
		try {
			return await this.organizationPositionService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many positions the caller's tenant keeps.
	 */
	@Query('organizationPositionCount')
	async organizationPositionCount(): Promise<number> {
		return await this.organizationPositionService.countBy();
	}

	/**
	 * Files a position.
	 *
	 * The payload is the input as stated, and the tenant is the credential's: the service stamps it and
	 * overwrites whatever a body states, so a caller states which organization the row is filed under
	 * and never which tenant it is written into.
	 */
	@Mutation('createOrganizationPosition')
	async createOrganizationPosition(
		@Args('input') input: ICreateOrganizationPositionInput
	): Promise<OrganizationPosition> {
		return await this.organizationPositionService.create(input as unknown as OrganizationPosition);
	}

	/**
	 * Changes the facts of a position, through the same call the delivered route makes.
	 *
	 * The route writes through the create path with the path identifier merged into the stated body, so
	 * this field does the same rather than reaching for the partial update: the two surfaces have to
	 * write the same thing, and a field that reached for a different service method would be a second
	 * write path for one fact.
	 */
	@Mutation('updateOrganizationPosition')
	async updateOrganizationPosition(
		@Args('input') input: IUpdateOrganizationPositionInput
	): Promise<OrganizationPosition> {
		const { id, ...values } = input;

		return await this.organizationPositionService.create({
			...values,
			id
		} as unknown as OrganizationPosition);
	}

	/**
	 * Removes a position outright.
	 */
	@Mutation('deleteOrganizationPosition')
	async deleteOrganizationPosition(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.organizationPositionService.delete(id);

		return true;
	}

	/**
	 * Withdraws a position: the row is marked rather than removed, and the recovery below reads it back.
	 */
	@Mutation('softDeleteOrganizationPosition')
	async softDeleteOrganizationPosition(@Args('id', { type: () => ID }) id: Id): Promise<OrganizationPosition> {
		return await this.organizationPositionService.softRemove(id);
	}

	/**
	 * Puts a withdrawn position back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverOrganizationPosition')
	async recoverOrganizationPosition(@Args('id', { type: () => ID }) id: Id): Promise<OrganizationPosition> {
		return await this.organizationPositionService.softRecover(id);
	}
}
