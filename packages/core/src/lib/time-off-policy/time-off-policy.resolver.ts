import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ID as Id,
	IPagination,
	ITimeOffPolicy,
	ITimeOffPolicyCreateInput,
	PermissionsEnum
} from '@gauzy/contracts';
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
import { TimeOffPolicy } from './time-off-policy.entity';
import { TimeOffPolicyService } from './time-off-policy.service';

/** The members `CreateTimeOffPolicyInput` declares in the schema. */
export interface ICreateTimeOffPolicyInput {
	organizationId: Id;
	name: string;
	requiresApproval: boolean;
	paid: boolean;
	employeeIds?: Id[];
	leaveType?: string;
	maxDaysPerYear?: number;
	allowCarryForward?: boolean;
	maxCarryForwardDays?: number;
	accrualRate?: number;
	accrualFrequency?: string;
	isDefault?: boolean;
}

/** The members `UpdateTimeOffPolicyInput` declares in the schema. */
export interface IUpdateTimeOffPolicyInput extends ICreateTimeOffPolicyInput {
	id: Id;
}

/**
 * The fields a policy list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `TimeOffPolicyFilter` and
 * `TimeOffPolicySortField` are its two renderings, and keeping the three in one file is what makes a
 * field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible to
 * introduce quietly.
 *
 * Every member is a column of the row, which is what the delivered list read returns: it hands the
 * store the `findInput` its `data` parameter carries and loads whatever `relations` that parameter
 * names, and this surface names none, so neither of the two relations the entity declares is part of
 * what a row here carries.
 *
 * The entitlement figures compare as exact decimals because that is what their columns are; the two
 * vocabularies — the leave category and the accrual frequency — compare as text, because the row
 * carries the value the delivered vocabulary states.
 */
const TIME_OFF_POLICY_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	requiresApproval: 'BOOLEAN',
	paid: 'BOOLEAN',
	leaveType: 'STRING',
	maxDaysPerYear: 'DECIMAL',
	allowCarryForward: 'BOOLEAN',
	maxCarryForwardDays: 'DECIMAL',
	accrualRate: 'DECIMAL',
	accrualFrequency: 'STRING',
	isDefault: 'BOOLEAN',
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
 * The two flags that decide how a policy behaves are sortable beside the name, because an
 * administrator reads this list to answer "which of these needs approval" and "which of these is the
 * default" as often as to read it alphabetically.
 */
const TIME_OFF_POLICY_SORTABLE = [
	'createdAt',
	'updatedAt',
	'name',
	'leaveType',
	'maxDaysPerYear',
	'allowCarryForward',
	'isDefault',
	'requiresApproval',
	'paid'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list read states no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: newest first, with the identifier as the last key so that two policies filed in the same
 * millisecond still have one order between them, which is what makes a cursor walk over them stable.
 */
const TIME_OFF_POLICY_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * Time off policies over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `TimeOffPolicyService` method the `/api/time-off-policy`
 * routes reach, with the same arguments those routes bind.
 *
 * **The guard chain and the class permission are the controller's.** The class carries
 * `TenantPermissionGuard` and `PermissionGuard` with the class-level edit permission, which is what the
 * controller class carries, and every field then states the permission its own route runs under.
 *
 * **Four routes restate a guard the class already carries, and the fields restate it beside them.** The
 * delivered `pagination`, `findAll`, `create` and `update` handlers each add
 * `@UseGuards(PermissionGuard)` over a class that already carries it — a restatement rather than a
 * widening, since the guard context creator unions the two lists — so the same four fields restate it
 * too, and a reader comparing the two surfaces finds the same chain written in the same places.
 *
 * **Five routes are inherited and state nothing of their own**, so they run under the class-level
 * permission: the count, the node read and the three lifecycle moves. The fields mirror that by
 * carrying the controller's own class-level permission rather than each inventing a narrower one — the
 * node read of this resource really is an edit-permission read, and that asymmetry is the controller's
 * to resolve in both places at once or in neither.
 *
 * **The list is a connection and the delivered list is served twice.** `GET /` answers the filtered set
 * and `GET pagination` answers it sliced by a page; that is one capability, so it is one root field,
 * and the page is what the connection protocol already performs. The connection therefore mirrors
 * `GET /`, the route that reads the whole filtered set the protocol is applied to.
 *
 * **The lifecycle moves are three fields because they are three operations.** Removal, withdrawal and
 * recovery answer three different questions — a client that could not tell them apart could not tell
 * whether the identifiers other rows point at survived — and the delivered controller serves all three,
 * so all three are here.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('TimeOffPolicy')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_EDIT)
export class TimeOffPolicyResolver {
	constructor(private readonly timeOffPolicyService: TimeOffPolicyService) {}

	/**
	 * The policies of the caller's tenant, newest first.
	 *
	 * The read is the delivered `GET /` route's own — `findAll`, and the object is the one that route
	 * builds out of the `data` query parameter it parses. This surface has no query string to bind, so
	 * both of that object's members carry the value the parameter leaves them at: the connection
	 * protocol states the same narrowing in `filter`, which is applied to the rows the service returns,
	 * and it names no `relations` because this surface's type carries no relation of this resource to
	 * fill — the policy's employees and its requests are not loaded by the read this field mirrors.
	 */
	@Query('timeOffPolicies')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.TIME_OFF_POLICY_VIEW)
	async timeOffPolicies(
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
	): Promise<GraphqlConnection<TimeOffPolicy>> {
		const { items }: IPagination<ITimeOffPolicy> = await this.timeOffPolicyService.findAll({
			...(withDeleted ? { withDeleted: true } : {}),
			where: undefined,
			relations: undefined
		});

		return buildConnection<TimeOffPolicy>({
			rows: (items ?? []) as TimeOffPolicy[],
			filterable: TIME_OFF_POLICY_FILTERABLE,
			sortable: TIME_OFF_POLICY_SORTABLE,
			defaultSort: TIME_OFF_POLICY_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One policy of the caller's tenant.
	 *
	 * The same service method the inherited `GET /:id` route calls. That route states no permission of
	 * its own, which is why this field runs under the controller's class-level edit permission rather
	 * than the view permission its read sibling carries: reading one policy and listing them really do
	 * require different grants on this resource, and widening that here — on one surface only — is
	 * exactly what the two-protocol rule forbids.
	 *
	 * A policy that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('timeOffPolicy')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_EDIT)
	async timeOffPolicy(@Args('id', { type: () => ID }) id: Id): Promise<TimeOffPolicy | null> {
		try {
			return await this.timeOffPolicyService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many policies the caller's tenant holds.
	 *
	 * The same call the inherited count route makes, with the same absence of narrowing: that route
	 * binds its query string to the store's own `where` and hands it to `countBy`, and the connection
	 * protocol has no argument of that shape, so the field passes none and counts the caller's own rows
	 * — the tenant is applied to the criterion by the service, from the credential. The field is
	 * nullable in the schema because a count is an aggregate a resource may legitimately have no answer
	 * for, and a non-null field would turn "not answered" into a fabricated zero.
	 */
	@Query('timeOffPolicyCount')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_EDIT)
	async timeOffPolicyCount(): Promise<number | null> {
		return await this.timeOffPolicyService.countBy();
	}

	/**
	 * Files a policy.
	 *
	 * The same service method the `POST /` route calls, with the payload that route passes through from
	 * its body. The delivered write builds the row member by member and resolves the employees the body
	 * names against the caller's own organization, so the membership is written from identifiers here
	 * exactly as it is written from rows there.
	 */
	@Mutation('createTimeOffPolicy')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_ADD)
	async createTimeOffPolicy(@Args('input') input: ICreateTimeOffPolicyInput): Promise<TimeOffPolicy> {
		return await this.timeOffPolicyService.create(this.bodyOf(input));
	}

	/**
	 * Edits a policy that exists.
	 *
	 * The same service method the `PUT /:id` route calls, with the identifier the route takes from its
	 * path and the body it takes from the request. The delivered write verifies the row against the
	 * caller's own tenant and organization before it writes and edits that row rather than replacing it,
	 * so a policy other rows point at keeps its identifier; a body without an organization is refused by
	 * the write itself, which is why the input requires one.
	 */
	@Mutation('updateTimeOffPolicy')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_EDIT)
	async updateTimeOffPolicy(@Args('input') input: IUpdateTimeOffPolicyInput): Promise<TimeOffPolicy> {
		return await this.timeOffPolicyService.update(input.id, this.bodyOf(input));
	}

	/**
	 * Removes a policy outright.
	 *
	 * The delivered route answers the store's own delete result — a statement about the write,
	 * `{ affected }` — which is not a row, so the field answers the one fact that call establishes, that
	 * the removal ran. It is a different operation from the withdrawal below and is stated separately
	 * for that reason: what a removal takes with it is the row the identifier names.
	 */
	@Mutation('deleteTimeOffPolicy')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_EDIT)
	async deleteTimeOffPolicy(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.timeOffPolicyService.delete(id);

		return true;
	}

	/**
	 * Withdraws a policy without removing it.
	 *
	 * The same service method the inherited `DELETE /:id/soft` route calls, and the answer is the row:
	 * the delivered method reads it, stamps its withdrawal and returns it, so a caller can tell a live
	 * policy from a withdrawn one off the answer to the write that withdrew it.
	 */
	@Mutation('softDeleteTimeOffPolicy')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_EDIT)
	async softDeleteTimeOffPolicy(@Args('id', { type: () => ID }) id: Id): Promise<TimeOffPolicy> {
		return await this.timeOffPolicyService.softRemove(id);
	}

	/**
	 * Puts a withdrawn policy back.
	 *
	 * The same service method the inherited `PUT /:id/recover` route calls. Recovery is the third of the
	 * three lifecycle operations and not a second spelling of either: the identifier the row kept while
	 * it was withdrawn is the one this call names, which is what lets the rows that point at it still
	 * point at it.
	 */
	@Mutation('recoverTimeOffPolicy')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.TIME_OFF_POLICY_EDIT)
	async recoverTimeOffPolicy(@Args('id', { type: () => ID }) id: Id): Promise<TimeOffPolicy> {
		return await this.timeOffPolicyService.softRecover(id);
	}

	/**
	 * The payload the two write routes build from their bodies.
	 *
	 * The employees are stated as the identifiers the delivered write is written from — it resolves them
	 * against the caller's own organization and replaces the policy's membership with the result — so a
	 * caller stating an identifier is stating the same thing the REST body states with a row. One builder
	 * serves both writes because both reach the same service shape; the identifier an edit carries beside
	 * its members is read by that write from its own argument, and the body member is ignored there.
	 */
	private bodyOf(input: ICreateTimeOffPolicyInput | IUpdateTimeOffPolicyInput): ITimeOffPolicyCreateInput {
		const { employeeIds, ...members } = input;

		return {
			...members,
			employees: employeeIds ? employeeIds.map((id) => ({ id })) : undefined
		} as unknown as ITimeOffPolicyCreateInput;
	}
}
