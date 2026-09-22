import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Query, Mutation, Resolver } from '@nestjs/graphql';
import { ID as Id, IPagination, PermissionsEnum } from '@gauzy/contracts';
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
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { CandidateDocument } from '../candidate-documents/candidate-documents.entity';
import { CandidateDocumentsService } from '../candidate-documents/candidate-documents.service';
import { CandidateEducation } from '../candidate-education/candidate-education.entity';
import { CandidateEducationService } from '../candidate-education/candidate-education.service';
import { CandidateExperience } from '../candidate-experience/candidate-experience.entity';
import { CandidateExperienceService } from '../candidate-experience/candidate-experience.service';
import { CandidateSkill } from '../candidate-skill/candidate-skill.entity';
import { CandidateSkillService } from '../candidate-skill/candidate-skill.service';
import { CandidateSource } from '../candidate-source/candidate-source.entity';
import { CandidateSourceService } from '../candidate-source/candidate-source.service';

/** The members `CreateCandidateDocumentInput` declares in the schema. */
export interface ICreateCandidateDocumentInput {
	candidateId?: Id;
	name: string;
	documentUrl?: string;
	organizationId?: Id;
}

/** The members `UpdateCandidateDocumentInput` declares in the schema. */
export interface IUpdateCandidateDocumentInput extends Partial<ICreateCandidateDocumentInput> {
	id: Id;
}

/** The members `CreateCandidateEducationInput` declares in the schema. */
export interface ICreateCandidateEducationInput {
	candidateId?: Id;
	schoolName: string;
	degree: string;
	field: string;
	completionDate: Date;
	notes?: string;
	organizationId: Id;
}

/** The members `UpdateCandidateEducationInput` declares in the schema. */
export interface IUpdateCandidateEducationInput extends Partial<ICreateCandidateEducationInput> {
	id: Id;
}

/** The members `CreateCandidateExperienceInput` declares in the schema. */
export interface ICreateCandidateExperienceInput {
	candidateId?: Id;
	occupation: string;
	duration: string;
	description?: string;
	organizationId: Id;
}

/** The members `UpdateCandidateExperienceInput` declares in the schema. */
export interface IUpdateCandidateExperienceInput extends Partial<ICreateCandidateExperienceInput> {
	id: Id;
}

/** The members `CreateCandidateSkillInput` declares in the schema. */
export interface ICreateCandidateSkillInput {
	candidateId?: Id;
	name: string;
	organizationId: Id;
}

/** The members `UpdateCandidateSkillInput` declares in the schema. */
export interface IUpdateCandidateSkillInput extends Partial<ICreateCandidateSkillInput> {
	id: Id;
}

/** The members `CreateCandidateSourceInput` declares in the schema. */
export interface ICreateCandidateSourceInput {
	name: string;
	organizationId: Id;
}

/** The members `UpdateCandidateSourceInput` declares in the schema. */
export interface IUpdateCandidateSourceInput extends Partial<ICreateCandidateSourceInput> {
	id: Id;
}

/**
 * The order every list below answers in when the caller states none.
 *
 * The five delivered list reads share one shape and therefore one order: none of them states an order of
 * its own — each hands the store a criterion and takes the rows as they come back — so this is a
 * decision the connection has to make rather than one it reproduces. Newest first, with the identifier
 * as the last key so two rows written in the same millisecond still have one order between them, which
 * is what makes a cursor walk over them stable.
 */
const PROFILE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The columns every row of this group carries, which is the base entity's shape.
 *
 * Declared once because it *is* one declaration: the five tables are the same base plus their own
 * columns, so stating the base five times would be five chances for the group to drift apart.
 */
const PROFILE_BASE_FILTERABLE = {
	id: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	archivedAt: 'DATE',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The base columns a caller may sort by, which is what every row of this group has in common. */
const PROFILE_BASE_SORTABLE = ['createdAt', 'updatedAt'] as const;

/** The columns a document list may be narrowed by. */
const DOCUMENT_FILTERABLE = {
	...PROFILE_BASE_FILTERABLE,
	name: 'STRING',
	documentUrl: 'STRING',
	candidateId: 'ID'
} as const;

/** The fields the document list's sort enum offers. */
const DOCUMENT_SORTABLE = [...PROFILE_BASE_SORTABLE, 'name'] as const;

/** The columns a course-of-study list may be narrowed by. */
const EDUCATION_FILTERABLE = {
	...PROFILE_BASE_FILTERABLE,
	schoolName: 'STRING',
	degree: 'STRING',
	field: 'STRING',
	completionDate: 'DATE',
	notes: 'STRING',
	candidateId: 'ID'
} as const;

/** The fields the course-of-study list's sort enum offers. */
const EDUCATION_SORTABLE = [...PROFILE_BASE_SORTABLE, 'schoolName', 'completionDate'] as const;

/** The columns a prior-engagement list may be narrowed by. */
const EXPERIENCE_FILTERABLE = {
	...PROFILE_BASE_FILTERABLE,
	occupation: 'STRING',
	duration: 'STRING',
	description: 'STRING',
	candidateId: 'ID'
} as const;

/** The fields the prior-engagement list's sort enum offers. */
const EXPERIENCE_SORTABLE = [...PROFILE_BASE_SORTABLE, 'occupation'] as const;

/** The columns a skill list may be narrowed by. */
const SKILL_FILTERABLE = {
	...PROFILE_BASE_FILTERABLE,
	name: 'STRING',
	candidateId: 'ID'
} as const;

/** The fields the skill list's sort enum offers. */
const SKILL_SORTABLE = [...PROFILE_BASE_SORTABLE, 'name'] as const;

/**
 * The columns a source list may be narrowed by.
 *
 * No `candidateId`, because the row has no such column: a source is the vocabulary of origins, and the
 * relation is written from the *candidate's* own `sourceId`. A filter here would be a narrowing the
 * delivered read cannot perform — the way to a candidacy's origin is `Candidate.sourceId` and then
 * `candidateSource(id:)`.
 */
const SOURCE_FILTERABLE = {
	...PROFILE_BASE_FILTERABLE,
	name: 'STRING'
} as const;

/** The fields the source list's sort enum offers. */
const SOURCE_SORTABLE = [...PROFILE_BASE_SORTABLE, 'name'] as const;

/**
 * The facts a candidacy's own file carries, over GraphQL.
 *
 * **Why these five resources are one resolver.** They are one shape repeated: every one of the five
 * controllers extends the same CRUD base, every one of the five services extends the same
 * `TenantAwareCrudService`, and every one of the five answers the same set of routes — the list, the
 * paginated spelling of it, the count, the row, the filing, the edit and the three lifecycle routes.
 * Four of the five carry one guard chain (`TenantPermissionGuard` and `PermissionGuard`, with the edit
 * permission on the class) and one read permission on the list (`ORG_CANDIDATES_VIEW`); the fifth, the
 * document, differs in exactly one statement — its list runs under `ORG_CANDIDATES_DOCUMENTS_VIEW` —
 * and agrees with the other four on the guard chain, on the class permission and on the shape of the
 * row. Splitting them across five resolver classes would state the shared order, the shared base
 * vocabulary and the shared guard chain five times, and would let four of the five drift; keeping them
 * in one class is what makes those one statement rather than five copies of it.
 *
 * The five are also one concept to the platform: they are the file a recruiter reads before an
 * interview, they are all keyed by `candidateId` (except the source, which the candidacy points at),
 * and the routes the platform serves them under are five spellings of `/api/candidate*`.
 *
 * **The guard chain is the five controllers' own, and one of them differs — which is why the permission
 * guard is stated per field rather than on the class.** Four of the five controllers carry
 * `TenantPermissionGuard` and `PermissionGuard` on the class; the experience controller carries
 * `TenantPermissionGuard` twice and no permission guard at all. A class-level `PermissionGuard` here
 * would therefore put a guard on the experience fields that their own route does not carry, so the class
 * states only what all five share — the tenant guard — and each field of the other four restates the
 * permission guard exactly as its own controller states it. That restatement is not decoration: the
 * guard is read per handler, and a resolver that approximated this would be a second answer to the
 * question of what guards a route runs under.
 *
 * All five carry the edit permission on the class. Every field below therefore states the permission its
 * own route runs under: four lists state the candidate view permission, the document list states the
 * document view permission, and every other field states the edit permission, because none of the five
 * controllers states a permission on any of its other handlers.
 *
 * **An edit answers the row it produced, and the delivered handler answers a statement about the
 * write.** Each of the five `PUT /:id` routes hands the store the stated columns and answers the store's
 * own update result, which is not a row; the field reads the row back through the same reader the
 * one-row field uses, which is what the delivered surfaces for the vocabulary resources do. The
 * document is the exception in form only — its edit route is the inherited one, which also answers the
 * store's result — so it is read back the same way.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability, and appended to the guard chain the routes already carry rather than replacing any part
 * of it.
 */
@Resolver()
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
export class CandidateProfileResolver {
	constructor(
		private readonly candidateDocumentsService: CandidateDocumentsService,
		private readonly candidateEducationService: CandidateEducationService,
		private readonly candidateExperienceService: CandidateExperienceService,
		private readonly candidateSkillService: CandidateSkillService,
		private readonly candidateSourceService: CandidateSourceService
	) {}

	// ---------------------------------------------------------------------------------------------
	// The documents a candidacy filed
	// ---------------------------------------------------------------------------------------------

	/**
	 * The documents of the caller's tenant. `candidateId` narrows them to one person's file.
	 *
	 * The read is the delivered list route's own: that route hands the service a criterion built out of
	 * its query string's `where` member and takes the rows as they come back. This surface has no query
	 * string to bind, so the read runs with the route's own default — no narrowing — and the caller's
	 * arrives in `filter`, applied to the rows the route answered.
	 */
	@Query('candidateDocuments')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_DOCUMENTS_VIEW)
	@UseGuards(PermissionGuard)
	async candidateDocuments(
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
	): Promise<GraphqlConnection<CandidateDocument>> {
		return await this.list(
			await this.candidateDocumentsService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) }),
			DOCUMENT_FILTERABLE,
			DOCUMENT_SORTABLE,
			{ filter, sort, page, first, after, last, before, limit, offset }
		);
	}

	/** One document, or null when there is none. */
	@Query('candidateDocument')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async candidateDocument(@Args('id', { type: () => ID }) id: Id): Promise<CandidateDocument | null> {
		return await this.oneOrNone(this.candidateDocumentsService, id);
	}

	/** How many documents the caller's tenant holds. */
	@Query('candidateDocumentCount')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async candidateDocumentCount(): Promise<number> {
		return await this.candidateDocumentsService.countBy();
	}

	/** Files a document under a candidacy. */
	@Mutation('createCandidateDocument')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async createCandidateDocument(
		@Args('input') input: ICreateCandidateDocumentInput
	): Promise<CandidateDocument> {
		return await this.candidateDocumentsService.create(input as never);
	}

	/** Edits a document, answering the row the write produced. */
	@Mutation('updateCandidateDocument')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async updateCandidateDocument(
		@Args('input') input: IUpdateCandidateDocumentInput
	): Promise<CandidateDocument> {
		const { id, ...values } = input;

		return await this.writeThenRead(this.candidateDocumentsService, id, values);
	}

	/** Removes a document outright. */
	@Mutation('deleteCandidateDocument')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async deleteCandidateDocument(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.candidateDocumentsService.delete(id);

		return true;
	}

	/** Withdraws a document without removing it. */
	@Mutation('softDeleteCandidateDocument')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async softDeleteCandidateDocument(@Args('id', { type: () => ID }) id: Id): Promise<CandidateDocument> {
		return await this.candidateDocumentsService.softRemove(id);
	}

	/** Puts a withdrawn document back. */
	@Mutation('recoverCandidateDocument')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async recoverCandidateDocument(@Args('id', { type: () => ID }) id: Id): Promise<CandidateDocument> {
		return await this.candidateDocumentsService.softRecover(id);
	}

	// ---------------------------------------------------------------------------------------------
	// The studies a candidacy filed
	// ---------------------------------------------------------------------------------------------

	/** The courses of study of the caller's tenant, narrowed to one person's file by `candidateId`. */
	@Query('candidateEducations')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@UseGuards(PermissionGuard)
	async candidateEducations(
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
	): Promise<GraphqlConnection<CandidateEducation>> {
		return await this.list(
			await this.candidateEducationService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) }),
			EDUCATION_FILTERABLE,
			EDUCATION_SORTABLE,
			{ filter, sort, page, first, after, last, before, limit, offset }
		);
	}

	/** One course of study, or null when there is none. */
	@Query('candidateEducation')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async candidateEducation(@Args('id', { type: () => ID }) id: Id): Promise<CandidateEducation | null> {
		return await this.oneOrNone(this.candidateEducationService, id);
	}

	/** How many courses of study the caller's tenant holds. */
	@Query('candidateEducationCount')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async candidateEducationCount(): Promise<number> {
		return await this.candidateEducationService.countBy();
	}

	/** Files a course of study under a candidacy. */
	@Mutation('createCandidateEducation')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async createCandidateEducation(
		@Args('input') input: ICreateCandidateEducationInput
	): Promise<CandidateEducation> {
		return await this.candidateEducationService.create(input as never);
	}

	/** Edits a course of study, answering the row the write produced. */
	@Mutation('updateCandidateEducation')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async updateCandidateEducation(
		@Args('input') input: IUpdateCandidateEducationInput
	): Promise<CandidateEducation> {
		const { id, ...values } = input;

		return await this.writeThenRead(this.candidateEducationService, id, values);
	}

	/** Removes a course of study outright. */
	@Mutation('deleteCandidateEducation')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async deleteCandidateEducation(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.candidateEducationService.delete(id);

		return true;
	}

	/** Withdraws a course of study without removing it. */
	@Mutation('softDeleteCandidateEducation')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async softDeleteCandidateEducation(@Args('id', { type: () => ID }) id: Id): Promise<CandidateEducation> {
		return await this.candidateEducationService.softRemove(id);
	}

	/** Puts a withdrawn course of study back. */
	@Mutation('recoverCandidateEducation')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async recoverCandidateEducation(@Args('id', { type: () => ID }) id: Id): Promise<CandidateEducation> {
		return await this.candidateEducationService.softRecover(id);
	}

	// ---------------------------------------------------------------------------------------------
	// The work a candidacy filed
	// ---------------------------------------------------------------------------------------------

	/**
	 * The prior engagements of the caller's tenant, narrowed to one person's file by `candidateId`.
	 *
	 * The read is the delivered list route's own, which is the delivered *service's* own: that service
	 * overrides the reader to state a projection of the organization relation. The projection never
	 * materialises — the call joins no relation — so the rows this connection narrows are the rows the
	 * store returns whole, and no organization member is carried on the type for that reason.
	 */
	@Query('candidateExperiences')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	async candidateExperiences(
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
	): Promise<GraphqlConnection<CandidateExperience>> {
		return await this.list(
			await this.candidateExperienceService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) }),
			EXPERIENCE_FILTERABLE,
			EXPERIENCE_SORTABLE,
			{ filter, sort, page, first, after, last, before, limit, offset }
		);
	}

	/** One prior engagement, or null when there is none. */
	@Query('candidateExperience')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	async candidateExperience(@Args('id', { type: () => ID }) id: Id): Promise<CandidateExperience | null> {
		return await this.oneOrNone(this.candidateExperienceService, id);
	}

	/** How many prior engagements the caller's tenant holds. */
	@Query('candidateExperienceCount')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	async candidateExperienceCount(): Promise<number> {
		return await this.candidateExperienceService.countBy();
	}

	/** Files a prior engagement under a candidacy. */
	@Mutation('createCandidateExperience')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	async createCandidateExperience(
		@Args('input') input: ICreateCandidateExperienceInput
	): Promise<CandidateExperience> {
		return await this.candidateExperienceService.create(input as never);
	}

	/** Edits a prior engagement, answering the row the write produced. */
	@Mutation('updateCandidateExperience')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	async updateCandidateExperience(
		@Args('input') input: IUpdateCandidateExperienceInput
	): Promise<CandidateExperience> {
		const { id, ...values } = input;

		return await this.writeThenRead(this.candidateExperienceService, id, values);
	}

	/** Removes a prior engagement outright. */
	@Mutation('deleteCandidateExperience')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	async deleteCandidateExperience(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.candidateExperienceService.delete(id);

		return true;
	}

	/** Withdraws a prior engagement without removing it. */
	@Mutation('softDeleteCandidateExperience')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	async softDeleteCandidateExperience(@Args('id', { type: () => ID }) id: Id): Promise<CandidateExperience> {
		return await this.candidateExperienceService.softRemove(id);
	}

	/** Puts a withdrawn prior engagement back. */
	@Mutation('recoverCandidateExperience')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	async recoverCandidateExperience(@Args('id', { type: () => ID }) id: Id): Promise<CandidateExperience> {
		return await this.candidateExperienceService.softRecover(id);
	}

	// ---------------------------------------------------------------------------------------------
	// The skills a candidacy claims
	// ---------------------------------------------------------------------------------------------

	/** The skills of the caller's tenant, narrowed to one person's file by `candidateId`. */
	@Query('candidateSkills')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@UseGuards(PermissionGuard)
	async candidateSkills(
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
	): Promise<GraphqlConnection<CandidateSkill>> {
		return await this.list(
			await this.candidateSkillService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) }),
			SKILL_FILTERABLE,
			SKILL_SORTABLE,
			{ filter, sort, page, first, after, last, before, limit, offset }
		);
	}

	/** One skill, or null when there is none. */
	@Query('candidateSkill')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async candidateSkill(@Args('id', { type: () => ID }) id: Id): Promise<CandidateSkill | null> {
		return await this.oneOrNone(this.candidateSkillService, id);
	}

	/** How many skills the caller's tenant holds. */
	@Query('candidateSkillCount')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async candidateSkillCount(): Promise<number> {
		return await this.candidateSkillService.countBy();
	}

	/** Files a skill under a candidacy. */
	@Mutation('createCandidateSkill')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async createCandidateSkill(@Args('input') input: ICreateCandidateSkillInput): Promise<CandidateSkill> {
		return await this.candidateSkillService.create(input as never);
	}

	/** Edits a skill, answering the row the write produced. */
	@Mutation('updateCandidateSkill')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async updateCandidateSkill(@Args('input') input: IUpdateCandidateSkillInput): Promise<CandidateSkill> {
		const { id, ...values } = input;

		return await this.writeThenRead(this.candidateSkillService, id, values);
	}

	/** Removes a skill outright. */
	@Mutation('deleteCandidateSkill')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async deleteCandidateSkill(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.candidateSkillService.delete(id);

		return true;
	}

	/** Withdraws a skill without removing it. */
	@Mutation('softDeleteCandidateSkill')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async softDeleteCandidateSkill(@Args('id', { type: () => ID }) id: Id): Promise<CandidateSkill> {
		return await this.candidateSkillService.softRemove(id);
	}

	/** Puts a withdrawn skill back. */
	@Mutation('recoverCandidateSkill')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async recoverCandidateSkill(@Args('id', { type: () => ID }) id: Id): Promise<CandidateSkill> {
		return await this.candidateSkillService.softRecover(id);
	}

	// ---------------------------------------------------------------------------------------------
	// The origins the candidacies point at
	// ---------------------------------------------------------------------------------------------

	/**
	 * The origins of the caller's tenant.
	 *
	 * This one is a vocabulary and not a person's file, which is why it has no `candidateId` to narrow
	 * by: the relation runs from the candidacy's own `sourceId` column.
	 */
	@Query('candidateSources')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	@UseGuards(PermissionGuard)
	async candidateSources(
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
	): Promise<GraphqlConnection<CandidateSource>> {
		return await this.list(
			await this.candidateSourceService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) }),
			SOURCE_FILTERABLE,
			SOURCE_SORTABLE,
			{ filter, sort, page, first, after, last, before, limit, offset }
		);
	}

	/** One origin, or null when there is none. */
	@Query('candidateSource')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async candidateSource(@Args('id', { type: () => ID }) id: Id): Promise<CandidateSource | null> {
		return await this.oneOrNone(this.candidateSourceService, id);
	}

	/** How many origins the caller's tenant records. */
	@Query('candidateSourceCount')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async candidateSourceCount(): Promise<number> {
		return await this.candidateSourceService.countBy();
	}

	/** Files an origin into the vocabulary the candidacies point at. */
	@Mutation('createCandidateSource')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async createCandidateSource(@Args('input') input: ICreateCandidateSourceInput): Promise<CandidateSource> {
		return await this.candidateSourceService.create(input as never);
	}

	/** Edits an origin, answering the row the write produced. */
	@Mutation('updateCandidateSource')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async updateCandidateSource(@Args('input') input: IUpdateCandidateSourceInput): Promise<CandidateSource> {
		const { id, ...values } = input;

		return await this.writeThenRead(this.candidateSourceService, id, values);
	}

	/** Removes an origin outright. A candidacy that still points at it is the store's to refuse. */
	@Mutation('deleteCandidateSource')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async deleteCandidateSource(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.candidateSourceService.delete(id);

		return true;
	}

	/** Withdraws an origin without removing it. */
	@Mutation('softDeleteCandidateSource')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async softDeleteCandidateSource(@Args('id', { type: () => ID }) id: Id): Promise<CandidateSource> {
		return await this.candidateSourceService.softRemove(id);
	}

	/** Puts a withdrawn origin back. */
	@Mutation('recoverCandidateSource')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@UseGuards(PermissionGuard)
	async recoverCandidateSource(@Args('id', { type: () => ID }) id: Id): Promise<CandidateSource> {
		return await this.candidateSourceService.softRecover(id);
	}

	// ---------------------------------------------------------------------------------------------
	// The three helpers every section above shares
	// ---------------------------------------------------------------------------------------------

	/**
	 * The connection one list field answers with.
	 *
	 * The five lists share one implementation, one default order and one shape, which is the whole reason
	 * they are one resolver: a connection that answered another way would be a second contract on the
	 * same endpoint. What each list states of its own is the vocabulary its *own* rows carry, so a filter
	 * is never advertised over a column the delivered read never returned.
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
			defaultSort: PROFILE_DEFAULT_SORT,
			request
		});
	}

	/**
	 * One row, or null when there is none.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the
	 * other protocol's vocabulary.
	 */
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

	/**
	 * The row a write produced, read back through the same service.
	 *
	 * The delivered edit answers the store's own update result — a statement about the write rather than
	 * a row — which is not what a field named `update…` may return. The row is therefore read back,
	 * through the same reader the one-row field uses.
	 */
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
