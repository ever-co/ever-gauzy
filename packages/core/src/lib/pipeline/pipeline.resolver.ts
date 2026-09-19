import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, IPipeline, PermissionsEnum } from '@gauzy/contracts';
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
import { Deal } from '../deal/deal.entity';
import { DEAL_FILTERABLE, DEAL_SORTABLE } from '../deal/deal.resolver';
import { Pipeline } from './pipeline.entity';
import { PipelineService } from './pipeline.service';

/** One stage of a pipeline, as `PipelineStageInput` declares it. */
export interface IPipelineStageInput {
	id?: Id;
	name: string;
	description?: string;
}

/** The members `CreatePipelineInput` declares in the schema. */
export interface ICreatePipelineInput {
	organizationId: Id;
	name: string;
	description?: string;
	stages?: IPipelineStageInput[];
	isActive?: boolean;
	isArchived?: boolean;
}

/** The members `UpdatePipelineInput` declares in the schema. */
export interface IUpdatePipelineInput extends Partial<ICreatePipelineInput> {
	id: Id;
}

/**
 * The fields a pipeline list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `PipelineFilter` and `PipelineSortField` are
 * its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 */
const PIPELINE_FILTERABLE = {
	id: 'ID',
	organizationId: 'ID',
	name: 'STRING',
	description: 'STRING',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const PIPELINE_SORTABLE = ['createdAt', 'updatedAt', 'name'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list and page methods apply no order of their own, so this is a decision the
 * connection has to make rather than one it reproduces: newest first, because a pipeline is
 * configured once and read when it changes, then the identifier, which is the key that makes the
 * order total and a cursor walk over it stable.
 */
const PIPELINE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The order the pipeline-deal connection keeps instead of declaring one.
 *
 * The delivered read sorts its answer by the position of each deal's stage on the board — an `ORDER
 * BY` over a joined column the deal row does not carry — so the connection cannot reproduce that
 * order from the rows it is given and must not pretend to. Declaring no default leaves the array the
 * service returned in the order the service meant it, and the cursor then names the row's own
 * identifier, which is the one key that is total without any sort being stated.
 */
const PIPELINE_DEALS_KEEP_READ_ORDER: readonly ConnectionSortKey[] = [];

/**
 * The sales pipeline over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `PipelineService` method the `/api/pipelines` routes
 * call.
 *
 * **The guard chain and the class permission are the controller's.** `PipelineController` carries
 * `TenantPermissionGuard` and `PermissionGuard` on the class and states `EDIT_SALES_PIPELINES` there,
 * so this class carries the same two guards, the gate below, and that permission. Each field then
 * states the permission its own route runs under: the four reads state the view permission their
 * routes state, and the create, the edit, the removal and the two lifecycle moves state the edit one.
 * The count is the field that reads oddly and is nevertheless the parity — `GET /pipelines/count` is
 * inherited from the CRUD base without a permission of its own, so it runs under the class-level edit
 * permission, and this field states the same one.
 *
 * **`pipelineDeals` is a root field rather than a filter, because its read joins a pivot the list
 * read does not.** It reads deal rows whose stage belongs to one pipeline; no filter on `pipelines`
 * could express that, and no filter on `deals` could either, because a deal carries its stage rather
 * than its pipeline. It answers with the deal domain's own connection and the deal domain's own
 * filter vocabulary — imported rather than restated, so a cursor minted on `deals` resumes here.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any
 * part of it.
 */
@Resolver('Pipeline')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
export class PipelineResolver {
	constructor(private readonly pipelineService: PipelineService) {}

	/**
	 * The pipelines of the caller's tenant, newest first.
	 */
	@Query('pipelines')
	@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
	async pipelines(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Pipeline>> {
		// The delivered list route hands the service the query DTO it bound. This surface has no query
		// string to bind, so the read runs with the route's own defaults — no criterion, no relations,
		// no page — and the connection protocol's `filter` narrows the rows the service returns.
		const options = {} as BaseQueryDTO<Pipeline>;
		const { items }: IPagination<Pipeline> = await this.pipelineService.findAll(options);

		return buildConnection<Pipeline>({
			rows: items ?? [],
			filterable: PIPELINE_FILTERABLE,
			sortable: PIPELINE_SORTABLE,
			defaultSort: PIPELINE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One pipeline of the caller's tenant.
	 *
	 * A pipeline that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact
	 * stated in the other protocol's vocabulary.
	 */
	@Query('pipeline')
	@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
	async pipeline(@Args('id', { type: () => ID }) id: Id): Promise<Pipeline | null> {
		try {
			return (await this.pipelineService.findById(id)) as Pipeline;
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many pipelines the caller's tenant holds.
	 *
	 * The same call the count route makes: the service applies the caller's own tenant to the
	 * criterion from the credential, so the bare call counts the rows the route counts when it is
	 * given no options.
	 */
	@Query('pipelineCount')
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	async pipelineCount(): Promise<number> {
		return await this.pipelineService.countBy();
	}

	/**
	 * The deals whose stage belongs to one pipeline.
	 *
	 * The same service method the delivered read calls, with the same two arguments the route binds
	 * from its query string: a `where` that names no organization when the caller states none, and
	 * the empty relation list the route's own parameter defaults to. The method catches a failure and
	 * answers an empty page rather than raising, so this field lets that answer through — a refusal
	 * here would tell a caller something the REST route does not.
	 */
	@Query('pipelineDeals')
	@Permissions(PermissionsEnum.VIEW_SALES_PIPELINES)
	async pipelineDeals(
		@Args('pipelineId', { type: () => ID }) pipelineId: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Deal>> {
		const { items }: IPagination<Deal> = await this.pipelineService.getPipelineDeals(pipelineId);

		return buildConnection<Deal>({
			rows: items ?? [],
			filterable: DEAL_FILTERABLE,
			sortable: DEAL_SORTABLE,
			// The read fixed an order over a joined column this connection cannot see, so no default
			// sort is declared and the rows keep the order the service meant them in.
			defaultSort: PIPELINE_DEALS_KEEP_READ_ORDER,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * Files a pipeline through the same service method the delivered create route calls.
	 *
	 * The tenant is the credential's: the service stamps it, so a caller states which organization
	 * the row is filed under and never which tenant it is written into. The stages the input states
	 * are cascaded by the delivered writer, which also hands each of them its `pipelineId` and its
	 * position.
	 */
	@Mutation('createPipeline')
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	async createPipeline(@Args('input') input: ICreatePipelineInput): Promise<Pipeline> {
		return (await this.pipelineService.create(input as unknown as IPipeline)) as Pipeline;
	}

	/**
	 * Changes a pipeline and its stage set through the same service method the delivered edit route
	 * calls.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered
	 * method answers the pipeline its transaction saved — and answers nothing at all when that
	 * transaction rolled back, which its own `catch` swallows — so the field answers the row as it
	 * now stands rather than a row the write may not have produced.
	 */
	@Mutation('updatePipeline')
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	async updatePipeline(@Args('input') input: IUpdatePipelineInput): Promise<Pipeline> {
		const { id, ...values } = input;

		await this.pipelineService.update(id, values as QueryDeepPartialEntity<Pipeline>);

		return (await this.pipelineService.findById(id)) as Pipeline;
	}

	/**
	 * Removes a pipeline outright, with the stages that belong to it.
	 */
	@Mutation('deletePipeline')
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	async deletePipeline(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.pipelineService.delete(id);

		return true;
	}

	/**
	 * Withdraws a pipeline: the row is marked rather than removed, and the recovery below reads it
	 * back.
	 */
	@Mutation('softDeletePipeline')
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	async softDeletePipeline(@Args('id', { type: () => ID }) id: Id): Promise<Pipeline> {
		return await this.pipelineService.softRemove(id);
	}

	/**
	 * Puts a withdrawn pipeline back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverPipeline')
	@Permissions(PermissionsEnum.EDIT_SALES_PIPELINES)
	async recoverPipeline(@Args('id', { type: () => ID }) id: Id): Promise<Pipeline> {
		return await this.pipelineService.softRecover(id);
	}
}
