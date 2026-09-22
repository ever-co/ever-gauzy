import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Deal } from './deal.entity';
import { DealService } from './deal.service';

/** The members `CreateDealInput` declares in the schema. */
export interface ICreateDealInput {
	organizationId: Id;
	title: string;
	probability: number;
	stageId: Id;
	clientId?: Id;
	isActive?: boolean;
	isArchived?: boolean;
}

/** The members `UpdateDealInput` declares in the schema. */
export interface IUpdateDealInput extends Partial<ICreateDealInput> {
	id: Id;
}

/**
 * The fields a deal list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `DealFilter` and `DealSortField` are its two
 * renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `probability` is `NUMBER` because the column behind it is an `int`: an operator on it is a
 * comparison between whole numbers, and `DecimalFilter` would offer a caller a precision the column
 * does not have.
 *
 * Exported because a deal list is served twice: this resource's own connection, and the pipeline
 * domain's `pipelineDeals`, whose read answers the deals of one pipeline. A cursor obtained from one
 * of them has to resume on the other, and that is only true while one declaration states the
 * vocabulary both evaluate — a second copy would be a second filter language wearing the same name.
 */
export const DEAL_FILTERABLE = {
	id: 'ID',
	organizationId: 'ID',
	title: 'STRING',
	probability: 'NUMBER',
	stageId: 'ID',
	clientId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. Exported for the reason stated above. */
export const DEAL_SORTABLE = ['createdAt', 'updatedAt', 'title', 'probability', 'stageId', 'clientId'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list method applies no order of its own — it hands the store the criterion and takes
 * the rows as they come back, which differs between installations — so this is a decision the
 * connection has to make rather than one it reproduces: newest first, because a board of
 * opportunities is read from the end that has just arrived, then the identifier, which is the key
 * that makes the order total and a cursor walk over it stable.
 */
const DEAL_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The deal over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `DealService` the `/api/deals` routes call.
 *
 * **The guard chain and the class permission are the controller's.** `DealController` carries
 * `TenantPermissionGuard` and `PermissionGuard` on the class and states `VIEW_SALES_PIPELINES` there,
 * so this class carries the same three things — the two guards, the gate below, and that permission.
 * Each field then states the permission its own route runs under, which for this resource is the
 * class permission on every route except the create: the one-row read, the count, the edit, the
 * removal and the two lifecycle moves all inherit it, and only `POST /deals` raises itself to
 * `EDIT_SALES_PIPELINES`. Stating the edit permission on the reads here "to make them consistent"
 * would refuse a caller the REST list route serves.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any
 * part of it.
 */
@Resolver('Deal')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
export class DealResolver {
	constructor(private readonly dealService: DealService) {}

	/**
	 * The deals of the caller's tenant, newest first.
	 */
	@Query('deals')
	@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
	async deals(
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
	): Promise<GraphqlConnection<Deal>> {
		// The delivered list route binds the query DTO to the query string and hands it to the service.
		// This surface has no query string to bind, so the read runs with the route's own defaults for
		// an unstated request — no criterion, no relations, no page — and the connection protocol's
		// `filter` is applied to the rows the service returns. The tenant is applied to the criterion
		// by the service, from the credential rather than from the caller.
		const options = { ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<Deal>;
		const { items }: IPagination<Deal> = await this.dealService.findAll(options);

		return buildConnection<Deal>({
			rows: items ?? [],
			filterable: DEAL_FILTERABLE,
			sortable: DEAL_SORTABLE,
			defaultSort: DEAL_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One deal of the caller's tenant.
	 *
	 * A deal that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact
	 * stated in the other protocol's vocabulary.
	 */
	@Query('deal')
	@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
	async deal(@Args('id', { type: () => ID }) id: Id): Promise<Deal | null> {
		try {
			return await this.dealService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many deals the caller's tenant holds.
	 *
	 * The same call the count route makes: the service applies the caller's own tenant to the
	 * criterion from the credential, so the bare call counts the rows the route counts when it is
	 * given no options.
	 */
	@Query('dealCount')
	@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
	async dealCount(): Promise<number> {
		return await this.dealService.countBy();
	}

	/**
	 * Files a deal through the same service method the delivered create route calls.
	 *
	 * The tenant is the credential's: the service stamps it, so a caller states which organization
	 * the row is filed under and never which tenant it is written into.
	 */
	@Mutation('createDeal')
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	async createDeal(@Args('input') input: ICreateDealInput): Promise<Deal> {
		return await this.dealService.create(input as unknown as Deal);
	}

	/**
	 * Changes the facts of a deal through the same service method the delivered edit route calls.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered
	 * route answers the store's own update result — a statement about the write, `{ affected }` —
	 * which is not a row and not what a GraphQL field named `updateDeal` may return. The service
	 * reads the row before it writes, so a caller naming a deal of another tenant, or one that is
	 * not there, is answered with the miss rather than with a write.
	 */
	@Mutation('updateDeal')
	@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
	async updateDeal(@Args('input') input: IUpdateDealInput): Promise<Deal> {
		const { id, ...values } = input;

		await this.dealService.update(id, values as QueryDeepPartialEntity<Deal>);

		return await this.dealService.findOneByIdString(id);
	}

	/**
	 * Removes a deal outright.
	 *
	 * The delivered service refuses a row that is not there with the same `404` the REST route
	 * answers with, so a caller that names one is told it is missing rather than that the removal
	 * succeeded.
	 */
	@Mutation('deleteDeal')
	@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
	async deleteDeal(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.dealService.delete(id);

		return true;
	}

	/**
	 * Withdraws a deal: the row is marked rather than removed, and the recovery below reads it back.
	 */
	@Mutation('softDeleteDeal')
	@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
	async softDeleteDeal(@Args('id', { type: () => ID }) id: Id): Promise<Deal> {
		return await this.dealService.softRemove(id);
	}

	/**
	 * Puts a withdrawn deal back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverDeal')
	@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
	async recoverDeal(@Args('id', { type: () => ID }) id: Id): Promise<Deal> {
		return await this.dealService.softRecover(id);
	}
}
