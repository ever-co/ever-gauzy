import { NotFoundException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { TagType } from './tag-type.entity';
import { TagTypeService } from './tag-type.service';

/** The members `CreateTagTypeInput` declares in the schema. */
export interface ICreateTagTypeInput {
	organizationId: Id;
	type: string;
}

/** The members `UpdateTagTypeInput` declares in the schema. */
export interface IUpdateTagTypeInput {
	id: Id;
	organizationId?: Id;
	type?: string;
}

/**
 * The fields a tag type list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `TagTypeFilter` and `TagTypeSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `type` is a column of the row rather than a translated member, which is why it is in both the
 * filterable and the sortable set: it is the whole of what a caller selects a group by, and the
 * delivered reader answers the column itself.
 */
const TAG_TYPE_FILTERABLE = {
	id: 'ID',
	type: 'STRING',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const TAG_TYPE_SORTABLE = ['createdAt', 'updatedAt', 'type'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list method declares no order of its own and the store answers in its own, so this is
 * not a reproduction of the route's order — there is none to reproduce — but the order that makes a
 * cursor walk total: newest first, with the identifier as the last key so that two groups written in
 * the same millisecond still have one order between them.
 */
const TAG_TYPE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The groupings the platform's labels are filed under, over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `TagTypeService` method the `/api/tag-types` routes call.
 *
 * **The guard chain and the permissions are the controller's, field by field.** The delivered
 * controller carries `TenantPermissionGuard` and `PermissionGuard` on the class, no class-level
 * permission, and states `ALL_ORG_VIEW` or `ALL_ORG_EDIT` beside the resource's own permission on the
 * four routes it declares of its own. This resolver carries the same two guards on the class and the
 * same permissions on the fields that mirror those four routes; the node query and the three removals
 * it inherits from the CRUD base state no permission of their own and therefore run under the guards
 * alone, so the fields mirroring them state none either. A field that demanded a permission the route
 * does not would refuse here a caller REST serves.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it is
 * appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('TagType')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class TagTypeResolver {
	constructor(private readonly tagTypeService: TagTypeService) {}

	/**
	 * The tag types of the caller's tenant.
	 *
	 * The read is the one the REST list route performs, with the route's own defaults: that route binds
	 * its query string to a query DTO and hands it to `findAll`, and this surface has no query string to
	 * bind — the connection protocol states the same narrowing in `filter`, which the evaluator applies
	 * to the rows the service answered — so the read is made with no options, which is the tenant-scoped
	 * read the service performs for every caller alike.
	 */
	@Query('tagTypes')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TAG_TYPES_VIEW)
	async tagTypes(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<TagType>> {
		const { items }: IPagination<TagType> = await this.tagTypeService.findAll();

		return buildConnection<TagType>({
			rows: items ?? [],
			filterable: TAG_TYPE_FILTERABLE,
			sortable: TAG_TYPE_SORTABLE,
			defaultSort: TAG_TYPE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One tag type of the caller's tenant.
	 *
	 * A group that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary. The field states no permission because the route it mirrors —
	 * the `GET /:id` inherited from the CRUD base — states none of its own.
	 */
	@Query('tagType')
	async tagType(@Args('id', { type: () => ID }) id: Id): Promise<TagType | null> {
		try {
			return await this.tagTypeService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many tag types the caller's tenant holds.
	 *
	 * The same call the count route makes, with the same absence of narrowing: that route binds its
	 * query string to the store's own `where` and hands it to `countBy`, and the connection protocol has
	 * no argument of that shape, so the field passes none and counts the caller's own rows.
	 */
	@Query('tagTypeCount')
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TAG_TYPES_VIEW)
	async tagTypeCount(): Promise<number> {
		return await this.tagTypeService.countBy();
	}

	/**
	 * Declares a group.
	 *
	 * The same service method the create route calls, with the body as stated: the tenant is stamped
	 * from the credential, so a caller states which of its own organizations the group belongs to and
	 * never which tenant.
	 */
	@Mutation('createTagType')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAG_TYPES_ADD)
	async createTagType(@Args('input') input: ICreateTagTypeInput): Promise<TagType> {
		return await this.tagTypeService.create(input as unknown as TagType);
	}

	/**
	 * Changes a group that exists.
	 *
	 * The service is the one the REST route calls, and it reads the row before it writes: a caller
	 * naming a group of another tenant, or one that is not there, is answered with the miss the route
	 * answers with rather than with a write against a row it does not own. The identifier is the
	 * criterion and is not repeated in the payload, which is the shape the route itself has: `:id` names
	 * the row and the body carries only what changes.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered route
	 * answers the store's own update result — a statement about the write, `{ affected }` — which is not
	 * a row and not what a field named `updateTagType` may return.
	 */
	@Mutation('updateTagType')
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAG_TYPES_EDIT)
	async updateTagType(@Args('input') input: IUpdateTagTypeInput): Promise<TagType> {
		const { id, ...values } = input;

		await this.tagTypeService.update(id, values as unknown as QueryDeepPartialEntity<TagType>);

		return await this.tagTypeService.findOneByIdString(id);
	}

	/**
	 * Removes a group outright. The tags filed under it are not removed with it: the relation is
	 * declared to clear, so their grouping is set aside and the labels themselves stay.
	 */
	@Mutation('deleteTagType')
	async deleteTagType(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.tagTypeService.delete(id);

		return true;
	}

	/**
	 * Withdraws a group without removing it. No permission is stated because the delivered route states
	 * none: the soft removal is inherited from the CRUD base, where the controller's own guards are the
	 * whole of its scope.
	 */
	@Mutation('softDeleteTagType')
	async softDeleteTagType(@Args('id', { type: () => ID }) id: Id): Promise<TagType> {
		return await this.tagTypeService.softRemove(id);
	}

	/**
	 * Puts a withdrawn group back. Unpermissioned for the same reason the withdrawal above is: the
	 * delivered route carries no permission to mirror.
	 */
	@Mutation('recoverTagType')
	async recoverTagType(@Args('id', { type: () => ID }) id: Id): Promise<TagType> {
		return await this.tagTypeService.softRecover(id);
	}
}
