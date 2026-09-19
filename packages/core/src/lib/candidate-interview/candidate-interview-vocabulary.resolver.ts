import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, IPagination, RolesEnum } from '@gauzy/contracts';
import {
	ConnectionFieldKind,
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { Roles } from '../shared/decorators';
import { FeatureFlagGuard, RoleGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { CandidatePersonalQualities } from '../candidate-personal-qualities/candidate-personal-qualities.entity';
import { CandidatePersonalQualitiesService } from '../candidate-personal-qualities/candidate-personal-qualities.service';
import { CandidatePersonalQualitiesBulkCreateCommand, CandidatePersonalQualitiesBulkDeleteCommand } from '../candidate-personal-qualities/commands';
import { CandidateTechnologies } from '../candidate-technologies/candidate-technologies.entity';
import { CandidateTechnologiesService } from '../candidate-technologies/candidate-technologies.service';
import {
	CandidateTechnologiesBulkCreateCommand,
	CandidateTechnologiesBulkDeleteCommand,
	CandidateTechnologiesBulkUpdateCommand
} from '../candidate-technologies/commands';

/** The members `CreateCandidateTechnologyInput` declares in the schema. */
export interface ICreateCandidateTechnologyInput {
	interviewId?: Id;
	name: string;
	rating?: number;
	organizationId?: Id;
}

/** The members `UpdateCandidateTechnologyInput` declares in the schema. */
export interface IUpdateCandidateTechnologyInput extends Partial<ICreateCandidateTechnologyInput> {
	id: Id;
}

/** The members `CreateCandidatePersonalQualityInput` declares in the schema. */
export interface ICreateCandidatePersonalQualityInput extends ICreateCandidateTechnologyInput {}

/** The members `UpdateCandidatePersonalQualityInput` declares in the schema. */
export interface IUpdateCandidatePersonalQualityInput extends Partial<ICreateCandidatePersonalQualityInput> {
	id: Id;
}

/** The members `CandidateTechnologyRatingInput` declares in the schema. */
export interface ICandidateTechnologyRatingInput {
	id: Id;
	rating?: number;
	organizationId?: Id;
}

/**
 * The roles the delivered handlers state, read once.
 *
 * The three controllers in this domain that carry them — the two vocabularies below and nothing else —
 * state the same three, and they state them per handler rather than on the class, which is why the
 * resolver states them per field and reads the same three from the same place.
 */
const VOCABULARY_ROLES = [RolesEnum.CANDIDATE, RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN] as const;

/**
 * The order both lists below answer in when the caller states none.
 *
 * Neither delivered reader states an order of its own — each hands the store a criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces. Newest first, with the identifier as the last key so two rows written in the same
 * millisecond still have one order between them.
 */
const VOCABULARY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The columns both rows carry, which is the base entity's shape plus the two the two tables share.
 *
 * One declaration, two readings: a technology and a personal quality are the same row — a name, an
 * average, and the sitting they belong to — so the fields a caller may narrow them by are the same
 * fields, and stating them once is what keeps the two connections from drifting apart.
 */
const VOCABULARY_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	rating: 'DECIMAL',
	interviewId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	archivedAt: 'DATE',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields both sort enums offer. */
const VOCABULARY_SORTABLE = ['createdAt', 'updatedAt', 'name', 'rating'] as const;

/**
 * The vocabulary an interview is assessed against, over GraphQL.
 *
 * **Why these two resources are one resolver.** A technology and a personal quality are one shape
 * repeated: both are a name and an average hanging off one sitting, both controllers extend the same
 * CRUD base, both services extend the same `TenantAwareCrudService`, and both are guarded the same way —
 * the tenant guard on the class, the role guard and the same three roles on every handler the controller
 * declares, and neither a class-level nor a handler-level permission anywhere. Their route sets differ in
 * exactly one statement: the technology controller also serves a bulk *update*, which the quality
 * controller does not. That is one field's difference, and it does not justify a second class that would
 * restate the shared order, the shared vocabulary and the shared guard chain.
 *
 * **The guard chain is the controllers', and no field states a permission.** Both controllers carry
 * `TenantPermissionGuard` on the class and nothing else — there is no `PermissionGuard` in either chain
 * and no permission on either class or on any handler — so this resolver carries the tenant guard and
 * the gate alone, and a field that demanded a permission would refuse a caller every one of those routes
 * serves. What the controllers *do* state, per handler, is `RoleGuard` and the same three roles, so the
 * fields whose routes state them restate them, and the fields whose routes are inherited from the CRUD
 * base — the count, the node, the edit and the two lifecycle routes — state nothing, because those
 * routes state nothing. That asymmetry is the controllers' own, and it is the reason the role guard is
 * on the fields rather than on the class.
 *
 * **The interview-scoped read folds into the list.** It is the same reader with one more predicate over
 * a column both rows carry, so it is `interviewId` in each list's filter. The two bulk deletions are not
 * reads and do not fold: each removes the named rows, or the sitting's whole vocabulary when the caller
 * names none, and each is therefore a field of its own.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability, and appended to the guard chain the routes already carry rather than replacing any part
 * of it.
 */
@Resolver()
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class CandidateInterviewVocabularyResolver {
	constructor(
		private readonly candidateTechnologiesService: CandidateTechnologiesService,
		private readonly candidatePersonalQualitiesService: CandidatePersonalQualitiesService,
		private readonly commandBus: CommandBus
	) {}

	// ---------------------------------------------------------------------------------------------
	// The technologies
	// ---------------------------------------------------------------------------------------------

	/** The technologies the panels assess. `interviewId` narrows them to one sitting's vocabulary. */
	@Query('candidateTechnologies')
	@UseGuards(RoleGuard)
	@Roles(...VOCABULARY_ROLES)
	async candidateTechnologies(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<CandidateTechnologies>> {
		return await this.list(
			await this.candidateTechnologiesService.findAll({}),
			VOCABULARY_FILTERABLE,
			VOCABULARY_SORTABLE,
			{ filter, sort, page, first, after, last, before, limit, offset }
		);
	}

	/** One technology, or null when there is none. */
	@Query('candidateTechnology')
	async candidateTechnology(@Args('id', { type: () => ID }) id: Id): Promise<CandidateTechnologies | null> {
		return await this.oneOrNone(this.candidateTechnologiesService, id);
	}

	/** How many technologies the caller's tenant records. */
	@Query('candidateTechnologyCount')
	async candidateTechnologyCount(): Promise<number> {
		return await this.candidateTechnologiesService.countBy();
	}

	/** Files one technology under a sitting. */
	@Mutation('createCandidateTechnology')
	@UseGuards(RoleGuard)
	@Roles(...VOCABULARY_ROLES)
	async createCandidateTechnology(
		@Args('input') input: ICreateCandidateTechnologyInput
	): Promise<CandidateTechnologies> {
		return await this.candidateTechnologiesService.create(input as never);
	}

	/** Edits a technology, answering the row the write produced. */
	@Mutation('updateCandidateTechnology')
	async updateCandidateTechnology(
		@Args('input') input: IUpdateCandidateTechnologyInput
	): Promise<CandidateTechnologies> {
		const { id, ...values } = input;

		return await this.writeThenRead(this.candidateTechnologiesService, id, values);
	}

	/** Removes a technology outright. The criteria rated against it are the store's to answer for. */
	@Mutation('deleteCandidateTechnology')
	@UseGuards(RoleGuard)
	@Roles(...VOCABULARY_ROLES)
	async deleteCandidateTechnology(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.candidateTechnologiesService.delete(id);

		return true;
	}

	/** Withdraws a technology without removing it. */
	@Mutation('softDeleteCandidateTechnology')
	async softDeleteCandidateTechnology(@Args('id', { type: () => ID }) id: Id): Promise<CandidateTechnologies> {
		return await this.candidateTechnologiesService.softRemove(id);
	}

	/** Puts a withdrawn technology back. */
	@Mutation('recoverCandidateTechnology')
	async recoverCandidateTechnology(@Args('id', { type: () => ID }) id: Id): Promise<CandidateTechnologies> {
		return await this.candidateTechnologiesService.softRecover(id);
	}

	/**
	 * Files several technologies under one sitting, and answers the rows it created.
	 *
	 * The same command the bulk route dispatches, with the same two members its body carries: the sitting
	 * every row belongs to, and the names to file. The delivered handler writes one row per name, in the
	 * order the names are stated.
	 */
	@Mutation('createCandidateTechnologiesBulk')
	@UseGuards(RoleGuard)
	@Roles(...VOCABULARY_ROLES)
	async createCandidateTechnologiesBulk(
		@Args('interviewId', { type: () => ID }) interviewId: Id,
		@Args('technologies', { type: () => [String] }) technologies: string[]
	): Promise<CandidateTechnologies[]> {
		return await this.commandBus.execute(
			new CandidateTechnologiesBulkCreateCommand(interviewId, technologies)
		);
	}

	/**
	 * Writes a new number on each of a verdict's technology criteria.
	 *
	 * The delivered handler dispatches one update per row without awaiting them and answers nothing at
	 * all, so the field answers the fact that the write was accepted — which is exactly what the route's
	 * own `200` states — rather than a page it would have to read before the writes it has just started
	 * have landed.
	 */
	@Mutation('updateCandidateTechnologiesBulk')
	@UseGuards(RoleGuard)
	@Roles(...VOCABULARY_ROLES)
	async updateCandidateTechnologiesBulk(
		@Args('technologies') technologies: ICandidateTechnologyRatingInput[]
	): Promise<boolean> {
		await this.commandBus.execute(
			new CandidateTechnologiesBulkUpdateCommand(technologies as unknown as CandidateTechnologies[])
		);

		return true;
	}

	/**
	 * Removes technologies from one sitting, or clears its whole technology vocabulary when the caller
	 * states no row.
	 *
	 * The delivered route states the rows as full objects in its query string and its handler reads one
	 * member of each — the identifier — so the field states the identifiers, which is the same thing the
	 * body states with a row.
	 */
	@Mutation('deleteCandidateTechnologiesBulk')
	@UseGuards(RoleGuard)
	@Roles(...VOCABULARY_ROLES)
	async deleteCandidateTechnologiesBulk(
		@Args('interviewId', { type: () => ID }) interviewId: Id,
		@Args('technologies', { type: () => [ID], nullable: true }) technologies?: Id[]
	): Promise<boolean> {
		await this.commandBus.execute(
			new CandidateTechnologiesBulkDeleteCommand(
				interviewId,
				technologies ? (technologies.map((id) => ({ id })) as unknown as CandidateTechnologies[]) : undefined
			)
		);

		return true;
	}

	// ---------------------------------------------------------------------------------------------
	// The personal qualities
	// ---------------------------------------------------------------------------------------------

	/** The personal qualities the panels assess. `interviewId` narrows them to one sitting's vocabulary. */
	@Query('candidatePersonalQualities')
	@UseGuards(RoleGuard)
	@Roles(...VOCABULARY_ROLES)
	async candidatePersonalQualities(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<CandidatePersonalQualities>> {
		return await this.list(
			await this.candidatePersonalQualitiesService.findAll({}),
			VOCABULARY_FILTERABLE,
			VOCABULARY_SORTABLE,
			{ filter, sort, page, first, after, last, before, limit, offset }
		);
	}

	/** One personal quality, or null when there is none. */
	@Query('candidatePersonalQuality')
	async candidatePersonalQuality(
		@Args('id', { type: () => ID }) id: Id
	): Promise<CandidatePersonalQualities | null> {
		return await this.oneOrNone(this.candidatePersonalQualitiesService, id);
	}

	/** How many personal qualities the caller's tenant records. */
	@Query('candidatePersonalQualityCount')
	async candidatePersonalQualityCount(): Promise<number> {
		return await this.candidatePersonalQualitiesService.countBy();
	}

	/** Files one personal quality under a sitting. */
	@Mutation('createCandidatePersonalQuality')
	@UseGuards(RoleGuard)
	@Roles(...VOCABULARY_ROLES)
	async createCandidatePersonalQuality(
		@Args('input') input: ICreateCandidatePersonalQualityInput
	): Promise<CandidatePersonalQualities> {
		return await this.candidatePersonalQualitiesService.create(input as never);
	}

	/** Edits a personal quality, answering the row the write produced. */
	@Mutation('updateCandidatePersonalQuality')
	async updateCandidatePersonalQuality(
		@Args('input') input: IUpdateCandidatePersonalQualityInput
	): Promise<CandidatePersonalQualities> {
		const { id, ...values } = input;

		return await this.writeThenRead(this.candidatePersonalQualitiesService, id, values);
	}

	/** Removes a personal quality outright. The criteria rated against it are the store's to answer for. */
	@Mutation('deleteCandidatePersonalQuality')
	@UseGuards(RoleGuard)
	@Roles(...VOCABULARY_ROLES)
	async deleteCandidatePersonalQuality(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.candidatePersonalQualitiesService.delete(id);

		return true;
	}

	/** Withdraws a personal quality without removing it. */
	@Mutation('softDeleteCandidatePersonalQuality')
	async softDeleteCandidatePersonalQuality(
		@Args('id', { type: () => ID }) id: Id
	): Promise<CandidatePersonalQualities> {
		return await this.candidatePersonalQualitiesService.softRemove(id);
	}

	/** Puts a withdrawn personal quality back. */
	@Mutation('recoverCandidatePersonalQuality')
	async recoverCandidatePersonalQuality(
		@Args('id', { type: () => ID }) id: Id
	): Promise<CandidatePersonalQualities> {
		return await this.candidatePersonalQualitiesService.softRecover(id);
	}

	/** Files several personal qualities under one sitting, and answers the rows it created. */
	@Mutation('createCandidatePersonalQualitiesBulk')
	@UseGuards(RoleGuard)
	@Roles(...VOCABULARY_ROLES)
	async createCandidatePersonalQualitiesBulk(
		@Args('interviewId', { type: () => ID }) interviewId: Id,
		@Args('personalQualities', { type: () => [String] }) personalQualities: string[]
	): Promise<CandidatePersonalQualities[]> {
		return await this.commandBus.execute(
			new CandidatePersonalQualitiesBulkCreateCommand(interviewId, personalQualities)
		);
	}

	/** Removes personal qualities from one sitting, or clears its whole quality vocabulary. */
	@Mutation('deleteCandidatePersonalQualitiesBulk')
	@UseGuards(RoleGuard)
	@Roles(...VOCABULARY_ROLES)
	async deleteCandidatePersonalQualitiesBulk(
		@Args('interviewId', { type: () => ID }) interviewId: Id,
		@Args('personalQualities', { type: () => [ID], nullable: true }) personalQualities?: Id[]
	): Promise<boolean> {
		await this.commandBus.execute(
			new CandidatePersonalQualitiesBulkDeleteCommand(
				interviewId,
				personalQualities
					? (personalQualities.map((id) => ({ id })) as unknown as CandidatePersonalQualities[])
					: undefined
			)
		);

		return true;
	}

	// ---------------------------------------------------------------------------------------------
	// The four helpers both sections share
	// ---------------------------------------------------------------------------------------------

	/**
	 * The connection one list field answers with.
	 *
	 * The two lists share one implementation, one order and one vocabulary, which is the whole reason they
	 * are one resolver: a connection that answered another way would be a second contract on the same
	 * endpoint.
	 */
	private async list<T>(
		answer: IPagination<T>,
		filterable: Readonly<Record<string, ConnectionFieldKind>>,
		sortable: readonly string[],
		request: ConnectionRequest
	): Promise<GraphqlConnection<T>> {
		return buildConnection<T>({
			rows: answer?.items ?? [],
			filterable,
			sortable,
			defaultSort: VOCABULARY_DEFAULT_SORT,
			request
		});
	}

	/** One row, or null when there is none. */
	private async oneOrNone<T>(
		service: { findOneByIdString(id: Id, options?: unknown): Promise<T> },
		id: Id
	): Promise<T | null> {
		try {
			return await service.findOneByIdString(id);
		} catch (error) {
			if (this.isMiss(error)) {
				return null;
			}

			throw error;
		}
	}

	/** The row a write produced, read back through the same service. */
	private async writeThenRead<T>(
		service: { update(id: Id, values: unknown): Promise<unknown>; findOneByIdString(id: Id): Promise<T> },
		id: Id,
		values: unknown
	): Promise<T> {
		await service.update(id, values);

		return await service.findOneByIdString(id);
	}

	/**
	 * Whether an answer is a miss rather than a refusal.
	 *
	 * The two are different facts and the surface must not merge them: a miss is `null` on a field that
	 * may have none, and a refusal is the error the caller is owed.
	 */
	private isMiss(error: unknown): boolean {
		return (
			error instanceof NotFoundException ||
			(error instanceof Error &&
				'getStatus' in error &&
				typeof (error as { getStatus(): number }).getStatus === 'function' &&
				(error as { getStatus(): number }).getStatus() === 404)
		);
	}
}
