import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ID as Id,
	IEmployeeNotificationCreateInput,
	IEmployeeNotificationUpdateInput,
	IMarkAllAsReadResponse,
	IPagination
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { BaseQueryDTO } from '../core/crud';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { EmployeeNotification } from './employee-notification.entity';
import { EmployeeNotificationService } from './employee-notification.service';

/**
 * The members `UpdateEmployeeNotificationInput` declares in the schema: the delivered edit input, plus
 * the identifier the write is made under.
 *
 * That identifier is stated here because the delivered input type cannot carry it: every input derived
 * through the platform's `OmitFields` drops `id`, `createdAt` and `updatedAt` by construction, while the
 * delivered route carries the identifier in its path and the service reads it from there. The schema
 * declares `id: ID!` for the same reason, so the field's type and the SDL state the same members.
 */
export interface IUpdateEmployeeNotificationInput extends IEmployeeNotificationUpdateInput {
	id: Id;
}

/**
 * The fields a notification list may be filtered and sorted by, and the order it is returned in when
 * the caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EmployeeNotificationFilter` and
 * `EmployeeNotificationSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * `type` is declared as text rather than as an enum, and that is the column's own shape: the store
 * keeps the vocabulary's value through its transformer, so a filter compares against the value the
 * row actually carries rather than against an ordinal. `readAt` and `onHoldUntil` are here because an
 * inbox is read by when a notification was read and by when it comes off hold — both are columns of
 * this row and both are what the delivered read answers.
 */
const EMPLOYEE_NOTIFICATION_FILTERABLE = {
	id: 'ID',
	title: 'STRING',
	message: 'STRING',
	type: 'STRING',
	isRead: 'BOOLEAN',
	readAt: 'DATE',
	onHoldUntil: 'DATE',
	sentByEmployeeId: 'ID',
	receiverEmployeeId: 'ID',
	entity: 'STRING',
	entityId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const EMPLOYEE_NOTIFICATION_SORTABLE = [
	'createdAt',
	'updatedAt',
	'readAt',
	'onHoldUntil',
	'isRead',
	'title',
	'type'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list read states no order of its own — it hands the store a filter and takes the rows
 * as they come back — so the connection applies the platform's own: newest first, with the identifier
 * as the last key, which is the key that makes the order total and a cursor walk over it stable. An
 * inbox's own reading order is this one, and the delivered read does not contradict it.
 */
const EMPLOYEE_NOTIFICATION_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The notification inbox over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `EmployeeNotificationService` method the
 * `/api/employee-notification` routes reach, under the same guard chain and with the same permission.
 *
 * **The guard chain and the permission are the controller's.** The delivered controller states
 * `TenantPermissionGuard` and `PermissionGuard` on the class, and beside them an empty `@Permissions()`
 * — which is a statement rather than an omission: both guards read an empty list as "no permission
 * required", so every route of this resource asks for a credential and a tenant and for no particular
 * grant, and no handler states a permission or a guard of its own. The class here therefore states the
 * same two guards plus the gate, and the same empty permission, and states nothing per field: a field
 * that demanded a permission its route does not would make GraphQL the narrower door, which is the
 * failure this delivery exists to prevent.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 *
 * **Two routes are easy to mistake for one.** `PUT /mark-all-read` is declared by this resource's own
 * controller and `PUT /:id` is inherited from the CRUD base: the declared one wins for that literal
 * path and the inherited one still serves every other identifier, so the two are two capabilities and
 * both are mirrored below.
 */
@Resolver('EmployeeNotification')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions()
export class EmployeeNotificationResolver {
	constructor(private readonly employeeNotificationService: EmployeeNotificationService) {}

	/**
	 * The notifications of the caller's tenant, newest first.
	 */
	@Query('employeeNotifications')
	async employeeNotifications(
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
	): Promise<GraphqlConnection<EmployeeNotification>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults — no
		// `where` and no `relations`, so the two employee relations are not joined.
		const options = { ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<EmployeeNotification>;
		const { items }: IPagination<EmployeeNotification> =
			await this.employeeNotificationService.findAll(options);

		return buildConnection<EmployeeNotification>({
			rows: items ?? [],
			filterable: EMPLOYEE_NOTIFICATION_FILTERABLE,
			sortable: EMPLOYEE_NOTIFICATION_SORTABLE,
			defaultSort: EMPLOYEE_NOTIFICATION_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One notification of the caller's tenant.
	 *
	 * A notification that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact stated
	 * in the other protocol's vocabulary.
	 */
	@Query('employeeNotification')
	async employeeNotification(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeNotification | null> {
		try {
			return await this.employeeNotificationService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many notifications the caller's tenant has.
	 *
	 * The same call the count route makes, with the route's own absence of narrowing: that route binds
	 * its query string to the store's own `where` and hands it to `countBy`, and the connection protocol
	 * has no argument of that shape, so the field passes none and counts the caller's own rows — the
	 * tenant is applied to the criterion by the service, from the credential. The field is nullable
	 * because an aggregate the resource has no answer for must not be answered as a zero.
	 */
	@Query('employeeNotificationCount')
	async employeeNotificationCount(): Promise<number> {
		return await this.employeeNotificationService.countBy();
	}

	/**
	 * Marks every unread notification of the caller's own employee record as read, and reports what the
	 * write did.
	 *
	 * The answer is the delivered service's own, and it is not a row: the write reports how many
	 * notifications it changed and whether it succeeded, so this is a computed answer of its own rather
	 * than a projection of the resource — and because it is a write it sits under `Mutation` rather
	 * than beside the reads. The receiver is never an argument: the service reads the caller's own
	 * employee record from the credential, so a caller can only mark its own notifications read, and a
	 * caller with no employee record and no tenant is answered a successful no-op rather than an
	 * unscoped update.
	 */
	@Mutation('markAllEmployeeNotificationsAsRead')
	async markAllEmployeeNotificationsAsRead(): Promise<IMarkAllAsReadResponse> {
		return await this.employeeNotificationService.markAllAsRead();
	}

	/**
	 * Files a notification for a receiver.
	 *
	 * The service is the one the REST route calls, and it is the only writer: it stamps the tenant from
	 * the credential, consults the receiver's notification settings, and answers the created row.
	 *
	 * **A receiver who has switched this kind of notification off is a write the delivered service
	 * declines to perform**: the settings lookup decides that the kind is not wanted, and the service
	 * then answers nothing at all instead of a row. That is the delivered behaviour of the route as
	 * well, and it is stated here rather than carried: the refusal is the receiver's own setting, so no
	 * payload type is invented to hold it.
	 */
	@Mutation('createEmployeeNotification')
	async createEmployeeNotification(
		@Args('input') input: IEmployeeNotificationCreateInput
	): Promise<EmployeeNotification> {
		return await this.employeeNotificationService.create(input);
	}

	/**
	 * Edits a notification that exists.
	 *
	 * The service is the one the REST route calls, and it reads the row before it writes: a caller
	 * naming a notification of another tenant, or one that is not there, is answered with the miss
	 * rather than with a write under an identifier it does not own. That write is a partial column
	 * update and answers the store's own update result — a statement about the write rather than a row
	 * — so the field answers the row the write left behind, read back through the same read the node
	 * field uses.
	 *
	 * The field takes the members `UpdateEmployeeNotificationInput` declares — the delivered edit input,
	 * plus the identifier the delivered route carries in its path — and the delivered type omits the two
	 * employee relations because a notification's sender and receiver are fixed when it is filed. See
	 * the input's own declaration in the schema for the statement and for the columns it does carry.
	 */
	@Mutation('updateEmployeeNotification')
	async updateEmployeeNotification(
		@Args('input') input: IUpdateEmployeeNotificationInput
	): Promise<EmployeeNotification> {
		await this.employeeNotificationService.update(input.id, input as unknown as EmployeeNotification);

		return await this.employeeNotificationService.findOneByIdString(input.id);
	}

	/**
	 * Removes a notification outright.
	 */
	@Mutation('deleteEmployeeNotification')
	async deleteEmployeeNotification(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.employeeNotificationService.delete(id);

		return true;
	}

	/**
	 * Withdraws a notification without removing it.
	 */
	@Mutation('softDeleteEmployeeNotification')
	async softDeleteEmployeeNotification(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeNotification> {
		return await this.employeeNotificationService.softRemove(id);
	}

	/**
	 * Puts a withdrawn notification back.
	 */
	@Mutation('recoverEmployeeNotification')
	async recoverEmployeeNotification(@Args('id', { type: () => ID }) id: Id): Promise<EmployeeNotification> {
		return await this.employeeNotificationService.softRecover(id);
	}
}
