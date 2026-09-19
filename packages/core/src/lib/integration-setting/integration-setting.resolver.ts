import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IIntegrationSetting, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { IntegrationSetting } from './integration-setting.entity';
import { IntegrationSettingService } from './integration-setting.service';

/** The members `UpdateIntegrationSettingInput` declares in the schema. */
export interface IUpdateIntegrationSettingInput {
	id: Id;
	organizationId?: Id;
	settingsValue: string;
}

/**
 * The credentials of a configured integration over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: the one field below performs the same two steps the `/api/integration-setting` route performs,
 * against the same service.
 *
 * **The guard chain is the controller's and the permission is the route's own.** The controller carries
 * `TenantPermissionGuard` and `PermissionGuard` on the class, so the class here carries them beside the
 * gate; and its handler states `INTEGRATION_EDIT` on itself, overriding the class-level pair, so the
 * field states `INTEGRATION_EDIT` and the class states no permission at all. Restating the class pair
 * here would put a permission on this surface that the route does not run under.
 *
 * **The value is written and never answered.** The delivered route is an upsert: it calls the service's
 * `create` with the path identifier inside the body and then answers the row read back. The field does
 * the same, and the type it answers deliberately carries no member for the stored value — the row's
 * value is the cleartext the delivered projection masks, and a member for it would resolve off the
 * entity property rather than off the masked serialization.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for the
 * GraphQL endpoint and its resolvers, applied once here so the field below is behind the one
 * capability, and appended to the guard chain the route already carries rather than replacing any part
 * of it.
 */
@Resolver('IntegrationSetting')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class IntegrationSettingResolver {
	constructor(private readonly integrationSettingService: IntegrationSettingService) {}

	/**
	 * Stores one credential under the identifier the caller states.
	 *
	 * The two steps are the route's own and in the route's own order: the write travels through the
	 * service's `create`, which persists the body under the identifier it carries, and the answer is the
	 * row read back through the same service — so the field answers the credential as it now stands
	 * rather than the store's own write result.
	 *
	 * A refusal is surfaced rather than translated: the delivered route's translation into a `400` is
	 * the other protocol's vocabulary for the same fact.
	 */
	@Mutation('updateIntegrationSetting')
	@Permissions(PermissionsEnum.INTEGRATION_EDIT)
	async updateIntegrationSetting(
		@Args('input') input: IUpdateIntegrationSettingInput
	): Promise<IntegrationSetting> {
		const { id, ...values } = input;

		await this.integrationSettingService.create({ ...values, id } as unknown as IIntegrationSetting);

		return await this.integrationSettingService.findOneByIdString(id);
	}
}
