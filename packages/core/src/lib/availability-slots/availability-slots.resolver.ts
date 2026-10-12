import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, IAvailabilitySlotsCreateInput, IPagination } from '@gauzy/contracts';
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
import { AvailabilitySlot } from './availability-slots.entity';
import { AvailabilitySlotsService } from './availability-slots.service';
import { AvailabilitySlotsBulkCreateCommand, AvailabilitySlotsCreateCommand } from './commands';

/** The members `CreateAvailabilitySlotInput` declares in the schema. */
export interface ICreateAvailabilitySlotInput {
	type: string;
	allDay: boolean;
	startTime: Date;
	endTime: Date;
	employeeId?: Id;
	organizationId?: Id;
}

/** The members `UpdateAvailabilitySlotInput` declares in the schema. */
export interface IUpdateAvailabilitySlotInput extends ICreateAvailabilitySlotInput {
	id: Id;
}

/**
 * The fields a slot list may be filtered and sorted by, and the order it is returned in when the caller
 * states none.
 *
 * This declaration is the resolver's half of the SDL: `AvailabilitySlotFilter` and
 * `AvailabilitySlotSortField` are its two renderings, and keeping the three in one file is what makes a
 * field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible to
 * introduce quietly.
 *
 * The two bounds of the window are instants, and they are the filters this resource exists to answer:
 * "which slots overlap this fortnight" is a range over them, which is a read the connection protocol
 * performs on the scale an instant has rather than on the scale its text would sort on.
 *
 * `type` is a text filter although the column holds a small closed vocabulary, for the same reason the
 * member is carried as its value: the row carries the vocabulary's own string — `Default` or
 * `Recurring` — so a caller narrowing by one states the value it read off a row.
 */
const AVAILABILITY_SLOT_FILTERABLE = {
	id: 'ID',
	startTime: 'DATE',
	endTime: 'DATE',
	allDay: 'BOOLEAN',
	type: 'STRING',
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
 * is what makes that order total — a statement about the resource, not an option for the caller.
 */
const AVAILABILITY_SLOT_SORTABLE = ['createdAt', 'updatedAt', 'startTime', 'endTime', 'type'] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered reads state no order of their own — the list hands the store a filter and takes the rows
 * as they come back — so the connection applies the platform's own: newest first, with the identifier as
 * the last key so that two slots filed in the same millisecond still have one order between them, which
 * is what makes a cursor walk over them stable.
 */
const AVAILABILITY_SLOT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The hours an employee is bookable, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below dispatches the same command, or reaches the same `AvailabilitySlotsService`
 * method, that the `/api/availability-slots` routes reach.
 *
 * **The guard chain is the controller's, and neither surface states a permission.** The delivered
 * controller carries `TenantPermissionGuard` and no `@Permissions` — at class level or on any handler —
 * so every route it serves runs under that guard alone, and every field below states the same and
 * nothing more. A resolver that demanded a permission would refuse here a caller the REST route serves;
 * tightening this resource is a change to make in both places at once, and it is not this delivery's to
 * make.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the catalogue declares for the GraphQL
 * endpoint and its resolvers, applied once here so every field below is behind the one capability.
 * `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the class, which
 * is why the gate is stated on the class rather than restated on each field — and why it is appended to
 * the guard chain the routes below already carry rather than replacing any part of it.
 *
 * **The list is a connection, and the delivered list is served once.** The controller answers a filtered
 * set twice — `GET /` and the inherited `GET /pagination` — and the two differ only in whether the page
 * is applied before or after the answer; that is one capability, so it is one root field, and the page is
 * what the connection protocol already performs. `withDeleted` is deliberately absent: the delivered read
 * answers live rows only, and an argument that cannot be honoured is worse than one that is not offered.
 */
@Resolver('AvailabilitySlot')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class AvailabilitySlotsResolver {
	constructor(
		private readonly availabilitySlotsService: AvailabilitySlotsService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The slots of the caller's tenant, newest first.
	 */
	@Query('availabilitySlots')
	async availabilitySlots(
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
	): Promise<GraphqlConnection<AvailabilitySlot>> {
		// The reader takes the `data` query string the list route binds. This surface has no query string
		// to bind: the connection protocol states the same narrowing in `filter`, which is applied to the
		// rows the service returns, so the read runs with the route's own defaults — no `where` and no
		// `relations`.
		const { items }: IPagination<AvailabilitySlot> = await this.availabilitySlotsService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) });

		return buildConnection<AvailabilitySlot>({
			rows: items ?? [],
			filterable: AVAILABILITY_SLOT_FILTERABLE,
			sortable: AVAILABILITY_SLOT_SORTABLE,
			defaultSort: AVAILABILITY_SLOT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One slot of the caller's tenant.
	 *
	 * A slot that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the other
	 * protocol's vocabulary.
	 */
	@Query('availabilitySlot')
	async availabilitySlot(@Args('id', { type: () => ID }) id: Id): Promise<AvailabilitySlot | null> {
		try {
			return await this.availabilitySlotsService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many slots the caller's tenant holds.
	 *
	 * The same call the inherited count route makes, with the same absence of narrowing: that route binds
	 * its query string to the store's own `where` and hands it to `countBy`, and the connection protocol
	 * has no argument of that shape, so the field passes none and counts the caller's own rows — the
	 * tenant is applied to the criterion by the service, from the credential. The field is nullable in the
	 * schema because a count is an aggregate a resource may legitimately have no answer for, and a
	 * non-null field would turn "not answered" into a fabricated zero.
	 */
	@Query('availabilitySlotCount')
	async availabilitySlotCount(): Promise<number> {
		return await this.availabilitySlotsService.countBy();
	}

	/**
	 * Files one slot.
	 *
	 * The write is dispatched as the same command the `POST /` route dispatches, so the two surfaces reach
	 * the same merge: **a slot that conflicts with one the tenant already has is merged into it rather
	 * than filed beside it** — the delivered handler widens the existing window to cover both and removes
	 * the rows it folded in — and the answer is the row the write produced.
	 *
	 * A window the write cannot use answers nothing at all, which is why the schema declares this field
	 * nullable rather than non-null: the delivered handler returns before it writes when the body states
	 * no start or no end, and a non-null field would turn that empty answer into an execution error
	 * instead of the answer the route itself gives.
	 *
	 * The cast states a difference rather than hiding one: the schema carries `type` as the vocabulary's
	 * own value — see `AvailabilitySlot.type` — while the delivered input type names the enum, and the
	 * value is the same string either way.
	 */
	@Mutation('createAvailabilitySlot')
	async createAvailabilitySlot(@Args('input') input: ICreateAvailabilitySlotInput): Promise<AvailabilitySlot> {
		return await this.commandBus.execute(
			new AvailabilitySlotsCreateCommand(input as unknown as IAvailabilitySlotsCreateInput)
		);
	}

	/**
	 * Files several slots at once.
	 *
	 * The same command the `POST /bulk` route dispatches, and the answer is the list of rows the write
	 * produced — what the delivered command answers, rather than a statement about the write. Each entry
	 * is folded through the single-slot write above, so the merge applies entry by entry and **the list is
	 * a list of rows rather than a positional echo of the input**: an entry the write answered nothing for
	 * is not a row, which is why the answer may be shorter than the input.
	 */
	@Mutation('createAvailabilitySlots')
	async createAvailabilitySlots(
		@Args('input') input: ICreateAvailabilitySlotInput[]
	): Promise<AvailabilitySlot[]> {
		return await this.commandBus.execute(
			new AvailabilitySlotsBulkCreateCommand(input as unknown as IAvailabilitySlotsCreateInput[])
		);
	}

	/**
	 * Writes a slot under an identifier the caller states.
	 *
	 * The service is the one the `PUT /:id` route calls, and the call is the route's own: **an upsert**
	 * through `create`, which the delivered service documents as writing a new row or updating the
	 * existing one the stated identifier names. The delivered route merges the identifier from the path
	 * into the body; this surface has no path, so the identifier travels inside the input and is read
	 * from the same place the write reads it.
	 */
	@Mutation('updateAvailabilitySlot')
	async updateAvailabilitySlot(@Args('input') input: IUpdateAvailabilitySlotInput): Promise<AvailabilitySlot> {
		return await this.availabilitySlotsService.create({ ...input } as unknown as AvailabilitySlot);
	}

	/**
	 * Removes a slot outright.
	 *
	 * The delivered route answers the store's own delete result — a statement about the write,
	 * `{ affected }` — which is not a row and not what a field named `deleteAvailabilitySlot` may return,
	 * so the field answers the one fact that call establishes, that the removal ran.
	 */
	@Mutation('deleteAvailabilitySlot')
	async deleteAvailabilitySlot(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.availabilitySlotsService.delete(id);

		return true;
	}

	/**
	 * Withdraws a slot without removing it.
	 */
	@Mutation('softDeleteAvailabilitySlot')
	async softDeleteAvailabilitySlot(@Args('id', { type: () => ID }) id: Id): Promise<AvailabilitySlot> {
		return await this.availabilitySlotsService.softRemove(id);
	}

	/**
	 * Puts a withdrawn slot back.
	 */
	@Mutation('recoverAvailabilitySlot')
	async recoverAvailabilitySlot(@Args('id', { type: () => ID }) id: Id): Promise<AvailabilitySlot> {
		return await this.availabilitySlotsService.softRecover(id);
	}
}
