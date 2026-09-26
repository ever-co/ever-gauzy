import { NotFoundException, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import {
	BaseEntityEnum,
	ID as Id,
	IPagination,
	IResourceLinkCreateInput,
	IResourceLinkUpdateInput
} from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { BaseQueryDTO } from '../core/crud';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { ResourceLink } from './resource-link.entity';
import { ResourceLinkService } from './resource-link.service';
import { ResourceLinkCreateCommand, ResourceLinkUpdateCommand } from './commands';

/** The members `CreateResourceLinkInput` declares in the schema. */
export interface ICreateResourceLinkInput {
	organizationId: Id;
	entity: BaseEntityEnum | string;
	entityId: Id;
	title: string;
	url: string;
	metaData?: unknown;
	employeeId?: Id;
}

/** The members `UpdateResourceLinkInput` declares in the schema. */
export interface IUpdateResourceLinkInput extends Partial<ICreateResourceLinkInput> {
	id: Id;
}

/**
 * The fields a link list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `ResourceLinkFilter` and
 * `ResourceLinkSortField` are its two renderings, and keeping the three in one file is what makes a
 * field that is filterable in the schema but unknown to the evaluator — or the reverse — impossible
 * to introduce quietly.
 *
 * `metaData` is `JSON` because the column is a document on the production dialects and text on the
 * embedded one, and a document is narrowed by containment rather than by a string operator.
 */
const RESOURCE_LINK_FILTERABLE = {
	id: 'ID',
	organizationId: 'ID',
	entity: 'STRING',
	entityId: 'ID',
	title: 'STRING',
	url: 'STRING',
	metaData: 'JSON',
	employeeId: 'ID',
	isActive: 'BOOLEAN',
	isArchived: 'BOOLEAN',
	deletedAt: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const RESOURCE_LINK_SORTABLE = ['createdAt', 'updatedAt', 'title', 'entity'] as const;

/**
 * The order the connection answers in when the caller states none.
 *
 * The delivered list method applies no order of its own, so this is a decision the connection has to
 * make rather than one it reproduces: newest first, because a reading list grows at the end, then the
 * identifier, which is the key that makes the order total and a cursor walk over it stable.
 */
const RESOURCE_LINK_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * The resource link over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: every field below reaches the same `ResourceLinkService` method, or dispatches the same
 * command, that the `/api/resource-link` routes reach.
 *
 * **The guard chain is the controller's, and no permission is stated anywhere.** The controller
 * carries `TenantPermissionGuard` and `PermissionGuard` on the class and states no `@Permissions` on
 * its class or on any route it inherits, so this class carries those two guards and the gate below
 * and nothing else — no permission on the class and none on a field. A permission here would refuse
 * a caller the REST route serves, and tightening the resource is a change to make in both places at
 * once.
 *
 * **The writes are dispatched as commands, because that is what the routes dispatch.** The creation
 * and the edit reach the service through the same command bus the two REST handlers use, so the
 * activity log the service writes for each is written once, for the same reason and with the same
 * detail, whichever protocol the caller reached for.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once here so every field below is behind the one
 * capability. `FeatureFlagGuard` reads that code from `FEATURE_METADATA`, over the handler and then
 * the class, which is why the gate is stated on the class rather than restated on each field — and
 * why it is appended to the guard chain the routes below already carry rather than replacing any
 * part of it.
 */
@Resolver('ResourceLink')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class ResourceLinkResolver {
	constructor(
		private readonly resourceLinkService: ResourceLinkService,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * The links of the caller's tenant, newest first.
	 */
	@Query('resourceLinks')
	async resourceLinks(
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
	): Promise<GraphqlConnection<ResourceLink>> {
		// The delivered list route hands the service the query DTO it bound from the query string. This
		// surface has no query string to bind, so the read runs with the route's own defaults — no
		// criterion, no relations, no page — and the connection protocol's `filter` narrows the rows the
		// service returns, including the polymorphic pair a client narrows by.
		const options = { ...(withDeleted ? { withDeleted: true } : {}) } as BaseQueryDTO<ResourceLink>;
		const { items }: IPagination<ResourceLink> = await this.resourceLinkService.findAll(options);

		return buildConnection<ResourceLink>({
			rows: items ?? [],
			filterable: RESOURCE_LINK_FILTERABLE,
			sortable: RESOURCE_LINK_SORTABLE,
			defaultSort: RESOURCE_LINK_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * One link of the caller's tenant.
	 *
	 * A link that is not there answers `null` rather than a refusal: GraphQL has one answer for
	 * "no such row" on a field that may have none, and the REST route's `404` is that same fact stated
	 * in the other protocol's vocabulary.
	 */
	@Query('resourceLink')
	async resourceLink(@Args('id', { type: () => ID }) id: Id): Promise<ResourceLink | null> {
		try {
			return await this.resourceLinkService.findOneByIdString(id);
		} catch (error) {
			if (error instanceof NotFoundException) {
				return null;
			}

			throw error;
		}
	}

	/**
	 * How many links the caller's tenant holds.
	 */
	@Query('resourceLinkCount')
	async resourceLinkCount(): Promise<number> {
		return await this.resourceLinkService.countBy();
	}

	/**
	 * Files a link through the same command the REST route dispatches.
	 *
	 * The author is not stated by this field any more than it is honoured by the route: the delivered
	 * service takes the caller's own employee from the request context and falls back to the body only
	 * when the credential carries none.
	 */
	@Mutation('createResourceLink')
	async createResourceLink(@Args('input') input: ICreateResourceLinkInput): Promise<ResourceLink> {
		return await this.commandBus.execute(
			new ResourceLinkCreateCommand(input as unknown as IResourceLinkCreateInput)
		);
	}

	/**
	 * Changes a link through the same command the REST route dispatches.
	 */
	@Mutation('updateResourceLink')
	async updateResourceLink(@Args('input') input: IUpdateResourceLinkInput): Promise<ResourceLink> {
		const { id, ...values } = input;

		return await this.commandBus.execute(
			new ResourceLinkUpdateCommand(id, values as unknown as IResourceLinkUpdateInput)
		);
	}

	/**
	 * Removes a link outright.
	 */
	@Mutation('deleteResourceLink')
	async deleteResourceLink(@Args('id', { type: () => ID }) id: Id): Promise<boolean> {
		await this.resourceLinkService.delete(id);

		return true;
	}

	/**
	 * Withdraws a link: the row is marked rather than removed, and the recovery below reads it back.
	 */
	@Mutation('softDeleteResourceLink')
	async softDeleteResourceLink(@Args('id', { type: () => ID }) id: Id): Promise<ResourceLink> {
		return await this.resourceLinkService.softRemove(id);
	}

	/**
	 * Puts a withdrawn link back, clearing the marker the withdrawal set.
	 */
	@Mutation('recoverResourceLink')
	async recoverResourceLink(@Args('id', { type: () => ID }) id: Id): Promise<ResourceLink> {
		return await this.resourceLinkService.softRecover(id);
	}
}
