import { UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	ID as Id,
	IIntegrationEntitySetting,
	IIntegrationTenant,
	IPagination,
	PermissionsEnum,
	IntegrationEntity
} from '@gauzy/contracts';
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
import { IntegrationEntitySetting } from './integration-entity-setting.entity';
import { IntegrationEntitySettingGetCommand, IntegrationEntitySettingUpdateOrCreateCommand } from './commands';

/** One tied row as `IntegrationEntitySettingInput` declares it. */
export interface IIntegrationEntitySettingTiedInput {
	entity: IntegrationEntity;
	sync: boolean;
	integrationEntitySettingId?: Id;
	organizationId?: Id;
}

/** The members `IntegrationEntitySettingInput` declares in the schema. */
export interface IIntegrationEntitySettingInput {
	entity: IntegrationEntity;
	sync: boolean;
	integrationId?: Id;
	organizationId?: Id;
	tiedEntities?: IIntegrationEntitySettingTiedInput[];
}

/**
 * The fields a decision list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * This declaration is the resolver's half of the SDL: `IntegrationEntitySettingFilter` and
 * `IntegrationEntitySettingSortField` are its two renderings, and keeping the three in one file is what
 * makes a field that is filterable in the schema but unknown to the evaluator — or the reverse —
 * impossible to introduce quietly.
 *
 * `entity` is a `STRING` here although the schema states it as the domain's enum: the evaluator
 * compares the row's stored value, and an enum's value *is* its name, so the two agree — and a
 * comparison that went through a mapping table would be a second vocabulary to keep aligned.
 */
const INTEGRATION_ENTITY_SETTING_FILTERABLE = {
	id: 'ID',
	entity: 'STRING',
	sync: 'BOOLEAN',
	integrationId: 'ID',
	tenantId: 'ID',
	organizationId: 'ID',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const INTEGRATION_ENTITY_SETTING_SORTABLE = ['createdAt', 'updatedAt', 'entity', 'sync'] as const;

/**
 * The order the connection applies when the caller states none.
 *
 * The delivered read fixes no order of its own — it hands the store a criterion and takes the rows as
 * they come back — so this is a decision the connection has to make rather than one it reproduces: the
 * row type, which is what a decision list is read by, and then the identifier, which is the key that
 * makes the order total and a cursor walk over it stable.
 */
const INTEGRATION_ENTITY_SETTING_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'entity', direction: 'ASC' },
	{ field: 'id', direction: 'ASC' }
];

/**
 * The synchronisation decisions of a configured integration over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: both fields below dispatch the same command the `/api/integration-entity-setting` routes
 * dispatch, with the same input.
 *
 * **The permission is stated per field, and that is the parity rather than a deviation.** The
 * controller carries `INTEGRATION_ADD` and `INTEGRATION_EDIT` on the class, its read states nothing of
 * its own, and its write states `INTEGRATION_EDIT` — which the reflector resolves in place of the class
 * pair. One class-level statement here could not be both, so the read states the pair and the write
 * states the edit alone, which is exactly what each route runs under.
 *
 * **The write takes a list because a GraphQL input has one shape.** The delivered body may be a single
 * decision or an array of them, and the delivered handler folds a single object into a list before it
 * stores anything — so stating the list is the same write, and the field answers the rows the delivered
 * write answers.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so both fields below are behind the one
 * capability, and appended to the guard chain the routes already carry rather than replacing any part
 * of it.
 */
@Resolver('IntegrationEntitySetting')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class IntegrationEntitySettingResolver {
	constructor(private readonly commandBus: CommandBus) {}

	/**
	 * The decisions of one configured integration.
	 *
	 * The command is the route's own and takes the identifier the route takes in its path, so the read
	 * is the delivered one — the decisions of that integration, with the integration and the tied rows
	 * loaded beside each row. The connection then narrows, orders and pages exactly those rows.
	 */
	@Query('integrationEntitySettings')
	@Permissions(PermissionsEnum.INTEGRATION_ADD, PermissionsEnum.INTEGRATION_EDIT)
	async integrationEntitySettings(
		@Args('integrationId', { type: () => ID }) integrationId: IIntegrationTenant['id'],
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IntegrationEntitySetting>> {
		const { items }: IPagination<IntegrationEntitySetting> = await this.commandBus.execute(
			new IntegrationEntitySettingGetCommand(integrationId)
		);

		return buildConnection<IntegrationEntitySetting>({
			rows: items ?? [],
			filterable: INTEGRATION_ENTITY_SETTING_FILTERABLE,
			sortable: INTEGRATION_ENTITY_SETTING_SORTABLE,
			defaultSort: INTEGRATION_ENTITY_SETTING_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * Stores the decisions of one configured integration.
	 *
	 * The command is the route's own, with the same two arguments — the integration from the path and
	 * the decisions from the body — and it answers the rows the write stored. The answer is that list
	 * rather than the rows read back, because the delivered command's own answer is what the route
	 * answers and a second read would be a second query the route does not perform.
	 */
	@Mutation('updateIntegrationEntitySettings')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	async updateIntegrationEntitySettings(
		@Args('integrationId', { type: () => ID }) integrationId: IIntegrationTenant['id'],
		@Args('input') input: IIntegrationEntitySettingInput[]
	): Promise<IIntegrationEntitySetting[]> {
		return await this.commandBus.execute(
			new IntegrationEntitySettingUpdateOrCreateCommand(
				integrationId,
				input as unknown as IIntegrationEntitySetting | IIntegrationEntitySetting[]
			)
		);
	}
}
