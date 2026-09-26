import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FindManyOptions } from 'typeorm';
import { FeatureFlag } from '@gauzy/common';
import {
	DecimalString,
	ID as Id,
	IPagination,
	IRequestApprovalCreateInput,
	PermissionsEnum,
	RequestApprovalStatusTypesEnum
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
import { RequestApprovalStatusCommand } from './commands';
import { RequestApproval } from './request-approval.entity';
import { RequestApprovalService } from './request-approval.service';

/** The members `CreateRequestApprovalInput` declares in the schema. */
export interface ICreateRequestApprovalInput {
	name: string;
	approvalPolicyId?: Id;
	min_count?: number;
	requestId?: Id;
	requestType?: string;
	amount?: DecimalString;
	currency?: string;
	note?: string;
	employeeApprovals?: Id[];
	teams?: Id[];
	tags?: Id[];
	organizationId?: Id;
}

/** The members `UpdateRequestApprovalInput` declares in the schema. */
export interface IUpdateRequestApprovalInput extends ICreateRequestApprovalInput {
	id: Id;
}

/**
 * The fields a request list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `RequestApprovalFilter` and
 * `RequestApprovalSortField` are its two renderings, and keeping the three in one file is what makes a
 * field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible to
 * introduce quietly.
 *
 * Every member is a column of the request row, for the reason the object type states: the connection
 * narrows the rows the service returned, so a condition on a pivot the reader never loaded could only
 * ever match the empty set. `amount` is the one member whose kind is not the obvious one, and it is
 * stated as a decimal rather than a number: a money filter that compares floating-point values is a
 * filter that returns the wrong rows, which is why the kernel gives money a scalar of its own.
 */
const REQUEST_APPROVAL_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	status: 'NUMBER',
	min_count: 'NUMBER',
	requestId: 'ID',
	requestType: 'STRING',
	amount: 'DECIMAL',
	currency: 'STRING',
	note: 'STRING',
	approvalPolicyId: 'ID',
	organizationId: 'ID',
	tenantId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	deletedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const REQUEST_APPROVAL_SORTABLE = [
	'id',
	'name',
	'status',
	'min_count',
	'amount',
	'currency',
	'createdAt',
	'updatedAt',
	'deletedAt'
] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list method states no order of its own — it evaluates its scope in the store and takes
 * the rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: newest first, because a register of asks is read from the end that has just arrived and
 * an approver works it in that direction, then the identifier, which is the key that makes the order
 * total and a cursor walk over it stable.
 */
const REQUEST_APPROVAL_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The approval request over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `RequestApprovalService` method, or dispatches the same
 * command, that the `/api/request-approval` routes reach.
 *
 * **The guard chain is the controller's and the permissions are the routes'.** The delivered
 * controller states `TenantPermissionGuard` and `PermissionGuard` on its class and no `@Permissions`
 * anywhere, so the class here carries the same two guards — and no class-level permission, which would
 * narrow every field below it below the route each mirrors. Each field then states the permission its
 * own route runs under: the inherited `GET /:id`, `GET /count`, `DELETE /:id`, `DELETE /:id/soft` and
 * `PUT /:id/recover` declare none, so neither do the five fields that mirror them. The one route whose
 * permission is not the one a reader would guess is `GET /:id`, whose missing permission is the
 * controller's own asymmetry between reading one request and listing them; restating it differently
 * here is exactly what the two-protocol rule forbids.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it
 * is appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('RequestApproval')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class RequestApprovalResolver {
	constructor(
		private readonly requestApprovalService: RequestApprovalService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The approval requests of the caller's organization, newest first.
	 */
	@Query('requestApprovals')
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_VIEW)
	async requestApprovals(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<RequestApproval>> {
		// The delivered list route binds the `data` envelope out of its query string and hands the
		// service `{ relations, findInput }`, defaulting both when the envelope is absent — which it has
		// to, because a caller reading the register asks for the collection rather than for a query
		// document. This surface has no envelope to bind and names no relation, so the read runs with
		// the route's own defaults for an unstated request, and the connection protocol's `filter` is
		// applied to the rows the service returns. The tenant and the organization are applied to the
		// criterion by the service, from the credential rather than from the caller.
		const { items }: IPagination<RequestApproval> = await this.requestApprovalService.findAllRequestApprovals(
			{ relations: [] } as unknown as FindManyOptions<RequestApproval>,
			{}
		);

		return buildConnection<RequestApproval>({
			rows: items ?? [],
			filterable: REQUEST_APPROVAL_FILTERABLE,
			sortable: REQUEST_APPROVAL_SORTABLE,
			defaultSort: REQUEST_APPROVAL_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * The requests one employee has to answer, newest first.
	 *
	 * The read is the one the delivered route performs, with the route's own arguments: the employee,
	 * no joined collection and no criterion. It is a root field of its own rather than a filter on the
	 * register above, because it asks a different question — it resolves the employee, walks that
	 * employee's own approval collection through the pivot the list read does not join, and then loads
	 * each request it finds with the policy, the employee approvals, the team approvals and the tags,
	 * none of which the list read loads. See the SDL for the same statement in the other protocol's
	 * voice.
	 */
	@Query('requestApprovalsByEmployee')
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_VIEW)
	async requestApprovalsByEmployee(
		@Args('employeeId', { type: () => ID }) employeeId: Id,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<RequestApproval>> {
		// The same three arguments the delivered route passes, with the same defaults for the two it
		// reads out of the envelope: no joined collection and no criterion. The service narrows the
		// answer to the rows the caller raised in the organization they are acting in, so this is not a
		// way to read another employee's queue.
		const { items }: IPagination<RequestApproval> = await this.requestApprovalService.findRequestApprovalsByEmployeeId(
			employeeId,
			[],
			{}
		);

		return buildConnection<RequestApproval>({
			rows: items ?? [],
			filterable: REQUEST_APPROVAL_FILTERABLE,
			sortable: REQUEST_APPROVAL_SORTABLE,
			defaultSort: REQUEST_APPROVAL_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One request of the caller's organization.
	 *
	 * The same service method the delivered `GET /:id` calls, and no permission — the route is
	 * inherited from the CRUD base without one of its own, so it runs under the controller's class
	 * chain and no permission, and the field states the same nothing. See the SDL for the full
	 * statement of that parity.
	 *
	 * A request that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('requestApproval')
	async requestApproval(@Args('id', { type: () => ID }) id: Id): Promise<RequestApproval | null> {
		try {
			return await this.requestApprovalService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many requests the caller's organization records.
	 *
	 * The same call the count route makes when it is given no query string, and the same absence of
	 * narrowing: that route binds its query string to the store's own `where` and hands it to
	 * `countBy`, and the connection protocol has no argument of that shape, so the field passes none
	 * and counts the caller's own rows. No permission is stated, because the inherited route states
	 * none.
	 */
	@Query('requestApprovalCount')
	async requestApprovalCount(): Promise<number> {
		return await this.requestApprovalService.countBy();
	}

	/**
	 * Raises a request for approval.
	 *
	 * The same service method the delivered route calls, with the body as stated: the delivered create
	 * builds the row member by member, stamps the caller's tenant onto it, and resolves the employees
	 * and the teams the caller names into one pivot row each — which is why the two collections travel
	 * as identifiers rather than as rows. A member the body omits is left at the column's default,
	 * because the delivered write never assigns it.
	 */
	@Mutation('createRequestApproval')
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_EDIT)
	async createRequestApproval(@Args('input') input: ICreateRequestApprovalInput): Promise<RequestApproval> {
		return await this.requestApprovalService.createRequestApproval(input as unknown as IRequestApprovalCreateInput);
	}

	/**
	 * Changes a request that exists.
	 *
	 * The same service method the delivered route calls, with the same two arguments: the identifier
	 * travels inside the input because the REST route carries it in the path, so the resolver takes it
	 * back out rather than asking the caller to state the row twice. See the SDL and `ICreateRequestApprovalInput`
	 * for which members the delivered write acts on.
	 */
	@Mutation('updateRequestApproval')
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_EDIT)
	async updateRequestApproval(@Args('input') input: IUpdateRequestApprovalInput): Promise<RequestApproval> {
		return await this.requestApprovalService.updateRequestApproval(
			input.id,
			input as unknown as IRequestApprovalCreateInput
		);
	}

	/**
	 * Approves one request.
	 *
	 * The write is dispatched as the same command the REST route dispatches, carrying the same
	 * decision: the handler records the approval and then moves the document the request is about
	 * through that document's own status vocabulary, which is why the field answers the request row
	 * the handler answers rather than a statement about the write.
	 */
	@Mutation('approveRequestApproval')
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_EDIT)
	async approveRequestApproval(@Args('id', { type: () => ID }) id: Id): Promise<RequestApproval> {
		return await this.commandBus.execute(
			new RequestApprovalStatusCommand(id, RequestApprovalStatusTypesEnum.APPROVED)
		);
	}

	/**
	 * Refuses one request.
	 *
	 * The same command with the other decision. A refusal is one approver's answer rather than a
	 * threshold's, which is the delivered writer's rule and not this field's to restate.
	 */
	@Mutation('refuseRequestApproval')
	@Permissions(PermissionsEnum.REQUEST_APPROVAL_EDIT)
	async refuseRequestApproval(@Args('id', { type: () => ID }) id: Id): Promise<RequestApproval> {
		return await this.commandBus.execute(
			new RequestApprovalStatusCommand(id, RequestApprovalStatusTypesEnum.REFUSED)
		);
	}

	/**
	 * Removes a request outright.
	 *
	 * The service is the one the REST route calls, and the field answers whether the removal happened
	 * rather than the removed row, because the delivered route answers the store's delete result. No
	 * permission is stated: the inherited route states none.
	 */
	@Mutation('deleteRequestApproval')
	async deleteRequestApproval(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.requestApprovalService.delete(id);

		return true;
	}

	/**
	 * Withdraws a request without removing it.
	 *
	 * The answer is the withdrawn row, whose `deletedAt` is the whole of what the write set — without
	 * that member on the answer, a caller could not tell a live row from a withdrawn one on the answer
	 * to the write that withdrew it.
	 */
	@Mutation('softDeleteRequestApproval')
	async softDeleteRequestApproval(@Args('id', { type: () => ID }) id: Id): Promise<RequestApproval> {
		return await this.requestApprovalService.softRemove(id);
	}

	/**
	 * Puts a withdrawn request back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverRequestApproval')
	async recoverRequestApproval(@Args('id', { type: () => ID }) id: Id): Promise<RequestApproval> {
		return await this.requestApprovalService.softRecover(id);
	}
}
