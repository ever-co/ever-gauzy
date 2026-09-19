import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination } from '@gauzy/contracts';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { OrganizationAward } from './organization-award.entity';
import { OrganizationAwardService } from './organization-award.service';

/** The members `CreateOrganizationAwardInput` declares in the schema. */
export interface ICreateOrganizationAwardInput {
	organizationId: Id;
	name: string;
	year: string;
}

/** The members `UpdateOrganizationAwardInput` declares in the schema. */
export interface IUpdateOrganizationAwardInput {
	id: Id;
	organizationId?: Id;
	name?: string;
	year?: string;
}

/**
 * The fields an award list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OrganizationAwardFilter` and
 * `OrganizationAwardSortField` are its two renderings, and keeping the three in one file is what makes
 * a field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible
 * to introduce quietly.
 *
 * `year` is filterable and not sortable. Filtering on it is a question a caller asks — the awards of
 * one year — and the column is text, so an ordering over it would be an ordering over whatever the
 * organization happened to write rather than a chronology.
 */
const ORGANIZATION_AWARD_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	year: 'STRING',
	organizationId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN'
} as const;

/** The fields the sort enum offers. */
const ORGANIZATION_AWARD_SORTABLE = ['createdAt', 'updatedAt', 'name'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list method applies no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is not a reproduction of the route's order but the order that makes
 * a cursor walk total: newest first, with the identifier as the last key so that two rows written in
 * the same millisecond still have one order between them.
 */
const ORGANIZATION_AWARD_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The organization award over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `OrganizationAwardService` method the
 * `/api/organization-awards` routes call.
 *
 * **The guard is the controller's guard, and no permission is stated above it.** The delivered
 * controller carries `TenantPermissionGuard` on the class and states no `@Permissions` anywhere — not
 * on the four routes it declares and not on the five it inherits from the CRUD base — so every one of
 * its routes is tenant-guarded and otherwise unpermissioned. A resolver that demanded a permission
 * here would refuse a caller the REST route serves, which is exactly the asymmetry the two-protocol
 * rule forbids.
 *
 * **The list is a connection, and no relation is a member of it.** An award row carries a title, a
 * year and the organization it is filed under; there is no relation column and nothing eager, so the
 * type is the row and the lists of awards are read from the organization that holds them.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('OrganizationAward')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class OrganizationAwardResolver {
	constructor(private readonly organizationAwardService: OrganizationAwardService) {}

	/**
	 * The awards of the caller's tenant.
	 */
	@Query('organizationAwards')
	async organizationAwards(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<OrganizationAward>> {
		// The delivered list route binds `findInput` out of its `data` query parameter and hands it to
		// the service as the criterion. This surface has no query string to bind, so the read runs with
		// the route's own default for an unstated request — no criterion, no relations — and the
		// connection protocol's `filter` is applied to the rows the service returns. The tenant is
		// applied to the criterion by the service, from the credential rather than from the caller.
		const { items }: IPagination<OrganizationAward> = await this.organizationAwardService.findAll({});

		return buildConnection<OrganizationAward>({
			rows: items ?? [],
			filterable: ORGANIZATION_AWARD_FILTERABLE,
			sortable: ORGANIZATION_AWARD_SORTABLE,
			defaultSort: ORGANIZATION_AWARD_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One award of the caller's tenant.
	 *
	 * An award that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('organizationAward')
	async organizationAward(@Args('id', { type: () => ID }) id: Id): Promise<OrganizationAward | null> {
		try {
			return await this.organizationAwardService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many awards the caller's tenant records.
	 */
	@Query('organizationAwardCount')
	async organizationAwardCount(): Promise<number> {
		return await this.organizationAwardService.countBy();
	}

	/**
	 * Files an award.
	 *
	 * The payload is the input as stated, and the tenant is the credential's: the service stamps it and
	 * overwrites whatever a body states, so a caller states which organization the row is filed under
	 * and never which tenant it is written into.
	 */
	@Mutation('createOrganizationAward')
	async createOrganizationAward(
		@Args('input') input: ICreateOrganizationAwardInput
	): Promise<OrganizationAward> {
		return await this.organizationAwardService.create(input as unknown as OrganizationAward);
	}

	/**
	 * Changes the facts of an award.
	 *
	 * The identifier is the criterion and is not repeated in the payload, which is the shape the route
	 * itself has: `:id` names the row and the body carries only what changes. The service is the one the
	 * REST route calls, and it reads the row before it writes, so an award of another tenant, or one
	 * that is not there, is answered with the miss rather than with a write under an identifier the
	 * caller does not own.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered route
	 * answers the store's own update result — a statement about the write, `{ affected }` — which is not
	 * a row and not what a GraphQL field named `updateOrganizationAward` may return.
	 */
	@Mutation('updateOrganizationAward')
	async updateOrganizationAward(
		@Args('input') input: IUpdateOrganizationAwardInput
	): Promise<OrganizationAward> {
		const { id, ...values } = input;

		await this.organizationAwardService.update(id, values as unknown as QueryDeepPartialEntity<OrganizationAward>);

		return await this.organizationAwardService.findOneByIdString(id);
	}

	/**
	 * Removes an award outright.
	 */
	@Mutation('deleteOrganizationAward')
	async deleteOrganizationAward(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.organizationAwardService.delete(id);

		return true;
	}

	/**
	 * Withdraws an award: the row is marked rather than removed, and the recovery below reads it back.
	 */
	@Mutation('softDeleteOrganizationAward')
	async softDeleteOrganizationAward(@Args('id', { type: () => ID }) id: Id): Promise<OrganizationAward> {
		return await this.organizationAwardService.softRemove(id);
	}

	/**
	 * Puts a withdrawn award back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverOrganizationAward')
	async recoverOrganizationAward(@Args('id', { type: () => ID }) id: Id): Promise<OrganizationAward> {
		return await this.organizationAwardService.softRecover(id);
	}
}
