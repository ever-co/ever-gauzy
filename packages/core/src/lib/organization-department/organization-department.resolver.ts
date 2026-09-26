import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	ID as Id,
	IEditEntityByMemberInput,
	IEmployee,
	IOrganizationDepartmentCreateInput,
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
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { OrganizationDepartmentEditByEmployeeCommand, OrganizationDepartmentUpdateCommand } from './commands';
import { OrganizationDepartment } from './organization-department.entity';
import { OrganizationDepartmentService } from './organization-department.service';

/** The members `CreateOrganizationDepartmentInput` declares in the schema. */
export interface ICreateOrganizationDepartmentInput {
	name: string;
	organizationId?: Id;
	memberIds?: Id[];
	tagIds?: Id[];
}

/** The members `UpdateOrganizationDepartmentInput` declares in the schema. */
export interface IUpdateOrganizationDepartmentInput {
	id: Id;
	name?: string;
	organizationId?: Id;
	memberIds?: Id[];
	tagIds?: Id[];
}

/** The members `UpdateOrganizationDepartmentByEmployeeInput` declares in the schema. */
export interface IUpdateOrganizationDepartmentByEmployeeInput {
	organizationId: Id;
	memberId: Id;
	addedEntityIds?: Id[];
	removedEntityIds?: Id[];
}

/**
 * The fields a department list may be filtered and sorted by, and the order it is returned in when
 * the caller states none.
 *
 * This declaration is the resolver's half of the SDL: `OrganizationDepartmentFilter` and
 * `OrganizationDepartmentSortField` are its two renderings, and keeping the three in one file is
 * what makes a field that is filterable in the schema but unknown to the evaluator — or the reverse
 * — impossible to introduce quietly.
 *
 * The three pivots are in neither. `members`, `tags` and `candidates` are joined only when a REST
 * caller names the relation in its query string, and this surface names none — so a filter on one of
 * them would be evaluated against a row that carries none of it and would select nothing at all.
 * Who works a department is the employee read's question, and that read is a root field of its own
 * precisely because the pivot it joins is not one the list read loads.
 */
const ORGANIZATION_DEPARTMENT_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	organizationId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN'
} as const;

/** The fields the sort enum offers. */
const ORGANIZATION_DEPARTMENT_SORTABLE = ['createdAt', 'updatedAt', 'name'] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list read declares no order of its own — it hands the store whatever criterion its
 * query parameter carried, and for an unstated request that is none at all — so this is a decision
 * the connection has to make rather than one it reproduces: the name ascending, because a name is
 * how a department is chosen from a list of them, then the identifier, which is the key that makes
 * the order total and a cursor walk over it stable.
 */
const ORGANIZATION_DEPARTMENT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'name', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The organization department over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `OrganizationDepartmentService` method, or dispatches
 * the same command, that the `/api/organization-department` routes reach — including the six whose
 * routes the controller inherits from the CRUD base rather than declaring.
 *
 * **The guard chain and the permission are the controller's, field by field.** The delivered
 * controller carries `TenantPermissionGuard` on the class and states `PermissionGuard` with a
 * permission on six of the routes this surface mirrors rather than on the class — the create, the
 * edit, the employee assignment, the removal, the soft removal and the recovery — so this resolver
 * carries the tenant guard on the class and restates exactly that pair on exactly those six fields.
 * Without it the GraphQL surface would serve a caller the REST route refuses: any authenticated
 * member of the tenant could file, rewrite, remove, withdraw or restore a department here while the
 * route each field mirrors demands `ALL_ORG_EDIT` (or `ORG_EMPLOYEES_EDIT`), which is one capability
 * decided two different ways with this surface as the permissive one. The class states no permission
 * of its own, because one there would gate the reads as well — and the reads, the list, the node, the
 * count and the employee read, are served to any member of the tenant on both protocols, so their
 * fields state nothing. A field that demanded a permission its route does not would refuse a caller
 * that route serves, which is the same defect read the other way round.
 *
 * **The employee read is a root field of its own rather than a filter on the connection.** The read
 * behind it joins the department-member pivot the list read does not, so a `members` filter on the
 * connection would be evaluated against rows that carry no members and would select nothing at all.
 * The field delegates to the same read and presents its rows as the connection, which is the shape
 * every list on this surface answers with.
 *
 * **The paginated spelling of the list is not a second field.** It answers the same rows under the
 * same filters as the delivered list route, and this surface states that question once; the
 * paginated route's own permission belongs to that route and is not restated on the connection,
 * which mirrors the list route.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any
 * part of it.
 */
@Resolver('OrganizationDepartment')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class OrganizationDepartmentResolver {
	constructor(
		private readonly organizationDepartmentService: OrganizationDepartmentService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The departments of the caller's tenant, in name order.
	 */
	@Query('organizationDepartments')
	async organizationDepartments(
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
	): Promise<GraphqlConnection<OrganizationDepartment>> {
		// The delivered list route binds `findInput`, `relations` and `order` out of its `data` query
		// parameter and hands the three to the service. This surface has no query string to bind, so the
		// read runs with exactly what that route hands over for a request that states nothing — the
		// members present and undefined — and the connection protocol's `filter` is applied to the rows
		// the service returns. The tenant is applied to the criterion by the service, from the credential
		// rather than from the caller.
		const { items }: IPagination<OrganizationDepartment> = await this.organizationDepartmentService.findAll({
			...(withDeleted ? { withDeleted: true } : {}),
			where: undefined,
			order: undefined,
			relations: undefined
		});

		return buildConnection<OrganizationDepartment>({
			rows: items ?? [],
			filterable: ORGANIZATION_DEPARTMENT_FILTERABLE,
			sortable: ORGANIZATION_DEPARTMENT_SORTABLE,
			defaultSort: ORGANIZATION_DEPARTMENT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One department of the caller's tenant.
	 *
	 * A department that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact stated
	 * in the other protocol's vocabulary.
	 */
	@Query('organizationDepartment')
	async organizationDepartment(
		@Args('id', { type: () => ID }) id: Id
	): Promise<OrganizationDepartment | null> {
		try {
			return await this.organizationDepartmentService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many departments the caller's tenant has.
	 *
	 * The same call the count route makes, with the same absence of narrowing: that route binds its
	 * query string to the store's own `where` and hands it to `countBy`, and the connection protocol
	 * has no argument of that shape, so the field passes none and counts the caller's own rows — the
	 * tenant is applied to the criterion by the service, from the credential.
	 */
	@Query('organizationDepartmentCount')
	async organizationDepartmentCount(): Promise<number> {
		return await this.organizationDepartmentService.countBy();
	}

	/**
	 * The departments one employee is a member of.
	 *
	 * The same read the delivered `GET /organization-department/employee/:id` route performs, with the
	 * same argument and nothing beside it: the route states the employee as a path segment and carries
	 * no query string, so the field states the employee and no other argument. The answer is the
	 * connection, built over the rows that read returns under the resource's own default order and the
	 * query protocol's own page — the pivot it joins is what makes this a root field of its own rather
	 * than a `members` filter on the connection above.
	 */
	@Query('organizationDepartmentsByEmployee')
	async organizationDepartmentsByEmployee(
		@Args('employeeId', { type: () => ID }) employeeId: Id
	): Promise<GraphqlConnection<OrganizationDepartment>> {
		const answer = await this.organizationDepartmentService.findByEmployee(employeeId);

		return buildConnection<OrganizationDepartment>({
			rows: this.rowsOfTheEmployeeRead(answer),
			filterable: ORGANIZATION_DEPARTMENT_FILTERABLE,
			sortable: ORGANIZATION_DEPARTMENT_SORTABLE,
			defaultSort: ORGANIZATION_DEPARTMENT_DEFAULT_SORT
		});
	}

	/**
	 * Files a department, through the same call the delivered create route makes.
	 *
	 * The payload is the input as the schema states it, mapped onto the relations this row owns. The
	 * tenant is stamped from the credential by the service and is never a member here: there is no way
	 * for a caller to file a department into a tenant it is not acting in.
	 *
	 * The route overrides the inherited `CrudController.create()` for no other reason than to attach
	 * `@UseGuards(PermissionGuard)` and `@Permissions(ALL_ORG_EDIT, ORG_EMPLOYEES_EDIT)`: filing a
	 * department is an administrative act, and `PermissionGuard` authorizes any handler that asks for
	 * no permission, so the inherited route was reachable by every member of the tenant until it was
	 * gated. The field states the same pair, or this mutation would be that way round again.
	 */
	@Mutation('createOrganizationDepartment')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_EMPLOYEES_EDIT)
	async createOrganizationDepartment(
		@Args('input') input: ICreateOrganizationDepartmentInput
	): Promise<OrganizationDepartment> {
		return await this.organizationDepartmentService.create(
			this.payload(input) as unknown as OrganizationDepartment
		);
	}

	/**
	 * Edits a department through the command the delivered route dispatches.
	 *
	 * The identifier is the criterion and is not repeated in the payload, which is the shape the route
	 * itself has: `:id` names the row and the body carries the facts. The handler writes through the
	 * create path with the identifier merged in, so a member the caller leaves out is left as it is
	 * and the answer is the row as it now stands.
	 *
	 * The route states `@UseGuards(PermissionGuard)` with `ALL_ORG_EDIT, ORG_EMPLOYEES_EDIT`, and the
	 * field states the same pair: rewriting a department's name or its people is the same
	 * administrative act as filing one, and an ungated mutation here would let a caller the edit route
	 * refuses rewrite the row through the other protocol.
	 */
	@Mutation('updateOrganizationDepartment')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_EMPLOYEES_EDIT)
	async updateOrganizationDepartment(
		@Args('input') input: IUpdateOrganizationDepartmentInput
	): Promise<OrganizationDepartment> {
		const { id, ...values } = input;

		return await this.commandBus.execute(
			new OrganizationDepartmentUpdateCommand(id, this.payload(values as ICreateOrganizationDepartmentInput))
		);
	}

	/**
	 * Moves a set of departments into or out of one employee's book.
	 *
	 * The same command the delivered `PUT /organization-department/employee` route dispatches, with the
	 * payload the delivered body carries: the employee is named by its identifier and handed over as
	 * the row the command reads, and a list the caller does not state is left out rather than sent
	 * empty, because the handler reads "nothing stated" and "nothing to change" as one instruction.
	 *
	 * The answer is the write's own success, which is what the command behind the route answers with.
	 * A refusal is that command's failure and reaches the caller as one, rather than being flattened
	 * into a `false` that would read as "there was nothing to do".
	 *
	 * The permission is the route's own and not this resource's edit permission: assigning people to a
	 * department is the employee domain's operation, and the field carries exactly the pair the route
	 * carries.
	 */
	@Mutation('updateOrganizationDepartmentByEmployee')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT)
	async updateOrganizationDepartmentByEmployee(
		@Args('input') input: IUpdateOrganizationDepartmentByEmployeeInput
	): Promise<boolean> {
		const payload: IEditEntityByMemberInput = {
			organizationId: input.organizationId,
			member: { id: input.memberId } as IEmployee,
			addedEntityIds: input.addedEntityIds,
			removedEntityIds: input.removedEntityIds
		} as IEditEntityByMemberInput;

		return await this.commandBus.execute(new OrganizationDepartmentEditByEmployeeCommand(payload));
	}

	/**
	 * Removes a department outright.
	 *
	 * The route overrides the inherited `CrudController.delete()` only to attach the gate, and states
	 * `@UseGuards(PermissionGuard)` with `ALL_ORG_EDIT, ORG_EMPLOYEES_EDIT`; the field states the same
	 * pair. An ungated removal here would be the way around that route for a caller who may not delete
	 * a department — and the pivot rows that point at the department are removed with it, so the act
	 * the route refuses is not one this surface may serve on the caller's behalf.
	 */
	@Mutation('deleteOrganizationDepartment')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_EMPLOYEES_EDIT)
	async deleteOrganizationDepartment(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.organizationDepartmentService.delete(id);

		return true;
	}

	/**
	 * Withdraws a department: the row is marked rather than removed, and the people filed under it keep
	 * pointing at it.
	 *
	 * Withdrawal is a removal as far as authority goes, and the route — an override of the inherited
	 * `CrudController.softRemove()` that exists to attach the gate — states `@UseGuards(PermissionGuard)`
	 * with `ALL_ORG_EDIT, ORG_EMPLOYEES_EDIT`. The field states the same pair: a department hidden from
	 * every list by a caller the route refuses is the same act as deleting it, only quieter.
	 */
	@Mutation('softDeleteOrganizationDepartment')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_EMPLOYEES_EDIT)
	async softDeleteOrganizationDepartment(
		@Args('id', { type: () => ID }) id: Id
	): Promise<OrganizationDepartment> {
		return await this.organizationDepartmentService.softRemove(id);
	}

	/**
	 * Puts a withdrawn department back, clearing the marker the withdrawal set.
	 *
	 * The route — an override of the inherited `CrudController.softRecover()` that exists to attach the
	 * gate — states `@UseGuards(PermissionGuard)` with `ALL_ORG_EDIT, ORG_EMPLOYEES_EDIT`, and the field
	 * states the same pair. Restoring is what undoes the withdrawal above, so a caller the withdrawal
	 * route refuses must not be able to reverse one here either.
	 */
	@Mutation('recoverOrganizationDepartment')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_EMPLOYEES_EDIT)
	async recoverOrganizationDepartment(
		@Args('id', { type: () => ID }) id: Id
	): Promise<OrganizationDepartment> {
		return await this.organizationDepartmentService.softRecover(id);
	}

	/**
	 * The rows of the employee read, whichever envelope the delivered method answered with.
	 *
	 * That method is declared as the pagination envelope and answers the rows themselves on both ORMs
	 * — one query builder's `getMany` with the member pivot joined, one repository `find` with the same
	 * relation — so the connection is handed the set rather than a shape the read does not produce.
	 * Both are the rows the pivot selected, which is the whole of what the read decides.
	 */
	private rowsOfTheEmployeeRead(
		answer: IPagination<OrganizationDepartment> | OrganizationDepartment[] | undefined
	): OrganizationDepartment[] {
		if (Array.isArray(answer)) {
			return answer;
		}

		return answer?.items ?? [];
	}

	/**
	 * The row a write persists, out of the members the two write inputs state.
	 *
	 * A related row is carried as the identifier the write persists and handed over as the row the
	 * pivot is written from — which is the shape this entity's own relations take, `members` and
	 * `tags` being the two many-to-many collections it owns. A list the caller did not state stays
	 * `undefined` rather than becoming `[]`: an absent list is not an instruction, while an empty one
	 * is the instruction to clear the pivot.
	 */
	private payload(
		input: ICreateOrganizationDepartmentInput | IUpdateOrganizationDepartmentInput
	): IOrganizationDepartmentCreateInput {
		return {
			name: input.name,
			organizationId: input.organizationId,
			members: input.memberIds?.map((id) => ({ id }) as IEmployee),
			tags: input.tagIds?.map((id) => ({ id }) as ITag)
		} as unknown as IOrganizationDepartmentCreateInput;
	}
}
