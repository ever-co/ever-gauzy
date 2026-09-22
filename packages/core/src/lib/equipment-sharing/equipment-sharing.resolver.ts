import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	ID as Id,
	IEquipmentSharing,
	IEquipmentSharingCreateInput,
	IEquipmentSharingUpdateInput,
	IPagination,
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
import { BaseQueryDTO } from '../core/crud';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingService } from './equipment-sharing.service';
import {
	EquipmentSharingCreateCommand,
	EquipmentSharingStatusCommand,
	EquipmentSharingUpdateCommand
} from './commands';

/** The members `CreateEquipmentSharingInput` declares in the schema. */
export interface ICreateEquipmentSharingInput {
	name?: string;
	shareRequestDay?: Date;
	shareStartDay?: Date;
	shareEndDay?: Date;
	status: number;
	equipmentId?: Id;
	equipmentSharingPolicyId?: Id;
	employeeIds?: Id[];
	teamIds?: Id[];
}

/** The members `UpdateEquipmentSharingInput` declares in the schema. */
export interface IUpdateEquipmentSharingInput extends ICreateEquipmentSharingInput {
	id: Id;
}

/**
 * The fields a sharing list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EquipmentSharingFilter` and
 * `EquipmentSharingSortField` are its two renderings, and keeping the three in one file is what makes
 * a field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible
 * to introduce quietly.
 *
 * Every member is a column of the row, which is why the set is what it is: the connection narrows the
 * rows the delivered read returned, and `status` is a `NUMBER` because the column is an integer the
 * contracts' own request-approval vocabulary is written as. The three interval members are `DATE`,
 * which is what makes the period questions stateable — a period in force now is the pair
 * `shareStartDay: { lte: now }` and `shareEndDay: { gte: now }`. The two memberships are in neither
 * list: the controller's list read is handed no `relations` by this surface, so a condition on
 * `employees` or `teams` could only ever match the empty set. They are answered by narrowing
 * `equipmentSharingsByOrganization` or `equipmentSharingsByEmployee` instead, whose reads join them.
 * `deletedAt` is absent because the delivered list read answers live rows only, and the tenant is
 * absent because the read applies it from the credential rather than from the caller.
 */
const EQUIPMENT_SHARING_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	shareRequestDay: 'DATE',
	shareStartDay: 'DATE',
	shareEndDay: 'DATE',
	status: 'NUMBER',
	equipmentId: 'ID',
	equipmentSharingPolicyId: 'ID',
	createdByUserId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const EQUIPMENT_SHARING_SORTABLE = [
	'createdAt',
	'updatedAt',
	'name',
	'shareRequestDay',
	'shareStartDay',
	'shareEndDay',
	'status'
] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list read applies no order of its own — it hands the store the criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces. It is the order a book of periods is read in: the window's opening instant, latest
 * first. `shareStartDay` is nullable and the connection's own rule places an absent value first under
 * a descending walk, so a period whose window was never recorded stands at the head of the list rather
 * than silently inside it — which is where a queue of filed requests wants exactly the rows whose
 * dates are missing. The creation instant and then the identifier follow, because a book has rows that
 * share a start and the last key is what makes the order total and a cursor walk over it stable.
 */
const EQUIPMENT_SHARING_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'shareStartDay', direction: 'DESC' },
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The periods an asset is handed out for, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every read below calls the same `EquipmentSharingService` method the `/api/equipment-sharing`
 * route behind it calls, and every write dispatches the same command its route dispatches. The writes
 * are commands rather than service calls for the reason the routes are commands: filing a period also
 * records the approval row that stands beside it, the edit re-checks the asset and the policy against
 * the row's own organization before it persists anything, and the two lifecycle moves write the sharing
 * row and its approval row together so the two cannot disagree.
 *
 * **The guard chain and the permission are the controller's, field by field.** The class carries what
 * the controller class carries — both guards — and every field then states the permission its own route
 * runs under, so a field is never narrower or wider than the route it mirrors. Three readings are worth
 * spelling out, because each is a case where the obvious answer is the wrong one:
 *
 * - the node read, the count and the three removals state **no permission at all**, because the routes
 *   they mirror state none: the node read, the count and the two lifecycle removals are inherited from
 *   the CRUD base, and the hard removal is declared on the controller without a permission. The
 *   controller declares none on its class either, so the whole of their scope is the guard chain. An
 *   empty `@Permissions()` would have been a second statement of the same absence.
 * - the list, the two by-pivot fields and the paginated spelling all state the view permission, which
 *   is what their own routes state — and the create states the maker pair, which is the one grant its
 *   route holds that the edit routes do not.
 * - the two lifecycle fields state the approver pair, which is what their routes state, and neither
 *   states the other's: approving and refusing are two delivered routes, and folding them into one
 *   field taking a status number would give a client that may do one a way to do the other.
 *
 * **Several handlers restate `PermissionGuard` beside the class that already carries it.** That is the
 * controller's own declaration and is not mirrored field by field here, because the guard is already in
 * the chain above: what parity requires is that the *set* a field runs under is the set its route runs
 * under, and it is — the class chain plus the gate. Restating a guard the class already carries would
 * run it twice for no scope change.
 *
 * **The gate is the catalogue's, and it is declared once for every field.** `FeatureFlagGuard` is
 * appended to the chain above — after the controller's two, so a caller with no credential is refused
 * as a credential problem before a tenant's switches are consulted — and the code it reads is
 * `FEATURE_GRAPHQL`, the commerce catalogue's own entry for "the GraphQL endpoint and its resolvers,
 * under the same guards and permissions as REST". The code is imported rather than restated here
 * because the value has to agree with the catalogue's `code` and nothing checks one string against
 * another: a literal that drifted names a code no catalogue row carries, which the guard resolves as
 * disabled, so every field below would answer `Cannot query field <name>` for every caller with nothing
 * red anywhere. One statement on the class is what puts every field behind it — the guard reads the
 * metadata with `getAllAndOverride` over the handler and then the class — and its effect is the REST one
 * in this protocol's vocabulary: a tenant that switched the capability off is answered
 * `Cannot query field <name>`, the same refusal a disabled capability's routes answer with a 404.
 *
 * **The status is the row's own value.** Nothing here translates it: the two lifecycle fields dispatch
 * the contracts' own numeric values, and the object type carries the column as it was read. The
 * vocabulary is shared with the approval row the delivered writes record beside the sharing, which is
 * why it is not declared as a schema enum here.
 *
 * This resolver is declared by `EquipmentSharingModule`, beside the service and the handlers it calls,
 * so the GraphQL host can scan that module for it — a resolver injects services, and a module is what
 * reaches them.
 */
@Resolver('EquipmentSharing')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class EquipmentSharingResolver {
	constructor(
		private readonly equipmentSharingService: EquipmentSharingService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The sharing periods of the caller's tenant.
	 *
	 * The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
	 * question, so the surface states it once: a second root field for the paginated spelling would be a
	 * second surface that could disagree with this one. The paginated spelling's own narrowing is an
	 * employee membership, and it is not offered here — the list read is handed no relations, so a
	 * condition on that collection could only ever match the empty set. The question it asks is answered
	 * by `equipmentSharingsByEmployee`, whose read joins the pivot.
	 */
	@Query('equipmentSharings')
	@Permissions(PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW)
	async equipmentSharings(
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
	): Promise<GraphqlConnection<EquipmentSharing>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults — no
		// criterion and no relations.
		//
		// `withDeleted` is the one member of that DTO the surface has to state itself, and it belongs in the
		// read rather than in the connection's request: the service hands these options to the base read,
		// which is what lifts the soft-delete filter, and the rows are read before the connection sees them.
		const { items }: IPagination<EquipmentSharing> = await this.equipmentSharingService.findAll({
			...(withDeleted ? { withDeleted: true } : {})
		} as BaseQueryDTO<EquipmentSharing>);

		return this.connection(items, {
			filter,
			sort,
			page,
			first,
			after,
			last,
			before,
			limit,
			offset
		});
	}

	/**
	 * One sharing period of the caller's tenant.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the
	 * other protocol's vocabulary.
	 */
	@Query('equipmentSharing')
	async equipmentSharing(@Args('id', { type: () => ID }) id: Id): Promise<EquipmentSharing | null> {
		try {
			return await this.equipmentSharingService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many sharing periods the caller's tenant holds.
	 *
	 * The same call the count route makes when it is given no options: that route binds its query string
	 * to the store's own `where` and hands it to `countBy`, and the connection protocol has no argument
	 * of that shape, so the field states no narrowing of its own. The tenant is applied to the criterion
	 * by the service, from the credential rather than from the caller.
	 */
	@Query('equipmentSharingCount')
	async equipmentSharingCount(): Promise<number> {
		return await this.equipmentSharingService.countBy();
	}

	/**
	 * The sharing periods of one organization, with the employees and the teams each one is handed to.
	 *
	 * **A root field of its own rather than a filter on `equipmentSharings`, and the reason is the read
	 * rather than a preference.** The delivered method joins the employee and team pivots and
	 * inner-joins the asset — none of which the list read joins — so its rows carry memberships the
	 * connection's rows cannot, and a filter over a membership a row does not carry selects nothing.
	 * Folding it in would answer the question without the memberships the route exists to answer.
	 *
	 * The organization is the path segment of the delivered route and is the whole of what the method
	 * is given, so nothing is restated as an argument here. The rows it returns are the whole filtered
	 * set — the method paginates nothing — which is exactly what the connection protocol is applied to.
	 */
	@Query('equipmentSharingsByOrganization')
	@Permissions(PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW)
	async equipmentSharingsByOrganization(
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
	): Promise<GraphqlConnection<EquipmentSharing>> {
		const { items }: IPagination<IEquipmentSharing> =
			await this.equipmentSharingService.findEquipmentSharingsByOrganizationId(organizationId);

		return this.connection(items as EquipmentSharing[], {
			filter,
			sort,
			page,
			first,
			after,
			last,
			before,
			limit,
			offset
		});
	}

	/**
	 * The sharing periods one employee filed, with the employees and the teams each one is handed to.
	 *
	 * **A root field of its own for the same reason, and one more.** The delivered method joins both
	 * pivots, and it narrows on `createdByUserId` — the user who filed the request — rather than on the
	 * employee the path segment is named for. That is a different question from any filter on the row's
	 * own employee pivot, and no member of `EquipmentSharingFilter` states it, so a filter on this
	 * connection would answer a different set of periods under a name that reads like this one.
	 *
	 * The delivered method wraps every failure of its own read into a bad request. That wrapper is the
	 * service's own translation of the failure and not part of the read, so it is not restated here:
	 * what reaches the caller is the failure the read raised, rendered by the platform's error contract
	 * with the status the condition actually has.
	 */
	@Query('equipmentSharingsByEmployee')
	@Permissions(PermissionsEnum.ORG_EQUIPMENT_SHARING_VIEW)
	async equipmentSharingsByEmployee(
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
	): Promise<GraphqlConnection<EquipmentSharing>> {
		const { items }: IPagination<IEquipmentSharing> =
			await this.equipmentSharingService.findEquipmentSharingsByEmployeeId(employeeId);

		return this.connection(items as EquipmentSharing[], {
			filter,
			sort,
			page,
			first,
			after,
			last,
			before,
			limit,
			offset
		});
	}

	/**
	 * Files a sharing period.
	 *
	 * The write is dispatched as the same command the REST route dispatches, with the same payload: the
	 * organization the route reads from its path segment, the members the caller states, the asset and
	 * the policy as the identifiers the foreign keys hold, and the two memberships as the identifiers
	 * the pivots are written from. The tenant is stamped by the handler from the credential and is never
	 * a member the caller can choose.
	 *
	 * The handler records the approval row that stands beside the sharing in the same call, which is the
	 * whole reason this is a command rather than a service call: a period filed over this protocol is
	 * one an approver can act on exactly as a REST caller's is.
	 */
	@Mutation('createEquipmentSharing')
	@Permissions(PermissionsEnum.EQUIPMENT_MAKE_REQUEST, PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT)
	async createEquipmentSharing(
		@Args('organizationId', { type: () => ID }) organizationId: Id,
		@Args('input') input: ICreateEquipmentSharingInput
	): Promise<EquipmentSharing> {
		return await this.commandBus.execute(
			new EquipmentSharingCreateCommand(organizationId, this.writePayload(input) as unknown as IEquipmentSharingCreateInput)
		);
	}

	/**
	 * Changes a period that exists.
	 *
	 * The same command the REST route dispatches, carrying the identifier the route reads from its path
	 * and the body beside it. The handler reads the row before it writes and refuses a row the caller
	 * does not own, and it re-checks the asset and the policy the body names against the row's own
	 * organization, so a body cannot re-attach a period to another organization's asset.
	 */
	@Mutation('updateEquipmentSharing')
	@Permissions(PermissionsEnum.EQUIPMENT_APPROVE_REQUEST, PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT)
	async updateEquipmentSharing(
		@Args('input') input: IUpdateEquipmentSharingInput
	): Promise<EquipmentSharing> {
		const { id, ...values } = input;

		return await this.commandBus.execute(
			new EquipmentSharingUpdateCommand(id, this.writePayload(values) as unknown as IEquipmentSharingUpdateInput)
		);
	}

	/**
	 * Approves a filed period.
	 *
	 * The same command the delivered route dispatches, with the approved value of the contracts' own
	 * vocabulary. The command moves the sharing row and its approval row together, so the two cannot
	 * disagree afterwards — which is why the status is not an argument the caller states here.
	 */
	@Mutation('approveEquipmentSharing')
	@Permissions(PermissionsEnum.EQUIPMENT_APPROVE_REQUEST, PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT)
	async approveEquipmentSharing(@Args('id', { type: () => ID }) id: Id): Promise<EquipmentSharing> {
		return await this.commandBus.execute(
			new EquipmentSharingStatusCommand(id, RequestApprovalStatusTypesEnum.APPROVED)
		);
	}

	/**
	 * Refuses a filed period.
	 *
	 * The same command as the approval above with the refused value: the two are one operation with two
	 * decisions, and the delivered routes are two for the same reason this surface is.
	 */
	@Mutation('refuseEquipmentSharing')
	@Permissions(PermissionsEnum.EQUIPMENT_APPROVE_REQUEST, PermissionsEnum.ORG_EQUIPMENT_SHARING_EDIT)
	async refuseEquipmentSharing(@Args('id', { type: () => ID }) id: Id): Promise<EquipmentSharing> {
		return await this.commandBus.execute(
			new EquipmentSharingStatusCommand(id, RequestApprovalStatusTypesEnum.REFUSED)
		);
	}

	/**
	 * Removes a period outright.
	 *
	 * The same service method the delivered route calls, and it is the service's own delete rather than
	 * the base one for that reason: it removes the approval row recorded beside the sharing in the same
	 * call, scoped to the caller's tenant and only once the sharing row was really the caller's. The
	 * delivered store answers its own delete result, which is not a row and not what a field named
	 * `deleteEquipmentSharing` may return; the field answers the one fact the removal establishes, that
	 * it ran.
	 */
	@Mutation('deleteEquipmentSharing')
	async deleteEquipmentSharing(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.equipmentSharingService.delete(id);

		return true;
	}

	/**
	 * Withdraws a period without removing the row.
	 *
	 * No permission is stated on the field beyond what the controller's class carries, because the
	 * delivered route states none of its own: the withdrawal is inherited from the CRUD base, where the
	 * controller's class-level declaration — none — is the whole of its scope.
	 */
	@Mutation('softDeleteEquipmentSharing')
	async softDeleteEquipmentSharing(@Args('id', { type: () => ID }) id: Id): Promise<EquipmentSharing> {
		return await this.equipmentSharingService.softRemove(id);
	}

	/**
	 * Puts a withdrawn period back. Its permission is the withdrawal's, for the same reason: the
	 * delivered route carries none of its own to mirror.
	 */
	@Mutation('recoverEquipmentSharing')
	async recoverEquipmentSharing(@Args('id', { type: () => ID }) id: Id): Promise<EquipmentSharing> {
		return await this.equipmentSharingService.softRecover(id);
	}

	/**
	 * The connection the three list fields answer with.
	 *
	 * One builder for the three, because they answer one row type under one protocol: what differs
	 * between them is the read that produced the rows, and the memberships those rows do or do not
	 * carry. Stating the filter, the sort and the page once is what keeps the three from drifting into
	 * three surfaces that accept different questions.
	 */
	private connection(
		rows: IEquipmentSharing[] | undefined,
		request?: {
			readonly filter?: ConnectionFilter;
			readonly sort?: ConnectionSortKey[];
			readonly page?: ConnectionPageRequest;
			readonly first?: number;
			readonly after?: string;
			readonly last?: number;
			readonly before?: string;
			readonly limit?: number;
			readonly offset?: number;
		}
	): GraphqlConnection<EquipmentSharing> {
		return buildConnection<EquipmentSharing>({
			rows: (rows ?? []) as EquipmentSharing[],
			filterable: EQUIPMENT_SHARING_FILTERABLE,
			sortable: EQUIPMENT_SHARING_SORTABLE,
			defaultSort: EQUIPMENT_SHARING_DEFAULT_SORT,
			request
		});
	}

	/**
	 * The payload the delivered write stores.
	 *
	 * The two memberships are handed over as the identifiers the pivot rows are written from, never as
	 * related rows: the delivered write stores the membership, which is the pair of identifiers. The
	 * tenant is deliberately not among the members the caller states, because the handler stamps the
	 * caller's own tenant onto the row. Nothing is normalised: the window the caller stated is the
	 * window the write receives, and the status is the value it stated.
	 */
	private writePayload(
		input: Omit<ICreateEquipmentSharingInput, 'id'> | IUpdateEquipmentSharingInput
	): Record<string, unknown> {
		const { employeeIds, teamIds, ...values } = input;

		return {
			...values,
			...(employeeIds ? { employees: employeeIds.map((id) => ({ id })) } : {}),
			...(teamIds ? { teams: teamIds.map((id) => ({ id })) } : {})
		};
	}
}
