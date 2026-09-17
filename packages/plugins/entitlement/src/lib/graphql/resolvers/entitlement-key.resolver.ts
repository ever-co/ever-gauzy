import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID, IPagination } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard } from '@gauzy/core';
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
 */
@Resolver('EntitlementKey')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
export class EntitlementKeyResolver {
	constructor(private readonly entitlementKeyService: EntitlementKeyService) {}

	/**
	 * Lists issued credentials.
	 *
	 * @param filter The key filter.
	 * @param page The page.
	 * @returns One page of keys.
	 */
	@Query('entitlementKeys')
	async entitlementKeys(@Args('filter') filter?: IEntitlementKeyFilter, @Args('page') page?: IPageSelection) {
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
			order: { createdAt: 'DESC' }
		} as any);

		return buildConnection(result as IPagination<EntitlementKey>, skip);
	}

	/**
	 * Issues a credential.
	 *
	 * @param input The right, the format and the holder.
	 * @returns The payload, carrying the plaintext once.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_GRANT)
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
}
