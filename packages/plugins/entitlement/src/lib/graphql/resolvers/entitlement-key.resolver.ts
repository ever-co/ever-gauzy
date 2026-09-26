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
import { EntitlementFeatures } from '../../entitlement.features';
import { EntitlementService } from '../../entitlement/entitlement.service';
import { EntitlementKey } from '../../entitlement-key/entitlement-key.entity';
import { EntitlementKeyService } from '../../entitlement-key/entitlement-key.service';
import { EntitlementKeyStatus } from '../../entitlement.enums';
import { EntitlementPermissions } from '../../entitlement.permissions';
import {
	IEntitlementKeyAssignInput,
	IEntitlementKeyIssueInput,
	IEntitlementKeyReissueInput
} from '../../entitlement.types';
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
 * Two fields carry key material, each exactly once, in the response to the call that created the
 * credential: `issueEntitlementKey` for an issuance and `reissueEntitlementKey` for a replacement.
 *
 * **No field reads a key back, and that refusal is the specifications'.** `11-customers-b2b-and-subscriptions-spec.md`
 * §9.1 states it where it defines the resource — "a key is shown once, at issue";
 * `02-commerce-domain-model.md` §4.8 E4 makes it an invariant — "A licence key is issued at most once per
 * entitlement key slot, is stored hashed, and is never returned again after its single reveal";
 * `05-database-schema-spec.md` §19.3 says the plaintext "leaves the service exactly once, in the
 * response to the issuance call, and never appears in a log, an export or an event payload"; and
 * `13-migration-and-rollout-plan.md`'s risk register names the opposite as the risk to manage — "An
 * issued licence key is exposed — logged, returned more than once, or stored in clear text — turning an
 * entitlement into a credential leak." `POST /entitlement-keys/:id/reveal`, which decrypts the stored
 * ciphertext and answers the plaintext a second time, is therefore deliberately not mirrored. The
 * counter-argument is recorded rather than hidden: §19.3 also defines `keyCiphertext` as existing "so
 * support can re-display it", ADR-50 describes a key as stored "so it can be verified rather than read
 * back where the format allows", and the service implements both the column and the route — so an
 * owner who reads those as the governing words wants one more field, `revealEntitlementKey(id: ID!)`
 * answering the decrypted key under `ENTITLEMENTS_GRANT`, with no version and no retry scope, exactly as
 * the route declares.
 *
 * A client that loses a key therefore re-issues it, and the field for that is `reissueEntitlementKey`,
 * which reaches the one service method that revokes the previous credential in the same transaction and
 * links the pair. `issueEntitlementKey` is **not** that operation: it mints another credential against
 * the same right without revoking the first — the service's `issue` carries no live-key guard at all —
 * which is why the two are separate fields rather than one.
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
 *
 * **The plugin's own gate stands beside it.** The class also declares `EntitlementFeatures.ENTITLEMENT`
 * (`FEATURE_ENTITLEMENT`), the code every entitlement REST controller declares with `@FeatureFlag`, so a
 * tenant that switched entitlement off is refused here exactly as its routes refuse it — rather than finding
 * every write the routes withhold still served over GraphQL. The two codes are two questions, both of which
 * must be answered yes: the endpoint is on, and the capability is on. The platform's decorator accumulates
 * the codes stated on one target and `FeatureFlagGuard` requires every one of them.
 */
@Resolver('EntitlementKey')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(EntitlementFeatures.ENTITLEMENT)
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
	 * Records who holds an issued credential.
	 *
	 * The route it mirrors is `PUT /entitlement-keys/:id`, and it is an **assignment**, not an update of
	 * the key: its body is `AssignEntitlementKeyDTO`, which states one member, and the service method it
	 * reaches is `assign`. A field named `updateEntitlementKey` would be a different capability — a
	 * partial write over the key's prefix, format, status, per-key limit, expiry and extras — and
	 * `05-database-schema-spec.md` §19.3 closes that: "a key is never re-assigned to a second holder —
	 * reassignment is a new key, so 'who was given key X' has one answer forever". The DTO's own
	 * docstring says the same from the other side ("the digest, the ciphertext and the state are
	 * closed"). So this field carries the one member the route carries, and the service enforces the
	 * rest: a key already naming a different holder is refused with `ENTITLEMENT_KEY_ALREADY_ASSIGNED`
	 * rather than reassigned, and `assignedAt` is stamped only on the first assignment.
	 *
	 * The permission is the route's own, `ENTITLEMENTS_EDIT`, and no version is stated and no retry
	 * scope declared, because the route declares neither: a key's own revision does not move when its
	 * holder is recorded.
	 *
	 * @param id The key.
	 * @param input The holder.
	 * @returns The payload, carrying the key as the assignment left it.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Mutation('assignEntitlementKey')
	async assignEntitlementKey(@Args('id') id: ID, @Args('input') input: IEntitlementKeyAssignInput) {
		try {
			return { key: await this.entitlementKeyService.assign(id, input), userErrors: [] };
		} catch (error) {
			return { key: null, userErrors: [toUserError(error)] };
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
	 * Replaces a credential with a freshly generated one.
	 *
	 * The recovery path for a lost key, and the only one this surface offers. The service issues the
	 * replacement against the same right, revokes the credential it replaces in the same transaction —
	 * which releases the activations that key was used for and re-derives the counters — and links the
	 * pair in each row's `metadata`, so "what happened to the key this customer was sent" has one answer
	 * forever. That link is why this is a field of its own and not two calls a client could compose from
	 * `issueEntitlementKey` and `revokeEntitlementKey`: composing them would leave the replacement
	 * unlinked, and `issueEntitlementKey` alone would leave two live credentials against one right.
	 *
	 * The plaintext of the replacement is returned once, here, and never again — the same treatment the
	 * issuance gives its own.
	 *
	 * No version is stated and no retry scope declared, because the route declares neither: the
	 * replacement is written against the credential and the right's own revision does not move.
	 *
	 * @param id The key being replaced.
	 * @param input The format of the replacement, why, and whether it should be recoverable.
	 * @returns The payload, carrying the replacement, its plaintext once, and the key it replaced.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Mutation('reissueEntitlementKey')
	async reissueEntitlementKey(@Args('id') id: ID, @Args('input') input: IEntitlementKeyReissueInput) {
		try {
			const result = await this.entitlementKeyService.reissue(id, input);

			return {
				key: result.key,
				plaintextKey: result.plaintext,
				replacedKey: result.replacedKey,
				userErrors: []
			};
		} catch (error) {
			return { key: null, plaintextKey: null, replacedKey: null, userErrors: [toUserError(error)] };
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
