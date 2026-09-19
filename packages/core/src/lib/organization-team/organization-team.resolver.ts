import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	ID as Id,
	IDateRangePicker,
	IOrganizationProject,
	IOrganizationTeam,
	IOrganizationTeamCreateInput,
	IOrganizationTeamStatisticInput,
	IOrganizationTeamUpdateInput,
	IPagination,
	ITag,
	PermissionsEnum
} from '@gauzy/contracts';
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
import { OrganizationTeamCreateCommand } from './commands';
import { GetOrganizationTeamStatisticQuery } from './queries';
import { OrganizationTeam } from './organization-team.entity';
import { OrganizationTeamService } from './organization-team.service';

/** The members `CreateOrganizationTeamInput` declares in the schema. */
export interface ICreateOrganizationTeamInput {
	name: string;
	organizationId: Id;
	profile_link?: string;
	logo?: string;
	prefix?: string;
	imageId?: Id;
	public?: boolean;
	memberIds?: Id[];
	managerIds?: Id[];
	tagIds?: Id[];
	projectIds?: Id[];
}

/**
 * The members `UpdateOrganizationTeamInput` declares in the schema.
 *
 * The delivered edit body is the create body with the identifier stated, plus the five presentation
 * members the delivered create read drops: the edit hands the whole body to the persist call, so a
 * member the create cannot write is one the edit can.
 */
export interface IUpdateOrganizationTeamInput extends ICreateOrganizationTeamInput {
	id: Id;
	color?: string;
	emoji?: string;
	teamSize?: string;
	shareProfileView?: boolean;
	requirePlanToTrack?: boolean;
}

/** The members `OrganizationTeamDeleteInput` declares in the schema. */
export interface IOrganizationTeamDeleteInput {
	organizationId: Id;
}

/** The presentation members the delivered edit writes and the delivered create read drops. */
type IOrganizationTeamEditMembers = Pick<
	IUpdateOrganizationTeamInput,
	'color' | 'emoji' | 'teamSize' | 'shareProfileView' | 'requirePlanToTrack'
>;

/**
 * The fields a team list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OrganizationTeamFilter` and
 * `OrganizationTeamSortField` are its two renderings, and keeping the three in one file is what makes
 * a field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible
 * to introduce quietly.
 *
 * Every member is a column of the row the delivered read answers. The collections are in neither: the
 * delivered list read joins the relations its caller names, and this surface names none, so a filter
 * on `members`, `projects` or `tags` would be evaluated against a row that carries none of them and
 * would select nothing at all — the worst answer a filter can give. A team's membership is read as
 * rows of the team-employee surface, and its projects from the project surface.
 */
const ORGANIZATION_TEAM_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	color: 'STRING',
	emoji: 'STRING',
	teamSize: 'STRING',
	logo: 'STRING',
	prefix: 'STRING',
	profile_link: 'STRING',
	public: 'BOOLEAN',
	shareProfileView: 'BOOLEAN',
	requirePlanToTrack: 'BOOLEAN',
	imageId: 'ID',
	organizationId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN'
} as const;

/** The fields the sort enum offers. */
const ORGANIZATION_TEAM_SORTABLE = ['createdAt', 'updatedAt', 'name'] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list read declares no order of its own — it hands the store the criterion and takes
 * the rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: the name ascending, because a name is how a team is chosen from a list of them, then
 * the identifier, which is the key that makes the order total and a cursor walk over it stable.
 */
const ORGANIZATION_TEAM_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'name', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The team over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `OrganizationTeamService` method, or dispatches the
 * same command or query, that the `/api/organization-team` routes reach.
 *
 * **The guard chain and the permission are the controller's, field by field.** The controller carries
 * `TenantPermissionGuard` and `PermissionGuard` on the class and states `ALL_ORG_EDIT` with
 * `ORG_TEAM_EDIT` there, so this resolver carries the same two guards and the same class-level pair,
 * and each field then states the permission its own route runs under. Two of those readings are worth
 * spelling out, because both are cases where the obvious answer is the wrong one:
 *
 * - the two reads of the list, the one-row read and the count state the view pair, which is what the
 *   routes state on the handler — a read served under a grant narrower than the write is the
 *   controller's own arrangement, and widening it here, on one surface only, is what the two-protocol
 *   rule forbids;
 * - the withdrawal and the recovery carry no permission of their own, because the routes behind them
 *   are inherited from the CRUD base and declare none: they run under the controller's class-level
 *   pair, and so do the fields.
 *
 * **The connection is both list routes.** The controller serves its list three times — `GET /`,
 * `GET /pagination` and `GET /me` — and the first two answer the same rows under the same filters,
 * one of them sliced by `take`/`skip` and the other not. That is one capability, so it is one root
 * field: `organizationTeams`, mirroring `GET /`, which is the route that reads the whole filtered set
 * the connection protocol is applied to. A second root field for the paginated spelling would be a
 * second surface that could disagree with this one, and the connection's own `limit` and `offset`
 * already are the page it performs. The third spelling is not folded in, and the reason is in the
 * field below.
 *
 * **No relation is a member of the answer.** The delivered read joins the relations its caller names,
 * and this surface names none — so what a caller receives is the team's own columns, with the one
 * relation the entity declares eager beside them. That relation travels on every row the read
 * answers, which is why it is a member of the type; the membership, the projects, the tags and the
 * vocabularies are not, and the type states where each of them is read from.
 *
 * **Filing a team is more than an insert.** The delivered create stores the membership as the
 * team-employee rows the caller's lists name, subscribes the people it added, and provisions the
 * team's task statuses, priorities, sizes and issue types — so the create field dispatches the command
 * the delivered route dispatches rather than writing a row the rest of the platform never finished
 * setting up.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and why
 * it is appended to the guard chain the routes below already carry rather than replacing any part of
 * it.
 */
@Resolver('OrganizationTeam')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_EDIT)
export class OrganizationTeamResolver {
	constructor(
		private readonly organizationTeamService: OrganizationTeamService,
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus
	) {}

	/**
	 * The teams of the caller's tenant, in name order.
	 */
	@Query('organizationTeams')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW)
	async organizationTeams(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IOrganizationTeam>> {
		// The delivered list route binds its query DTO to the query string and hands it to the service:
		// the `where`, the `relations` and the page. This surface has no query string to bind, so the
		// read runs with the route's own defaults for an unstated request — and **the route's default
		// criterion is an empty object, not an absent one**: the DTO's own transform turns an unstated
		// `where` into `{}` before the service sees it, and the service reads that criterion to decide
		// which of its two reads to run. Passing nothing made it take the other branch and dereference a
		// row it had not loaded ("Cannot use 'in' operator to search for 'members' in undefined"), which
		// is why this states the criterion rather than leaving it out.
		const options = { where: {} } as BaseQueryDTO<OrganizationTeam>;
		const { items }: IPagination<IOrganizationTeam> = await this.organizationTeamService.findAll(options);

		return buildConnection<IOrganizationTeam>({
			rows: items ?? [],
			filterable: ORGANIZATION_TEAM_FILTERABLE,
			sortable: ORGANIZATION_TEAM_SORTABLE,
			defaultSort: ORGANIZATION_TEAM_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * The caller's own teams.
	 *
	 * The read the `GET /me` route performs, reached through the same `findMyTeams` the route calls.
	 * It is a root field of its own rather than an argument on the connection because the narrowing
	 * that makes it "mine" is not a column: for a caller that may not choose whose teams are read the
	 * list is narrowed to the teams the caller's own employee is an active member of, resolved from the
	 * credential, which is a fact about who is asking and therefore a statement no filter can carry. A
	 * caller that does hold the permission to choose is answered the tenant's teams, which is what the
	 * route answers that caller too.
	 */
	@Query('myOrganizationTeams')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW)
	async myOrganizationTeams(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IOrganizationTeam>> {
		// The same read the route performs, with the route's own defaults for a query string that states
		// nothing: no criterion, no relations, no page. Nothing here names whose teams are read, because
		// the read resolves that from the credential.
		const options = {} as BaseQueryDTO<OrganizationTeam>;
		const { items }: IPagination<IOrganizationTeam> = await this.organizationTeamService.findMyTeams(options);

		return buildConnection<IOrganizationTeam>({
			rows: items ?? [],
			filterable: ORGANIZATION_TEAM_FILTERABLE,
			sortable: ORGANIZATION_TEAM_SORTABLE,
			defaultSort: ORGANIZATION_TEAM_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One team of the caller's tenant.
	 *
	 * The read is the statistics read, not the plain finder: the delivered `GET /:id` route dispatches
	 * `GetOrganizationTeamStatisticQuery`, whose handler reaches `getOrganizationTeamStatistic`, and
	 * this field dispatches that same query through the same bus rather than reaching for a finder of
	 * its own — so the two surfaces answer from one read and the statistics the route computes are the
	 * statistics a client receives here.
	 *
	 * The route's query DTO is `OrganizationTeamStatisticDTO` and the field states no arguments of its
	 * own, so the delivered defaults apply: no relation is named and no last-worked-task sync is asked
	 * for, which is a read of the same row the plain finder would answer.
	 *
	 * A team that is not there is answered `null` rather than a refusal, which is this schema's answer
	 * for a one-row field that may have none. The delivered read states a miss as a refusal instead —
	 * the handler behind it converts every failure, a missing row included, into a bad-request refusal —
	 * so what a caller receives for a miss is that refusal under either protocol, and the branch below
	 * is the schema's own empty answer for the shape of miss that arrives as one.
	 */
	@Query('organizationTeam')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW)
	async organizationTeam(@Args('id', { type: () => ID }) id: Id): Promise<IOrganizationTeam | null> {
		try {
			const query = {} as IOrganizationTeamStatisticInput & IDateRangePicker;

			return await this.queryBus.execute(new GetOrganizationTeamStatisticQuery(id, query));
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many teams the caller's tenant has.
	 *
	 * The same call the count route makes, with the same absence of narrowing: that route binds its
	 * query string to the store's own `where` and hands it to `countBy`, and the connection protocol
	 * has no argument of that shape — so the field passes none and counts the caller's own rows, the
	 * tenant being applied to the criterion by the service from the credential.
	 */
	@Query('organizationTeamCount')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TEAM_VIEW)
	async organizationTeamCount(): Promise<number> {
		return await this.organizationTeamService.countBy();
	}

	/**
	 * Files a team through the command the delivered route dispatches.
	 *
	 * The payload is the input as stated, with the two relations the delivered write persists named by
	 * identifier. The tenant is stamped from the credential by the service and is never a member here:
	 * there is no way for a caller to file a team into a scope it is not acting in.
	 */
	@Mutation('createOrganizationTeam')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_ADD)
	async createOrganizationTeam(@Args('input') input: ICreateOrganizationTeamInput): Promise<IOrganizationTeam> {
		return await this.commandBus.execute(new OrganizationTeamCreateCommand(this.payload(input)));
	}

	/**
	 * Edits a team through the same service method the delivered route calls.
	 *
	 * The identifier is the criterion and is not repeated in the facts, which is the shape the route
	 * itself has: `:id` names the row and the body carries what changes. The service reads the row
	 * before it writes it — and refuses a row of the caller's scope that the caller does not manage —
	 * so a team that is not there is answered with the refusal rather than with a write under an
	 * identifier the caller does not own.
	 */
	@Mutation('updateOrganizationTeam')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_EDIT)
	async updateOrganizationTeam(@Args('input') input: IUpdateOrganizationTeamInput): Promise<IOrganizationTeam> {
		const { id, ...values } = input;

		return await this.organizationTeamService.update(
			id,
			this.payload(values) as unknown as IOrganizationTeamUpdateInput
		);
	}

	/**
	 * Removes a team outright.
	 *
	 * The delivered answer is the removal result — the signature admits the row beside it — and the one
	 * member a caller reads from either is that the removal happened, which is what this field answers.
	 * A team that is not there, or one the caller does not manage, is a refusal the service raises
	 * before this line rather than a `false` answered from it, so the answer is never a statement that
	 * nothing was done.
	 *
	 * The options are the route's own criterion: the organization the removal is scoped to. The tenant
	 * is not among them, because the tenant a write runs under comes from the credential — the service
	 * reads it from the request context and falls back to what it was handed.
	 */
	@Mutation('deleteOrganizationTeam')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_DELETE)
	async deleteOrganizationTeam(
		@Args('id', { type: () => ID }) id: Id,
		@Args('options') options?: IOrganizationTeamDeleteInput
	): Promise<boolean> {
		await this.organizationTeamService.deleteTeam(id, options ?? {});

		return true;
	}

	/**
	 * Removes one user from the teams they joined as a member.
	 *
	 * The delivered read takes the user, resolves the employee the user is, unassigns that employee
	 * from the tasks their teams carry and removes the membership rows they hold as a plain member —
	 * the rows whose role is stated by nothing — and answers a deletion result. The one member of that
	 * result a caller reads is the fact of the removal, which is what this field answers; a caller that
	 * names a user other than itself is refused by the service unless it holds the permission to change
	 * the selected employee, which is the same refusal the route gives.
	 */
	@Mutation('removeUserFromOrganizationTeams')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_REMOVE_ACCOUNT_AS_MEMBER)
	async removeUserFromOrganizationTeams(@Args('userId', { type: () => ID }) userId: Id): Promise<boolean> {
		await this.organizationTeamService.existTeamsAsMember(userId);

		return true;
	}

	/**
	 * Withdraws a team: the row is marked rather than removed, and the recovery below reads it back.
	 *
	 * No permission is stated beyond the class's pair because the delivered route states none: the
	 * withdrawal is inherited from the CRUD base, where the controller's class-level pair is the whole
	 * of its scope.
	 */
	@Mutation('softDeleteOrganizationTeam')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_EDIT)
	async softDeleteOrganizationTeam(@Args('id', { type: () => ID }) id: Id): Promise<IOrganizationTeam> {
		return await this.organizationTeamService.softRemove(id);
	}

	/**
	 * Puts a withdrawn team back, clearing the marker the withdrawal set.
	 *
	 * Unpermissioned beyond the class's pair for the same reason the withdrawal above is: the delivered
	 * route is inherited and carries no permission to mirror.
	 */
	@Mutation('recoverOrganizationTeam')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_EDIT)
	async recoverOrganizationTeam(@Args('id', { type: () => ID }) id: Id): Promise<IOrganizationTeam> {
		return await this.organizationTeamService.softRecover(id);
	}

	/**
	 * The payload the delivered write persists.
	 *
	 * The members and the managers are the two lists the delivered body names, and they are handed over
	 * as lists of identifiers because that is what the write resolves them from — the people are read
	 * in the caller's own organization and stored as the team-employee rows beside the team. The tags
	 * and the projects are the two relations the write attaches, and they are named by identifier for
	 * the same reason: the relation is what the row records, and the row beside it is read from its own
	 * surface rather than written from here.
	 *
	 * A list the caller does not state stays unstated rather than becoming an empty one. The delivered
	 * write tests a member or manager list for emptiness before it touches the membership, so an empty
	 * list would be a statement the caller did not make; the relations are attached only when they are
	 * stated at all.
	 *
	 * The five presentation members are carried for the edit alone. The delivered create read builds
	 * its row from an explicit set of members and drops these, so offering one on a filing would accept
	 * a value and write nothing — the edit is where the row's presentation is written, and there the
	 * whole body reaches the persist call.
	 */
	private payload(
		input: ICreateOrganizationTeamInput & Partial<IOrganizationTeamEditMembers>
	): IOrganizationTeamCreateInput {
		return {
			name: input.name,
			organizationId: input.organizationId,
			prefix: input.prefix,
			logo: input.logo,
			imageId: input.imageId,
			profile_link: input.profile_link,
			public: input.public,
			memberIds: input.memberIds,
			managerIds: input.managerIds,
			color: input.color,
			emoji: input.emoji,
			teamSize: input.teamSize,
			shareProfileView: input.shareProfileView,
			requirePlanToTrack: input.requirePlanToTrack,
			tags: input.tagIds?.map((id) => ({ id }) as ITag),
			projects: input.projectIds?.map((id) => ({ id }) as IOrganizationProject)
		} as unknown as IOrganizationTeamCreateInput;
	}
}
