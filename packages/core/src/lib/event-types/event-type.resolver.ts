import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { DecimalString, ID as Id, IEventTypeCreateInput, IPagination } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { EventType } from './event-type.entity';
import { EventTypeService } from './event-type.service';
import { EventTypeCreateCommand } from './commands';

/** The members `CreateEventTypeInput` declares in the schema. */
export interface ICreateEventTypeInput {
	title: string;
	description?: string;
	duration: DecimalString;
	durationUnit: string;
	isActive: boolean;
	employeeId?: Id;
	organizationId: Id;
	tagIds?: Id[];
}

/**
 * The members `UpdateEventTypeInput` declares in the schema.
 *
 * Declared in its own right rather than by extending the create input, because the delivered edit body is
 * the entity with every member relaxed and runs no validation pipe: a write that states no title leaves
 * the row's title as it is, so every member is optional here and four of them are required there.
 */
export interface IUpdateEventTypeInput {
	id: Id;
	title?: string;
	description?: string;
	duration?: DecimalString;
	durationUnit?: string;
	isActive?: boolean;
	employeeId?: Id;
	organizationId?: Id;
	tagIds?: Id[];
}

/**
 * The fields an event-type list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `EventTypeFilter` and `EventTypeSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the schema
 * but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the row, which is why the set is what it is: the connection narrows the rows
 * the delivered read returned. `duration` is `DECIMAL` rather than `NUMBER` because the column is
 * `numeric`: a length compared as a whole number is a length that selects the wrong rows, and the
 * vocabulary's own half-hour lengths are exactly the values a whole-number comparison would miss. The
 * facets are in neither list — the delivered list read loads no relations, so a condition on that
 * collection could only ever match the empty set. `deletedAt` is absent because the delivered list read
 * answers live rows only, and the tenant is absent because the read applies it from the credential rather
 * than from the caller.
 */
const EVENT_TYPE_FILTERABLE = {
	id: 'ID',
	title: 'STRING',
	description: 'STRING',
	duration: 'DECIMAL',
	durationUnit: 'STRING',
	employeeId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const EVENT_TYPE_SORTABLE = ['createdAt', 'updatedAt', 'title', 'duration', 'durationUnit'] as const;

/**
 * The order the connection means when the caller states none.
 *
 * The delivered list read applies no order of its own — it hands the store the criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces. The title is what a vocabulary of meetings is scanned by, so the rows stand in it; the
 * creation instant and then the identifier follow, because a vocabulary may hold two lengths a tenant
 * named alike and the last key is what makes the order total and a cursor walk over it stable. The title
 * column is nullable and the connection's own rule places an absent value last under an ascending walk,
 * so a row filed without a name stands after the named ones rather than among them.
 */
const EVENT_TYPE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'title', direction: 'ASC' },
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The organization's vocabulary of meeting lengths, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `EventTypeService` method the `/api/event-type` route behind it
 * calls, with the same payload. The create is the one write that goes through the command bus, and it is
 * the command rather than the service for a reason the route itself has: the handler resolves the
 * organization and the employee the body names and builds the row from them, so reaching the service
 * directly would write a row the REST route would never write.
 *
 * **The guard chain and the permission are the controller's.** The controller guards its class with
 * `TenantPermissionGuard` alone and states no permission on the class or on any handler, so this resolver
 * carries that one guard and no field states a permission. That is not an omission: a field that stated a
 * grant the route does not ask for would narrow REST below GraphQL, and an empty `@Permissions()` would
 * restate the same absence as though it were a decision this surface had made. The node read is the
 * controller's own override rather than the CRUD base's, and it too declares no permission — so the field
 * mirrors it exactly as it mirrors the inherited ones.
 *
 * **The gate is the catalogue's, and it is declared once for every field.** `FeatureFlagGuard` is appended
 * to the chain above — after the controller's own, so a caller with no credential is refused as a
 * credential problem before a tenant's switches are consulted — and the code it reads is
 * `FEATURE_GRAPHQL`, the commerce catalogue's own entry for "the GraphQL endpoint and its resolvers, under
 * the same guards and permissions as REST". The code is imported rather than restated here because the
 * value has to agree with the catalogue's `code` and nothing checks one string against another: a literal
 * that drifted names a code no catalogue row carries, which the guard resolves as disabled, so every field
 * below would answer `Cannot query field <name>` for every caller with nothing red anywhere. One statement
 * on the class is what puts every field behind it — the guard reads the metadata with `getAllAndOverride`
 * over the handler and then the class — and its effect is the REST one in this protocol's vocabulary: a
 * tenant that switched the capability off is answered `Cannot query field <name>`, the same refusal a
 * disabled capability's routes answer with a 404.
 *
 * **The duration is the row's own.** Nothing here rescales or reformats it: the column is read through the
 * platform's numeric transformer and the value travels as it was read, and a length is written as the
 * exact decimal the schema states it as, so a vocabulary filed over this protocol holds the digits it was
 * given rather than a binary fraction that approximates them.
 *
 * This resolver is declared by `EventTypeModule`, beside the service and the handler it calls, so the
 * GraphQL host can scan that module for it — a resolver injects services, and a module is what reaches
 * them.
 */
@Resolver('EventType')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class EventTypeResolver {
	constructor(
		private readonly eventTypeService: EventTypeService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The meeting lengths of the caller's tenant, in title order.
	 *
	 * The controller serves its list twice — `GET /` and `GET /pagination` — and the two answer one
	 * question, so the surface states it once: a second root field for the paginated spelling would be a
	 * second surface that could disagree with this one. The paginated spelling's two narrowings are
	 * partial matches on `title` and `description`, and both survive the fold as `ilike` on the same
	 * members of `filter`.
	 */
	@Query('eventTypes')
	async eventTypes(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<EventType>> {
		// The reader takes the query DTO the list route binds its `data` query parameter to. This surface
		// has no query string to bind: the connection protocol states the same narrowing in `filter`, which
		// is applied to the rows the service returns, so the read runs with the route's own defaults — no
		// criterion and no relations.
		const { items }: IPagination<EventType> = await this.eventTypeService.findAll(
			{} as BaseQueryDTO<EventType>
		);

		return buildConnection<EventType>({
			rows: items ?? [],
			filterable: EVENT_TYPE_FILTERABLE,
			sortable: EVENT_TYPE_SORTABLE,
			defaultSort: EVENT_TYPE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One meeting length of the caller's tenant.
	 *
	 * A row that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the other
	 * protocol's vocabulary. The route's own `data` query string can name relations to load; this surface
	 * has no query string to bind, so the read states none and runs with the route's own default — which is
	 * what the object type's own members are the columns of.
	 */
	@Query('eventType')
	async eventType(@Args('id', { type: () => ID }) id: Id): Promise<EventType | null> {
		try {
			return await this.eventTypeService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many meeting lengths the caller's tenant offers.
	 *
	 * The same call the count route makes when it is given no options: that route binds its query string to
	 * the store's own `where` and hands it to `countBy`, and the connection protocol has no argument of
	 * that shape, so the field states no narrowing of its own. The tenant is applied to the criterion by
	 * the service, from the credential rather than from the caller.
	 */
	@Query('eventTypeCount')
	async eventTypeCount(): Promise<number> {
		return await this.eventTypeService.countBy();
	}

	/**
	 * Files a meeting length.
	 *
	 * The write is dispatched as the same command the REST route dispatches, with the same payload. The
	 * handler resolves the organization the body names and, when the body names an employee, that employee
	 * too, then builds the row from them and stamps the caller's tenant from the credential — so the
	 * command is not an indirection around the service but the write the route actually performs.
	 */
	@Mutation('createEventType')
	async createEventType(@Args('input') input: ICreateEventTypeInput): Promise<EventType> {
		return await this.commandBus.execute(
			new EventTypeCreateCommand(this.writePayload(input) as unknown as IEventTypeCreateInput)
		);
	}

	/**
	 * Changes a meeting length that exists.
	 *
	 * The delivered edit reaches the service rather than the command above, which is what its route does:
	 * `PUT /:id` spreads the body beside the identifier and calls the same write the create route calls, so
	 * no handler resolves anything and the stated members are merged onto the row the store holds. A member
	 * the caller omits is therefore left as it is, and the field reproduces that rather than routing the
	 * edit through the create command, which would resolve the organization and the employee a second time
	 * and write a row the REST route would not.
	 */
	@Mutation('updateEventType')
	async updateEventType(@Args('input') input: IUpdateEventTypeInput): Promise<EventType> {
		const { id, ...values } = input;

		return await this.eventTypeService.create({
			...this.writePayload(values),
			id
		} as unknown as EventType);
	}

	/**
	 * Removes a meeting length outright.
	 *
	 * The same service method the inherited removal route calls. The delivered store answers its own delete
	 * result — a statement about the write, `{ affected }` — which is not a row and not what a field named
	 * `deleteEventType` may return; the field answers the one fact the removal establishes, that it ran.
	 */
	@Mutation('deleteEventType')
	async deleteEventType(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.eventTypeService.delete(id);

		return true;
	}

	/**
	 * Withdraws a meeting length without removing the row.
	 *
	 * No permission is stated on the field beyond what the controller's class carries, because the
	 * delivered route states none of its own: the withdrawal is inherited from the CRUD base, where the
	 * controller's class-level declaration — none — is the whole of its scope. The delivered route passes
	 * the service the empty option list that leaves, so the field states none either.
	 */
	@Mutation('softDeleteEventType')
	async softDeleteEventType(@Args('id', { type: () => ID }) id: Id): Promise<EventType> {
		return await this.eventTypeService.softRemove(id);
	}

	/**
	 * Puts a withdrawn meeting length back. Its permission is the withdrawal's, for the same reason: the
	 * delivered route carries none of its own to mirror.
	 */
	@Mutation('recoverEventType')
	async recoverEventType(@Args('id', { type: () => ID }) id: Id): Promise<EventType> {
		return await this.eventTypeService.softRecover(id);
	}

	/**
	 * The payload the delivered write stores.
	 *
	 * The facets are handed over as the identifiers the pivot row is written from, never as tag rows: the
	 * delivered handler hands the tag list it is given straight to the service, and what the write persists
	 * is the membership, which is the pair of identifiers. The tenant is deliberately not among the members
	 * the caller states, because the handler and the service stamp the caller's own tenant onto the row. No
	 * length is touched here: the exact decimal the caller stated is the value the write receives.
	 *
	 * Both writes reach this one mapper, and the parameter is the create input with every member relaxed —
	 * which is what the delivered edit body is: the same members, none of them required.
	 */
	private writePayload(input: Partial<Omit<ICreateEventTypeInput, 'id'>>): Record<string, unknown> {
		const { tagIds, ...values } = input;

		return {
			...values,
			...(tagIds ? { tags: tagIds.map((id) => ({ id })) } : {})
		};
	}
}
