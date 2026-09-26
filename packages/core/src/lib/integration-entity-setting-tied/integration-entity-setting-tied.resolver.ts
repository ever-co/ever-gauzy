import { UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import {
	ID as Id,
	IIntegrationEntitySettingTied,
	IIntegrationTenant,
	IntegrationEntity,
	PermissionsEnum
} from '@gauzy/contracts';
import { FeatureFlag } from '@gauzy/common';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { IntegrationEntitySettingTied } from './integration-entity-setting-tied.entity';
import { IntegrationEntitySettingTiedUpdateCommand } from './commands';

/** The members `IntegrationEntitySettingTiedInput` declares in the schema. */
export interface IIntegrationEntitySettingTiedInput {
	entity: IntegrationEntity;
	sync: boolean;
	integrationEntitySettingId?: Id;
	organizationId?: Id;
}

/**
 * The tied decisions of a configured integration over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: the one field below dispatches the same command the
 * `/api/integration-entity-setting-tied` route dispatches, with the same two arguments.
 *
 * **The guard chain and the permission are the controller's.** The controller carries
 * `TenantPermissionGuard` and `PermissionGuard` beside `INTEGRATION_EDIT` on the class, and its handler
 * states nothing of its own, so the class here carries the two guards beside the gate and the field
 * states the same permission.
 *
 * **The answer is the list the delivered handler produces.** The route annotates its answer as a single
 * tied row, while the delivered handler stores an array — it folds a single object into a list before it
 * saves anything, and the store answers what it saved. The field states the list, which is the answer
 * the route actually produces.
 *
 * **The field mirrors a dispatch that has no handler registered today, and that is deliberate.**
 * `IntegrationEntitySettingTiedModule` does not declare the handler of
 * `IntegrationEntitySettingTiedUpdateCommand` among its providers, so the delivered route answers the
 * command bus's own refusal. The field reproduces that refusal instead of reaching the service the
 * handler would have called: a surface that served the write REST cannot would be exactly the asymmetry
 * between the two protocols that this delivery exists to prevent, and the day the registration lands
 * both surfaces start working together, with no change here.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so the field below is behind the one capability,
 * and appended to the guard chain the route already carries rather than replacing any part of it.
 */
@Resolver('IntegrationEntitySettingTied')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(PermissionsEnum.INTEGRATION_EDIT)
export class IntegrationEntitySettingTiedResolver {
	constructor(private readonly commandBus: CommandBus) {}

	/**
	 * Stores the tied decisions of one configured integration.
	 *
	 * The command is the route's own, with the same two arguments: the integration the route takes in its
	 * path, and the rows the route binds from its body — which may be one row or a list of them, and is
	 * stated here as the list the delivered handler folds it into.
	 */
	@Mutation('updateIntegrationEntitySettingsTied')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	async updateIntegrationEntitySettingsTied(
		@Args('integrationId', { type: () => ID }) integrationId: IIntegrationTenant['id'],
		@Args('input') input: IIntegrationEntitySettingTiedInput[]
	): Promise<IIntegrationEntitySettingTied[]> {
		return await this.commandBus.execute(
			new IntegrationEntitySettingTiedUpdateCommand(
				integrationId,
				input as unknown as IIntegrationEntitySettingTied | IIntegrationEntitySettingTied[]
			)
		);
	}
}
