import { UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { ID as Id, IIntegrationFilter, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { FeatureFlag } from '@gauzy/common';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { Integration } from './integration.entity';
import { IntegrationType } from './integration-type.entity';
import { IntegrationGetCommand, IntegrationTypeGetCommand } from './commands';

/**
 * The fields a catalogue list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `IntegrationFilter` and `IntegrationSortField`
 * are its two renderings, and keeping the three in one file is what makes a field that is filterable in
 * the schema but unknown to the evaluator — or the reverse — impossible to introduce quietly.
 *
 * `isPaid` is deliberately absent, and the reason is a root-field argument rather than an evaluator's
 * limitation: the delivered read takes the paid flag as a member of its own filter object, so the field
 * states it as `isPaid` and a second spelling here would be a second answer that could disagree.
 */
const INTEGRATION_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	provider: 'STRING',
	redirectUrl: 'STRING',
	version: 'STRING',
	docUrl: 'STRING',
	order: 'NUMBER',
	isComingSoon: 'BOOLEAN',
	isFreeTrial: 'BOOLEAN',
	freeTrialPeriod: 'NUMBER',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the catalogue sort enum offers. */
const INTEGRATION_SORTABLE = [
	'createdAt',
	'updatedAt',
	'name',
	'provider',
	'order',
	'isComingSoon',
	'isFreeTrial',
	'version'
] as const;

/**
 * The order the catalogue connection means when the caller states none.
 *
 * The delivered read fixes one order of its own — `order` ascending, which is the position the
 * catalogue places an entry in — so the connection reproduces it rather than inventing a second one,
 * and adds the identifier as the last key: that is the key that makes the order total, which is what a
 * cursor needs in order to name a row rather than a position among equals.
 */
const INTEGRATION_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'order', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/** The fields a facet list may be filtered and sorted by. */
const INTEGRATION_TYPE_FILTERABLE = {
	id: 'ID',
	name: 'STRING',
	description: 'STRING',
	icon: 'STRING',
	groupName: 'STRING',
	order: 'NUMBER',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the facet sort enum offers. */
const INTEGRATION_TYPE_SORTABLE = ['createdAt', 'updatedAt', 'name', 'groupName', 'order'] as const;

/**
 * The order the facet connection means when the caller states none: the position the catalogue places
 * a facet in, then the identifier, which is the key that makes the order total.
 */
const INTEGRATION_TYPE_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'order', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The integration catalogue over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below dispatches the same command the `/api/integration` routes dispatch, with the
 * same input.
 *
 * **The guard chain and the permission are the controller's.** The controller carries
 * `TenantPermissionGuard` and `PermissionGuard` beside `INTEGRATION_VIEW` on the class, and neither
 * handler states a permission of its own, so both fields state `INTEGRATION_VIEW` and the class
 * carries the two guards: a field is never narrower or wider than the route it mirrors.
 *
 * **The delivered read's filter object is an argument of the field, not a member of the connection's
 * filter.** `GET /api/integration` takes `integrationTypeId`, `searchQuery` and the paid flag and hands
 * them to the store — the facet membership through a join, the name through a prefix match — and the
 * connection protocol's filter evaluates over the rows a read returned. A relation membership is not a
 * column of the row, so stating it as an argument is what keeps the two protocols answering from the
 * same read rather than from two similar ones.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so both fields below are behind the one
 * capability, and appended to the guard chain the routes already carry rather than replacing any part
 * of it.
 */
@Resolver('Integration')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.INTEGRATION_VIEW)
export class IntegrationResolver {
	constructor(private readonly commandBus: CommandBus) {}

	/**
	 * The integration catalogue, as the delivered list route answers it.
	 *
	 * The command is the route's own, with the input its own query parameter carries: the facet to read
	 * through, the name prefix and the paid flag. The delivered handler matches the facet through the
	 * join and the name through a prefix, which is why those three travel to the store rather than being
	 * applied to its answer — and the connection then narrows, orders and pages exactly the rows that
	 * read returned.
	 */
	@Query('integrations')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async integrations(
		@Args('integrationTypeId', { type: () => ID, nullable: true }) integrationTypeId?: Id,
		@Args('searchQuery', { type: () => String, nullable: true }) searchQuery?: string,
		@Args('isPaid', { type: () => Boolean, nullable: true }) isPaid?: boolean,
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<Integration>> {
		// The delivered filter object states the paid flag as text — its own handler compares it with
		// `'true'` and `'false'` — and narrows only when one of those two is what it holds. A caller
		// that states neither asks for the flag to be ignored, which is the empty member.
		const input = {
			integrationTypeId,
			searchQuery,
			filter: isPaid === undefined || isPaid === null ? undefined : String(isPaid)
		} as IIntegrationFilter;

		const rows: Integration[] = (await this.commandBus.execute(new IntegrationGetCommand(input))) ?? [];

		return buildConnection<Integration>({
			rows,
			filterable: INTEGRATION_FILTERABLE,
			sortable: INTEGRATION_SORTABLE,
			defaultSort: INTEGRATION_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * The facets of the catalogue, as the delivered types route answers them.
	 *
	 * The command is the route's own and reads the whole table in the order the catalogue places its
	 * facets; the connection narrows, orders and pages the rows that read returned, and its default
	 * order reproduces the delivered one.
	 */
	@Query('integrationTypes')
	@Permissions(PermissionsEnum.INTEGRATION_VIEW)
	async integrationTypes(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IntegrationType>> {
		const rows: IntegrationType[] = (await this.commandBus.execute(new IntegrationTypeGetCommand())) ?? [];

		return buildConnection<IntegrationType>({
			rows,
			filterable: INTEGRATION_TYPE_FILTERABLE,
			sortable: INTEGRATION_TYPE_SORTABLE,
			defaultSort: INTEGRATION_TYPE_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}
}
