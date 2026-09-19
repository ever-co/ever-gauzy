import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, IPagination } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { AppointmentEmployee } from './appointment-employees.entity';
import { AppointmentEmployeesService } from './appointment-employees.service';

/** The members `CreateAppointmentEmployeeInput` declares in the schema. */
export interface ICreateAppointmentEmployeeInput {
	appointmentId: Id;
	employeeId: Id;
	organizationId?: Id;
}

/** The members `UpdateAppointmentEmployeeInput` declares in the schema. */
export interface IUpdateAppointmentEmployeeInput extends Partial<ICreateAppointmentEmployeeInput> {
	id: Id;
}

/**
 * The fields an invitation list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `AppointmentEmployeeFilter` and
 * `AppointmentEmployeeSortField` are its two renderings, and keeping the three in one file is what makes
 * a field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible to
 * introduce quietly.
 *
 * **The two identifier filters are the whole of what the delivered sub-routes ask for, and that is why
 * they are here.** `GET /appointment/:appointmentId` answers this resource's rows for one appointment
 * and `GET /employee-appointments/:employeeId` answers them for one employee: both are
 * `findAll({ where: … })` over the same table the connection reads, so both are the connection narrowed
 * by one field rather than capabilities of their own. `employeeAppointmentId` is the third identifier,
 * and it is the relation's own key rather than the plain column beside it — see the type document for
 * which is which.
 *
 * `tenantId` is deliberately absent: the tenant a read runs under comes from the credential and never
 * from a filter. The four bookkeeping members — `isActive`, `isArchived`, `archivedAt` and `deletedAt` —
 * are absent as well: the delivered read already answers live rows through the soft-delete column, so a
 * filter on one of the markers would be a second, weaker way to ask the question the read has answered.
 */
const APPOINTMENT_EMPLOYEE_FILTERABLE = {
	id: 'ID',
	appointmentId: 'ID',
	employeeId: 'ID',
	employeeAppointmentId: 'ID',
	organizationId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/**
 * The fields the sort enum offers.
 *
 * The invitation states no descriptive column of its own — it is the pair of identifiers that makes one
 * employee an invitee of one appointment — so the two stamps are the whole of what a caller can order it
 * by. The identifiers are filters rather than an order: ordering a page by a foreign key orders it by an
 * arbitrary identifier, which says nothing a reader of an invitation list is asking, and the walk is
 * served just as well by the stamp that makes the order total.
 */
const APPOINTMENT_EMPLOYEE_SORTABLE = ['createdAt', 'updatedAt'] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered reads state no order of their own — the list method hands the store a criterion and
 * takes the rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: newest first, with the identifier as the last key so that two invitations filed in the
 * same millisecond still have one order between them, which is what makes a cursor walk over them
 * stable.
 */
const APPOINTMENT_EMPLOYEE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The appointment's invitation over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below reaches the same `AppointmentEmployeesService` method the
 * `/api/appointment-employees` routes reach through the CRUD base.
 *
 * **The guard chain is the controller's, and no permission is stated anywhere.** The delivered
 * controller carries `TenantPermissionGuard` on the class and states no `@Permissions` — not on its two
 * sub-routes, and not on any of the routes it inherits from the CRUD base — so every one of its routes is
 * tenant-guarded and otherwise unpermissioned. The class below states the same guard, and every field
 * states no permission at all, because there is none to mirror: a resolver that demanded one would
 * refuse a caller the REST route serves, which is exactly the asymmetry the two-protocol rule forbids.
 *
 * **The two sub-routes are filters of the connection, never root fields of their own.** They answer the
 * same rows this connection answers, narrowed by one field each — the appointment on one, the employee on
 * the other — so `appointmentEmployees(filter: { appointmentId: { eq: … } })` and
 * `appointmentEmployees(filter: { employeeId: { eq: … } })` are those two capabilities stated in this
 * surface's vocabulary. A root field per narrowing would be a second surface over the same rows, free to
 * disagree with this one about the ordering and the page.
 *
 * **No relation is a member, and each one is carried as the identifier that always travels.** The second
 * sub-route joins `employeeAppointment` for its own caller; the read this surface mirrors joins nothing,
 * because a relation joined for a caller who named it is not a member of the answer to a caller who did
 * not. The appointment behind `employeeAppointmentId` is read from its own surface —
 * `employeeAppointment(id: …)` — and the employee behind `employeeId` from the employees resource.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('AppointmentEmployee')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class AppointmentEmployeesResolver {
	constructor(private readonly appointmentEmployeesService: AppointmentEmployeesService) {}

	/**
	 * The invitations of the caller's tenant, newest first.
	 *
	 * The delivered list route hands the service the query DTO its query string binds. This surface has no
	 * query string to bind: the connection protocol states the same narrowing in `filter`, which is
	 * applied to the rows the service returns, so the read runs with the route's own defaults — no
	 * `where` and no `relations`. The tenant is applied to the criterion by the service, from the
	 * credential rather than from the caller.
	 */
	@Query('appointmentEmployees')
	async appointmentEmployees(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<AppointmentEmployee>> {
		const { items }: IPagination<AppointmentEmployee> = await this.appointmentEmployeesService.findAll({});

		return buildConnection<AppointmentEmployee>({
			rows: items ?? [],
			filterable: APPOINTMENT_EMPLOYEE_FILTERABLE,
			sortable: APPOINTMENT_EMPLOYEE_SORTABLE,
			defaultSort: APPOINTMENT_EMPLOYEE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One invitation of the caller's tenant.
	 *
	 * An invitation that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in the
	 * other protocol's vocabulary.
	 *
	 * The delivered `GET /:id` is inherited from the CRUD base, which reads the row and nothing beside it
	 * — no relation of the row is joined, which is what this field mirrors: the two identifiers on the
	 * answer name the rows, and each of them is read from its own surface.
	 */
	@Query('appointmentEmployee')
	async appointmentEmployee(@Args('id', { type: () => ID }) id: Id): Promise<AppointmentEmployee | null> {
		try {
			return await this.appointmentEmployeesService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many invitations the caller's tenant holds.
	 *
	 * The same call the count route makes, with the same absence of narrowing. That route binds its query
	 * string to the store's own `where` and hands it to `countBy`; the connection protocol has no argument
	 * of that shape, so the field passes none and counts the caller's own rows — the tenant is applied to
	 * the criterion by the service, from the credential rather than from the caller, which is what the
	 * route's bare call counts too.
	 */
	@Query('appointmentEmployeeCount')
	async appointmentEmployeeCount(): Promise<number> {
		return await this.appointmentEmployeesService.countBy();
	}

	/**
	 * Invites an employee to an appointment.
	 *
	 * The write is the inherited `POST /`, which hands the service the entity as the store's own partial,
	 * so the input mirrors the row's writable columns and nothing else. The tenant is not a member: the
	 * service stamps the caller's own tenant from the credential. The employee is stamped from the
	 * credential too when the caller may not select one — a caller without the permission to change the
	 * selected employee invites itself, which is the service's own scope decision and not this surface's
	 * to restate.
	 */
	@Mutation('createAppointmentEmployee')
	async createAppointmentEmployee(
		@Args('input') input: ICreateAppointmentEmployeeInput
	): Promise<AppointmentEmployee> {
		return await this.appointmentEmployeesService.create(input as unknown as AppointmentEmployee);
	}

	/**
	 * Changes an invitation.
	 *
	 * The identifier is the criterion and is not repeated in the payload, which is the shape the inherited
	 * route has: `:id` names the row and the body carries only what changes. The service reads the row
	 * before it writes — through the same tenant-scoped read the node field uses — so a caller naming a row
	 * that is not there, or one of another tenant, is answered with the miss rather than with a write under
	 * an identifier it does not own.
	 *
	 * The delivered route answers the store's update result — a statement about the write, `{ affected }` —
	 * which is not a row and not what a field named `updateAppointmentEmployee` may return, so the row the
	 * write produced is read back through the same service read the node field uses.
	 */
	@Mutation('updateAppointmentEmployee')
	async updateAppointmentEmployee(
		@Args('input') input: IUpdateAppointmentEmployeeInput
	): Promise<AppointmentEmployee> {
		const { id, ...values } = input;

		await this.appointmentEmployeesService.update(id, values as unknown as Partial<AppointmentEmployee>);

		return await this.appointmentEmployeesService.findOneByIdString(id);
	}

	/**
	 * Removes an invitation outright.
	 *
	 * The same service the inherited `DELETE /:id` route calls, so the two surfaces remove the same row and
	 * refuse the same miss: the service raises the miss as the `404` the route answers with. The delivered
	 * route answers the store's delete result, which is not a row, so the field answers whether the removal
	 * was performed — the fact a client branches on.
	 */
	@Mutation('deleteAppointmentEmployee')
	async deleteAppointmentEmployee(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.appointmentEmployeesService.delete(id);

		return true;
	}

	/**
	 * Withdraws an invitation without removing it: the row keeps its identifier, and the delivered list
	 * stops answering it.
	 *
	 * The delivered route declares no query parameter of its own and hands the service the empty option
	 * list its variadic parameter carries, so the field states no options either.
	 */
	@Mutation('softDeleteAppointmentEmployee')
	async softDeleteAppointmentEmployee(@Args('id', { type: () => ID }) id: Id): Promise<AppointmentEmployee> {
		return await this.appointmentEmployeesService.softRemove(id);
	}

	/**
	 * Puts a withdrawn invitation back. Unoptioned for the same reason the withdrawal above is: the
	 * delivered route binds no query parameter of its own.
	 */
	@Mutation('recoverAppointmentEmployee')
	async recoverAppointmentEmployee(@Args('id', { type: () => ID }) id: Id): Promise<AppointmentEmployee> {
		return await this.appointmentEmployeesService.softRecover(id);
	}
}
