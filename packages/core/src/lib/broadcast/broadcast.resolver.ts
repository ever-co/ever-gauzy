import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	IBroadcastCreateInput,
	IBroadcastUpdateInput,
	ID as Id,
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
import { BaseQueryDTO } from '../core/crud';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Broadcast } from './broadcast.entity';
import { BroadcastService } from './broadcast.service';
import { BroadcastCreateCommand, BroadcastUpdateCommand } from './commands';

/** The members `CreateBroadcastInput` declares in the schema. */
export interface ICreateBroadcastInput {
	title: string;
	content: JsonData;
	category: string;
	visibilityMode: string;
	audienceRules?: JsonData;
	publishedAt?: Date;
	entity: string;
	entityId: Id;
	organizationId?: Id;
}

/**
 * The members `UpdateBroadcastInput` declares in the schema.
 *
 * The polymorphic pair is deliberately not among them, which is what the delivered edit body does:
 * `UpdateBroadcastDTO` omits `entity` and `entityId` from the create DTO, so a message cannot be
 * re-pointed at another record by a later edit.
 */
export interface IUpdateBroadcastInput {
	id: Id;
	title?: string;
	content?: JsonData;
	category?: string;
	visibilityMode?: string;
	audienceRules?: JsonData;
	publishedAt?: Date;
	organizationId?: Id;
}

/**
 * The fields a broadcast list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `BroadcastFilter` and `BroadcastSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the row the delivered read answers, and the read has already applied its
 * own visibility rule by the time the connection sees a row — so each condition narrows the rows the
 * caller may see. Three absences are deliberate and each is a fact about the read rather than an
 * omission: `audienceRules` is a document column on one dialect and plain text on another, so a condition
 * over it would answer differently on two installations; `isArchived` and `isActive` are applied by the
 * read itself, so a condition on either could only restate what it already did; and the organization is
 * taken from the credential, so a member for it would suggest a scope decision the caller does not have.
 * `deletedAt` is absent because the read answers live rows only.
 */
const BROADCAST_FILTERABLE = {
	id: 'ID',
	title: 'STRING',
	category: 'STRING',
	visibilityMode: 'STRING',
	entity: 'STRING',
	entityId: 'ID',
	employeeId: 'ID',
	publishedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const BROADCAST_SORTABLE = [
	'createdAt',
	'updatedAt',
	'publishedAt',
	'title',
	'category',
	'visibilityMode'
] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list read states an order of its own — the publication instant, descending — and this is
 * that order rather than a second one, extended so that it is total: the creation instant and then the
 * identifier follow, because a feed has messages that share a publication instant and the last key is
 * what makes the order total and a cursor walk over it stable. `publishedAt` is nullable and the
 * connection's own rule places an absent value first under a descending walk, so a row published without
 * an instant stands at the head of the feed rather than silently inside it — which is where a moderation
 * queue wants exactly the rows whose dates are missing.
 */
const BROADCAST_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'publishedAt', direction: 'DESC' },
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The messages an organization publishes, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every read below calls the same `BroadcastService` method the `/api/broadcasts` route behind it
 * calls, and both writes dispatch the same command. The writes are commands rather than service calls for
 * the reason the routes are: publishing stamps the caller's own employee and tenant onto the row, defaults
 * the publication instant, records the activity entry and notifies the audience the visibility rule
 * selects, and the edit refuses a caller who is neither the publisher nor a holder of the change-employee
 * permission.
 *
 * **The guard chain and the permission are the controller's, field by field.** The class carries what the
 * controller class carries — both guards — and every field then states the permission its own route runs
 * under, so a field is never narrower or wider than the route it mirrors. Three readings are worth
 * spelling out:
 *
 * - the node read states the read permission, not the create or the edit one, because reading a message
 *   and publishing one are different grants and only the first is what its route asks for;
 * - the create, the edit and the removal each state the one permission their own route states — the
 *   create permission is not the edit permission, and the removal's is a third;
 * - the count and the two lifecycle moves state **no permission at all**, because the routes they mirror
 *   state none: they are inherited from the CRUD base, and the controller declares nothing on its class,
 *   so the whole of their scope is the guard chain. An empty `@Permissions()` would have been a second
 *   statement of the same absence.
 *
 * **The gate is the catalogue's, and it is declared once for every field.** `FeatureFlagGuard` is
 * appended to the chain above — after the controller's two, so a caller with no credential is refused as
 * a credential problem before a tenant's switches are consulted — and the code it reads is
 * `FEATURE_GRAPHQL`, the commerce catalogue's own entry for "the GraphQL endpoint and its resolvers,
 * under the same guards and permissions as REST". The code is imported rather than restated here because
 * the value has to agree with the catalogue's `code` and nothing checks one string against another: a
 * literal that drifted names a code no catalogue row carries, which the guard resolves as disabled, so
 * every field below would answer `Cannot query field <name>` for every caller with nothing red anywhere.
 * One statement on the class is what puts every field behind it — the guard reads the metadata with
 * `getAllAndOverride` over the handler and then the class — and its effect is the REST one in this
 * protocol's vocabulary: a tenant that switched the capability off is answered `Cannot query field
 * <name>`, the same refusal a disabled capability's routes answer with a 404.
 *
 * **The visibility rule is the reader's, and it is not restated here.** Both reads answer only the rows
 * the caller may see, which is why the connection's `totalCount` is the size of that set and why the node
 * field's `null` covers both a row that is not there and one that is not the caller's to read. Stating
 * the rule a second time in this file would be a second implementation of it, and the two would diverge
 * the first time it changed.
 *
 * This resolver is declared by `BroadcastModule`, beside the service and the handlers it calls, so the
 * GraphQL host can scan that module for it — a resolver injects services, and a module is what reaches
 * them.
 */
@Resolver('Broadcast')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class BroadcastResolver {
	constructor(
		private readonly broadcastService: BroadcastService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The messages the caller may read, newest publication first.
	 *
	 * The reader takes the query DTO the list route binds its query string to. This surface has no query
	 * string to bind: the connection protocol states the same narrowing in `filter`, which is applied to
	 * the rows the service returns, so the read runs with the route's own defaults — no criterion, no
	 * relations and no page. The read's own visibility rule has already decided which rows those are.
	 */
	@Query('broadcasts')
	@Permissions(PermissionsEnum.BROADCAST_READ)
	async broadcasts(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Broadcast>> {
		const { items }: IPagination<Broadcast> = await this.broadcastService.findAll(
			{} as BaseQueryDTO<Broadcast>
		);

		return buildConnection<Broadcast>({
			rows: items ?? [],
			filterable: BROADCAST_FILTERABLE,
			sortable: BROADCAST_SORTABLE,
			defaultSort: BROADCAST_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One message the caller may read.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the other
	 * protocol's vocabulary. The delivered reader raises that same miss for a row the caller may not read,
	 * so a message that exists and is somebody else's is answered here exactly as a message that does not
	 * exist — which is the delivered behaviour rather than a choice this surface makes.
	 *
	 * The route's own query DTO can name the organization to scope by and the relations to load; this
	 * surface has no query string to bind, so the read states the route's own default and the credential's
	 * organization, which is what the object type's own members are the columns of.
	 */
	@Query('broadcast')
	@Permissions(PermissionsEnum.BROADCAST_READ)
	async broadcast(@Args('id', { type: () => ID }) id: Id): Promise<Broadcast | null> {
		try {
			return await this.broadcastService.findOneById(id, {} as BaseQueryDTO<Broadcast>);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many messages the caller's tenant holds.
	 *
	 * The same call the count route makes when it is given no options: that route binds its query string
	 * to the store's own `where` and hands it to `countBy`, and the connection protocol has no argument of
	 * that shape, so the field states no narrowing of its own. The tenant is applied to the criterion by
	 * the service, from the credential rather than from the caller.
	 *
	 * The count is the store's own, and it is deliberately not the connection's `totalCount`: the
	 * delivered count route does not apply the visibility rule the list read applies, and presenting one
	 * number as the other would claim a rule the count never ran.
	 */
	@Query('broadcastCount')
	async broadcastCount(): Promise<number> {
		return await this.broadcastService.countBy();
	}

	/**
	 * Publishes a message.
	 *
	 * The write is dispatched as the same command the REST route dispatches, with the same payload. The
	 * handler is where the publication is assembled — the caller's own employee and tenant, the
	 * publication instant defaulted to now, the activity entry and the audience notification — so the
	 * command is not an indirection around the service but the write the route actually performs, and a
	 * message published over this protocol is one the audience hears about.
	 */
	@Mutation('createBroadcast')
	@Permissions(PermissionsEnum.BROADCAST_CREATE)
	async createBroadcast(@Args('input') input: ICreateBroadcastInput): Promise<Broadcast> {
		return await this.commandBus.execute(
			new BroadcastCreateCommand(input as unknown as IBroadcastCreateInput)
		);
	}

	/**
	 * Changes a message that exists.
	 *
	 * The same command the REST route dispatches, carrying the identifier the route reads from its path
	 * and the body beside it. The handler reads the row before it writes, refuses a caller who is neither
	 * the message's publisher nor a holder of the change-employee permission, and merges the stated members
	 * onto the row — so a member the caller leaves out is left as it is.
	 *
	 * The delivered handler wraps its own failures into a bad request. That wrapper is the handler's
	 * translation of the failure and not part of the write, so it is not restated here: what reaches the
	 * caller is the failure the handler raised, rendered by the platform's error contract with the code and
	 * the status the condition actually has.
	 */
	@Mutation('updateBroadcast')
	@Permissions(PermissionsEnum.BROADCAST_UPDATE)
	async updateBroadcast(@Args('input') input: IUpdateBroadcastInput): Promise<Broadcast> {
		const { id, ...values } = input;

		return await this.commandBus.execute(
			new BroadcastUpdateCommand(id, values as unknown as IBroadcastUpdateInput)
		);
	}

	/**
	 * Removes a message outright.
	 *
	 * The same service method the REST removal route calls. The delivered store answers its own delete
	 * result — a statement about the write, `{ affected }` — which is not a row and not what a field named
	 * `deleteBroadcast` may return; the field answers the one fact the removal establishes, that it ran.
	 */
	@Mutation('deleteBroadcast')
	@Permissions(PermissionsEnum.BROADCAST_DELETE)
	async deleteBroadcast(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.broadcastService.delete(id);

		return true;
	}

	/**
	 * Withdraws a message without removing the row.
	 *
	 * No permission is stated on the field beyond what the controller's class carries, because the
	 * delivered route states none of its own: the withdrawal is inherited from the CRUD base, where the
	 * controller's class-level declaration — none — is the whole of its scope.
	 */
	@Mutation('softDeleteBroadcast')
	async softDeleteBroadcast(@Args('id', { type: () => ID }) id: Id): Promise<Broadcast> {
		return await this.broadcastService.softRemove(id);
	}

	/**
	 * Puts a withdrawn message back. Its permission is the withdrawal's, for the same reason: the
	 * delivered route carries none of its own to mirror.
	 */
	@Mutation('recoverBroadcast')
	async recoverBroadcast(@Args('id', { type: () => ID }) id: Id): Promise<Broadcast> {
		return await this.broadcastService.softRecover(id);
	}
}
