import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlagGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { KeyResult } from './keyresult.entity';
import { KeyResultService } from './keyresult.service';

/** The members `CreateKeyResultInput` declares in the schema. */
export interface ICreateKeyResultInput {
	name?: string;
	description?: string;
	type?: string;
	targetValue?: number;
	initialValue?: number;
	unit?: string;
	update?: number;
	progress?: number;
	deadline?: string;
	hardDeadline?: Date;
	softDeadline?: Date;
	status?: string;
	weight?: string;
	ownerId?: Id;
	leadId?: Id;
	projectId?: Id;
	taskId?: Id;
	kpiId?: Id;
	goalId?: Id;
	organizationId?: Id;
}

/** The members `UpdateKeyResultInput` declares in the schema. */
export interface IUpdateKeyResultInput extends ICreateKeyResultInput {
	id: Id;
}

/**
 * The fields a key result list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `KeyResultFilter` and `KeyResultSortField` are
 * its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the key-result row, because that is what the connection protocol
 * evaluates. An objective's key results are this connection narrowed by `goalId`, and the `updates`
 * collection the node read joins is not here: it is a pivot rather than a column, and it has a
 * connection of its own.
 */
const KEY_RESULT_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	description: 'STRING',
	type: 'STRING',
	targetValue: 'NUMBER',
	initialValue: 'NUMBER',
	unit: 'STRING',
	update: 'NUMBER',
	progress: 'NUMBER',
	deadline: 'STRING',
	hardDeadline: 'DATE',
	softDeadline: 'DATE',
	status: 'STRING',
	weight: 'STRING',
	ownerId: 'ID',
	leadId: 'ID',
	projectId: 'ID',
	taskId: 'ID',
	kpiId: 'ID',
	goalId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const KEY_RESULT_SORTABLE = [
	'createdAt',
	'updatedAt',
	'name',
	'type',
	'progress',
	'targetValue',
	'deadline',
	'status'
] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list read applies no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: newest first, with the identifier as the last key so that two key results authored in
 * the same millisecond still have one order between them, which is what makes a cursor walk over them
 * stable.
 */
const KEY_RESULT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The measurable half of an objective, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `KeyResultService` method the `/api/key-results` routes
 * call.
 *
 * **The node read is a field of its own.** The controller's own `GET /:id` is not the list reader with
 * one more criterion: it hands the store four relations the list read does not join — the updates
 * that hang off the row, and the goal, lead and owner it points at — and its path segment names the
 * row itself rather than somebody else's identifier. The members those relations would answer are the
 * identifiers the row always holds, and the updates are read through their own connection, so a
 * caller gets one shape from every field here rather than an object on one read and `null` on the
 * rest.
 *
 * **One fact about the delivered router is written down here rather than left to be discovered.** A
 * router walks a class's own methods before the base class's, so the controller's `GET /:id` is
 * registered ahead of the inherited `GET /count` and `GET /pagination`, and a single-segment pattern
 * matches both: on REST they answer the node read with the segment as an identifier. This surface
 * states each capability where the controller declares it. The spec asserts that ordering, so the
 * note cannot quietly stop being true.
 *
 * **The guard chain is the controller's, and no field states a permission.** `KeyResultController`
 * carries `TenantPermissionGuard` on the class and nothing else, on any of the nine routes, so the
 * permission guard is not part of this resolver's chain either. The spec reads the controller's
 * `__guards__` and `PERMISSIONS_METADATA` and compares them with this class's.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any part
 * of it.
 */
@Resolver('KeyResult')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class KeyResultResolver {
	constructor(private readonly keyResultService: KeyResultService) {}

	/**
	 * The key results of the caller's tenant.
	 *
	 * The same read the inherited list route performs: the route binds its query DTO to the query
	 * string and hands it to `findAll`. This surface has no query string to bind — the connection
	 * protocol states the caller's narrowing in `filter`, which the evaluator applies to the rows the
	 * service returns — so the read runs with the route's own default for an unstated request.
	 */
	@Query('keyResults')
	async keyResults(
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
	): Promise<GraphqlConnection<KeyResult>> {
		const { items }: IPagination<KeyResult> = await this.keyResultService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) } as never);

		return this.connection(items, { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * One key result of the caller's tenant.
	 *
	 * The read the controller's own `GET /key-results/:id` route performs, started at the same place:
	 * the delivered reader is the list reader handed the row's identifier and the four relations it
	 * joins, and it answers an envelope rather than a row — so the row is taken out of that envelope,
	 * which is the row the route answers. A key result that is not there answers `null` rather than a
	 * refusal: GraphQL has one answer for "no such row" on a field that may have none, and the REST
	 * route's empty envelope is that same fact stated in the other protocol's vocabulary.
	 */
	@Query('keyResult')
	async keyResult(@Args('id', { type: () => ID }) id: Id): Promise<KeyResult | null> {
		try {
			const { items }: IPagination<KeyResult> = await this.keyResultService.findAll({
				where: { id },
				relations: ['updates', 'goal', 'lead', 'owner']
			} as never);

			return (items ?? [])[0] ?? null;
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many key results the caller's tenant holds.
	 *
	 * The same call the inherited count route makes, with the same absence of narrowing: that route
	 * binds its query string to the store's own `where` and hands it to `countBy`, and the connection
	 * protocol has no argument of that shape, so the field passes none and counts the caller's own
	 * rows.
	 */
	@Query('keyResultCount')
	async keyResultCount(): Promise<number> {
		return await this.keyResultService.countBy();
	}

	/**
	 * Authors a key result.
	 *
	 * The same service method the create route calls, with the body that route validates.
	 */
	@Mutation('createKeyResult')
	async createKeyResult(@Args('input') input: ICreateKeyResultInput): Promise<KeyResult> {
		return await this.keyResultService.create(input as never);
	}

	/**
	 * Authors several key results in one write.
	 *
	 * The delivered bulk route hands its body's `list` to the service's own bulk write, and that is
	 * what this field does with the list it is given. The delivered save is an upsert rather than an
	 * insert, so an entry carrying an identifier updates the row it names.
	 */
	@Mutation('createKeyResults')
	async createKeyResults(@Args('input') input: ICreateKeyResultInput[]): Promise<KeyResult[]> {
		return await this.keyResultService.createBulk(input as never);
	}

	/**
	 * Changes a key result.
	 *
	 * The delivered route is an update-through-create and this field is the same call with the stated
	 * identifier spread over the body.
	 */
	@Mutation('updateKeyResult')
	async updateKeyResult(@Args('input') input: IUpdateKeyResultInput): Promise<KeyResult> {
		const { id, ...values } = input;

		return await this.keyResultService.create({ ...values, id } as never);
	}

	/**
	 * Removes a key result outright.
	 *
	 * The delivered route answers the store's delete result — a statement about the write rather than a
	 * row — so this field answers whether the removal ran.
	 */
	@Mutation('deleteKeyResult')
	async deleteKeyResult(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.keyResultService.delete(id);

		return true;
	}

	/**
	 * Withdraws a key result without removing it.
	 *
	 * The inherited `DELETE /key-results/:id/soft` route's own call.
	 */
	@Mutation('softDeleteKeyResult')
	async softDeleteKeyResult(@Args('id', { type: () => ID }) id: Id): Promise<KeyResult> {
		return await this.keyResultService.softRemove(id);
	}

	/**
	 * Puts a withdrawn key result back.
	 */
	@Mutation('recoverKeyResult')
	async recoverKeyResult(@Args('id', { type: () => ID }) id: Id): Promise<KeyResult> {
		return await this.keyResultService.softRecover(id);
	}

	/**
	 * The connection this domain's list root field answers with, built by the one implementation every
	 * domain on this platform shares.
	 */
	private connection(
		rows: readonly KeyResult[] | undefined,
		request: ConnectionRequest
	): GraphqlConnection<KeyResult> {
		return buildConnection<KeyResult>({
			rows: rows ?? [],
			filterable: KEY_RESULT_FILTERABLE,
			sortable: KEY_RESULT_SORTABLE,
			defaultSort: KEY_RESULT_DEFAULT_SORT,
			request
		});
	}
}
