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
import { KeyResultTemplate } from './keyresult-template.entity';
import { KeyresultTemplateService } from './keyresult-template.service';

/** The members `CreateKeyResultTemplateInput` declares in the schema. */
export interface ICreateKeyResultTemplateInput {
	name: string;
	type: string;
	unit?: string;
	targetValue?: number;
	initialValue?: number;
	deadline: string;
	kpiId?: Id;
	goalId?: Id;
	organizationId?: Id;
}

/** The members `UpdateKeyResultTemplateInput` declares in the schema. */
export interface IUpdateKeyResultTemplateInput extends Partial<ICreateKeyResultTemplateInput> {
	id: Id;
}

/**
 * The fields a catalogue list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `KeyResultTemplateFilter` and
 * `KeyResultTemplateSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * `goalId` and `kpiId` are the two the catalogue is walked by: an entry belongs to a goal template
 * and may suggest a KPI template, and both are columns of this row rather than pivots, so the
 * connection narrows by them directly.
 */
const KEY_RESULT_TEMPLATE_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	type: 'STRING',
	unit: 'STRING',
	targetValue: 'NUMBER',
	initialValue: 'NUMBER',
	deadline: 'STRING',
	kpiId: 'ID',
	goalId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const KEY_RESULT_TEMPLATE_SORTABLE = [
	'createdAt',
	'updatedAt',
	'name',
	'type',
	'targetValue',
	'initialValue',
	'deadline'
] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list read applies no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: newest first, with the identifier as the last key so that two entries filed in the same
 * millisecond still have one order between them, which is what makes a cursor walk over them stable.
 */
const KEY_RESULT_TEMPLATE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The catalogue a key result is authored from, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `KeyresultTemplateService` method the
 * `/api/key-result-templates` routes call.
 *
 * **Two routes are declared and seven inherited, and the resolver mirrors all nine.** The controller
 * declares the list and the filing; the node, the count, the paginated spelling, the edit, the removal
 * and the two lifecycle moves come from the CRUD base. The base's edit answers the store's update
 * result rather than a row, which is why the edit field here writes and then reads the row back
 * through the same reader the node query uses.
 *
 * **The guard chain is the controller's, and no field states a permission.**
 * `KeyresultTemplateController` carries `TenantPermissionGuard` on the class and nothing else, on any
 * of the nine routes, so the permission guard is not part of this resolver's chain either. The spec
 * reads the controller's `__guards__` and `PERMISSIONS_METADATA` and compares them with this class's.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any part
 * of it.
 */
@Resolver('KeyResultTemplate')
@UseGuards(TenantPermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class KeyResultTemplateResolver {
	constructor(private readonly keyResultTemplateService: KeyresultTemplateService) {}

	/**
	 * The catalogue entries of the caller's tenant.
	 *
	 * The same read the list route performs: the route binds its query string to `findInput` and
	 * `relations` and hands both to `findAll`. This surface has no query string to bind — the
	 * connection protocol states the caller's narrowing in `filter`, which the evaluator applies to the
	 * rows the service returns — so the read runs with the route's own defaults for an unstated
	 * request. One goal template's entries are this connection with `goalId` in `filter`.
	 */
	@Query('keyResultTemplates')
	async keyResultTemplates(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<KeyResultTemplate>> {
		const { items }: IPagination<KeyResultTemplate> = await this.keyResultTemplateService.findAll({
			where: {}
		} as never);

		return this.connection(items, { filter, sort, page, first, after, last, before, limit, offset });
	}

	/**
	 * One catalogue entry of the caller's tenant.
	 *
	 * The read the inherited `GET /key-result-templates/:id` route performs. An entry that is not there
	 * answers `null` rather than a refusal: GraphQL has one answer for "no such row" on a field that
	 * may have none, and the REST route's `404` is that same fact stated in the other protocol's
	 * vocabulary.
	 */
	@Query('keyResultTemplate')
	async keyResultTemplate(@Args('id', { type: () => ID }) id: Id): Promise<KeyResultTemplate | null> {
		try {
			return (await this.keyResultTemplateService.findOneByIdString(id)) as KeyResultTemplate;
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many catalogue entries the caller's tenant holds.
	 *
	 * The same call the inherited count route makes, with the same absence of narrowing: that route
	 * binds its query string to the store's own `where` and hands it to `countBy`, and the connection
	 * protocol has no argument of that shape, so the field passes none and counts the caller's own
	 * rows.
	 */
	@Query('keyResultTemplateCount')
	async keyResultTemplateCount(): Promise<number> {
		return await this.keyResultTemplateService.countBy();
	}

	/**
	 * Files a catalogue entry.
	 *
	 * The same service method the create route calls, with the body that route validates — a name, a
	 * kind and a deadline are the three it requires, and the goal template and the KPI template it
	 * points at are the two relations its DTO joins.
	 */
	@Mutation('createKeyResultTemplate')
	async createKeyResultTemplate(
		@Args('input') input: ICreateKeyResultTemplateInput
	): Promise<KeyResultTemplate> {
		return (await this.keyResultTemplateService.create(input as never)) as KeyResultTemplate;
	}

	/**
	 * Changes a catalogue entry.
	 *
	 * The delivered route is the CRUD base's own: it reads the row first — which is what turns an entry
	 * of another tenant, or one that is not there, into a miss — and then performs a partial column
	 * update whose answer is the store's update result. A field that promises a row cannot answer a
	 * statement about a write, so the row is read back through the same reader the node query uses.
	 */
	@Mutation('updateKeyResultTemplate')
	async updateKeyResultTemplate(
		@Args('input') input: IUpdateKeyResultTemplateInput
	): Promise<KeyResultTemplate> {
		const { id, ...values } = input;

		await this.keyResultTemplateService.update(id, values as never);

		return (await this.keyResultTemplateService.findOneByIdString(id)) as KeyResultTemplate;
	}

	/**
	 * Removes a catalogue entry outright.
	 *
	 * The delivered route answers the store's delete result — a statement about the write rather than a
	 * row — so this field answers whether the removal ran.
	 */
	@Mutation('deleteKeyResultTemplate')
	async deleteKeyResultTemplate(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.keyResultTemplateService.delete(id);

		return true;
	}

	/**
	 * Withdraws a catalogue entry without removing it.
	 *
	 * The inherited `DELETE /key-result-templates/:id/soft` route's own call.
	 */
	@Mutation('softDeleteKeyResultTemplate')
	async softDeleteKeyResultTemplate(@Args('id', { type: () => ID }) id: Id): Promise<KeyResultTemplate> {
		return (await this.keyResultTemplateService.softRemove(id)) as KeyResultTemplate;
	}

	/**
	 * Puts a withdrawn catalogue entry back.
	 */
	@Mutation('recoverKeyResultTemplate')
	async recoverKeyResultTemplate(@Args('id', { type: () => ID }) id: Id): Promise<KeyResultTemplate> {
		return (await this.keyResultTemplateService.softRecover(id)) as KeyResultTemplate;
	}

	/**
	 * The connection this domain's list root field answers with, built by the one implementation every
	 * domain on this platform shares.
	 */
	private connection(
		rows: readonly KeyResultTemplate[] | undefined,
		request: ConnectionRequest
	): GraphqlConnection<KeyResultTemplate> {
		return buildConnection<KeyResultTemplate>({
			rows: rows ?? [],
			filterable: KEY_RESULT_TEMPLATE_FILTERABLE,
			sortable: KEY_RESULT_TEMPLATE_SORTABLE,
			defaultSort: KEY_RESULT_TEMPLATE_DEFAULT_SORT,
			request
		});
	}
}
