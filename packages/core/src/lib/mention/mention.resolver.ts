import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IMentionCreateInput, IPagination } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO, FindOptionsQueryDTO } from '../core/crud';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Mention } from './mention.entity';
import { MentionService } from './mention.service';

/** The members `CreateMentionInput` declares in the schema. */
export interface ICreateMentionInput {
	entity: string;
	entityId: Id;
	mentionedEmployeeId: Id;
	organizationId: Id;
	parentEntityId?: Id;
	parentEntityType?: string;
	actorType?: string;
	entityName?: string;
}

/** The members `UpdateMentionInput` declares in the schema. */
export interface IUpdateMentionInput {
	id: Id;
	entity?: string;
	entityId?: Id;
	mentionedEmployeeId?: Id;
	organizationId?: Id;
	parentEntityId?: Id;
	parentEntityType?: string;
	actorType?: string;
}

/**
 * The fields a mention list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `MentionFilter` and `MentionSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the mention row, which is why the set is what it is: the delivered list
 * read answers the row itself and joins only the relations a REST caller names in its query string —
 * which this surface never names — so each member here narrows the rows the connection was handed
 * rather than a collection a reader would have had to load. The two employees are therefore absent as
 * relation paths and present as the identifiers the row stores; the parent pair is present, because
 * narrowing a list by the record a mention is about is the read the parent columns exist for.
 */
const MENTION_FILTERABLE = {
	id: 'ID',
	actorType: 'STRING',
	entity: 'STRING',
	entityId: 'ID',
	parentEntityId: 'ID',
	parentEntityType: 'STRING',
	mentionedEmployeeId: 'ID',
	employeeId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	createdAt: 'DATE',
	updatedAt: 'DATE',
	deletedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const MENTION_SORTABLE = [
	'id',
	'entity',
	'entityId',
	'parentEntityType',
	'mentionedEmployeeId',
	'createdAt',
	'updatedAt',
	'deletedAt'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list method states no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is the platform's own: newest first, with the identifier as the
 * last key so that two mentions filed in the same millisecond still have one order between them, which
 * is what makes a cursor walk over them total.
 */
const MENTION_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The mention over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `MentionService` method the `/api/mentions` routes call.
 *
 * **The guard chain is the controller's, and no permission is stated anywhere — not even on a field.**
 * The delivered controller carries `TenantPermissionGuard` and `PermissionGuard` on the class and no
 * `@Permissions` at all: it declares no handler of its own, so its whole route set is the nine routes
 * it inherits from the CRUD base, and not one of those nine states a permission either. Every route
 * is therefore tenant-guarded and otherwise unpermissioned, and a field that demanded a permission
 * would refuse a caller the REST route serves — the asymmetry the two-protocol rule forbids.
 * Tightening the resource is a change to make in both places at once, and it is not this delivery's to
 * make.
 *
 * **The filing is the one field that reaches an override rather than the base method.** `POST /` is
 * inherited, but the service it resolves is this domain's, whose `create` stamps the tenant and the
 * authoring employee from the credential, publishes a subscription for the mentioned employee and
 * raises a notification for them. `createMention` therefore calls `create` — the override the route
 * reaches — because the base insert it would otherwise reach files the row and silently skips the two
 * effects, which is exactly the kind of divergence this surface exists to prevent. The remaining
 * writes are the inherited ones and reach the inherited methods: the edit reads the row before it
 * writes it, the removal answers the store's delete result, and the withdrawal and restoration move
 * the row's own marker.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('Mention')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class MentionResolver {
	constructor(private readonly mentionService: MentionService) {}

	/**
	 * The mentions of the caller's tenant, newest first.
	 */
	@Query('mentions')
	async mentions(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Mention>> {
		// The reader takes the query DTO the list route binds its query string to. This surface has no
		// query string to bind: the connection protocol states the same narrowing in `filter`, which is
		// applied to the rows the service returns, so the read runs with the route's own defaults — the
		// route's criterion when its caller states none, and no joined collection. The tenant is applied
		// to that criterion by the service, from the credential rather than from the caller.
		const { items }: IPagination<Mention> = await this.mentionService.findAll({} as BaseQueryDTO<Mention>);

		return buildConnection<Mention>({
			rows: items ?? [],
			filterable: MENTION_FILTERABLE,
			sortable: MENTION_SORTABLE,
			defaultSort: MENTION_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One mention of the caller's tenant.
	 *
	 * A mention that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 */
	@Query('mention')
	async mention(@Args('id', { type: () => ID }) id: Id): Promise<Mention | null> {
		try {
			return await this.mentionService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many mentions the caller's tenant records.
	 *
	 * The same call the count route makes when it is given no query string, and the same absence of
	 * narrowing: that route binds its query string to the store's own `where` and hands it to `countBy`,
	 * and the connection protocol has no argument of that shape, so the field passes none and counts the
	 * caller's own rows.
	 */
	@Query('mentionCount')
	async mentionCount(): Promise<number> {
		return await this.mentionService.countBy();
	}

	/**
	 * Files a mention.
	 *
	 * The payload is the input as stated and the call is the service's own `create` — the override the
	 * inherited `POST /` reaches — so the filing stamps the tenant and the authoring employee from the
	 * credential, publishes the subscription for the mentioned employee and raises their notification,
	 * exactly as the route does. A caller therefore states the entity, the employee who was named and
	 * the organization the two effects are addressed to, and never which tenant the row is written into
	 * or who is writing it.
	 */
	@Mutation('createMention')
	async createMention(@Args('input') input: ICreateMentionInput): Promise<Mention> {
		const created = await this.mentionService.create(input as unknown as IMentionCreateInput);

		return created as unknown as Mention;
	}

	/**
	 * Changes a mention.
	 *
	 * The service is the one the REST route calls, and it reads the row before it writes: a caller
	 * naming a mention of another tenant, or one that is not there, is answered with the miss rather
	 * than with a write. The identifier travels inside the payload here, exactly as the route's path
	 * identifier does beside the body.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered route
	 * answers the store's own update result — a statement about the write, `{ affected }` — which is not
	 * a row, and a field declared as the object type cannot answer it: the caller would receive an object
	 * with no identifier on a member the schema promises is there.
	 */
	@Mutation('updateMention')
	async updateMention(@Args('input') input: IUpdateMentionInput): Promise<Mention> {
		await this.mentionService.update(input.id, input as unknown as Mention);

		return await this.mentionService.findOneByIdString(input.id, {} as FindOptionsQueryDTO<Mention>);
	}

	/**
	 * Removes a mention outright.
	 *
	 * The service is the one the REST route calls, and it refuses a caller naming a row of another
	 * tenant rather than reporting a deletion that did not happen; the field answers whether the removal
	 * happened rather than the removed row, because the delivered route answers the store's delete
	 * result.
	 */
	@Mutation('deleteMention')
	async deleteMention(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.mentionService.delete(id);

		return true;
	}

	/**
	 * Withdraws a mention: the row is marked rather than removed, and the recovery below reads it back.
	 */
	@Mutation('softDeleteMention')
	async softDeleteMention(@Args('id', { type: () => ID }) id: Id): Promise<Mention> {
		return await this.mentionService.softRemove(id);
	}

	/**
	 * Puts a withdrawn mention back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverMention')
	async recoverMention(@Args('id', { type: () => ID }) id: Id): Promise<Mention> {
		return await this.mentionService.softRecover(id);
	}
}
