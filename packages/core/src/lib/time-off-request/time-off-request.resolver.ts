import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ID as Id,
	IPagination,
	ITimeOff as ITimeOffRequest,
	ITimeOffCreateInput,
	PermissionsEnum,
	RolesEnum,
	StatusTypesEnum
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { Permissions, Roles } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, RoleGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { TimeOffRequest } from './time-off-request.entity';
import { TimeOffRequestService } from './time-off-request.service';
import { TimeOffStatusCommand } from './commands';

/** The members `CreateTimeOffRequestInput` declares in the schema. */
export interface ICreateTimeOffRequestInput {
	organizationId: Id;
	start: Date;
	end: Date;
	requestDate: Date;
	employeeIds?: Id[];
	description?: string;
	policyId?: Id;
	status?: string;
	isHoliday?: boolean;
	documentUrl?: string;
}

/** The members `UpdateTimeOffRequestInput` declares in the schema. */
export interface IUpdateTimeOffRequestInput {
	id: Id;
	status?: string;
}

/**
 * The fields a request list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `TimeOffRequestFilter` and
 * `TimeOffRequestSortField` are its two renderings, and keeping the three in one file is what makes a
 * field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible to
 * introduce quietly.
 *
 * Every member is a column of the row. Neither relation is here: the delivered read fills the policy
 * and the employees beside each row, and the connection protocol narrows by comparing a value, so
 * `policyId` is how a caller asks for one policy's requests and the employee is narrowed by the field's
 * own argument — the row carries the employees as a collection, not as an identifier.
 *
 * The employee narrowing is genuinely an argument rather than a filter for a second reason: the
 * delivered read applies it to the store through an inner join, so it decides **which** rows are read
 * and not merely which of them are answered.
 */
const TIME_OFF_REQUEST_FILTERABLE = {
	id: 'ID',
	documentUrl: 'STRING',
	description: 'STRING',
	start: 'DATE',
	end: 'DATE',
	requestDate: 'DATE',
	status: 'STRING',
	isHoliday: 'BOOLEAN',
	policyId: 'ID',
	documentId: 'ID',
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
 * The two ends of the leave and the day it was asked for are the keys this list is read in an order
 * for — a calendar reads `start`, an approvals queue reads `requestDate` — and the filing stamp and the
 * lifecycle flags are the administrative ones.
 */
const TIME_OFF_REQUEST_SORTABLE = [
	'createdAt',
	'updatedAt',
	'start',
	'end',
	'requestDate',
	'status',
	'isHoliday'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list read states no order of its own — it hands the store a criterion and a range and
 * takes the rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: newest filed first, with the identifier as the last key so that two requests filed in the
 * same millisecond still have one order between them, which is what makes a cursor walk over them
 * stable.
 */
const TIME_OFF_REQUEST_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * Time off requests over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below reaches the same `TimeOffRequestService` method, or dispatches the same
 * command, that the `/api/time-off-request` routes reach.
 *
 * **The guard chain and the class permission are the controller's.** The class carries
 * `TenantPermissionGuard` and `PermissionGuard` with the class-level edit permission, which is what the
 * controller class carries, and every field then states the permission its own route runs under.
 *
 * **The two review routes carry a guard of their own, and the fields carry it too.** `PUT /approval/:id`
 * and `PUT /denied/:id` each add `@UseGuards(RoleGuard)` and state `@Roles(SUPER_ADMIN, ADMIN)` over the
 * controller's chain, so the two fields state the same guard and the same roles: `RoleGuard` reads them
 * from `ROLES_METADATA` with `getAllAndOverride` over the handler and then the class, which is the same
 * reading Nest applies to a controller handler and to a resolver field alike. A field that omitted
 * either would let a caller approve leave here whom the route refuses — and approving leave is the one
 * capability on this resource where the difference between "may edit" and "may decide" is the whole
 * point. The create route restates `PermissionGuard` over the class that already carries it, and its
 * field restates it beside the others for the same reason: the two chains are written in the same
 * places.
 *
 * **`PUT /:id` runs under the delete permission, and the field states that rather than what it looks
 * like.** The delivered update handler declares `ALL_ORG_EDIT` with `TIME_OFF_DELETE`, which is the
 * route's own grant and not a mistake this surface may quietly correct: an administrator who may edit
 * leave is not necessarily one who may rewrite a filed request. Mirroring it here is what keeps the two
 * surfaces one capability; changing it here would give GraphQL a scope REST does not have.
 *
 * **Five routes are inherited and state nothing of their own**, so they run under the class-level
 * permission: the count, the node read and the three lifecycle moves. The fields carry the controller's
 * class-level permission for that reason, rather than each inventing a narrower one.
 *
 * **One list, and the delivered list is served twice.** `GET /` answers the filtered set and
 * `GET /pagination` answers it sliced by a page; that is one capability, so it is one root field, and
 * the page is what the connection protocol already performs. The connection mirrors `GET /`, whose
 * `findInput` is an argument of the field because the delivered read reads it from its `data` query
 * parameter and cannot answer without it.
 *
 * **The lifecycle moves are three fields because they are three operations.** Removal, withdrawal and
 * recovery answer three different questions — a client that could not tell them apart could not tell
 * whether the approvals and the balances that point at a request survived — and the delivered controller
 * serves all three, so all three are here.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('TimeOffRequest')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
export class TimeOffRequestResolver {
	constructor(
		private readonly timeOffRequestService: TimeOffRequestService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The requests filed in one organization over a range, newest filed first.
	 *
	 * The read is the delivered `GET /` route's own — `getAllTimeOffRequests` — and the two arguments
	 * are the ones that route takes: the `relations` its `data` parameter carries and the `findInput` it
	 * builds from the same parameter. This surface states no `relations`, and there is nothing for it to
	 * state: the delivered read decides what it joins — its TypeORM branch left-joins the policy, the
	 * employees and each employee's account whatever it is handed, and its other branch populates the
	 * same three — so a list of relation names here would be an argument whose value changes nothing.
	 *
	 * The organization and the two ends of the range are required because the delivered read cannot
	 * answer without them: it scopes its own criterion by the organization, and it bounds the rows by
	 * the two instants, defaulting each to *now* when it is given neither — which is a range no caller
	 * could have meant, so this surface asks for the range the read actually needs rather than
	 * reproducing that default. The employee is optional and narrows the read through an inner join,
	 * which is why it is an argument of the field and not a member of the connection's filter: the rows
	 * carry the employees as a collection, so the connection could not narrow by one.
	 */
	@Query('timeOffRequests')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_OFF_VIEW)
	async timeOffRequests(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('startDate', { type: () => Date }) startDate: Date,
		@Args('endDate', { type: () => Date }) endDate: Date,
		@Args('employeeId', { type: () => ID, nullable: true }) employeeId?: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<TimeOffRequest>> {
		const { items }: IPagination<ITimeOffRequest> = await this.timeOffRequestService.getAllTimeOffRequests(
			undefined,
			{ organizationId, employeeId, startDate, endDate }
		);

		return buildConnection<TimeOffRequest>({
			rows: (items ?? []) as TimeOffRequest[],
			filterable: TIME_OFF_REQUEST_FILTERABLE,
			sortable: TIME_OFF_REQUEST_SORTABLE,
			defaultSort: TIME_OFF_REQUEST_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One request of the caller's tenant.
	 *
	 * The same service method the inherited `GET /:id` route calls. That route states no permission of
	 * its own, which is why this field runs under the controller's class-level edit permission rather
	 * than the view permission its read sibling carries: reading one request and listing them really do
	 * require different grants on this resource, and widening that here — on one surface only — is
	 * exactly what the two-protocol rule forbids.
	 *
	 * A request that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('timeOffRequest')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
	async timeOffRequest(@Args('id', { type: () => ID }) id: Id): Promise<TimeOffRequest | null> {
		try {
			return await this.timeOffRequestService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many requests the caller's tenant holds.
	 *
	 * The same call the inherited count route makes, with the same absence of narrowing: that route
	 * binds its query string to the store's own `where` and hands it to `countBy`, and the connection
	 * protocol has no argument of that shape, so the field passes none and counts the caller's own rows
	 * — the tenant is applied to the criterion by the service, from the credential. The field is
	 * nullable in the schema because a count is an aggregate a resource may legitimately have no answer
	 * for, and a non-null field would turn "not answered" into a fabricated zero.
	 */
	@Query('timeOffRequestCount')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
	async timeOffRequestCount(): Promise<number | null> {
		return await this.timeOffRequestService.countBy();
	}

	/**
	 * Files a request.
	 *
	 * The same service method the `POST /` route calls, with the payload that route passes through from
	 * its body. The delivered write stores the row and then files the approval record that carries it
	 * forward, in that order and in one call, so a request never exists without the record that says who
	 * has to decide it.
	 */
	@Mutation('createTimeOffRequest')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_ADD)
	async createTimeOffRequest(@Args('input') input: ICreateTimeOffRequestInput): Promise<TimeOffRequest> {
		return await this.timeOffRequestService.create(this.createBody(input));
	}

	/**
	 * Edits a filed request.
	 *
	 * The same service method the `PUT /:id` route calls — `updateTimeOffByAdmin`, with the identifier
	 * the route takes from its path and the body it takes from the request — and the permission is the
	 * route's own, which is the delete grant rather than the edit one. The delivered write verifies the
	 * row against the caller's own tenant before it writes and makes the verified identifier the one it
	 * saves, so a body naming somebody else's request cannot re-point the write.
	 */
	@Mutation('updateTimeOffRequest')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_DELETE)
	async updateTimeOffRequest(@Args('input') input: IUpdateTimeOffRequestInput): Promise<TimeOffRequest> {
		return await this.timeOffRequestService.updateTimeOffByAdmin(input.id, { status: input.status });
	}

	/**
	 * Removes a request outright.
	 *
	 * The delivered route answers the store's own delete result rather than a row, so this field answers
	 * whether the removal ran — the one fact that call establishes.
	 */
	@Mutation('deleteTimeOffRequest')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
	async deleteTimeOffRequest(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.timeOffRequestService.delete(id);

		return true;
	}

	/**
	 * Withdraws a request without removing it.
	 *
	 * The same service method the inherited `DELETE /:id/soft` route calls, and the answer is the row.
	 */
	@Mutation('softDeleteTimeOffRequest')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
	async softDeleteTimeOffRequest(@Args('id', { type: () => ID }) id: Id): Promise<TimeOffRequest> {
		return await this.timeOffRequestService.softRemove(id);
	}

	/**
	 * Puts a withdrawn request back.
	 *
	 * The same service method the inherited `PUT /:id/recover` route calls. Recovery is the third of the
	 * three lifecycle operations and not a second spelling of either: the identifier the row kept while
	 * it was withdrawn is the one this call names, which is what lets the approval record that points at
	 * it still point at it.
	 */
	@Mutation('recoverTimeOffRequest')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
	async recoverTimeOffRequest(@Args('id', { type: () => ID }) id: Id): Promise<TimeOffRequest> {
		return await this.timeOffRequestService.softRecover(id);
	}

	/**
	 * Approves a filed request.
	 *
	 * The same command the `PUT /approval/:id` route dispatches, with the same identifier and the same
	 * status, so the two surfaces reach one handler and one transition rather than two implementations
	 * of the same decision. The guard and the roles are the route's own and are stated on the field
	 * above; the delivered handler refuses a request that is not awaiting a decision, and that refusal
	 * is not restated here.
	 */
	@Mutation('approveTimeOffRequest')
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
	async approveTimeOffRequest(@Args('id', { type: () => ID }) id: Id): Promise<TimeOffRequest> {
		return await this.commandBus.execute(new TimeOffStatusCommand(id, StatusTypesEnum.APPROVED));
	}

	/**
	 * Denies a filed request.
	 *
	 * The same command the `PUT /denied/:id` route dispatches, with the status that route states, and
	 * the same guard, roles and permission as the approval above — which is the controller's own
	 * symmetry: the two routes differ in the status they dispatch and in nothing else.
	 */
	@Mutation('denyTimeOffRequest')
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_EDIT)
	async denyTimeOffRequest(@Args('id', { type: () => ID }) id: Id): Promise<TimeOffRequest> {
		return await this.commandBus.execute(new TimeOffStatusCommand(id, StatusTypesEnum.DENIED));
	}

	/**
	 * The payload the create route builds from its body.
	 *
	 * The two relations are stated as the identifiers the delivered write is written from — the policy
	 * as `{ id }`, the employees as a list of `{ id }` — because that is the shape the delivered write
	 * persists a relation in, and a caller stating an identifier here is stating the same thing the REST
	 * body states with a row. The delivered write assigns the body onto a new row and stores it, so a
	 * member it does not name is simply not written.
	 */
	private createBody(input: ICreateTimeOffRequestInput): ITimeOffCreateInput {
		const { employeeIds, policyId, ...members } = input;

		return {
			...members,
			policy: policyId ? { id: policyId } : undefined,
			employees: employeeIds ? employeeIds.map((id) => ({ id })) : undefined
		} as unknown as ITimeOffCreateInput;
	}
}
