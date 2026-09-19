import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ID as Id,
	IEmployeeAppointmentCreateInput,
	IEmployeeAppointmentUpdateInput,
	IPagination,
	LanguagesEnum
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { RequestContext } from '../core/context';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { EmployeeAppointment } from './employee-appointment.entity';
import { EmployeeAppointmentService } from './employee-appointment.service';
import { EmployeeAppointmentCreateCommand, EmployeeAppointmentUpdateCommand } from './commands';

/** The members `CreateEmployeeAppointmentInput` declares in the schema. */
export interface ICreateEmployeeAppointmentInput {
	organizationId: Id;
	agenda: string;
	employeeId?: Id;
	description?: string;
	location?: string;
	startDateTime: Date;
	endDateTime: Date;
	bufferTimeStart?: boolean;
	bufferTimeEnd?: boolean;
	bufferTimeInMins?: number;
	breakTimeInMins?: number;
	breakStartTime?: Date;
	emails?: string;
}

/** The members `UpdateEmployeeAppointmentInput` declares in the schema. */
export interface IUpdateEmployeeAppointmentInput extends Partial<ICreateEmployeeAppointmentInput> {
	id: Id;
	status?: string;
}

/**
 * The fields an appointment list may be filtered and sorted by, and the order it is returned in when
 * the caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EmployeeAppointmentFilter` and
 * `EmployeeAppointmentSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * Every member below is a column of the row the delivered list read answers, because the connection
 * narrows the rows the service returned: a member the read does not select would be a filter that
 * silently selects nothing. `startDateTime` and `endDateTime` are the pair a calendar is read by, and
 * `employeeId` is the narrowing that turns the tenant's whole calendar into one employee's.
 *
 * `tenantId` is deliberately absent: the tenant a read runs under comes from the credential and never
 * from a filter. The four bookkeeping members — `isActive`, `isArchived`, `archivedAt` and `deletedAt`
 * — are absent too, and for one reason between them: the delivered read already answers live rows
 * through the soft-delete column, so a filter on one of the markers would be a second, weaker way to
 * ask the question the read has answered.
 */
const EMPLOYEE_APPOINTMENT_FILTERABLE = {
	id: 'ID',
	employeeId: 'ID',
	organizationId: 'ID',
	agenda: 'STRING',
	description: 'STRING',
	location: 'STRING',
	emails: 'STRING',
	status: 'STRING',
	startDateTime: 'DATE',
	endDateTime: 'DATE',
	breakStartTime: 'DATE',
	bufferTimeStart: 'BOOLEAN',
	bufferTimeEnd: 'BOOLEAN',
	bufferTimeInMins: 'NUMBER',
	breakTimeInMins: 'NUMBER',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const EMPLOYEE_APPOINTMENT_SORTABLE = [
	'createdAt',
	'updatedAt',
	'startDateTime',
	'endDateTime',
	'status',
	'agenda'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered reads state no order of their own — the list method hands the store a criterion and
 * takes the rows as they come back, and the node read answers one row — so this is a decision the
 * connection has to make rather than one it reproduces: newest first, with the identifier as the last
 * key so that two appointments filed in the same millisecond still have one order between them, which
 * is what makes a cursor walk over them stable.
 */
const EMPLOYEE_APPOINTMENT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The appointment over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `EmployeeAppointmentService` method the
 * `/api/employee-appointment` routes reach, or dispatches the same command they dispatch.
 *
 * **The guard chain is the controller's, and no permission is stated anywhere.** The delivered
 * controller carries `TenantPermissionGuard` on the class and states no `@Permissions` — not on its own
 * routes and not on any of the routes it inherits from the CRUD base — so every one of its routes is
 * tenant-guarded and otherwise unpermissioned. The class below states the same guard, and every field
 * states no permission at all, because there is none to mirror: a resolver that demanded one would
 * refuse a caller the REST route serves, which is exactly the asymmetry the two-protocol rule forbids.
 * Tightening the resource is a change to make in both places at once, and it is not this delivery's to
 * make.
 *
 * **Two of the fields below are not resources, and they are root fields anyway.** `GET /sign/:id` and
 * `GET /decode/:token` answer a signed token and the identifier that token carries: neither is a row of
 * any table, so neither can hang off the appointment type as a member, and a capability the delivered
 * routes serve is not one this surface may drop. They are root reads of their own, stated as such.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('EmployeeAppointment')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class EmployeeAppointmentResolver {
	constructor(
		private readonly employeeAppointmentService: EmployeeAppointmentService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The appointments of the caller's tenant, newest first.
	 *
	 * The delivered list route hands the service the `where` and the `relations` its `data` query
	 * parameter carries. This surface has no query string to bind: the connection protocol states the
	 * same narrowing in `filter`, which is applied to the rows the service returns, so the read runs
	 * with the route's own defaults — no `where` and no `relations`. The tenant is applied to the
	 * criterion by the service, from the credential rather than from the caller.
	 */
	@Query('employeeAppointments')
	async employeeAppointments(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<EmployeeAppointment>> {
		const { items }: IPagination<EmployeeAppointment> = await this.employeeAppointmentService.findAll({});

		return buildConnection<EmployeeAppointment>({
			rows: items ?? [],
			filterable: EMPLOYEE_APPOINTMENT_FILTERABLE,
			sortable: EMPLOYEE_APPOINTMENT_SORTABLE,
			defaultSort: EMPLOYEE_APPOINTMENT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One appointment of the caller's tenant.
	 *
	 * An appointment that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact stated
	 * in the other protocol's vocabulary.
	 *
	 * The delivered route reads the relations its `relations` query parameter names and reads none
	 * otherwise, so the read runs with the service's own default: a caller that names none is what this
	 * field mirrors — and the members the type does not carry would not be readable here even if a
	 * relation were joined.
	 */
	@Query('employeeAppointment')
	async employeeAppointment(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeAppointment | null> {
		try {
			return await this.employeeAppointmentService.findById(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many appointments the caller's tenant has.
	 *
	 * The same call the count route makes, with the same absence of narrowing. That route binds its
	 * query string to the store's own `where` and hands it to `countBy`; the connection protocol has no
	 * argument of that shape, so the field passes none and counts the caller's own rows — the tenant is
	 * applied to the criterion by the service, from the credential rather than from the caller, which is
	 * what the route's bare call counts too.
	 */
	@Query('employeeAppointmentCount')
	async employeeAppointmentCount(): Promise<number> {
		return await this.employeeAppointmentService.countBy();
	}

	/**
	 * Signs an appointment's identifier, which is what makes an invitation answerable without a
	 * credential.
	 *
	 * The answer is not a row and not a relation of one: it is the token the delivered `GET /sign/:id`
	 * route answers, produced by the same service method that route calls, so a token obtained here is
	 * the one the route would have produced for the same appointment — the service signs the identifier
	 * with the installation's own secret and nothing else, so there is no state for the two surfaces to
	 * disagree about.
	 */
	@Query('signEmployeeAppointment')
	async signEmployeeAppointment(@Args('id', { type: () => ID }) id: Id): Promise<string> {
		return this.employeeAppointmentService.signAppointmentId(id);
	}

	/**
	 * The appointment an invitation token names.
	 *
	 * The route reads the member off whatever the decoder answered; here a token that carries no
	 * appointment identifier — one that does not decode at all, or one whose payload is not an object —
	 * answers `null` rather than failing the request, because "this token names no appointment" is a
	 * fact about the token and not a malformed question. The decoder is the same one the route calls, so
	 * a token that names an appointment names the same one on either surface.
	 */
	@Query('decodeEmployeeAppointment')
	async decodeEmployeeAppointment(@Args('token', { type: () => String }) token: string): Promise<Id | null> {
		const decoded: unknown = this.employeeAppointmentService.decodeSignToken(token);
		const appointmentId = (decoded as { appointmentId?: Id } | null)?.appointmentId;

		return appointmentId ?? null;
	}

	/**
	 * Files an appointment.
	 *
	 * The write is dispatched as the same command the REST route dispatches, and it carries the same
	 * language: the handler renders the invitation mail in it when the body names recipients, so the two
	 * surfaces send the same text for the same caller.
	 *
	 * The organization is stated by the caller because the handler resolves it by identifier before the
	 * write; the tenant is never a member, because the handler stamps it from the credential — and the
	 * invitation rows are not a member either, because the handler never reads them: an invitee is filed
	 * through that resource's own write, and an appointment's invitees are read back as the rows that
	 * name its identifier.
	 */
	@Mutation('createEmployeeAppointment')
	async createEmployeeAppointment(
		@Args('input') input: ICreateEmployeeAppointmentInput
	): Promise<EmployeeAppointment> {
		return await this.commandBus.execute(
			new EmployeeAppointmentCreateCommand(
				input as unknown as IEmployeeAppointmentCreateInput,
				this.languageOfTheCaller()
			)
		);
	}

	/**
	 * Changes the facts of an appointment.
	 *
	 * The identifier is the criterion and is not repeated in the payload, which is the shape the route
	 * itself has: `:id` names the row and the body carries only what changes. The write is dispatched as
	 * the same command the route dispatches, and the handler leaves a member the caller omitted as it
	 * is rather than writing a default — which is why the input's members are every one of them
	 * optional.
	 *
	 * The command's own answer is the store's update result — a statement about the write, `{ affected }`
	 * — which is not a row and not what a field named `updateEmployeeAppointment` may return, so the row
	 * the write produced is read back through the same service read the node field uses.
	 */
	@Mutation('updateEmployeeAppointment')
	async updateEmployeeAppointment(
		@Args('input') input: IUpdateEmployeeAppointmentInput
	): Promise<EmployeeAppointment> {
		const { id, ...values } = input;

		await this.commandBus.execute(
			new EmployeeAppointmentUpdateCommand(id, values as unknown as IEmployeeAppointmentUpdateInput)
		);

		return await this.employeeAppointmentService.findById(id);
	}

	/**
	 * Removes an appointment outright.
	 *
	 * The same service the inherited `DELETE /:id` route calls, so the two surfaces remove the same row
	 * and refuse the same miss: the service raises the miss as the `404` the route answers with. The
	 * delivered route answers the store's delete result, which is not a row, so the field answers
	 * whether the removal was performed — the fact a client branches on.
	 */
	@Mutation('deleteEmployeeAppointment')
	async deleteEmployeeAppointment(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.employeeAppointmentService.delete(id);

		return true;
	}

	/**
	 * Withdraws an appointment without removing it: the row keeps its identifier, and the delivered list
	 * stops answering it.
	 *
	 * The delivered route declares no query parameter of its own and hands the service the empty option
	 * list its variadic parameter carries, so the field states no options either.
	 */
	@Mutation('softDeleteEmployeeAppointment')
	async softDeleteEmployeeAppointment(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeAppointment> {
		return await this.employeeAppointmentService.softRemove(id);
	}

	/**
	 * Puts a withdrawn appointment back. Unoptioned for the same reason the withdrawal above is: the
	 * delivered route binds no query parameter of its own.
	 */
	@Mutation('recoverEmployeeAppointment')
	async recoverEmployeeAppointment(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeAppointment> {
		return await this.employeeAppointmentService.softRecover(id);
	}

	/**
	 * The language the delivered handler renders an invitation in.
	 *
	 * The controller reads the `language` request header (its `I18nLang` decorator, which defaults to
	 * English) and passes it to the command; `RequestContext.getLanguageCode()` reads the same header
	 * off the same request — the bootstrap mounts the request context on the GraphQL endpoint as well
	 * as on the prefixed routes — so a caller asking the same question over either protocol is answered
	 * in the same language. Without a request it answers English, which is the decorator's own default.
	 */
	private languageOfTheCaller(): LanguagesEnum {
		return RequestContext.getLanguageCode();
	}
}
