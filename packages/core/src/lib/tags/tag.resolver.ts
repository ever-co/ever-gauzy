import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, IPagination, ITag, PermissionsEnum } from '@gauzy/contracts';
import { FindOptionsWhere } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { RequestContext } from '../core/context';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { Tag } from './tag.entity';
import { TagService } from './tag.service';
import { TagListCommand } from './commands';

/** The members `CreateTagInput` declares in the schema. */
export interface ICreateTagInput {
	name: string;
	color: string;
	description?: string;
	textColor?: string;
	icon?: string;
	tagTypeId?: Id;
	organizationTeamId?: Id;
	organizationId?: Id;
}

/** The members `UpdateTagInput` declares in the schema: the same, all optional, plus the identifier. */
export interface IUpdateTagInput {
	id: Id;
	name?: string;
	color?: string;
	description?: string;
	textColor?: string;
	icon?: string;
	tagTypeId?: Id;
	organizationTeamId?: Id;
	organizationId?: Id;
}

/**
 * The fields a tag list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `TagFilter` and `TagSortField` are its two
 * renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member here is a column the delivered readers actually answer, which is why the set is what
 * it is. The usage counters the list reader computes in SQL are in neither: they are produced by one
 * branch of that reader and are not members of a tag.
 */
const TAG_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	color: 'STRING',
	textColor: 'STRING',
	description: 'STRING',
	icon: 'STRING',
	isSystem: 'BOOLEAN',
	tagTypeId: 'ID',
	organizationTeamId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const TAG_SORTABLE = ['createdAt', 'updatedAt', 'name', 'color', 'isSystem'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * Neither delivered reader states an order of its own — both hand the store a criterion and take the
 * rows as they come back — so this is a decision the connection has to make rather than one it
 * reproduces: newest first, with the identifier as the last key so that two tags written in the same
 * millisecond still have one order between them, which is what makes a cursor walk over them stable.
 */
const TAG_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The platform's labels and their groupings over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below dispatches the same command, or calls the same `TagService` method, that
 * the `/api/tags` routes reach.
 *
 * **The guard chain and the permissions are the controller's, field by field.** The delivered
 * controller carries `TenantPermissionGuard` on the class, no class-level permission, and
 * `PermissionGuard` with `ALL_ORG_EDIT` plus the add or edit permission on each of the two writes it
 * declares of its own. This resolver carries the tenant guard on the class and the permission guard
 * with the same two permissions on the same two fields; every other field mirrors a route that states
 * no permission — the list, the level lookup, the count and the node query the controller inherits
 * from the CRUD base — and therefore states none either. A field that demanded a permission the route
 * does not would refuse here a caller REST serves, and tightening the resource is a change to make in
 * both places at once.
 */
@Resolver('Tag')
@UseGuards(TenantPermissionGuard)
export class TagResolver {
	constructor(
		private readonly tagService: TagService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The tags of the caller's tenant.
	 *
	 * The read is the one the REST list route performs, dispatched as the same command: that route
	 * hands `TagListCommand` the `where` and `relations` its query string bound — its own clients send
	 * the tenant and the organization they act in — and the handler's reader builds its tenant and
	 * organization fragment from them. This surface has no query string to bind: the connection
	 * protocol states the caller's narrowing in `filter`, which the evaluator applies to the rows the
	 * handler answered, and the scope is the credential's, so the command is dispatched with the
	 * organization the credential names and no other criterion, and with no relation beyond the ones
	 * the reader loads itself.
	 */
	@Query('tags')
	async tags(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Tag>> {
		const { items }: IPagination<ITag> = await this.commandBus.execute(
			new TagListCommand({ organizationId: this.organizationOfTheCaller() } as FindOptionsWhere<Tag>, [])
		);

		return buildConnection<Tag>({
			rows: (items ?? []) as unknown as Tag[],
			filterable: TAG_FILTERABLE,
			sortable: TAG_SORTABLE,
			defaultSort: TAG_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * The tags the caller may pick from where they act, as `GET /tags/level` answers them.
	 *
	 * The read is the route's own: `findTagsByLevel` is the second of the two readers this resource
	 * has, and it answers the rows themselves rather than the list reader's usage columns. The route
	 * takes the organization and the team from its query string; this surface takes the organization
	 * from the credential — the same value the route's own clients send — and states no team, so the
	 * caller's narrowing arrives in `filter` and the connection protocol is applied to what the reader
	 * answers, which is why both walks resume on one cursor codec.
	 */
	@Query('tagsByLevel')
	async tagsByLevel(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Tag>> {
		const { items }: IPagination<ITag> = await this.tagService.findTagsByLevel(
			{ organizationId: this.organizationOfTheCaller() },
			[]
		);

		return buildConnection<Tag>({
			rows: (items ?? []) as unknown as Tag[],
			filterable: TAG_FILTERABLE,
			sortable: TAG_SORTABLE,
			defaultSort: TAG_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One tag of the caller's tenant.
	 *
	 * A tag that is not there answers `null` rather than a refusal: GraphQL has one answer for "no such
	 * row" on a field that may have none, and the REST route's `404` is that same fact stated in the
	 * other protocol's vocabulary.
	 */
	@Query('tag')
	async tag(@Args('id', { type: () => ID }) id: Id): Promise<Tag | null> {
		try {
			return await this.tagService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many tags the caller's tenant holds.
	 *
	 * The same call the count route makes, with the same absence of narrowing. That route binds its
	 * query string to the store's own `where` and hands it to `countBy`; the connection protocol has no
	 * argument of that shape, so the field passes none and counts the caller's own rows — the tenant is
	 * applied to the criterion by the service, from the credential rather than from the caller, which
	 * is what the route's bare call counts too.
	 */
	@Query('tagCount')
	async tagCount(): Promise<number> {
		return await this.tagService.countBy();
	}

	/**
	 * Files a tag.
	 *
	 * The same service method the create route calls, with the body as stated: the tenant is stamped
	 * from the credential, so a caller states which grouping the tag carries and never which scope it
	 * is written into.
	 */
	@Mutation('createTag')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAGS_ADD)
	async createTag(@Args('input') input: ICreateTagInput): Promise<Tag> {
		return await this.tagService.create(input as unknown as Tag);
	}

	/**
	 * Changes the facts of a tag that exists.
	 *
	 * The service is the one the REST route calls, and it reads the row before it writes: a caller
	 * naming a tag of another tenant, or one that is not there, is answered with the miss the route
	 * answers with rather than with a write against a row it does not own. The identifier is the
	 * criterion and is not repeated in the payload, which is the shape the route itself has: `:id`
	 * names the row and the body carries only what changes — the delivered write updates the stated
	 * columns and leaves the rest as they are.
	 *
	 * The answer is the row the write produced, read back through the same service. The delivered route
	 * answers the store's own update result — a statement about the write, `{ affected }` — which is not
	 * a row and not what a field named `updateTag` may return.
	 */
	@Mutation('updateTag')
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAGS_EDIT)
	async updateTag(@Args('input') input: IUpdateTagInput): Promise<Tag> {
		const { id, ...values } = input;

		await this.tagService.update(id, values as unknown as QueryDeepPartialEntity<Tag>);

		return await this.tagService.findOneByIdString(id);
	}

	/**
	 * Removes a tag outright, with the pivot rows that attach it to the records it labelled.
	 */
	@Mutation('deleteTag')
	async deleteTag(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.tagService.delete(id);

		return true;
	}

	/**
	 * Withdraws a tag without removing it. No permission is stated because the delivered route states
	 * none: the soft removal is inherited from the CRUD base, where the controller's own tenant guard
	 * is the whole of its scope.
	 */
	@Mutation('softDeleteTag')
	async softDeleteTag(@Args('id', { type: () => ID }) id: Id): Promise<Tag> {
		return await this.tagService.softRemove(id);
	}

	/**
	 * Puts a withdrawn tag back. Unpermissioned for the same reason the withdrawal above is: the
	 * delivered route carries no permission to mirror.
	 */
	@Mutation('recoverTag')
	async recoverTag(@Args('id', { type: () => ID }) id: Id): Promise<Tag> {
		return await this.tagService.softRecover(id);
	}

	/**
	 * The organization the caller is acting in, as the credential names it.
	 *
	 * Both delivered readers build an organization fragment — the tags of the tenant level together with
	 * the tags of one organization — and both take that organization from their input. The delivered
	 * clients send it: the tag screen puts the organization it is showing in the query string of the
	 * list route, and the pickers put it, with the team, in the query string of the level route. A
	 * GraphQL caller states no scope at all, so the field reads the organization from the credential,
	 * which is the value every client of the route sends and the one value a caller cannot misstate —
	 * the strategy that validates the token is what put it there, against the caller's own memberships.
	 *
	 * `undefined` rather than `null` when the credential names none, and the readers treat the two the
	 * same way: the fragment then selects the tenant-level rows, which is what the same request produces
	 * on the route when it states no organization.
	 */
	private organizationOfTheCaller(): Id | undefined {
		return RequestContext.currentOrganizationId() ?? undefined;
	}
}
