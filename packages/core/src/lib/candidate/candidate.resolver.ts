import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ID as Id,
	ICandidate,
	ICandidateCreateInput,
	ICandidateUpdateInput,
	IPagination,
	LanguagesEnum,
	PermissionsEnum,
	CandidateStatusType
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { BaseQueryDTO } from '../core/crud';
import { RequestContext } from '../core/context';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Candidate } from './candidate.entity';
import { CandidateService } from './candidate.service';
import {
	CandidateBulkCreateCommand,
	CandidateCreateCommand,
	CandidateHiredCommand,
	CandidateRejectedCommand,
	CandidateUpdateCommand
} from './commands';

/** The members `CandidateUserInput` declares in the schema. */
export interface ICandidateUserInput {
	email: string;
	firstName?: string;
	lastName?: string;
	imageUrl?: string;
}

/** The members `CreateCandidateInput` declares in the schema. */
export interface ICreateCandidateInput {
	organizationId: Id;
	user: ICandidateUserInput;
	password: string;
	organizationPositionId?: Id;
	tagIds?: Id[];
}

/** The members `UpdateCandidateInput` declares in the schema. */
export interface IUpdateCandidateInput {
	id: Id;
	organizationPositionId?: Id;
	tagIds?: Id[];
	contactId?: Id;
	appliedDate?: Date;
	hiredDate?: Date;
	rejectDate?: Date;
	candidateLevel?: string;
	cvUrl?: string;
	billRateValue?: number;
	billRateCurrency?: string;
	minimumBillingRate?: number;
	payPeriod?: string;
	reWeeklyLimit?: number;
	linkedInUrl?: string;
	facebookUrl?: string;
	instagramUrl?: string;
	twitterUrl?: string;
	githubUrl?: string;
	gitlabUrl?: string;
	upworkUrl?: string;
	stackoverflowUrl?: string;
	upworkId?: string;
	linkedInId?: string;
	profile_link?: string;
}

/**
 * The fields a candidacy list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `CandidateFilter` and `CandidateSortField` are
 * its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the row. Nothing is here from a relation, because the delivered list read
 * joins none: the connection protocol evaluates a filter against the rows the read returned, and a
 * member for a relation would narrow by a value those rows do not carry. That is also why the account is
 * absent even though the *paginated* spelling of the list narrows by the account's name and address —
 * that spelling does it with a join predicate the store evaluates, and the rows this connection narrows
 * carry no account column.
 */
const CANDIDATE_FILTERABLE = {
	id: 'ID',
	rating: 'DECIMAL',
	valueDate: 'DATE',
	appliedDate: 'DATE',
	hiredDate: 'DATE',
	rejectDate: 'DATE',
	status: 'STRING',
	candidateLevel: 'STRING',
	reWeeklyLimit: 'NUMBER',
	billRateCurrency: 'STRING',
	billRateValue: 'DECIMAL',
	minimumBillingRate: 'DECIMAL',
	payPeriod: 'STRING',
	cvUrl: 'STRING',
	userId: 'ID',
	contactId: 'ID',
	organizationPositionId: 'ID',
	sourceId: 'ID',
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

/** The fields the candidacy list's sort enum offers. */
const CANDIDATE_SORTABLE = [
	'createdAt',
	'updatedAt',
	'appliedDate',
	'hiredDate',
	'rejectDate',
	'candidateLevel',
	'status',
	'rating',
	'billRateValue'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list read states no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so the connection applies the platform's own: newest first, with the
 * identifier as the last key so that two candidacies filed in the same millisecond still have one order
 * between them, which is what makes a cursor walk over them stable.
 */
const CANDIDATE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The candidacy over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below reaches the same `CandidateService` method, or dispatches the same command,
 * that the `/api/candidate` routes reach.
 *
 * **The guard chain and the class permission are the controller's.** The controller carries
 * `TenantPermissionGuard` and `PermissionGuard` with the edit permission on the class, and every field
 * then states the permission its own route runs under — so a field is never narrower or wider than the
 * route it mirrors. Three of the controller's routes state a permission of their own and all three are
 * the view permission, while everything else — the node, the three lifecycle routes, the filing and the
 * edit — runs under the class-level edit permission, because the controller states none of its own on
 * any of them. The resolver states exactly that, and its spec reads the two lists out of the controller
 * rather than restating them.
 *
 * **A candidacy is a person, and the type says which person-facts it carries.** The delivered reads of
 * this resource state no `relations`, so nothing relation-shaped is a member: the account, the contact,
 * the source, the engagement and the position are each carried as the identifier that always travels,
 * and the row behind an identifier is read from the surface that owns it. The two virtual columns are
 * refused as well, and `candidate.type.gql` states the reason for each.
 *
 * **The pipeline move is its own field.** `PUT /:id/:status` is not an edit: it dispatches one of two
 * commands, and the two do different things — the hire files an engagement and gives the account the
 * employee role, the rejection writes the state and sends a message. A field that folded the move into
 * `updateCandidate` would let a client believe a status column was written when a person was hired.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('Candidate')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
export class CandidateResolver {
	constructor(private readonly candidateService: CandidateService, private readonly commandBus: CommandBus) {}

	/**
	 * The candidacies of the caller's tenant, newest first.
	 *
	 * The read is the delivered list route's own: that route binds its query string to the query DTO and
	 * hands it to the service, and a caller that states nothing binds nothing — so the read runs with the
	 * route's own defaults, which is a tenant criterion the service stamps from the credential and no
	 * `relations`. The narrowing a caller states arrives in `filter` and is applied to the rows this call
	 * returns, which is the same set the route answers.
	 */
	@Query('candidates')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	async candidates(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Candidate>> {
		const options = {} as BaseQueryDTO<Candidate>;
		const { items }: IPagination<ICandidate> = await this.candidateService.findAll(options);

		return buildConnection<Candidate>({
			rows: (items ?? []) as Candidate[],
			filterable: CANDIDATE_FILTERABLE,
			sortable: CANDIDATE_SORTABLE,
			defaultSort: CANDIDATE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One candidacy of the caller's tenant.
	 *
	 * The read is the delivered handler's, with the route's own defaults: that route binds the relations
	 * and the withdrawal flag its caller names in the query string, and this surface names none, so the
	 * call is the one the route makes when its query string is empty.
	 *
	 * A miss answers `null` rather than a refusal: GraphQL has one answer for "no such row" on a field
	 * that may have none, and the REST route's `404` is that same fact stated in the other protocol's
	 * vocabulary.
	 */
	@Query('candidate')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	async candidate(@Args('id', { type: () => ID }) id: Id): Promise<Candidate | null> {
		try {
			return await this.candidateService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many candidacies the caller's tenant holds.
	 *
	 * The same call the count route makes when it is given no options: that route passes its query string
	 * through as the store's own `where`, a shape the connection protocol does not speak, so the field
	 * states no narrowing rather than an argument it could not pass on. The tenant is applied to the
	 * criterion by the service, from the credential.
	 */
	@Query('candidateCount')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_VIEW)
	async candidateCount(): Promise<number> {
		return await this.candidateService.countBy();
	}

	/**
	 * Files a candidacy, and the account it belongs to.
	 *
	 * The write is dispatched as the same command the create route dispatches, with the payload that
	 * route builds from its body and the same two things it reads off the request: the language, which
	 * decides the new account's own interface language and the text of the answer, and the origin, which
	 * is the link the welcome mail carries.
	 */
	@Mutation('createCandidate')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	async createCandidate(@Args('input') input: ICreateCandidateInput): Promise<Candidate> {
		return await this.commandBus.execute(
			new CandidateCreateCommand(
				this.createPayload(input),
				RequestContext.getLanguageCode(),
				this.originOfTheCaller()
			)
		);
	}

	/**
	 * Files several candidacies in one call.
	 *
	 * The same command the bulk route dispatches, over the same list its body carries, with the same
	 * language and origin, and the same answer: the rows the handler created, in the order it created
	 * them.
	 */
	@Mutation('createCandidatesBulk')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	async createCandidatesBulk(@Args('input') input: ICreateCandidateInput[]): Promise<Candidate[]> {
		return await this.commandBus.execute(
			new CandidateBulkCreateCommand(
				input.map((one) => this.createPayload(one)),
				RequestContext.getLanguageCode(),
				this.originOfTheCaller()
			)
		);
	}

	/**
	 * Edits a candidacy that exists.
	 *
	 * The same command the edit route dispatches, with the same payload: the identifier the route takes
	 * from its path is carried in the body the handler reads. A member the caller leaves out is left as
	 * it is, because the delivered write persists the stated members over the row it read — the opposite
	 * of the catalogue's category update, and worth stating because a client that assumed the other
	 * behaviour would clear columns by omission.
	 */
	@Mutation('updateCandidate')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	async updateCandidate(@Args('input') input: IUpdateCandidateInput): Promise<Candidate> {
		return await this.commandBus.execute(new CandidateUpdateCommand(this.updatePayload(input)));
	}

	/**
	 * Moves a candidacy along the pipeline.
	 *
	 * The two moves the delivered route serves are the two commands it dispatches, and the field
	 * dispatches the same one for the same word. The vocabulary is stated as the SDL enum
	 * `CandidatePipelineAction` rather than as a string, because the delivered `switch` has no default
	 * branch: a move it does not name answers nothing at all, and a schema that accepted any string would
	 * advertise a capability the route does not have.
	 */
	@Mutation('updateCandidateStatus')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	async updateCandidateStatus(
		@Args('id', { type: () => ID }) id: Id,
		@Args('status') status: CandidateStatusType
	): Promise<Candidate> {
		switch (status) {
			case 'hired':
				return await this.commandBus.execute(new CandidateHiredCommand(id));
			case 'rejected':
				return await this.commandBus.execute(new CandidateRejectedCommand(id));
		}
	}

	/**
	 * Removes a candidacy outright.
	 *
	 * The same service method the removal route calls, with the same narrowing: that route is inherited
	 * from the CRUD base, which hands the store the path identifier and nothing else.
	 */
	@Mutation('deleteCandidate')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	async deleteCandidate(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.candidateService.delete(id);

		return true;
	}

	/**
	 * Withdraws a candidacy without removing it.
	 *
	 * The same service method the withdrawal route calls, with the same identifier: the row keeps the
	 * identifier the account, the contact and the interviews point at, and the delivered list stops
	 * answering it.
	 */
	@Mutation('softDeleteCandidate')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	async softDeleteCandidate(@Args('id', { type: () => ID }) id: Id): Promise<Candidate> {
		return await this.candidateService.softRemove(id);
	}

	/**
	 * Puts a withdrawn candidacy back.
	 */
	@Mutation('recoverCandidate')
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	async recoverCandidate(@Args('id', { type: () => ID }) id: Id): Promise<Candidate> {
		return await this.candidateService.softRecover(id);
	}

	/**
	 * The payload the filing route builds from its body.
	 *
	 * The relations are stated as the identifiers the delivered write is written from — the position as
	 * `{ id }`, the tags as a list of `{ id }` — because that is the shape the service persists a relation
	 * in, and a caller stating an identifier is stating the same thing the REST body states with a row.
	 *
	 * The account is passed as the caller stated it, and the surface states only the four members the
	 * delivered handler persists: the role and the preferred language the delivered body also accepts are
	 * both overwritten by that handler — it resolves the candidate role itself and hands it beside the
	 * language of the request — so neither is a member here.
	 */
	private createPayload(input: ICreateCandidateInput): ICandidateCreateInput {
		return {
			organizationId: input.organizationId,
			user: { ...input.user },
			password: input.password,
			organizationPosition: input.organizationPositionId ? { id: input.organizationPositionId } : undefined,
			tags: input.tagIds ? input.tagIds.map((id) => ({ id })) : undefined
		} as unknown as ICandidateCreateInput;
	}

	/**
	 * The payload the edit route builds from its body.
	 *
	 * A member the caller did not state is left undefined rather than written as a default, because the
	 * delivered write persists the stated members over the row it read: saying nothing about a member is a
	 * different request from stating an empty one.
	 */
	private updatePayload(input: IUpdateCandidateInput): ICandidateUpdateInput {
		// The four identifier members are lifted out rather than passed beside their relations: the
		// delivered write persists the relations, and handing it an identifier column the entity does not
		// assign would be a second statement of the same fact.
		const { organizationPositionId, tagIds, contactId, ...members } = input;

		return {
			...members,
			organizationPosition: organizationPositionId ? { id: organizationPositionId } : undefined,
			tags: tagIds ? tagIds.map((id) => ({ id })) : undefined,
			contact: contactId ? { id: contactId } : undefined
		} as unknown as ICandidateUpdateInput;
	}

	/**
	 * The origin the request carries, which the two filing routes hand to their handler.
	 *
	 * The controller reads it with `@Headers('origin')` and this reads the same header off the same
	 * request, so the two surfaces build the same welcome-mail link for the same caller. There is no
	 * request at all in a context that is not serving one, and the handler's own default is what the
	 * command then carries.
	 */
	private originOfTheCaller(): string | undefined {
		const request = RequestContext.currentRequest() as { headers?: Record<string, string> } | null;

		return request?.headers?.origin;
	}
}
