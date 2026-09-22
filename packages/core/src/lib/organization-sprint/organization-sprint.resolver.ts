import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	ID as Id,
	IOrganizationSprintCreateInput,
	IOrganizationSprintUpdateInput,
	IPagination,
	JsonData,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { OrganizationSprintCreateCommand, OrganizationSprintUpdateCommand } from './commands';
import { OrganizationSprint } from './organization-sprint.entity';
import { OrganizationSprintService } from './organization-sprint.service';

/** The members `CreateOrganizationSprintInput` declares in the schema. */
export interface ICreateOrganizationSprintInput {
	organizationId: Id;
	projectId: Id;
	name: string;
	goal?: string;
	length: number;
	startDate?: Date;
	endDate?: Date;
	status: string;
	dayStart?: number;
	sprintProgress?: JsonData;
	memberIds?: Id[];
	managerIds?: Id[];
}

/** The members `UpdateOrganizationSprintInput` declares in the schema. */
export interface IUpdateOrganizationSprintInput {
	id: Id;
	organizationId?: Id;
	projectId?: Id;
	name?: string;
	goal?: string;
	length?: number;
	startDate?: Date;
	endDate?: Date;
	status?: string;
	dayStart?: number;
	sprintProgress?: JsonData;
	memberIds?: Id[];
	managerIds?: Id[];
}

/**
 * The fields a sprint list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OrganizationSprintFilter` and
 * `OrganizationSprintSortField` are its two renderings, and keeping the three in one file is what makes
 * a field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible
 * to introduce quietly.
 *
 * Every member is a column of the row the delivered read answers. The sprint's `members`, its
 * `taskSprints` and its `tasks` are in neither: the delivered list read joins the relations its `data`
 * query parameter names, this surface names none, and none of the three is a column of the sprint row
 * — so a filter on one of them would be evaluated against a row that carries none of it and would
 * select nothing at all, which is the worst answer a filter can give.
 */
const ORGANIZATION_SPRINT_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	goal: 'STRING',
	length: 'NUMBER',
	startDate: 'DATE',
	endDate: 'DATE',
	status: 'STRING',
	dayStart: 'NUMBER',
	sprintProgress: 'JSON',
	projectId: 'ID',
	organizationId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN'
} as const;

/** The fields the sort enum offers. */
const ORGANIZATION_SPRINT_SORTABLE = [
	'createdAt',
	'updatedAt',
	'name',
	'startDate',
	'endDate',
	'status',
	'length'
] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list method applies no order of its own — it hands the store a criterion and takes the
 * rows as they come back, in whatever order the store returns them — so this is not a reproduction of
 * the route's order but the order that makes a cursor walk total: newest first, which is the order a
 * list of sprints is filed in, with the identifier as the last key so that two rows written in the same
 * millisecond still have one order between them. A caller that wants the sprint's own timeline states
 * `startDate` or `endDate` in `sort`, which the enum offers for exactly that read.
 */
const ORGANIZATION_SPRINT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The organization sprint over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below reaches the same `OrganizationSprintService` method, or dispatches the same
 * command, that the `/api/organization-sprint` routes reach.
 *
 * **The guard chain and the permission are the controller's, field by field.** The controller carries
 * `TenantPermissionGuard` and `PermissionGuard` on the class and states `ALL_ORG_EDIT` there, so this
 * resolver carries the same two guards and the same class-level permission, and each field then states
 * the permission its own route runs under. The count, the withdrawal and the recovery are the three
 * readings worth spelling out: all three routes are inherited from the CRUD base, none of them declares
 * a permission of its own, and the guard reads the handler's declaration before the class's — so each
 * resolves to the controller's class-level `ALL_ORG_EDIT` and each field states that rather than the
 * view permission its read siblings state. A field that stated nothing would be a field whose scope is
 * inherited rather than written down, and one that stated the view permission would serve a caller the
 * REST route refuses.
 *
 * **Nothing reaches for the service on the two writes.** Filing a sprint is more than an insert — the
 * handler stamps the tenant, resolves the named employees inside the caller's own organization, writes
 * the membership pivot with the managers marked, subscribes the assignees to the sprint and records the
 * activity — so both write fields dispatch the command the delivered route dispatches rather than
 * writing a row the rest of the platform never finished setting up. The update's handler reads the row
 * back after it writes, which is why the field answers with the row rather than with the write's result.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('OrganizationSprint')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_EDIT)
export class OrganizationSprintResolver {
	constructor(
		private readonly organizationSprintService: OrganizationSprintService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The sprints of the caller's tenant, newest first.
	 */
	@Query('organizationSprints')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_SPRINT_VIEW)
	async organizationSprints(
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
	): Promise<GraphqlConnection<OrganizationSprint>> {
		// The delivered list route binds the `relations` and the `findInput` out of its `data` query
		// parameter and hands both to the service. This surface has no query string to bind, so the read
		// runs with the route's own defaults for an unstated request — no criterion and no relations,
		// which is exactly what the route hands the service when its `data` parameter names neither —
		// and the connection protocol's `filter` is applied to the rows the service returns. The tenant
		// is applied to the criterion by the service, from the credential rather than from the caller.
		const { items }: IPagination<OrganizationSprint> = await this.organizationSprintService.findAll({
			...(withDeleted ? { withDeleted: true } : {}),
			where: undefined,
			relations: undefined
		});

		return buildConnection<OrganizationSprint>({
			rows: items ?? [],
			filterable: ORGANIZATION_SPRINT_FILTERABLE,
			sortable: ORGANIZATION_SPRINT_SORTABLE,
			defaultSort: ORGANIZATION_SPRINT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One sprint of the caller's tenant.
	 *
	 * A sprint that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 *
	 * The delivered route hands the query string it binds to the same read, and joins the relations that
	 * string names and none otherwise — so the field asks the same read for the same absence of options,
	 * which is what a REST caller that names none gets.
	 */
	@Query('organizationSprint')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_SPRINT_VIEW)
	async organizationSprint(@Args('id', { type: () => ID }) id: Id): Promise<OrganizationSprint | null> {
		try {
			return await this.organizationSprintService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many sprints the caller's tenant holds.
	 *
	 * The same call the count route makes, with the same absence of narrowing: that route binds its query
	 * string to the store's own `where` and hands it to `countBy`, and the connection protocol has no
	 * argument of that shape, so the field passes none and counts the caller's own rows — the tenant is
	 * applied to the criterion by the service, from the credential rather than from the caller.
	 *
	 * The permission is the controller's class-level one rather than the view permission the two reads
	 * above state, because the route this mirrors is inherited and declares none: see the class comment.
	 */
	@Query('organizationSprintCount')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	async organizationSprintCount(): Promise<number> {
		return await this.organizationSprintService.countBy();
	}

	/**
	 * Files a sprint through the command the delivered route dispatches.
	 *
	 * The payload is the input as stated. The tenant is stamped from the credential by the handler and is
	 * never a member here: there is no way for a caller to file a sprint into a tenant it is not acting
	 * in.
	 */
	@Mutation('createOrganizationSprint')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_SPRINT_ADD)
	async createOrganizationSprint(@Args('input') input: ICreateOrganizationSprintInput): Promise<OrganizationSprint> {
		return await this.commandBus.execute(
			new OrganizationSprintCreateCommand(input as unknown as IOrganizationSprintCreateInput)
		);
	}

	/**
	 * Changes a sprint through the command the delivered route dispatches.
	 *
	 * The identifier is the criterion and is not repeated in the payload, which is the shape the route
	 * itself has: `:id` names the row and the body carries the facts. The handler reads the row before it
	 * writes and answers the row read back afterwards, so a sprint of another tenant, or one that is not
	 * there, is a miss rather than a write under an identifier the caller does not own.
	 */
	@Mutation('updateOrganizationSprint')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_SPRINT_EDIT)
	async updateOrganizationSprint(@Args('input') input: IUpdateOrganizationSprintInput): Promise<OrganizationSprint> {
		const { id, ...values } = input;

		return await this.commandBus.execute(
			new OrganizationSprintUpdateCommand(id, values as unknown as IOrganizationSprintUpdateInput)
		);
	}

	/**
	 * Removes a sprint outright.
	 *
	 * The delivered route hands the identifier to the service rather than dispatching a command, so this
	 * field does the same; the answer is the fact of the removal, which is the one member of the deletion
	 * result a caller reads.
	 */
	@Mutation('deleteOrganizationSprint')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_SPRINT_DELETE)
	async deleteOrganizationSprint(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.organizationSprintService.delete(id);

		return true;
	}

	/**
	 * Withdraws a sprint: the row is marked rather than removed, and the recovery below reads it back.
	 *
	 * The same service method the delivered route calls, and the route passes the empty options array its
	 * variadic parameter collects; no options is what that array states, so none are passed here.
	 */
	@Mutation('softDeleteOrganizationSprint')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	async softDeleteOrganizationSprint(@Args('id', { type: () => ID }) id: Id): Promise<OrganizationSprint> {
		return await this.organizationSprintService.softRemove(id);
	}

	/**
	 * Puts a withdrawn sprint back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverOrganizationSprint')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT)
	async recoverOrganizationSprint(@Args('id', { type: () => ID }) id: Id): Promise<OrganizationSprint> {
		return await this.organizationSprintService.softRecover(id);
	}
}
