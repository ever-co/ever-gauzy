import { CommandBus } from '@nestjs/cqrs';
import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, ICandidateCriterionsRating, IPagination, PermissionsEnum } from '@gauzy/contracts';
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
import { CandidateCriterionsRating } from './candidate-criterion-rating.entity';
import { CandidateCriterionsRatingService } from './candidate-criterion-rating.service';
import {
	CandidateCriterionsRatingBulkCreateCommand,
	CandidateCriterionsRatingBulkDeleteCommand,
	CandidateCriterionsRatingBulkUpdateCommand
} from './commands';

/** The members `CreateCandidateCriterionsRatingInput` declares in the schema. */
export interface ICreateCandidateCriterionsRatingInput {
	rating: number;
	technologyId?: Id;
	personalQualityId?: Id;
	feedbackId?: Id;
	organizationId?: Id;
}

/** The members `UpdateCandidateCriterionsRatingInput` declares in the schema. */
export interface IUpdateCandidateCriterionsRatingInput extends Partial<ICreateCandidateCriterionsRatingInput> {
	id: Id;
}

/** One technology criterion as `CreateCandidateCriterionsRatingsBulkInput` declares it. */
export interface ICandidateTechnologyRatingBulkInput {
	technologyId: Id;
	rating: number;
	organizationId?: Id;
}

/** One personal-quality criterion as `CreateCandidateCriterionsRatingsBulkInput` declares it. */
export interface ICandidatePersonalQualityRatingBulkInput {
	personalQualityId: Id;
	rating: number;
	organizationId?: Id;
}

/** The members `CreateCandidateCriterionsRatingsBulkInput` declares in the schema. */
export interface ICreateCandidateCriterionsRatingsBulkInput {
	feedbackId: Id;
	technologies?: ICandidateTechnologyRatingBulkInput[];
	qualities?: ICandidatePersonalQualityRatingBulkInput[];
}

/** The members `UpdateCandidateCriterionsRatingsBulkInput` declares in the schema. */
export interface IUpdateCandidateCriterionsRatingsBulkInput {
	criterionsRating: IUpdateCandidateCriterionsRatingInput[];
	technologies?: number[];
	personalQualities?: number[];
}

/**
 * The fields a criterion-rating list may be filtered and sorted by, and the order it is returned in when
 * the caller states none.
 *
 * Every member is a column of the row, including the three identifiers that make the row a join with a
 * number on it: the verdict it belongs to and the two things a sitting is assessed on.
 */
const CRITERION_FILTERABLE = {
	id: 'ID',
	rating: 'NUMBER',
	technologyId: 'ID',
	personalQualityId: 'ID',
	feedbackId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	archivedAt: 'DATE',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the criterion-rating list's sort enum offers. */
const CRITERION_SORTABLE = ['createdAt', 'updatedAt', 'rating'] as const;

/** The order the connection applies when the caller states none. */
const CRITERION_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The criterion a verdict rated, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below reaches the same `CandidateCriterionsRatingService` method, or dispatches the
 * same command, that the `/api/candidate-criterions-rating` routes reach.
 *
 * **The guard chain and the permissions are the controller's.** The controller carries
 * `TenantPermissionGuard` and `PermissionGuard` with `ORG_CANDIDATES_INTERVIEW_EDIT` on the class, and it
 * states one permission of its own: the list runs under the interview *view* permission. Everything
 * else — the node, the count, the two bulk writes, the verdict-scoped removal and the three lifecycle
 * routes it inherits — runs under the class-level edit permission. The two permissions are the interview
 * controller's own vocabulary and not the candidate one, which is why this surface never states
 * `ORG_CANDIDATES_VIEW`.
 *
 * **The row is a join with a number on it, and the schema says the number's scale.** A criterion points
 * at the verdict that carries it and at exactly one of the two things the sitting is assessed on — a
 * technology or a personal quality — and its rating is a whole number on an `integer` column, so the
 * member is `Int!` while every other rating in this domain is the exact decimal its `numeric` column
 * holds.
 *
 * **The verdict-scoped removal is not the plain removal.** `DELETE /feedback/:feedbackId` removes every
 * criterion of one verdict in one call, and the two bulk writes file or re-rate a whole verdict's
 * criteria at once; the three are the routes the assessment screen reaches and none is a narrowing of
 * the list, so each is a field of its own beside the three lifecycle routes.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability, and appended to the guard chain the routes already carry rather than replacing any part
 * of it.
 */
@Resolver('CandidateCriterionsRating')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
export class CandidateCriterionsRatingResolver {
	constructor(
		private readonly candidateCriterionsRatingService: CandidateCriterionsRatingService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The criterion ratings of the caller's tenant. `feedbackId` narrows them to one verdict's criteria.
	 *
	 * The read is the delivered list route's own: that route binds its query string to the query DTO and
	 * hands it to the service, and a caller that states nothing binds nothing — so the read runs with the
	 * route's own defaults, which is a tenant criterion the service stamps from the credential.
	 */
	@Query('candidateCriterionsRatings')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_VIEW)
	async candidateCriterionsRatings(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<CandidateCriterionsRating>> {
		const { items }: IPagination<ICandidateCriterionsRating> =
			await this.candidateCriterionsRatingService.findAll({});

		return buildConnection<CandidateCriterionsRating>({
			rows: (items ?? []) as CandidateCriterionsRating[],
			filterable: CRITERION_FILTERABLE,
			sortable: CRITERION_SORTABLE,
			defaultSort: CRITERION_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/** One criterion rating, or null when there is none. */
	@Query('candidateCriterionsRating')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async candidateCriterionsRating(
		@Args('id', { type: () => ID }) id: Id
	): Promise<CandidateCriterionsRating | null> {
		try {
			return await this.candidateCriterionsRatingService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/** How many criterion ratings the caller's tenant holds. */
	@Query('candidateCriterionsRatingCount')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async candidateCriterionsRatingCount(): Promise<number> {
		return await this.candidateCriterionsRatingService.countBy();
	}

	/** Files one criterion rating. */
	@Mutation('createCandidateCriterionsRating')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async createCandidateCriterionsRating(
		@Args('input') input: ICreateCandidateCriterionsRatingInput
	): Promise<CandidateCriterionsRating> {
		return await this.candidateCriterionsRatingService.create(input as never);
	}

	/** Edits one criterion rating, answering the row the write produced. */
	@Mutation('updateCandidateCriterionsRating')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async updateCandidateCriterionsRating(
		@Args('input') input: IUpdateCandidateCriterionsRatingInput
	): Promise<CandidateCriterionsRating> {
		const { id, ...values } = input;

		await this.candidateCriterionsRatingService.update(id, values as never);

		return await this.candidateCriterionsRatingService.findOneByIdString(id);
	}

	/** Removes one criterion rating outright. */
	@Mutation('deleteCandidateCriterionsRating')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async deleteCandidateCriterionsRating(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.candidateCriterionsRatingService.delete(id);

		return true;
	}

	/** Withdraws one criterion rating without removing it. */
	@Mutation('softDeleteCandidateCriterionsRating')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async softDeleteCandidateCriterionsRating(
		@Args('id', { type: () => ID }) id: Id
	): Promise<CandidateCriterionsRating> {
		return await this.candidateCriterionsRatingService.softRemove(id);
	}

	/** Puts a withdrawn criterion rating back. */
	@Mutation('recoverCandidateCriterionsRating')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async recoverCandidateCriterionsRating(
		@Args('id', { type: () => ID }) id: Id
	): Promise<CandidateCriterionsRating> {
		return await this.candidateCriterionsRatingService.softRecover(id);
	}

	/**
	 * Files a whole verdict's criteria in one call.
	 *
	 * The same command the bulk route dispatches, over the same body: the verdict every rating belongs to,
	 * the technologies rated and the qualities rated, each stated as the row it is about beside the number
	 * given to it. The delivered handler reads exactly those two members of each item and writes one row
	 * per item, so the field states what the body states and the answer is the rows it created.
	 */
	@Mutation('createCandidateCriterionsRatingsBulk')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async createCandidateCriterionsRatingsBulk(
		@Args('input') input: ICreateCandidateCriterionsRatingsBulkInput
	): Promise<CandidateCriterionsRating[]> {
		return await this.commandBus.execute(
			new CandidateCriterionsRatingBulkCreateCommand(
				input.feedbackId,
				(input.technologies ?? []).map((one) => ({
					id: one.technologyId,
					rating: one.rating,
					organizationId: one.organizationId
				})),
				(input.qualities ?? []).map((one) => ({
					id: one.personalQualityId,
					rating: one.rating,
					organizationId: one.organizationId
				}))
			)
		);
	}

	/**
	 * Writes a new number on each of a verdict's criteria in one call.
	 *
	 * The delivered handler pairs each stated number with a row by position and saves the rows, which is
	 * why the numbers are stated as lists beside the rows they belong to rather than as one member of
	 * each. Whatever the handler answers is what the field answers.
	 */
	@Mutation('updateCandidateCriterionsRatingsBulk')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async updateCandidateCriterionsRatingsBulk(
		@Args('input') input: IUpdateCandidateCriterionsRatingsBulkInput
	): Promise<CandidateCriterionsRating[]> {
		return await this.commandBus.execute(
			new CandidateCriterionsRatingBulkUpdateCommand({
				criterionsRating: input.criterionsRating as unknown as ICandidateCriterionsRating[],
				technologies: input.technologies ?? [],
				personalQualities: input.personalQualities ?? []
			})
		);
	}

	/**
	 * Removes every criterion rating of one verdict.
	 *
	 * The delivered handler deletes the rows it read for the verdict and answers nothing, so the field
	 * answers the fact that the write was accepted — which is what the route's own `200` states. A
	 * verdict that has no criteria is not a refusal, which is what makes the call idempotent.
	 */
	@Mutation('deleteCandidateCriterionsRatingsByFeedback')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async deleteCandidateCriterionsRatingsByFeedback(
		@Args('feedbackId', { type: () => ID }) feedbackId: Id
	): Promise<boolean> {
		await this.commandBus.execute(new CandidateCriterionsRatingBulkDeleteCommand(feedbackId));

		return true;
	}
}
