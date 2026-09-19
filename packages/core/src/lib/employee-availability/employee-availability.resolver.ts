import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, IEmployeeAvailabilityCreateInput, IPagination, PermissionsEnum } from '@gauzy/contracts';
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
import { EmployeeAvailability } from './employee-availability.entity';
import { EmployeeAvailabilityService } from './employee-availability.service';
import { EmployeeAvailabilityBulkCreateCommand, EmployeeAvailabilityCreateCommand } from './commands';

/** The members `CreateEmployeeAvailabilityInput` declares in the schema. */
export interface ICreateEmployeeAvailabilityInput {
	dayOfWeek: number;
	startDate: Date;
	endDate: Date;
	availabilityStatus: string;
	employeeId: Id;
	availabilityNotes?: string;
	organizationId?: Id;
}

/** The members `UpdateEmployeeAvailabilityInput` declares in the schema. */
export interface IUpdateEmployeeAvailabilityInput extends Partial<ICreateEmployeeAvailabilityInput> {
	id: Id;
}

/**
 * The fields an availability list may be filtered and sorted by, and the order it is returned in when
 * the caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EmployeeAvailabilityFilter` and
 * `EmployeeAvailabilitySortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * `dayOfWeek` is a whole number and the two window bounds are instants, so the two of them are the
 * only filters here that compare on a scale rather than on equality: "who is unavailable on a Friday",
 * "whose window covers next week" are the reads this resource exists to answer.
 *
 * `availabilityStatus` is a text filter, not a numeric one, although the column behind it is an
 * integer. The value a row carries by the time this resolver sees it is the vocabulary's own label —
 * `AvailabilityStatusTransformer` maps the column on the way out — so a filter that compared numbers
 * would compare against the wrong scale and match nothing. The label is the value; the filter follows
 * the value.
 */
const EMPLOYEE_AVAILABILITY_FILTERABLE = {
	id: 'ID',
	startDate: 'DATE',
	endDate: 'DATE',
	dayOfWeek: 'NUMBER',
	availabilityStatus: 'STRING',
	availabilityNotes: 'STRING',
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

/**
 * The fields the sort enum offers.
 *
 * `id` is deliberately absent although the default order below ends on it. A caller ordering by a
 * randomly generated identifier is ordering by nothing it can name, while the default's own tie-break
 * is what makes that order total — which is a statement about the resource, not an option for the
 * caller.
 */
const EMPLOYEE_AVAILABILITY_SORTABLE = [
	'createdAt',
	'updatedAt',
	'startDate',
	'endDate',
	'dayOfWeek',
	'availabilityStatus'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered reads state no order of their own — `findAll`, the node read and the count all hand
 * the store a filter and take the rows as they come back — so the connection applies the platform's
 * own: newest first, with the identifier as the last key so that two windows filed in the same
 * millisecond still have one order between them, which is what makes a cursor walk over them stable.
 */
const EMPLOYEE_AVAILABILITY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * Where an employee's availability lives, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below dispatches the same command, or reaches the same `EmployeeAvailabilityService`
 * method, that the `/api/employee-availability` routes reach.
 *
 * **The guard chain and the permission are the controller's, read from its own metadata.** The class
 * carries what the controller class carries — both protocol guards, and the class-level pair of
 * `EMPLOYEE_AVAILABILITY_UPDATE` and `EMPLOYEE_AVAILABILITY_DELETE` — and every field then states the
 * permission its own route runs under. Four of the fields below state none of their own and are
 * therefore answered by that class pair, and that is the parity rather than an omission: the delivered
 * `GET /count`, `DELETE /:id`, `DELETE /:id/soft` and `PUT /:id/recover` are inherited from the CRUD
 * base without a permission of their own, so the class pair is the whole of what they run under — and
 * so is the inherited `GET /:id` behind the node query. A field that narrowed one of those to the read
 * permission would refuse a caller the REST route serves; a field that widened the list or the writes
 * would be a second, wider door to the same rows.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the catalogue declares for the GraphQL
 * endpoint and its resolvers, applied once here so every field below is behind the one capability.
 * `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the class,
 * which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 *
 * **The list is a connection, and the delivered list is served once.** The controller answers a filtered
 * set twice — `GET /` and the inherited `GET /pagination` — and the two differ only in whether the page
 * is applied before or after the answer; that is one capability, so it is one root field, and the page
 * is what the connection protocol already performs. `withDeleted` is deliberately absent: the delivered
 * read answers live rows only, and an argument that cannot be honoured is worse than one that is not
 * offered.
 */
@Resolver('EmployeeAvailability')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE, PermissionsEnum.EMPLOYEE_AVAILABILITY_DELETE)
export class EmployeeAvailabilityResolver {
	constructor(
		private readonly employeeAvailabilityService: EmployeeAvailabilityService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The availability rows of the caller's tenant, newest first.
	 */
	@Query('employeeAvailabilities')
	@Permissions(PermissionsEnum.EMPLOYEE_AVAILABILITY_READ)
	async employeeAvailabilities(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<EmployeeAvailability>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults — no
		// `where` and no `relations`.
		const { items }: IPagination<EmployeeAvailability> = await this.employeeAvailabilityService.findAll({});

		return buildConnection<EmployeeAvailability>({
			rows: items ?? [],
			filterable: EMPLOYEE_AVAILABILITY_FILTERABLE,
			sortable: EMPLOYEE_AVAILABILITY_SORTABLE,
			defaultSort: EMPLOYEE_AVAILABILITY_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One availability row of the caller's tenant.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the
	 * other protocol's vocabulary.
	 */
	@Query('employeeAvailability')
	async employeeAvailability(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeAvailability | null> {
		try {
			return await this.employeeAvailabilityService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many availability rows the caller's tenant holds.
	 *
	 * The same call the inherited count route makes, with the same absence of narrowing: that route
	 * binds its query string to the store's own `where` and hands it to `countBy`, and the connection
	 * protocol has no argument of that shape, so the field passes none and counts the caller's own rows
	 * — the tenant is applied to the criterion by the service, from the credential. The field is
	 * nullable in the schema because a count is an aggregate a resource may legitimately have no answer
	 * for, and a non-null field would turn "not answered" into a fabricated zero.
	 */
	@Query('employeeAvailabilityCount')
	async employeeAvailabilityCount(): Promise<number> {
		return await this.employeeAvailabilityService.countBy();
	}

	/**
	 * Files one availability row.
	 *
	 * The write is dispatched as the same command the REST route dispatches, so the two surfaces file
	 * the same row: the handler stamps the tenant from the credential and never from the body, the
	 * service resolves the employee against the credential as well, and the status the caller states is
	 * mapped to its stored integer by the entity's own transformer on the way in, exactly as it is over
	 * REST.
	 *
	 * The cast states a difference rather than hiding one: the schema carries `availabilityStatus` as the
	 * vocabulary's own label — see `EmployeeAvailability.availabilityStatus` — while the delivered input
	 * type names the enum, and the label is the value the transformer maps back to that enum. Casting is
	 * how the same vocabulary is stated in the schema's spelling.
	 */
	@Mutation('createEmployeeAvailability')
	@Permissions(PermissionsEnum.EMPLOYEE_AVAILABILITY_CREATE)
	async createEmployeeAvailability(
		@Args('input') input: ICreateEmployeeAvailabilityInput
	): Promise<EmployeeAvailability> {
		return await this.commandBus.execute(
			new EmployeeAvailabilityCreateCommand(input as unknown as IEmployeeAvailabilityCreateInput)
		);
	}

	/**
	 * Files several availability rows at once.
	 *
	 * The same command the `POST /bulk` route dispatches, and the answer is the list of rows the write
	 * created — which is what the delivered command answers, rather than a statement about the write.
	 * The tenant is stamped from the credential for every row in the list, so no member of the input can
	 * place a row in a tenant the caller is not acting in.
	 */
	@Mutation('createEmployeeAvailabilities')
	@Permissions(PermissionsEnum.EMPLOYEE_AVAILABILITY_CREATE)
	async createEmployeeAvailabilities(
		@Args('input') input: ICreateEmployeeAvailabilityInput[]
	): Promise<EmployeeAvailability[]> {
		return await this.commandBus.execute(
			new EmployeeAvailabilityBulkCreateCommand(input as unknown as IEmployeeAvailabilityCreateInput[])
		);
	}

	/**
	 * Changes one availability row.
	 *
	 * The service is the one the `PUT /:id` route calls, with the identifier the route takes from the
	 * path carried inside the input. The delivered service reads the row before it writes it — a caller
	 * naming a row of another tenant, or one that is not there, is answered with the miss rather than
	 * with a write under an identifier it does not own — and the write itself is a primitive statement
	 * over the columns the caller states, so a member the caller leaves out is left as it is, which is
	 * what `UpdateEmployeeAvailabilityInput` says in the schema.
	 *
	 * The row is then read back through the read the node field performs, because the delivered call
	 * answers the store's own result — `{ affected }`, a statement about the write — and a field that
	 * declares a row cannot answer a statement about one. The write is still the route's own call, made
	 * once; the second call is the read that turns its result into the row the schema promises.
	 */
	@Mutation('updateEmployeeAvailability')
	@Permissions(PermissionsEnum.EMPLOYEE_AVAILABILITY_UPDATE)
	async updateEmployeeAvailability(
		@Args('input') input: IUpdateEmployeeAvailabilityInput
	): Promise<EmployeeAvailability> {
		await this.employeeAvailabilityService.update(input.id, { ...input } as unknown as EmployeeAvailability);

		return await this.employeeAvailabilityService.findOneByIdString(input.id);
	}

	/**
	 * Removes an availability row outright.
	 *
	 * The delivered route answers the store's own delete result — a statement about the write,
	 * `{ affected }` — which is not a row and not what a field named `deleteEmployeeAvailability` may
	 * return, so the field answers the one fact that call establishes, that the removal ran.
	 */
	@Mutation('deleteEmployeeAvailability')
	async deleteEmployeeAvailability(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.employeeAvailabilityService.delete(id);

		return true;
	}

	/**
	 * Withdraws an availability row without removing it.
	 */
	@Mutation('softDeleteEmployeeAvailability')
	async softDeleteEmployeeAvailability(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeAvailability> {
		return await this.employeeAvailabilityService.softRemove(id);
	}

	/**
	 * Puts a withdrawn availability row back.
	 */
	@Mutation('recoverEmployeeAvailability')
	async recoverEmployeeAvailability(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeAvailability> {
		return await this.employeeAvailabilityService.softRecover(id);
	}
}
