import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, ICandidateFeedback, IPagination, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { CandidateFeedback } from './candidate-feedbacks.entity';
import { CandidateFeedbacksService } from './candidate-feedbacks.service';
import { FeedbackDeleteCommand, FeedbackUpdateCommand } from './commands';

/** The members `CreateCandidateFeedbackInput` declares in the schema. */
export interface ICreateCandidateFeedbackInput {
	candidateId?: Id;
	interviewId?: Id;
	interviewerId?: Id;
	description?: string;
	rating: number;
	status?: string;
	organizationId?: Id;
}

/** The members `UpdateCandidateFeedbackInput` declares in the schema. */
export interface IUpdateCandidateFeedbackInput extends Partial<ICreateCandidateFeedbackInput> {
	id: Id;
}

/**
 * The fields a verdict list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * Every member is a column of the row. `interviewId` is here because the delivered interview-scoped
 * route is the same read with one more predicate — the row carries the column, so the connection can
 * narrow by it — and `candidateId` for the same reason on the other axis.
 */
const FEEDBACK_FILTERABLE = {
	id: 'ID',
	description: 'STRING',
	rating: 'DECIMAL',
	status: 'STRING',
	candidateId: 'ID',
	interviewId: 'ID',
	interviewerId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	archivedAt: 'DATE',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the verdict list's sort enum offers. */
const FEEDBACK_SORTABLE = ['createdAt', 'updatedAt', 'rating', 'status'] as const;

/** The order the connection applies when the caller states none. */
const FEEDBACK_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The panel's verdict over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below reaches the same `CandidateFeedbacksService` method, or dispatches the same
 * command, that the `/api/candidate-feedbacks` routes reach.
 *
 * **The guard chain is the controller's, and it is the shortest chain in this domain.** The controller
 * carries `TenantPermissionGuard` on its class and nothing else: no class-level permission, and none on
 * the count, the paginated spelling, the list, the node, or the three lifecycle routes it inherits from
 * the CRUD base. Four of its handlers state `PermissionGuard` of their own — the interview-scoped read,
 * the two writes and the interview-scoped removal — and three of those four also state the feedback edit
 * permission. So the class here carries the tenant guard and the gate alone, those four fields restate
 * the permission guard and state the permission their own routes state, and **no field states a
 * permission its route does not** — which for this resource means that most of the surface is guarded
 * by the tenant alone, exactly as the routes are. A class-level permission added for symmetry would
 * refuse a caller every one of those routes serves.
 *
 * **The interview-scoped read folds into the list, and the interview-scoped removal does not.** The read
 * is the same reader with one more predicate over a column the row carries, so it is `interviewId` in
 * the list's filter. The removal is a different operation: it removes one verdict *and recomputes the
 * sitting's average from the verdicts that remain*, which the plain removal does not do. Two removals
 * that leave the platform in two different states are two fields.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability, and appended to the guard chain the routes already carry rather than replacing any part
 * of it.
 */
@Resolver('CandidateFeedback')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class CandidateFeedbacksResolver {
	constructor(
		private readonly candidateFeedbacksService: CandidateFeedbacksService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The verdicts of the caller's tenant, newest first. `interviewId` narrows them to one sitting.
	 *
	 * The read is the delivered list route's own: that route reads a `data` parameter carrying a `where`
	 * member and a `relations` member and hands both to the service, and a caller that states neither
	 * hands it neither. This surface's fields name no relation, so the read runs with the route's own
	 * default — no narrowing, no joins — and the caller's narrowing arrives in `filter`.
	 */
	@Query('candidateFeedbacks')
	async candidateFeedbacks(
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
	): Promise<GraphqlConnection<CandidateFeedback>> {
		const { items }: IPagination<ICandidateFeedback> = await this.candidateFeedbacksService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) });

		return buildConnection<CandidateFeedback>({
			rows: (items ?? []) as CandidateFeedback[],
			filterable: FEEDBACK_FILTERABLE,
			sortable: FEEDBACK_SORTABLE,
			defaultSort: FEEDBACK_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One verdict, or null when there is none.
	 *
	 * A miss answers `null` rather than a refusal: GraphQL has one answer for "no such row" on a field
	 * that may have none, and the REST route's `404` is that same fact stated in the other protocol's
	 * vocabulary.
	 */
	@Query('candidateFeedback')
	async candidateFeedback(@Args('id', { type: () => ID }) id: Id): Promise<CandidateFeedback | null> {
		try {
			return await this.candidateFeedbacksService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/** How many verdicts the caller's tenant holds. */
	@Query('candidateFeedbackCount')
	async candidateFeedbackCount(): Promise<number> {
		return await this.candidateFeedbacksService.countBy();
	}

	/**
	 * Files a verdict.
	 *
	 * The write is the same service call the filing route makes, with the same body: the three relations
	 * are stated as the identifiers the delivered write is written from, and the rating is the number the
	 * delivered body requires.
	 */
	@Mutation('createCandidateFeedback')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT)
	async createCandidateFeedback(
		@Args('input') input: ICreateCandidateFeedbackInput
	): Promise<CandidateFeedback> {
		return await this.candidateFeedbacksService.create(input as never);
	}

	/**
	 * Edits a verdict.
	 *
	 * The same command the edit route dispatches, with the same payload — including the nested seating
	 * the delivered handler reads to find the sitting whose average it recomputes. That nesting is why
	 * this input carries `interviewId` beside `interviewerId`: the handler does not read the verdict's own
	 * interview column when it edits, and a field that stated only the seat would silently leave the
	 * sitting's average stale.
	 */
	@Mutation('updateCandidateFeedback')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT)
	async updateCandidateFeedback(
		@Args('input') input: IUpdateCandidateFeedbackInput
	): Promise<CandidateFeedback> {
		const { id, interviewId, ...members } = input;
		const entity = {
			...members,
			// The delivered handler reads the sitting out of the nested seat rather than out of the
			// verdict's own column, so the identifier is handed to it in the shape it reads.
			interviewer: interviewId ? { interviewId } : undefined
		} as unknown as ICandidateFeedback;

		return await this.commandBus.execute(new FeedbackUpdateCommand(id, entity));
	}

	/**
	 * Removes a verdict outright, through the plain removal the controller inherits.
	 *
	 * The delivered handler answers the store's deletion result, and the field answers the fact of the
	 * removal, which is the one member of that result a caller reads.
	 */
	@Mutation('deleteCandidateFeedback')
	async deleteCandidateFeedback(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.candidateFeedbacksService.delete(id);

		return true;
	}

	/**
	 * Removes one verdict from one sitting, and recomputes the sitting's average from the verdicts that
	 * remain — which is the whole of what the delivered command does, down to answering zero when the
	 * sitting has none left.
	 */
	@Mutation('deleteCandidateFeedbackByInterview')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_FEEDBACK_EDIT)
	async deleteCandidateFeedbackByInterview(
		@Args('interviewId', { type: () => ID }) interviewId: Id,
		@Args('feedbackId', { type: () => ID }) feedbackId: Id
	): Promise<boolean> {
		await this.commandBus.execute(new FeedbackDeleteCommand(feedbackId, interviewId));

		return true;
	}

	/** Withdraws a verdict without removing it. */
	@Mutation('softDeleteCandidateFeedback')
	async softDeleteCandidateFeedback(@Args('id', { type: () => ID }) id: Id): Promise<CandidateFeedback> {
		return await this.candidateFeedbacksService.softRemove(id);
	}

	/** Puts a withdrawn verdict back. */
	@Mutation('recoverCandidateFeedback')
	async recoverCandidateFeedback(@Args('id', { type: () => ID }) id: Id): Promise<CandidateFeedback> {
		return await this.candidateFeedbacksService.softRecover(id);
	}
}
