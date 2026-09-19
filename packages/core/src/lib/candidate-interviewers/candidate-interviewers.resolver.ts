import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, ICandidateInterviewers, IPagination, PermissionsEnum } from '@gauzy/contracts';
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
import { CandidateInterviewers } from './candidate-interviewers.entity';
import { CandidateInterviewersService } from './candidate-interviewers.service';
import {
	CandidateInterviewersBulkCreateCommand,
	CandidateInterviewersEmployeeBulkDeleteCommand,
	CandidateInterviewersInterviewBulkDeleteCommand
} from './commands';

/** The members `CreateCandidateInterviewerInput` declares in the schema. */
export interface ICreateCandidateInterviewerInput {
	interviewId: Id;
	employeeId?: Id;
	organizationId?: Id;
}

/** The members `UpdateCandidateInterviewerInput` declares in the schema. */
export interface IUpdateCandidateInterviewerInput extends Partial<ICreateCandidateInterviewerInput> {
	id: Id;
}

/** The members `CreateCandidateInterviewersBulkInput` declares in the schema. */
export interface ICreateCandidateInterviewersBulkInput {
	interviewId: Id;
	employeeIds: Id[];
	organizationId?: Id;
}

/**
 * The fields a panel list may be filtered and sorted by, and the order it is returned in when the caller
 * states none.
 *
 * `interviewId` is here because the delivered interview-scoped route is the same read with one more
 * predicate over a column the row carries. The employee is filterable as the identifier the engagement
 * is carried as, which is the only thing this row knows about the person on the panel.
 */
const INTERVIEWER_FILTERABLE = {
	id: 'ID',
	interviewId: 'ID',
	employeeId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	archivedAt: 'DATE',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the panel list's sort enum offers. */
const INTERVIEWER_SORTABLE = ['createdAt', 'updatedAt'] as const;

/** The order the connection applies when the caller states none. */
const INTERVIEWER_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The interview panel over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below reaches the same `CandidateInterviewersService` method, or dispatches the same
 * command, that the `/api/candidate-interviewers` routes reach.
 *
 * **The guard chain and the class permission are the controller's.** The controller carries
 * `TenantPermissionGuard` and `PermissionGuard` with `ORG_CANDIDATES_INTERVIEWERS_EDIT` on the class, and
 * it states a permission of its own on exactly one handler — the list, which runs under the interviewer
 * *view* permission. So the list field states the view permission and every other field states the edit
 * permission, because every other route runs under the class-level one. The members' tenant guard and
 * permission guard are read from that controller rather than restated, and the resolver's spec compares
 * the two lists instead of holding a third copy.
 *
 * **A panel seat is a pair, and the person on it is an engagement.** The row carries the sitting and the
 * engagement, and the engagement is what the panel is assembled from: an interviewer is an employee of
 * the organization, not an account and not a contact. The employee's own columns are read from
 * `employee(id)`; this surface carries the identifier, because the delivered read joins no relation.
 *
 * **The interview-scoped read folds into the list, and the two scoped removals do not.** The read is the
 * same reader with one more predicate over a column the row carries, so it is `interviewId` in the
 * filter. The removals are different operations: one clears a sitting's whole panel, the other removes
 * every seat one set of engagements holds anywhere in the tenant, and neither is expressible as a
 * narrowing of a list.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability, and appended to the guard chain the routes already carry rather than replacing any part
 * of it.
 */
@Resolver('CandidateInterviewer')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
export class CandidateInterviewersResolver {
	constructor(
		private readonly candidateInterviewersService: CandidateInterviewersService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The panel seats of the caller's tenant, newest first. `interviewId` narrows them to one sitting.
	 *
	 * The read is the delivered list route's own: that route reads a `where` member out of a `data`
	 * parameter and hands it to the service, and a caller that states none hands it none — so the read
	 * runs with the route's own defaults, which is a tenant criterion the service stamps from the
	 * credential.
	 */
	@Query('candidateInterviewers')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_VIEW)
	async candidateInterviewers(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<CandidateInterviewers>> {
		const { items }: IPagination<ICandidateInterviewers> = await this.candidateInterviewersService.findAll({});

		return buildConnection<CandidateInterviewers>({
			rows: (items ?? []) as CandidateInterviewers[],
			filterable: INTERVIEWER_FILTERABLE,
			sortable: INTERVIEWER_SORTABLE,
			defaultSort: INTERVIEWER_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/** One panel seat, or null when there is none. */
	@Query('candidateInterviewer')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
	async candidateInterviewer(@Args('id', { type: () => ID }) id: Id): Promise<CandidateInterviewers | null> {
		try {
			return await this.candidateInterviewersService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/** How many panel seats the caller's tenant holds. */
	@Query('candidateInterviewerCount')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
	async candidateInterviewerCount(): Promise<number> {
		return await this.candidateInterviewersService.countBy();
	}

	/**
	 * Puts one engagement on one panel.
	 *
	 * The write is the same service call the filing route makes, with the same body: the sitting and the
	 * engagement are stated as the identifiers the relation is written from.
	 */
	@Mutation('createCandidateInterviewer')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
	async createCandidateInterviewer(
		@Args('input') input: ICreateCandidateInterviewerInput
	): Promise<CandidateInterviewers> {
		return await this.candidateInterviewersService.create(input as never);
	}

	/** Edits one panel seat, answering the row the write produced. */
	@Mutation('updateCandidateInterviewer')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
	async updateCandidateInterviewer(
		@Args('input') input: IUpdateCandidateInterviewerInput
	): Promise<CandidateInterviewers> {
		const { id, ...values } = input;

		await this.candidateInterviewersService.update(id, values as never);

		return await this.candidateInterviewersService.findOneByIdString(id);
	}

	/** Removes one panel seat outright. */
	@Mutation('deleteCandidateInterviewer')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
	async deleteCandidateInterviewer(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.candidateInterviewersService.delete(id);

		return true;
	}

	/** Withdraws one panel seat without removing it. */
	@Mutation('softDeleteCandidateInterviewer')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
	async softDeleteCandidateInterviewer(
		@Args('id', { type: () => ID }) id: Id
	): Promise<CandidateInterviewers> {
		return await this.candidateInterviewersService.softRemove(id);
	}

	/** Puts a withdrawn panel seat back. */
	@Mutation('recoverCandidateInterviewer')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
	async recoverCandidateInterviewer(
		@Args('id', { type: () => ID }) id: Id
	): Promise<CandidateInterviewers> {
		return await this.candidateInterviewersService.softRecover(id);
	}

	/**
	 * Puts several engagements on one panel in one call.
	 *
	 * The same command the bulk route dispatches, with the same body: the sitting every seat belongs to
	 * and the engagements to seat on it. The delivered handler writes one row per engagement, in the order
	 * the engagements are stated, and answers the rows it wrote.
	 */
	@Mutation('createCandidateInterviewersBulk')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
	async createCandidateInterviewersBulk(
		@Args('input') input: ICreateCandidateInterviewersBulkInput
	): Promise<CandidateInterviewers[]> {
		return await this.commandBus.execute(new CandidateInterviewersBulkCreateCommand(input as never));
	}

	/**
	 * Clears one sitting's panel.
	 *
	 * The delivered handler deletes every seat of the sitting and answers nothing, so the field answers
	 * the fact that the write was accepted — which is what the route's own `200` states, and all it
	 * states. A sitting whose panel is already empty is not a refusal: the handler answers the same way,
	 * which is what makes the call idempotent.
	 */
	@Mutation('deleteCandidateInterviewersByInterview')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
	async deleteCandidateInterviewersByInterview(
		@Args('interviewId', { type: () => ID }) interviewId: Id
	): Promise<boolean> {
		await this.commandBus.execute(new CandidateInterviewersInterviewBulkDeleteCommand(interviewId));

		return true;
	}

	/**
	 * Removes every panel seat one set of engagements holds.
	 *
	 * The delivered route states the engagements as rows of a `deleteInput` list in its query string and
	 * its handler reads one member of each — the engagement's identifier — so the field states the
	 * identifiers, which is the same thing the body states with a row.
	 */
	@Mutation('deleteCandidateInterviewersByEmployee')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_INTERVIEWERS_EDIT)
	async deleteCandidateInterviewersByEmployee(
		@Args('employeeIds', { type: () => [ID] }) employeeIds: Id[]
	): Promise<boolean> {
		await this.commandBus.execute(
			new CandidateInterviewersEmployeeBulkDeleteCommand(employeeIds.map((employeeId) => ({ employeeId })))
		);

		return true;
	}
}
