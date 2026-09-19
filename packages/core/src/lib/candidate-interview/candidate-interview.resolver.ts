import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, ICandidateInterview, IPagination, PermissionsEnum } from '@gauzy/contracts';
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
import { CandidateInterview } from './candidate-interview.entity';
import { CandidateInterviewService } from './candidate-interview.service';

/** The members `CreateCandidateInterviewInput` declares in the schema. */
export interface ICreateCandidateInterviewInput {
	candidateId?: Id;
	title: string;
	startTime: Date;
	endTime: Date;
	location?: string;
	note?: string;
	rating?: number;
	organizationId?: Id;
}

/** The members `UpdateCandidateInterviewInput` declares in the schema. */
export interface IUpdateCandidateInterviewInput extends Partial<ICreateCandidateInterviewInput> {
	id: Id;
	isArchived?: boolean;
}

/**
 * The fields an interview list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * `candidateId` is here because the delivered candidate-scoped route is the same read with one more
 * predicate over a column the row carries; every other member is a column of the row as well. The
 * sitting's four collections are not here, and cannot be: the delivered read joins none of them, so the
 * rows this connection narrows carry no feedback, panel seat, technology or quality.
 */
const INTERVIEW_FILTERABLE = {
	id: 'ID',
	title: 'STRING',
	startTime: 'DATE',
	endTime: 'DATE',
	location: 'STRING',
	note: 'STRING',
	rating: 'DECIMAL',
	candidateId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	archivedAt: 'DATE',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the interview list's sort enum offers. */
const INTERVIEW_SORTABLE = ['createdAt', 'updatedAt', 'title', 'startTime', 'endTime', 'rating'] as const;

/** The order the connection applies when the caller states none. */
const INTERVIEW_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The interview over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below reaches the same `CandidateInterviewService` method that the
 * `/api/candidate-interview` routes reach.
 *
 * **The guard chain and the permission are the controller's, and this is the domain's one resource whose
 * reads run under its edit permission.** The controller carries `TenantPermissionGuard` and
 * `PermissionGuard` with `ORG_CANDIDATES_INTERVIEW_EDIT` on the class, and it states no permission on
 * any of its eight handlers — not on the list, not on the node, not on the count. So every field here
 * states the edit permission, and none states the interview *view* permission: that permission is
 * carried by the criterion-rating resource, which is a different controller, and widening this surface
 * to it would give GraphQL a scope REST does not have. The asymmetry between reading a sitting and
 * listing one is the controller's, and resolving it on one surface only is exactly what the
 * two-protocol rule forbids.
 *
 * **The candidate-scoped read folds into the list.** It is the same reader with one more predicate over
 * a column the row carries — the interview knows which candidacy it belongs to — so it is `candidateId`
 * in the list's filter rather than a root field that could disagree with the list about the same rows.
 *
 * **The sitting's four collections are read from their own surfaces.** A feedback, a panel seat, a
 * technology and a personal quality each belong to a sitting, and each is served by a root field of this
 * domain narrowed by `interviewId`. None of them is a member here, because the delivered read of a
 * sitting joins none of them and a member that answered null on every row would be read as "this sitting
 * has no panel" rather than as "this surface did not ask".
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability, and appended to the guard chain the routes already carry rather than replacing any part
 * of it.
 */
@Resolver('CandidateInterview')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
export class CandidateInterviewResolver {
	constructor(private readonly candidateInterviewService: CandidateInterviewService) {}

	/**
	 * The sittings of the caller's tenant, newest first. `candidateId` narrows them to one candidacy.
	 *
	 * The read is the delivered list route's own: that route binds its query string to the query DTO and
	 * hands it to the service, and a caller that states nothing binds nothing — so the read runs with the
	 * route's own defaults, which is a tenant criterion the service stamps from the credential.
	 */
	@Query('candidateInterviews')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async candidateInterviews(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<CandidateInterview>> {
		const { items }: IPagination<ICandidateInterview> = await this.candidateInterviewService.findAll({});

		return buildConnection<CandidateInterview>({
			rows: (items ?? []) as CandidateInterview[],
			filterable: INTERVIEW_FILTERABLE,
			sortable: INTERVIEW_SORTABLE,
			defaultSort: INTERVIEW_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One sitting, or null when there is none.
	 *
	 * The same read the delivered node route performs, with the route's own defaults: that route binds no
	 * relations, so the call is the one it makes.
	 */
	@Query('candidateInterview')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async candidateInterview(@Args('id', { type: () => ID }) id: Id): Promise<CandidateInterview | null> {
		try {
			return await this.candidateInterviewService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/** How many sittings the caller's tenant holds. */
	@Query('candidateInterviewCount')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async candidateInterviewCount(): Promise<number> {
		return await this.candidateInterviewService.countBy();
	}

	/**
	 * Schedules a sitting.
	 *
	 * The write is the same service call the scheduling route makes, with the same body: the candidacy is
	 * stated as the identifier the relation is written from, and the average is a member of the write
	 * because the delivered route persists whatever it is given — the platform's own reads compute it
	 * from the verdicts, and a caller that states one is stating it deliberately.
	 */
	@Mutation('createCandidateInterview')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async createCandidateInterview(
		@Args('input') input: ICreateCandidateInterviewInput
	): Promise<CandidateInterview> {
		return await this.candidateInterviewService.create(input as never);
	}

	/**
	 * Edits a sitting, answering the row the write produced.
	 *
	 * The delivered edit hands the store the stated columns beside the path identifier and answers the
	 * store's own update result — a statement about the write rather than a row — so the row is read back
	 * through the same reader the node field uses.
	 */
	@Mutation('updateCandidateInterview')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async updateCandidateInterview(
		@Args('input') input: IUpdateCandidateInterviewInput
	): Promise<CandidateInterview> {
		const { id, ...values } = input;

		await this.candidateInterviewService.update(id, values as never);

		return await this.candidateInterviewService.findOneByIdString(id);
	}

	/**
	 * Removes a sitting outright.
	 *
	 * The same service method the removal route calls. The verdicts, the panel seats and the two
	 * vocabularies that point at the sitting are the store's own constraint to answer for; this field
	 * does not pre-empt it.
	 */
	@Mutation('deleteCandidateInterview')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async deleteCandidateInterview(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.candidateInterviewService.delete(id);

		return true;
	}

	/** Withdraws a sitting without removing it. */
	@Mutation('softDeleteCandidateInterview')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async softDeleteCandidateInterview(@Args('id', { type: () => ID }) id: Id): Promise<CandidateInterview> {
		return await this.candidateInterviewService.softRemove(id);
	}

	/** Puts a withdrawn sitting back. */
	@Mutation('recoverCandidateInterview')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEW_EDIT)
	async recoverCandidateInterview(@Args('id', { type: () => ID }) id: Id): Promise<CandidateInterview> {
		return await this.candidateInterviewService.softRecover(id);
	}
}
