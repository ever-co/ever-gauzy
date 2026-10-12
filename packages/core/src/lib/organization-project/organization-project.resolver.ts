import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	ID as Id,
	IEmployee,
	IOrganizationProject,
	IOrganizationProjectCreateInput,
	IOrganizationProjectEditByEmployeeInput,
	IOrganizationProjectSetting,
	IOrganizationProjectUpdateInput,
	IPagination,
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
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import {
	OrganizationProjectCreateCommand,
	OrganizationProjectEditByEmployeeCommand,
	OrganizationProjectSettingUpdateCommand,
	OrganizationProjectUpdateCommand
} from './commands';
import { ProjectManagerOrPermissionGuard } from './guards/project-manager-or-permission.guard';
import { OrganizationProject } from './organization-project.entity';
import { OrganizationProjectService } from './organization-project.service';

/** The members `CreateOrganizationProjectInput` declares in the schema. */
export interface ICreateOrganizationProjectInput {
	organizationId: Id;
	name: string;
	imageId?: Id;
	billing?: string;
	budgetType?: string;
	taskListType?: string;
	memberIds?: Id[];
	managerIds?: Id[];
}

/**
 * The members `UpdateOrganizationProjectInput` declares in the schema.
 *
 * Declared in its own right rather than by extending the create input, because the delivered edit
 * body is the create body with every member relaxed and the name is one of them: a write that states
 * no name leaves the row's name as it is, so the member is optional here and required there.
 */
export interface IUpdateOrganizationProjectInput {
	id: Id;
	organizationId: Id;
	name?: string;
	imageId?: Id;
	billing?: string;
	budgetType?: string;
	taskListType?: string;
	memberIds?: Id[];
	managerIds?: Id[];
}

/** The members `OrganizationProjectTaskViewModeInput` declares in the schema. */
export interface IOrganizationProjectTaskViewModeInput {
	organizationId: Id;
	taskListType: string;
}

/** The members `OrganizationProjectSettingInput` declares in the schema. */
export interface IOrganizationProjectSettingInput {
	organizationId: Id;
	isTasksAutoSync?: boolean;
	isTasksAutoSyncOnLabel?: boolean;
	syncTag?: string;
	customFields?: Record<string, unknown>;
}

/** The members `UpdateOrganizationProjectByEmployeeInput` declares in the schema. */
export interface IUpdateOrganizationProjectByEmployeeInput {
	organizationId: Id;
	memberId: Id;
	addedProjectIds?: Id[];
	removedProjectIds?: Id[];
}

/**
 * The fields a project list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OrganizationProjectFilter` and
 * `OrganizationProjectSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * Every member is a column of the row the delivered list read answers, because the connection
 * narrows the rows the service returned. The relations are in neither list: `members`, `teams` and
 * `tags` are pivots and `organizationContact` is a row beside this one, and the list read joins none
 * of them, so a filter on one would be evaluated against a row that carries none of it and would
 * select nothing at all — the worst answer a filter can give. The two reads that do join something
 * the list does not are root fields of their own below, and the question they answer is not a
 * narrowing of this connection. `description` is absent although it is a column: it is the long-form
 * rich text the delivered writes sanitise, and a list is not narrowed by a fragment of markup. The
 * tenant is absent for the same reason the read applies it: it comes from the credential, so a filter
 * on it would be a second statement of the same scope.
 */
const ORGANIZATION_PROJECT_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	startDate: 'DATE',
	endDate: 'DATE',
	billing: 'STRING',
	currency: 'STRING',
	public: 'BOOLEAN',
	owner: 'STRING',
	taskListType: 'STRING',
	code: 'STRING',
	color: 'STRING',
	billable: 'BOOLEAN',
	billingFlat: 'BOOLEAN',
	openSource: 'BOOLEAN',
	projectUrl: 'STRING',
	openSourceProjectUrl: 'STRING',
	budget: 'DECIMAL',
	budgetType: 'STRING',
	imageUrl: 'STRING',
	icon: 'STRING',
	status: 'STRING',
	isTasksAutoSync: 'BOOLEAN',
	isTasksAutoSyncOnLabel: 'BOOLEAN',
	syncTag: 'STRING',
	archiveTasksIn: 'NUMBER',
	closeTasksIn: 'NUMBER',
	membersCount: 'NUMBER',
	organizationId: 'ID',
	organizationContactId: 'ID',
	imageId: 'ID',
	defaultAssigneeId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN'
} as const;

/** The fields the sort enum offers. */
const ORGANIZATION_PROJECT_SORTABLE = [
	'createdAt',
	'updatedAt',
	'name',
	'startDate',
	'endDate',
	'budget',
	'status',
	'taskListType'
] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list method applies no order of its own — it hands the store the criterion and takes
 * the rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: the name ascending, because a name is how a project is chosen from a list of them, then
 * the identifier, which is the key that makes the order total and a cursor walk over it stable.
 */
const ORGANIZATION_PROJECT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'name', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The project over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every read below calls the same `OrganizationProjectService` method the
 * `/api/organization-projects` route calls, and every write dispatches the same command its route
 * dispatches. The writes are commands rather than service calls for the reason the routes are: filing
 * a project also provisions its task statuses, priorities, sizes and issue types, and the edits read
 * the row, move the member pivot and answer with the row read back.
 *
 * **The guard chain and the permissions are the controller's, field by field.** The controller
 * carries `TenantPermissionGuard` and the module-local `ProjectManagerOrPermissionGuard` on the class
 * and states `ALL_ORG_EDIT` and `ORG_PROJECT_EDIT` beside them, so this resolver carries the same two
 * guards and the same class-level pair, and each field then states the permission its own route runs
 * under. The module-local guard is not a second scope: it *is* the permission guard, with a
 * short-circuit that admits the employee who manages the project named in the path before the grant
 * is consulted, so stating it here is what keeps a project manager's own access — the access the REST
 * route grants — available over this protocol as well. Four readings are worth spelling out, because
 * each is a case where the obvious answer is the wrong one:
 *
 * - `organizationProjects`, `organizationProject`, `organizationProjectCount`,
 *   `organizationProjectsByEmployee` and `isOrganizationProjectManager` state the view pair their own
 *   routes state, and never the class's edit pair: a caller allowed to list projects is not thereby
 *   allowed to change one.
 * - `createOrganizationProject` states `ALL_ORG_EDIT` **and** `ORG_PROJECT_ADD`, which is what its
 *   route states. The add permission is the one grant the create route holds that its edit sibling
 *   does not, so folding the two writes together under the class pair would widen who may file a
 *   project.
 * - `deleteOrganizationProject` states the class's edit permission **and** `ORG_PROJECT_DELETE`,
 *   because its route does. Only the withdrawal below is governed by the edit pair alone.
 * - `syncedOrganizationProjects`, `updateOrganizationProjectSetting`,
 *   `softDeleteOrganizationProject` and `recoverOrganizationProject` state the controller's
 *   class-level pair, because the routes they mirror declare no permission of their own — the setting
 *   write and the synced page declare none beside the class's, and the two lifecycle moves are
 *   inherited from the CRUD base, where the class's declaration is the whole of their scope.
 *
 * **The connection is the list, and the two sub-routes that join more than it does are fields of
 * their own.** `GET /pagination` answers the same rows under the same filters as `GET /`, so it folds
 * into the one connection rather than claiming a second root field that could disagree with it.
 * `GET /employee/:employeeId` inner-joins the project-member pivot the list read does not join and
 * answers a projection of the row, and `GET /synced` narrows on a repository custom field and joins
 * the custom-field relation; neither question is a narrowing of a row this connection carries, so
 * each is a root field of its own rather than a filter that would select nothing. The same reasoning
 * makes the manager question a `Boolean` field: it is answered from the pivot, not from the row.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any part
 * of it.
 */
@Resolver('OrganizationProject')
@UseGuards(TenantPermissionGuard, ProjectManagerOrPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT)
export class OrganizationProjectResolver {
	constructor(
		private readonly organizationProjectService: OrganizationProjectService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The projects of the caller's organization, in name order.
	 */
	@Query('organizationProjects')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
	async organizationProjects(
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
	): Promise<GraphqlConnection<OrganizationProject>> {
		// The delivered list route binds its query DTO to the query string and hands it to the
		// service: the `where`, the `relations` and the page. This surface has no query string to
		// bind, so the read runs with the route's own defaults for an unstated request — no criterion,
		// no relations, no page — and the connection protocol's `filter` is applied to the rows the
		// service returns. The tenant is applied to the criterion by the service, from the credential
		// rather than from the caller.
		const options = { ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<OrganizationProject>;
		const { items }: IPagination<OrganizationProject> =
			await this.organizationProjectService.findAll(options);

		return buildConnection<OrganizationProject>({
			rows: items ?? [],
			filterable: ORGANIZATION_PROJECT_FILTERABLE,
			sortable: ORGANIZATION_PROJECT_SORTABLE,
			defaultSort: ORGANIZATION_PROJECT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One project of the caller's organization.
	 *
	 * The delivered read is the one the REST route performs, side effect included: it records the
	 * caller's recent visit to the project, which is why the field calls that method rather than
	 * reading the row beside it — the two protocols then leave the same history behind them.
	 *
	 * A project that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's own miss is that same fact
	 * stated in the other protocol's vocabulary. The delivered read wraps its failure in a `400`
	 * rather than a `404`, and that behaviour is left as it stands: inventing a second read here to
	 * turn it into a miss would be a second code path for one question.
	 */
	@Query('organizationProject')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
	async organizationProject(@Args('id', { type: () => ID }) id: Id): Promise<OrganizationProject | null> {
		try {
			return await this.organizationProjectService.findById(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many projects the caller's organization holds.
	 *
	 * The same call the count route makes, with the same absence of narrowing: that route binds its
	 * query string to the store's own `where` and hands it to `countBy`, and the connection protocol
	 * has no argument of that shape, so the field passes none and counts the caller's own rows — the
	 * tenant is applied to the criterion by the service, from the credential.
	 */
	@Query('organizationProjectCount')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
	async organizationProjectCount(): Promise<number> {
		return await this.organizationProjectService.countBy();
	}

	/**
	 * The projects one employee works.
	 *
	 * A root field of its own rather than a filter on the connection, for the two reasons the read
	 * itself states: it inner-joins the project-member pivot the list read does not join, and it
	 * answers a projection of the row — the identifier, the name, the avatar URL, the currency, the
	 * billing basis, the public flag, the owner basis and the task list type, with the project's teams
	 * joined beside them — so a filter on this connection could be evaluated only against rows that
	 * carry none of it.
	 *
	 * The same read the route performs, with the same options: the employee is the path segment, the
	 * organization is the query parameter the read is scoped by, and the party and the team are the
	 * two the read is narrowed by when they are stated. The tenant is taken from the credential by the
	 * service rather than stated here.
	 */
	@Query('organizationProjectsByEmployee')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
	async organizationProjectsByEmployee(
		@Args('employeeId', { type: () => ID }) employeeId: Id,
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('organizationContactId', { type: () => ID, nullable: true }) organizationContactId?: Id,
		@Args('organizationTeamId', { type: () => ID, nullable: true }) organizationTeamId?: Id
	): Promise<IOrganizationProject[]> {
		return await this.organizationProjectService.findByEmployee(employeeId, {
			organizationId,
			organizationContactId,
			organizationTeamId
		});
	}

	/**
	 * The projects linked to a repository.
	 *
	 * A root field of its own rather than a filter on the connection, because the delivered read
	 * narrows on a repository custom field and joins the custom-field relation, and neither is a
	 * member of a row this connection carries.
	 *
	 * The read answers a bounded page of its own — ten rows, and a `skip` that is a one-based page
	 * number rather than an offset — so it is called with the route's own defaults for an unstated
	 * request, and the connection then applies `filter`, `sort` and its page over the rows that read
	 * returned. That is also why `totalCount` here counts those rows rather than every linked project
	 * in the store: the total is the size of the set the filters selected, and a number that counted
	 * beyond the set the delivered read answers would be a second, disagreeing count.
	 */
	@Query('syncedOrganizationProjects')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT)
	async syncedOrganizationProjects(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<OrganizationProject>> {
		// The read takes the query DTO the synced route binds its query string to. This surface has no
		// query string to bind and does not restate the read's own defaults as arguments either: an
		// empty DTO *is* those defaults — the first ten linked projects, in the store's own order — so
		// the two protocols ask the service the same question. The tenant is applied by the service,
		// from the credential rather than from the caller.
		const { items }: IPagination<OrganizationProject> = await this.organizationProjectService.findSyncedProjects(
			{} as BaseQueryDTO<OrganizationProject>
		);

		return buildConnection<OrganizationProject>({
			rows: items ?? [],
			filterable: ORGANIZATION_PROJECT_FILTERABLE,
			sortable: ORGANIZATION_PROJECT_SORTABLE,
			defaultSort: ORGANIZATION_PROJECT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * Whether one employee manages one project.
	 *
	 * A question rather than a row, so it is a field of its own: the answer comes from the
	 * project-member pivot, and it is the question the delivered route answers when it admits a
	 * caller to a project without the grant that would otherwise be needed.
	 */
	@Query('isOrganizationProjectManager')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_PROJECT_VIEW)
	async isOrganizationProjectManager(
		@Args('projectId', { type: () => ID }) projectId: Id,
		@Args('employeeId', { type: () => ID }) employeeId: Id
	): Promise<boolean> {
		return await this.organizationProjectService.isManagerOfProject(projectId, employeeId);
	}

	/**
	 * Files a project through the command the delivered route dispatches.
	 *
	 * The payload is the input as stated. The tenant is stamped from the credential by the handler and
	 * is never a member here: there is no way for a caller to file a project into a tenant it is not
	 * acting in. The command is dispatched rather than the service called because the handler also
	 * provisions the task statuses, priorities, sizes and issue types the new project's tasks need.
	 */
	@Mutation('createOrganizationProject')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_ADD)
	async createOrganizationProject(
		@Args('input') input: ICreateOrganizationProjectInput
	): Promise<OrganizationProject> {
		return await this.commandBus.execute(
			new OrganizationProjectCreateCommand(input as unknown as IOrganizationProjectCreateInput)
		);
	}

	/**
	 * Edits a project through the command the delivered route dispatches.
	 *
	 * The identifier is the criterion and is not repeated in the payload, which is the shape the route
	 * itself has: `:id` names the row and the body carries the facts. The handler reads the row before
	 * it writes, so a project of another organization, or one that is not there, is answered with the
	 * miss rather than with a write under an identifier the caller does not own.
	 */
	@Mutation('updateOrganizationProject')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT)
	async updateOrganizationProject(
		@Args('input') input: IUpdateOrganizationProjectInput
	): Promise<OrganizationProject> {
		const { id, ...values } = input;

		return await this.commandBus.execute(
			new OrganizationProjectUpdateCommand(id, values as unknown as IOrganizationProjectUpdateInput)
		);
	}

	/**
	 * Changes which view a project's tasks open in.
	 *
	 * The same command as the edit above, with the task-mode body the delivered route hands it: the
	 * list type and the organization that scopes the row. Dispatching the edit command rather than
	 * writing the column is what keeps the two protocols' side effects — the activity log, the member
	 * pivot the handler leaves alone when no employee list is stated — the same on both.
	 */
	@Mutation('updateOrganizationProjectTaskViewMode')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT)
	async updateOrganizationProjectTaskViewMode(
		@Args('id', { type: () => ID }) id: Id,
		@Args('input') input: IOrganizationProjectTaskViewModeInput
	): Promise<OrganizationProject> {
		return await this.commandBus.execute(
			new OrganizationProjectUpdateCommand(id, input as unknown as IOrganizationProjectUpdateInput)
		);
	}

	/**
	 * Changes how a project's tasks synchronise.
	 *
	 * The same command the delivered route dispatches, with the setting body it hands it: the two
	 * synchronisation flags, the label the second matches on, the tenant-defined extras and the
	 * organization that scopes the write. The delivered route states no permission of its own, so the
	 * field states the controller's class-level pair — the same grant the route resolves to.
	 */
	@Mutation('updateOrganizationProjectSetting')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT)
	async updateOrganizationProjectSetting(
		@Args('id', { type: () => ID }) id: Id,
		@Args('input') input: IOrganizationProjectSettingInput
	): Promise<OrganizationProject> {
		return await this.commandBus.execute(
			new OrganizationProjectSettingUpdateCommand(id, input as unknown as IOrganizationProjectSetting)
		);
	}

	/**
	 * Moves a set of projects into or out of one employee's list.
	 *
	 * The same command the delivered route dispatches, with the employee named by its identifier: the
	 * command takes the row the identifier names, which is what the delivered body carries. A list the
	 * caller does not state is left out rather than sent empty — the delivered write reads "nothing
	 * stated" and "nothing to change" as the same instruction, so leaving it out says so once rather
	 * than twice.
	 */
	@Mutation('updateOrganizationProjectByEmployee')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT)
	async updateOrganizationProjectByEmployee(
		@Args('input') input: IUpdateOrganizationProjectByEmployeeInput
	): Promise<boolean> {
		const payload = {
			organizationId: input.organizationId,
			member: { id: input.memberId } as IEmployee,
			addedProjectIds: input.addedProjectIds,
			removedProjectIds: input.removedProjectIds
		} as IOrganizationProjectEditByEmployeeInput;

		return await this.commandBus.execute(new OrganizationProjectEditByEmployeeCommand(payload));
	}

	/**
	 * Removes a project outright.
	 *
	 * The delivered route calls the service directly rather than dispatching a command, so this field
	 * does the same. The store's own constraints are what refuse a row other records still point at,
	 * and that refusal is surfaced rather than pre-empted here.
	 */
	@Mutation('deleteOrganizationProject')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_DELETE)
	async deleteOrganizationProject(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.organizationProjectService.delete(id);

		return true;
	}

	/**
	 * Withdraws a project: the row is marked rather than removed, and every task and record filed
	 * under it keeps pointing at it.
	 *
	 * No permission is stated beyond the class's because the delivered route declares none: the
	 * withdrawal is inherited from the CRUD base, where the controller's class-level declaration is
	 * the whole of its scope.
	 */
	@Mutation('softDeleteOrganizationProject')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT)
	async softDeleteOrganizationProject(@Args('id', { type: () => ID }) id: Id): Promise<OrganizationProject> {
		return await this.organizationProjectService.softRemove(id);
	}

	/**
	 * Puts a withdrawn project back, clearing the marker the withdrawal set.
	 *
	 * Unpermissioned beyond the class's for the same reason the withdrawal above is: the delivered
	 * route is inherited and carries no permission to mirror.
	 */
	@Mutation('recoverOrganizationProject')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_EDIT)
	async recoverOrganizationProject(@Args('id', { type: () => ID }) id: Id): Promise<OrganizationProject> {
		return await this.organizationProjectService.softRecover(id);
	}
}
