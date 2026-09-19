import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { FeatureFlag } from '@gauzy/common';
import { ID as Id, IGenerateApiKey, IGenerateApiKeyResponse, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { FeatureFlagGuard, PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { FEATURE_GRAPHQL } from '../feature/graphql-feature.code';
import { TenantApiKeyService } from './tenant-api-key.service';

/** The members `GenerateTenantApiKeyInput` declares in the schema. */
export interface IGenerateTenantApiKeyInput {
	name?: string;
}

/** The members `TenantApiKeyPair` declares in the schema. */
export interface ITenantApiKeyPair {
	tenantId: Id;
	name?: string;
	apiKey: string;
	apiSecret: string;
}

/**
 * The tenant API key over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of
 * its own: the one field below calls the same `TenantApiKeyService.generateApiKey` method the
 * `/api/tenant-api-key` route calls, with the same input, and answers the pair the service built.
 *
 * **The guard chain and the permission are the controller's.** The controller carries
 * `TenantPermissionGuard` and `PermissionGuard` on the class and states `TENANT_API_KEY_CREATE` on its
 * handler, so the class here carries the same two guards beside the gate and the field states the same
 * permission. The scope of the refusal is the delivered one: an operator who may not issue a pair is
 * refused here exactly as it is refused there.
 *
 * **The tenant is not a member of the input, and that is parity rather than a narrowing.** The
 * delivered body carries a `tenantId` which its DTO validates against the caller's own membership —
 * `IsTenantBelongsToUser` compares it with the tenant of the credential and refuses every other value
 * — so the route has one legal value for that member, and the service falls back to the credential's
 * tenant when it is absent. A field that offered it would offer a choice with a single legal answer;
 * a field that omits it cannot be used to name a tenant the caller does not belong to, which is what
 * the validator is there to prevent.
 *
 * **The secret is an answer and never a member of a row.** The delivered issuance returns the secret in
 * clear text exactly once, because a secret nobody is shown is a secret nobody can use, and the field
 * answers the same object. Nothing in this schema answers key material off a stored row: the resource
 * serves no read at all, and the stored secret is a hash, so there is no second chance to read it —
 * over either protocol. That is the whole of the projection decision, and the reason the type this
 * field answers is named for the pair rather than for the row.
 *
 * **The gate is the catalogue's**: `FEATURE_GRAPHQL` is the code the commerce catalogue declares for
 * the GraphQL endpoint and its resolvers, applied once on this class so the field below is behind the
 * one capability, and appended to the guard chain the route already carries rather than replacing any
 * part of it.
 */
@Resolver('TenantApiKeyPair')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
export class TenantApiKeyResolver {
	constructor(private readonly tenantApiKeyService: TenantApiKeyService) {}

	/**
	 * Has a pair issued for the caller's own tenant.
	 *
	 * The service is the route's own and so is its behaviour, refusals included: a tenant that already
	 * holds a pair is refused, and the delivered service states that refusal itself. A refusal is
	 * surfaced rather than translated, because the delivered route's own translation to an HTTP status
	 * is the other protocol's vocabulary for the same fact.
	 */
	@Mutation('generateTenantApiKeyPair')
	@Permissions(PermissionsEnum.TENANT_API_KEY_CREATE)
	async generateTenantApiKeyPair(
		@Args('input') input: IGenerateTenantApiKeyInput
	): Promise<ITenantApiKeyPair> {
		const pair: IGenerateApiKeyResponse = await this.tenantApiKeyService.generateApiKey(
			input as unknown as IGenerateApiKey
		);

		return pair as unknown as ITenantApiKeyPair;
	}
}
