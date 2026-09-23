import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID, IPagination } from '@gauzy/contracts';
import {
	FeatureFlagGuard,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	Versioned
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { EntitlementService } from '../../entitlement/entitlement.service';
import { EntitlementKey } from '../../entitlement-key/entitlement-key.entity';
import { EntitlementKeyService } from '../../entitlement-key/entitlement-key.service';
import { EntitlementKeyStatus } from '../../entitlement.enums';
import { EntitlementPermissions } from '../../entitlement.permissions';
import { IEntitlementKeyIssueInput } from '../../entitlement.types';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { toUserError } from '../wire';

/** The filter the keys connection accepts. */
interface IEntitlementKeyFilter {
	entitlementId?: ID;
	status?: EntitlementKeyStatus;
	assignedToEmail?: string;
	assignedToCustomerId?: ID;
}

/**
 * Licence keys, over GraphQL.
 *
 * The one field that carries key material is `issueEntitlementKey`, and it carries it once: the
 * schema declares no way to read a key back, so a client that loses one re-issues it, and the
 * previous key is revoked in the same transaction.
 *
 * **The gate is the catalogue's.** `FeatureFlagGuard` is appended to the guard chain this resolver
 * already carried, and the code it reads is `FEATURE_GRAPHQL` — the commerce catalogue's entry for "the
 * GraphQL endpoint and its resolvers, under the same guards and permissions as REST". The code is
 * imported rather than restated because the value has to agree with the catalogue's `code` and nothing
 * checks one string against another: a literal that drifted names a code no catalogue row carries, which
 * the guard resolves as disabled, so every field here would answer `Cannot query field <name>` for every
 * caller with nothing red anywhere. One statement on the class puts every field behind it, and a tenant
 * that switched the capability off is answered the refusal a disabled capability's routes answer with a
 * 404.
 */
@Resolver('EntitlementKey')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
export class EntitlementKeyResolver {
	constructor(private readonly entitlementKeyService: EntitlementKeyService) {}

	/**
	 * Lists issued credentials.
	 *
	 * @param filter The key filter.
	 * @param page The page.
	 * @param withDeleted Whether retired rows are included.
	 * @returns One page of keys.
	 */
	@Versioned({ resource: EntitlementService, write: false })
	@Query('entitlementKeys')
	async entitlementKeys(
		@Args('filter') filter?: IEntitlementKeyFilter,
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
		const { skip, take } = resolvePageWindow(page);
		const result = await this.entitlementKeyService.findAll({
			where: {
				...(filter?.entitlementId ? { entitlementId: filter.entitlementId } : {}),
				...(filter?.status ? { status: filter.status } : {}),
				...(filter?.assignedToEmail ? { assignedToEmail: filter.assignedToEmail } : {}),
				...(filter?.assignedToCustomerId ? { assignedToCustomerId: filter.assignedToCustomerId } : {})
			},
			skip,
			take,
			order: { createdAt: 'DESC' },
			...(withDeleted ? { withDeleted: true } : {})
		} as any);

		return buildConnection(result as IPagination<EntitlementKey>, skip);
	}

	/**
	 * Issues a credential.
	 *
	 * The retry scope is `entitlement_key.issue`, which the key route declares as well: the two reach
	 * one operation differently — the right comes from the path there and from the input here — so a
	 * client that lost the response gets the same credential back rather than a second one, and a retry
	 * of one surface can never replay the other's answer because the fingerprint includes the path.
	 *
	 * @param input The right, the format and the holder.
	 * @returns The payload, carrying the plaintext once.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_GRANT)
	@Idempotent({ scope: 'entitlement_key.issue', required: false, resourceType: 'entitlement_key' })
	@Mutation('issueEntitlementKey')
	async issueEntitlementKey(@Args('input') input: IEntitlementKeyIssueInput) {
		try {
			const result = await this.entitlementKeyService.issue(input);

			return { key: result.key, plaintextKey: result.plaintext, userErrors: [] };
		} catch (error) {
			return { key: null, plaintextKey: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Withdraws a credential, releasing the activations it was used for.
	 *
	 * @param id The key.
	 * @param reason Why.
	 * @returns The payload.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Mutation('revokeEntitlementKey')
	async revokeEntitlementKey(@Args('id') id: ID, @Args('reason') reason: string) {
		try {
			return { key: await this.entitlementKeyService.revoke(id, reason), userErrors: [] };
		} catch (error) {
			return { key: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Retires a credential recoverably, leaving the row in place.
	 *
	 * The route it mirrors is `DELETE /entitlement-keys/:id/soft`, inherited from `CrudController` and
	 * overridden by this plugin's controller only to state the permission the base left unstated. The
	 * field matters more here than elsewhere: `revokeEntitlementKey` is the only other way to end a key
	 * over GraphQL, it releases the activations the key was used for, and it is irreversible — so
	 * without this pair a key retired by mistake could not be brought back, while a REST caller could
	 * retire one without touching a single activation.
	 *
	 * The permission is the route's own, `ENTITLEMENTS_EDIT`, the grant the revoke and re-issue routes
	 * already carry, and not the class-level view grant.
	 *
	 * @param id The key.
	 * @returns The payload, carrying the key as the soft delete left it.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Mutation('softDeleteEntitlementKey')
	async softDeleteEntitlementKey(@Args('id') id: ID) {
		try {
			return { key: await this.entitlementKeyService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { key: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a credential that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /entitlement-keys/:id/recover`. A restored key is one a customer can
	 * present again, which is why the route states the destructive grant rather than the issuing one —
	 * and why this field states `ENTITLEMENTS_EDIT` too.
	 *
	 * @param id The key.
	 * @returns The payload, carrying the restored key.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Mutation('recoverEntitlementKey')
	async recoverEntitlementKey(@Args('id') id: ID) {
		try {
			return { key: await this.entitlementKeyService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { key: null, userErrors: [toUserError(error)] };
		}
	}
}
