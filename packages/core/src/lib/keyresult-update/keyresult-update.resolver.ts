import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
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
import { KeyResultUpdate } from './keyresult-update.entity';
import { KeyResultUpdateService } from './keyresult-update.service';
import { KeyResultUpdateBulkDeleteCommand } from './commands';

/** The members `CreateKeyResultUpdateInput` declares in the schema. */
export interface ICreateKeyResultUpdateInput {
	owner: string;
	progress: number;
	update: number;
	status: string;
	keyResultId?: Id;
	organizationId: Id;
}

/** The members `UpdateKeyResultUpdateInput` declares in the schema. */
export interface IUpdateKeyResultUpdateInput extends Partial<ICreateKeyResultUpdateInput> {
	id: Id;
}

/**
 * The fields an update list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `KeyResultUpdateFilter` and
 * `KeyResultUpdateSortField` are its two renderings, and keeping the three in one file is what makes
 * a field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible
 * to introduce quietly.
 *
 * `keyResultId` is the member the resource is read by: an update is a row of a key result, and the
 * delivered by-key-result route narrows to exactly this column.
 */
const KEY_RESULT_UPDATE_FILTERABLE = {
	id: 'ID',
	update: 'NUMBER',
	progress: 'NUMBER',
	owner: 'STRING',
	status: 'STRING',
	keyResultId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const KEY_RESULT_UPDATE_SORTABLE = ['createdAt', 'updatedAt', 'progress', 'status'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list read applies no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces. An update is a move in time, so the order a caller means by default is the history's:
 * newest first, with the identifier as the last key so that two moves recorded in the same
 * millisecond still have one order between them, which is what makes a cursor walk over them stable.
 */
const KEY_RESULT_UPDATE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The moves a key result made, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `KeyResultUpdateService` method the
 * `/api/key-result-updates` routes call, or dispatches the same `KeyResultUpdateBulkDeleteCommand`
 * the bulk removal dispatches.
 *
 * **The controller's own read is a by-key-result list, and it is the connection narrowed.**
 * `GET /:id` hands the list reader `where: { keyResultId }` — the path segment names the key result,
 * not the row — so one key result's updates are stated as the connection's `keyResultId` filter. The
 * relation that read joins is the parent, whose identifier the row already carries.
 *
 * **One fact about the delivered router is written down here rather than left to be discovered.** A
 * router walks a class's own methods before the base class's, so the controller's `GET /:id` is
 * registered ahead of the inherited `GET /count` and `GET /pagination`, and a single-segment pattern
 * matches both: on REST they answer a by-key-result list. This surface states each capability where
 * the controller declares it. The spec asserts that ordering, so the note cannot quietly stop being
 * true.
 *
 * **The delivered edit answers nothing, and this field does not reproduce that.** The controller's
 * `PUT /:id` catches whatever the write threw and returns an empty body; a field that promises a row
 * cannot answer an empty body, because a caller could not tell it from a row that was never there. The
 * write's own refusal travels instead.
 *
 * **The guard chain is the controller's, and no field states a permission.**
 * `KeyResultUpdateController` carries `TenantPermissionGuard` on the class and nothing else, on any of
 * the nine routes, so the permission guard is not part of this resolver's chain either. The spec reads
 * the controller's `__guards__` and `PERMISSIONS_METADATA` and compares them with this class's.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any part
 * of it.
 */
@Resolver('KeyResultUpdate')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class KeyResultUpdateResolver {
	constructor(
		private readonly keyResultUpdateService: KeyResultUpdateService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The updates of the caller's tenant.
	 *
	 * The same read the inherited list route performs, and the same reader the by-key-result route calls
	 * with one more criterion — which is why one key result's updates are this connection with
	 * `keyResultId` in `filter` rather than a field of their own. The relation the by-key-result route
	 * names is stated here too, so the rows this surface answers are the rows that route answers.
	 */
	@Query('keyResultUpdates')
	async keyResultUpdates(
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
	): Promise<GraphqlConnection<KeyResultUpdate>> {
		const { items }: IPagination<KeyResultUpdate> = await this.keyResultUpdateService.findAll({
			...(withDeleted ? { withDeleted: true } : {}),
			where: {},
			relations: ['keyResult']
		} as never);

		return this.connection(items, { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * One update of the caller's tenant.
	 *
	 * The capability the CRUD base's `GET /:id` route declares — see the note above the class for the
	 * registration order that puts the controller's by-key-result read in front of it on the delivered
	 * router. An update that is not there answers `null` rather than a refusal: GraphQL has one answer
	 * for "no such row" on a field that may have none, and the REST route's `404` is that same fact
	 * stated in the other protocol's vocabulary.
	 */
	@Query('keyResultUpdate')
	async keyResultUpdate(@Args('id', { type: () => ID }) id: Id): Promise<KeyResultUpdate | null> {
		try {
			return await this.keyResultUpdateService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many updates the caller's tenant holds.
	 *
	 * The same call the inherited count route makes, with the same absence of narrowing: that route
	 * binds its query string to the store's own `where` and hands it to `countBy`, and the connection
	 * protocol has no argument of that shape, so the field passes none and counts the caller's own
	 * rows.
	 */
	@Query('keyResultUpdateCount')
	async keyResultUpdateCount(): Promise<number> {
		return await this.keyResultUpdateService.countBy();
	}

	/**
	 * Records a move against a key result.
	 *
	 * The same service method the create route calls, with the body that route validates — the
	 * organization among its members, because the delivered DTO refuses a body that names no
	 * organization and checks the one it is given against the caller's own memberships.
	 */
	@Mutation('createKeyResultUpdate')
	async createKeyResultUpdate(
		@Args('input') input: ICreateKeyResultUpdateInput
	): Promise<KeyResultUpdate> {
		return await this.keyResultUpdateService.create(input as never);
	}

	/**
	 * Corrects a move that was recorded.
	 *
	 * The delivered route is an update-through-create and this field is the same call with the stated
	 * identifier spread over the body. What it does not reproduce is the route's silence: that route
	 * catches whatever the write threw and answers an empty body, and a field that promises a row
	 * cannot answer one — so the write's own refusal travels, which is the same fact stated where a
	 * caller can read it.
	 */
	@Mutation('updateKeyResultUpdate')
	async updateKeyResultUpdate(
		@Args('input') input: IUpdateKeyResultUpdateInput
	): Promise<KeyResultUpdate> {
		const { id, ...values } = input;

		return await this.keyResultUpdateService.create({ ...values, id } as never);
	}

	/**
	 * Removes one update outright, by its own identifier.
	 *
	 * The delivered route answers the store's delete result — a statement about the write rather than a
	 * row — so this field answers whether the removal ran.
	 */
	@Mutation('deleteKeyResultUpdate')
	async deleteKeyResultUpdate(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.keyResultUpdateService.delete(id);

		return true;
	}

	/**
	 * Removes every update of one key result in a single write.
	 *
	 * The same command the delivered bulk removal dispatches; the handler reads the key result's
	 * updates and deletes them by identifier, which is the whole of what the route does. The route
	 * answers nothing at all, so this field answers whether the command ran.
	 */
	@Mutation('deleteKeyResultUpdates')
	async deleteKeyResultUpdates(@Args('keyResultId', { type: () => ID }) keyResultId: Id): Promise<boolean> {
		await this.commandBus.execute(new KeyResultUpdateBulkDeleteCommand(keyResultId));

		return true;
	}

	/**
	 * Withdraws one update without removing it.
	 *
	 * The inherited `DELETE /key-result-updates/:id/soft` route's own call.
	 */
	@Mutation('softDeleteKeyResultUpdate')
	async softDeleteKeyResultUpdate(@Args('id', { type: () => ID }) id: Id): Promise<KeyResultUpdate> {
		return await this.keyResultUpdateService.softRemove(id);
	}

	/**
	 * Puts a withdrawn update back.
	 */
	@Mutation('recoverKeyResultUpdate')
	async recoverKeyResultUpdate(@Args('id', { type: () => ID }) id: Id): Promise<KeyResultUpdate> {
		return await this.keyResultUpdateService.softRecover(id);
	}

	/**
	 * The connection this domain's list root field answers with, built by the one implementation every
	 * domain on this platform shares.
	 */
	private connection(
		rows: readonly KeyResultUpdate[] | undefined,
		request: ConnectionRequest
	): GraphqlConnection<KeyResultUpdate> {
		return buildConnection<KeyResultUpdate>({
			rows: rows ?? [],
			filterable: KEY_RESULT_UPDATE_FILTERABLE,
			sortable: KEY_RESULT_UPDATE_SORTABLE,
			defaultSort: KEY_RESULT_UPDATE_DEFAULT_SORT,
			request
		});
	}
}
