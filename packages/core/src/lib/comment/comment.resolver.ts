import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ICommentCreateInput, ICommentUpdateInput, ID as Id, IPagination } from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
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
import { Comment } from './comment.entity';
import { CommentService } from './comment.service';
import { CommentCreateCommand, CommentUpdateCommand } from './commands';

/** The members `CreateCommentInput` declares in the schema. */
export interface ICreateCommentInput {
	comment: string;
	entity: string;
	entityId: Id;
	organizationId: Id;
	actorType?: string;
	resolved?: boolean;
	resolvedAt?: Date;
	editedAt?: Date;
	employeeId?: Id;
	resolvedByEmployeeId?: Id;
	parentId?: Id;
	mentionEmployeeIds?: Id[];
	entityName?: string;
	isActive?: boolean;
	isArchived?: boolean;
	archivedAt?: Date;
}

/** The members `UpdateCommentInput` declares in the schema. */
export interface IUpdateCommentInput {
	id: Id;
	comment?: string;
	organizationId?: Id;
	actorType?: string;
	resolved?: boolean;
	resolvedAt?: Date;
	editedAt?: Date;
	employeeId?: Id;
	resolvedByEmployeeId?: Id;
	parentId?: Id;
	mentionEmployeeIds?: Id[];
	entityName?: string;
	isActive?: boolean;
	isArchived?: boolean;
	archivedAt?: Date;
}

/**
 * The fields a comment list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `CommentFilter` and `CommentSortField` are its
 * two renderings, and keeping the three in one file is what makes a field that is filterable in the
 * schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * Every member is a column of the comment row, which is why the set is what it is: the delivered list
 * read answers the row itself and joins only the relations a REST caller names in its query string —
 * which this surface never names — so each member here narrows the rows the connection was handed
 * rather than a collection a reader would have had to load. `parentId` is the member that carries the
 * tree: it is the filter the replies of one comment are read by, and the filter the comments that
 * start a conversation are read by. The two pivots the row owns are deliberately absent from both
 * lists, for the reason the object type states.
 */
const COMMENT_FILTERABLE = {
	id: 'ID',
	comment: 'STRING',
	actorType: 'STRING',
	resolved: 'BOOLEAN',
	resolvedAt: 'DATE',
	editedAt: 'DATE',
	entity: 'STRING',
	entityId: 'ID',
	parentId: 'ID',
	resolvedByEmployeeId: 'ID',
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
const COMMENT_SORTABLE = [
	'id',
	'entity',
	'entityId',
	'resolved',
	'editedAt',
	'resolvedAt',
	'createdAt',
	'updatedAt',
	'deletedAt'
] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered list method states no order of its own — it hands the store a criterion and takes the
 * rows as they come back — so this is the platform's own: newest first, with the identifier as the last
 * key so that two comments posted in the same millisecond still have one order between them, which is
 * what makes a cursor walk over them total.
 */
const COMMENT_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The comment over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below calls the same `CommentService` method, or dispatches the same command,
 * that the `/api/comment` routes call.
 *
 * **The guard chain is the controller's, and no permission is stated anywhere — not even on a field.**
 * The delivered controller carries `TenantPermissionGuard` and `PermissionGuard` on the class and no
 * `@Permissions` at all: not on the five routes it declares and not on the four it inherits from the
 * CRUD base. Every one of its routes is therefore tenant-guarded and otherwise unpermissioned, and a
 * field that demanded a permission would refuse a caller the REST route serves — the asymmetry the
 * two-protocol rule forbids. Tightening the resource is a change to make in both places at once, and it
 * is not this delivery's to make.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then the
 * class, which is why the gate is stated on the class rather than restated on each field — and why it
 * is appended to the guard chain the routes below already carry rather than replacing any part of it.
 */
@Resolver('Comment')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class CommentResolver {
	constructor(
		private readonly commentService: CommentService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The comments of the caller's tenant, newest first.
	 */
	@Query('comments')
	async comments(
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
	): Promise<GraphqlConnection<Comment>> {
		// The delivered list route binds `params` out of its query string and hands the service that
		// object — its own narrowing and the relations its caller names. This surface has no query string
		// to bind and names no relation: the connection protocol states the narrowing in `filter`, which
		// is applied to the rows the service returns, so the read runs with the route's own defaults — no
		// criterion and no joined collection. The tenant is applied to the criterion by the service, from
		// the credential rather than from the caller.
		const { items }: IPagination<Comment> = await this.commentService.findAll({ ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<Comment>);

		return buildConnection<Comment>({
			rows: items ?? [],
			filterable: COMMENT_FILTERABLE,
			sortable: COMMENT_SORTABLE,
			defaultSort: COMMENT_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One comment of the caller's tenant.
	 *
	 * A comment that is not there answers `null` rather than a refusal: GraphQL has one answer for "no
	 * such row" on a field that may have none, and the REST route's `404` is that same fact stated in
	 * the other protocol's vocabulary.
	 *
	 * The route's own read passes the query string through as find options, which is the one thing a
	 * REST caller uses to name relations; this surface names none and asks the same method for the row
	 * with the route's own default — an empty option object.
	 */
	@Query('comment')
	async comment(@Args('id', { type: () => ID }) id: Id): Promise<Comment | null> {
		try {
			return await this.commentService.findOneByIdString(id, {} as FindOptionsQueryDTO<Comment>);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many comments the caller's tenant records.
	 *
	 * The same call the count route makes when it is given no query string, and the same absence of
	 * narrowing: that route binds its query string to the store's own `where` and hands it to `countBy`,
	 * and the connection protocol has no argument of that shape, so the field passes none and counts the
	 * caller's own rows.
	 */
	@Query('commentCount')
	async commentCount(): Promise<number> {
		return await this.commentService.countBy();
	}

	/**
	 * Posts a comment.
	 *
	 * The write is dispatched as the same command the REST route dispatches, carrying the same body, so
	 * the two surfaces publish the same mentions and record the same author for the same caller: the
	 * author and the tenant are resolved from the credential inside the handler, and a body that states
	 * neither still posts a comment the caller owns.
	 *
	 * The body is handed on as the contract's own input. The two members the schema carries as text —
	 * `entity` and `actorType` — are the kernel's `BaseEntityEnum` and `ActorTypeEnum` values, and the
	 * cast is where the schema's open string meets that vocabulary: the delivered route makes the same
	 * reading through its DTO, which declares them as the entity's own members.
	 */
	@Mutation('createComment')
	async createComment(@Args('input') input: ICreateCommentInput): Promise<Comment> {
		return await this.commandBus.execute(new CommentCreateCommand(input as unknown as ICommentCreateInput));
	}

	/**
	 * Edits a comment.
	 *
	 * The delivered route carries the identifier in the path and the body beside it, and the command it
	 * dispatches holds the two as separate members; this field dispatches the same command with the same
	 * pair. The handler is what proves the caller may edit this comment — the author, or a holder of the
	 * kernel's change-selected-employee permission — so a comment of somebody else is refused rather
	 * than rewritten.
	 *
	 * The body is handed on as the contract's own input, for the reason the create states: `actorType` is
	 * the kernel's `ActorTypeEnum` and the schema carries it as its string value.
	 *
	 * **The answer is the row read back through the same service the reads call, not the handler's own.**
	 * The handler answers the store's update result — a statement about the write, `{ affected }` — which
	 * is not a row and not what a field declared `Comment!` may return. Reading the row back is what makes
	 * the answer the same shape the route's own caller gets from its follow-up read, and it is the shape
	 * every delivered edit of this form answers with.
	 */
	@Mutation('updateComment')
	async updateComment(@Args('input') input: IUpdateCommentInput): Promise<Comment> {
		await this.commandBus.execute(new CommentUpdateCommand(input.id, input as unknown as ICommentUpdateInput));

		return await this.commentService.findOneByIdString(input.id, {} as FindOptionsQueryDTO<Comment>);
	}

	/**
	 * Removes a comment outright, together with the mention rows that point at it.
	 *
	 * The service is the one the REST route calls, and it refuses a caller naming a row of another
	 * tenant rather than reporting a deletion that did not happen; the field answers whether the removal
	 * happened rather than the removed row, because the delivered route answers the store's delete
	 * result.
	 */
	@Mutation('deleteComment')
	async deleteComment(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.commentService.delete(id);

		return true;
	}

	/**
	 * Withdraws a comment: the row is marked rather than removed, so the replies that point at it keep
	 * their parent, and the recovery below reads it back.
	 */
	@Mutation('softDeleteComment')
	async softDeleteComment(@Args('id', { type: () => ID }) id: Id): Promise<Comment> {
		return await this.commentService.softRemove(id);
	}

	/**
	 * Puts a withdrawn comment back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverComment')
	async recoverComment(@Args('id', { type: () => ID }) id: Id): Promise<Comment> {
		return await this.commentService.softRecover(id);
	}
}
