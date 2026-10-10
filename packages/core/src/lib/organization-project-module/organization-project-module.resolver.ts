import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	ID as Id,
	IOrganizationProjectModule,
	IOrganizationProjectModuleCreateInput,
	IOrganizationProjectModuleFindInput,
	IPagination,
	ITask,
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
import { OrganizationProjectModuleCreateCommand, OrganizationProjectModuleUpdateCommand } from './commands';
import { OrganizationProjectModule } from './organization-project-module.entity';
import { OrganizationProjectModuleService } from './organization-project-module.service';

/** The members `CreateOrganizationProjectModuleInput` declares in the schema. */
export interface ICreateOrganizationProjectModuleInput {
	organizationId: Id;
	name: string;
	description?: string;
	status?: string;
	startDate?: Date;
	endDate?: Date;
	public?: boolean;
	isFavorite?: boolean;
	isActive?: boolean;
	isArchived?: boolean;
	parentId?: Id;
	projectId?: Id;
	memberIds?: Id[];
	managerIds?: Id[];
	tasks?: Id[];
}

/** The members `UpdateOrganizationProjectModuleInput` declares in the schema. */
export interface IUpdateOrganizationProjectModuleInput extends Partial<ICreateOrganizationProjectModuleInput> {
	id: Id;
}

/**
 * The fields a module list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OrganizationProjectModuleFilter` and
 * `OrganizationProjectModuleSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * Every member is a column of the row the delivered reads answer, because the connection narrows the
 * rows the service returned: a member a read does not select would be a filter that silently selects
 * nothing. The member pivot, the teams and the tasks are in neither list: no delivered read hydrates
 * them onto the rows this surface answers, and who works a module, which teams share it and which tasks
 * are filed under it are read from `employeeProjectModules`, `teamProjectModules`,
 * `organizationProjectModulesByEmployee` and the work-tracking domain's own read of a module's tasks.
 *
 * `tenantId` is in neither list either: the delivered read is scoped to the caller's own tenant by the
 * service, from the credential rather than from the request, so every row the connection narrows already
 * carries the caller's tenant and a filter on it could only select all of them or none.
 */
const ORGANIZATION_PROJECT_MODULE_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	description: 'STRING',
	status: 'STRING',
	startDate: 'DATE',
	endDate: 'DATE',
	public: 'BOOLEAN',
	isFavorite: 'BOOLEAN',
	parentId: 'ID',
	projectId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const ORGANIZATION_PROJECT_MODULE_SORTABLE = ['createdAt', 'updatedAt', 'name', 'startDate', 'endDate'] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list method applies no order of its own — it hands the store the criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: newest first, because a module list is read as what has been filed lately, then the
 * identifier, which is the key that makes the order total and a cursor walk over it stable. `status` is
 * not a key of it: the vocabulary is the platform's own and its alphabetical order is not a lifecycle.
 */
const ORGANIZATION_PROJECT_MODULE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The project module over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below reaches the same `OrganizationProjectModuleService` method, or dispatches the
 * same command, that the `/api/organization-project-modules` routes reach.
 *
 * **The guard chain and the permission are the controller's, field by field.** The controller carries
 * `TenantPermissionGuard` and `PermissionGuard` on the class and states `ALL_ORG_EDIT` on the class, so
 * this resolver carries the same two guards and the same class-level permission, and each field then
 * states the permission its own route runs under. Three of those readings are worth spelling out,
 * because each is a case where the obvious answer is the wrong one:
 *
 * - the four reads the controller declares state `ALL_ORG_VIEW` beside `PROJECT_MODULE_READ`, and the
 *   fields that mirror them state both — the node query included, since this controller overrides the
 *   base `GET /:id` and states the read permissions on it rather than inheriting an empty declaration
 *   the way the organization controller does;
 * - the count and the two lifecycle moves are inherited from the platform's CRUD base, whose handlers
 *   declare no permission of their own, so they resolve to the controller's class-level `ALL_ORG_EDIT`
 *   and the fields state that rather than the read permission their neighbours carry. The count is a
 *   read and still runs under the edit permission; that asymmetry is the controller's, and widening it
 *   on one surface only is exactly what the two-protocol rule forbids;
 * - the create, the edit and the removal state `ALL_ORG_EDIT` beside the verb of their own route.
 *
 * **The three further reads are fields of their own rather than filters on the connection**, because
 * each answers a question the connection cannot state: `employeeProjectModules` resolves the employee
 * from the credential — or from the selection a caller permitted to change it may name — and joins the
 * module-member pivot; `teamProjectModules` joins the caller's teams pivot; and
 * `organizationProjectModulesByEmployee` joins the member pivot by the employee the field names. A
 * filter narrows rows, and these narrow by who is asking, which is not a column of any row.
 *
 * **Both writes dispatch the command the delivered route dispatches.** Filing a module is more than an
 * insert — the handler reads the employees it is given as members of the module's organization, builds
 * the module-employee pivot, files the stated tasks under the module and writes an activity log beside
 * it — so a field that reached for the service would write a row the rest of the platform never finished
 * assembling.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('OrganizationProjectModule')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
export class OrganizationProjectModuleResolver {
	constructor(
		private readonly organizationProjectModuleService: OrganizationProjectModuleService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The modules of the caller's tenant, newest first.
	 */
	@Query('organizationProjectModules')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.PROJECT_MODULE_READ)
	async organizationProjectModules(
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
	): Promise<GraphqlConnection<OrganizationProjectModule>> {
		// The delivered list route binds its query DTO to the query string and hands it to the service:
		// the `where`, the `relations` and the page. This surface has no query string to bind, so the
		// read runs with the route's own defaults for an unstated request — no criterion, no relations,
		// no page — and the connection protocol's `filter` is applied to the rows the service returns.
		// The tenant is applied to the criterion by the service, from the credential rather than from
		// the caller.
		//
		// `withDeleted` is the one option the route's DTO carries that this surface must state for itself,
		// and it belongs here rather than in the connection's request: the service hands these options to
		// the base read, which is what lifts the soft-delete filter, and the rows are read before the
		// connection ever sees them.
		const options = {
			...(withDeleted ? { withDeleted: true } : {})
		} as BaseQueryDTO<OrganizationProjectModule>;
		const { items }: IPagination<OrganizationProjectModule> =
			await this.organizationProjectModuleService.findAll(options);

		return buildConnection<OrganizationProjectModule>({
			rows: items ?? [],
			filterable: ORGANIZATION_PROJECT_MODULE_FILTERABLE,
			sortable: ORGANIZATION_PROJECT_MODULE_SORTABLE,
			defaultSort: ORGANIZATION_PROJECT_MODULE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One module of the caller's tenant.
	 *
	 * A module that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 *
	 * The read permission this field states is the one the delivered `GET /:id` states: this controller
	 * overrides the base route and declares the view and read permissions on it, so the mirror is those
	 * two rather than the class-level edit permission the inherited spelling would have carried.
	 */
	@Query('organizationProjectModule')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.PROJECT_MODULE_READ)
	async organizationProjectModule(
		@Args('id', { type: () => ID }) id: Id
	): Promise<OrganizationProjectModule | null> {
		try {
			return await this.organizationProjectModuleService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many modules the caller's tenant holds.
	 *
	 * The class-level edit permission is the route's own: the count is inherited from the platform's CRUD
	 * base, whose handler declares no permission, so the permission guard falls back to the controller's
	 * class-level one. Stating the read permission here would be a scope REST does not have.
	 */
	@Query('organizationProjectModuleCount')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	async organizationProjectModuleCount(): Promise<number> {
		return await this.organizationProjectModuleService.countBy();
	}

	/**
	 * The modules the caller is a member of.
	 *
	 * The read is the one `GET /employee` performs with its query string unstated: the delivered service
	 * resolves the employee from the credential — or from the selection the request names, for a caller
	 * with the permission to change it — and joins the module-member pivot, so the narrowing is by who is
	 * asking rather than by a column. That is why it is a root field of its own: a filter narrows rows,
	 * and this is not a fact about any row the list read answers.
	 *
	 * The connection's `filter` narrows the rows this read answered, and its total is the count of them
	 * rather than of every module in the store, because the read fixes a page of its own.
	 */
	@Query('employeeProjectModules')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.PROJECT_MODULE_READ)
	async employeeProjectModules(
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
	): Promise<GraphqlConnection<IOrganizationProjectModule>> {
		const options = {
			where: {},
			...(withDeleted ? { withDeleted: true } : {})
		} as BaseQueryDTO<OrganizationProjectModule>;
		const { items }: IPagination<IOrganizationProjectModule> =
			await this.organizationProjectModuleService.getEmployeeProjectModules(options);

		return buildConnection<IOrganizationProjectModule>({
			rows: items ?? [],
			filterable: ORGANIZATION_PROJECT_MODULE_FILTERABLE,
			sortable: ORGANIZATION_PROJECT_MODULE_SORTABLE,
			defaultSort: ORGANIZATION_PROJECT_MODULE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * The modules the caller's own teams share.
	 *
	 * The read is the one `GET /team` performs with its query string unstated, and it joins the team
	 * membership pivot the list read does not: the employee is resolved from the credential, the modules
	 * are those the caller's teams are attached to, and the teams a caller may name are the request
	 * context's business rather than an argument this surface could state. A pivot is not a column of the
	 * row, so no filter could express this and the field stands on its own.
	 */
	@Query('teamProjectModules')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.PROJECT_MODULE_READ)
	async teamProjectModules(
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
	): Promise<GraphqlConnection<IOrganizationProjectModule>> {
		const options = {
			where: {},
			...(withDeleted ? { withDeleted: true } : {})
		} as BaseQueryDTO<OrganizationProjectModule>;
		const { items }: IPagination<IOrganizationProjectModule> =
			await this.organizationProjectModuleService.findTeamProjectModules(options);

		return buildConnection<IOrganizationProjectModule>({
			rows: items ?? [],
			filterable: ORGANIZATION_PROJECT_MODULE_FILTERABLE,
			sortable: ORGANIZATION_PROJECT_MODULE_SORTABLE,
			defaultSort: ORGANIZATION_PROJECT_MODULE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * The modules one employee works.
	 *
	 * The read is the one `GET /employee/:id` performs, with the employee in the path: it joins the
	 * module-member pivot by the employee named here, narrows on the organization and scopes the read to
	 * the credential's tenant.
	 *
	 * **The organization is stated rather than left to a default.** The route's own query DTO requires it
	 * and the read applies it as a criterion, so a field that named only the employee would hand the read
	 * an absent organization — a criterion no caller stated, which selects nothing rather than everything.
	 * The tenant is not stated for the opposite reason: the service applies it from the credential, so
	 * there is nothing for a caller to choose.
	 */
	@Query('organizationProjectModulesByEmployee')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.PROJECT_MODULE_READ)
	async organizationProjectModulesByEmployee(
		@Args('employeeId', { type: () => ID }) employeeId: Id,
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IOrganizationProjectModule>> {
		const options = { organizationId } as IOrganizationProjectModuleFindInput;
		const { items }: IPagination<IOrganizationProjectModule> =
			await this.organizationProjectModuleService.findByEmployee(employeeId, options);

		return buildConnection<IOrganizationProjectModule>({
			rows: items ?? [],
			filterable: ORGANIZATION_PROJECT_MODULE_FILTERABLE,
			sortable: ORGANIZATION_PROJECT_MODULE_SORTABLE,
			defaultSort: ORGANIZATION_PROJECT_MODULE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * Files a module through the command the delivered route dispatches.
	 *
	 * The payload is the input as stated, with the task identifiers reduced to the rows the write reads
	 * an identifier off. The tenant is stamped from the credential by the service and is never a member
	 * here: there is no way for a caller to file a module into a tenant it is not acting in.
	 */
	@Mutation('createOrganizationProjectModule')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.PROJECT_MODULE_CREATE)
	async createOrganizationProjectModule(
		@Args('input') input: ICreateOrganizationProjectModuleInput
	): Promise<OrganizationProjectModule> {
		return await this.commandBus.execute(
			new OrganizationProjectModuleCreateCommand(this.payload(input))
		);
	}

	/**
	 * Edits a module through the command the delivered route dispatches.
	 *
	 * The identifier is the criterion and is not repeated in the payload, which is the shape the route
	 * itself has: `:id` names the row and the body carries the facts. The handler reads the row before it
	 * writes, so a module of another tenant, or one that is not there, is answered with the miss rather
	 * than with a write under an identifier the caller does not own.
	 *
	 * The field answers with the row read back rather than with the write's own answer. That answer is
	 * the row or the platform's update-result envelope, whose one member a caller reads is the count of
	 * rows the write reached — a count this schema declares no scalar for — so answering with the row is
	 * the same operation stated in the shape a client reads next anyway.
	 */
	@Mutation('updateOrganizationProjectModule')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.PROJECT_MODULE_UPDATE)
	async updateOrganizationProjectModule(
		@Args('input') input: IUpdateOrganizationProjectModuleInput
	): Promise<OrganizationProjectModule> {
		const { id, ...values } = input;

		await this.commandBus.execute(
			new OrganizationProjectModuleUpdateCommand(id, this.payload(values))
		);

		return await this.organizationProjectModuleService.findOneByIdString(id);
	}

	/**
	 * Removes a module outright.
	 */
	@Mutation('deleteOrganizationProjectModule')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.PROJECT_MODULE_DELETE)
	async deleteOrganizationProjectModule(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.organizationProjectModuleService.delete(id);

		return true;
	}

	/**
	 * Withdraws a module: the row is marked rather than removed, and the tasks filed under it keep
	 * pointing at it.
	 *
	 * The class-level edit permission is the route's own: the withdrawal is inherited from the platform's
	 * CRUD base, whose handler declares no permission of their own.
	 */
	@Mutation('softDeleteOrganizationProjectModule')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	async softDeleteOrganizationProjectModule(
		@Args('id', { type: () => ID }) id: Id
	): Promise<OrganizationProjectModule> {
		return await this.organizationProjectModuleService.softRemove(id);
	}

	/**
	 * Puts a withdrawn module back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverOrganizationProjectModule')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	async recoverOrganizationProjectModule(
		@Args('id', { type: () => ID }) id: Id
	): Promise<OrganizationProjectModule> {
		return await this.organizationProjectModuleService.softRecover(id);
	}

	/**
	 * The payload the delivered create and edit handlers read.
	 *
	 * A related row is carried as the identifier the write reads: the employee lists are identifiers
	 * already, and each task is reduced to the row the handler takes the identifier off, because the
	 * pairing is written onto the task rather than onto this row. A list the caller does not state stays
	 * `undefined` rather than becoming `[]`: the edit reads "no tasks stated" as "leave the task set as
	 * it is" and an empty list as the instruction to take every task out of the module, and the employee
	 * lists are read the same way.
	 */
	private payload(
		input: ICreateOrganizationProjectModuleInput | Omit<IUpdateOrganizationProjectModuleInput, 'id'>
	): IOrganizationProjectModuleCreateInput {
		const { tasks, ...facts } = input;

		return {
			...facts,
			tasks: tasks?.map((id) => ({ id }) as ITask)
		} as unknown as IOrganizationProjectModuleCreateInput;
	}
}
