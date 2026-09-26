import { Inject, Optional, UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Parent, Query, ResolveField, Resolver, Subscription } from '@nestjs/graphql';
import { filter, Observable } from 'rxjs';
import { ID, IPagination } from '@gauzy/contracts';
import {
	EventBus,
	FeatureFlagGuard,
	Idempotent,
	PermissionGuard,
	Permissions,
	TenantPermissionGuard,
	Versioned,
	versionExpectationOf
} from '@gauzy/core';
import { FEATURE_GRAPHQL } from '@gauzy/core/src/lib/feature/graphql-feature.code';
import { FeatureFlag } from '@gauzy/common';
import { EntitlementFeatures } from '../../entitlement.features';
import { Entitlement } from '../../entitlement/entitlement.entity';
import { EntitlementService } from '../../entitlement/entitlement.service';
import { EntitlementKeyService } from '../../entitlement-key/entitlement-key.service';
import { EntitlementActivationService } from '../../entitlement-activation/entitlement-activation.service';
import { EntitlementCheckService } from '../../entitlement-check/entitlement-check.service';
import { EntitlementActivation } from '../../entitlement-activation/entitlement-activation.entity';
import { EntitlementKey } from '../../entitlement-key/entitlement-key.entity';
import {
	EntitlementActivationStatus,
	EntitlementKind,
	EntitlementStatus
} from '../../entitlement.enums';import {
	EntitlementActivatedEvent,
	EntitlementChangedEvent,
	EntitlementRevokedEvent
} from '../../events/entitlement.events';
import { EntitlementPermissions } from '../../entitlement.permissions';
import {
	ENTITLEMENT_CATALOG_PORT,
	IEntitlementCatalogPort,
	IEntitlementCheckResult,
	IEntitlementEditInput,
	IEntitlementGrantInput
} from '../../entitlement.types';
import { toAsyncIterable } from '../async-iterable';
import { buildConnection, IPageSelection, resolvePageWindow } from '../pagination';
import { toUserError } from '../wire';

/** The filter the connection fields accept. */
interface IEntitlementFilter {
	status?: EntitlementStatus;
	kind?: EntitlementKind;
	customerId?: ID;
	orderId?: ID;
	orderLineId?: ID;
	subscriptionId?: ID;
	productId?: ID;
	variantId?: ID;
	number?: string;
}

/**
 * The entitlement domain's GraphQL root fields.
 *
 * The resolvers call the same services the REST surface calls, so a right granted over GraphQL and one
 * granted over REST obey the same provenance check and the same lifecycle, and the two surfaces cannot
 * drift. Authorisation is unchanged: the guards run on the request that carried the operation, and a
 * field declares the same permission the equivalent route does.
 *
 * One difference the transport forces is stated rather than inferred. A GraphQL operation travels over
 * `POST` whichever root type it selects, so a query has to say that it does not write, and a mutation
 * has to carry the version it read beside the arguments it qualifies — one request may select several
 * mutations, and neither a header nor the transport could say which of them a version belongs to. The
 * version therefore rides as the `version` argument, and the accepted version reaches the service
 * through the request the operation arrived on.
 *
 * **The three resources' inherited `DELETE /:id` routes are deliberately not mirrored.** What the
 * specifications refuse is a hard delete of these tables through the API, and they say so in four
 * places: `05-database-schema-spec.md` §1.7 — "Every table in this document is deleted softly and
 * archived explicitly. A hard `DELETE` is only ever issued by a retention job (§25) against a table it
 * owns"; §25.2, which names `entitlement` and `entitlement_key` as "archived by the retention job after
 * the export" and `entitlement_activation` as "deleted by the retention job; a live activation is never
 * touched"; §19.2, where the dormant release marks a row `EXPIRED` "rather than deleting the row, so
 * the history of who held a slot survives"; and
 * `11-customers-b2b-and-subscriptions-spec.md` §9.3 — "Revoking an entitlement never deletes its rows:
 * the grant, the activations and the keys stay readable, because they are the record of what the
 * customer was once entitled to." The counter-argument is recorded rather than hidden: §3.1 lists
 * "delete" among the parity dimensions, and `06-api-specification.md` §3 declares `DELETE /:id` in
 * every entity controller's inherited route set — so an owner who reads that sentence as declaring a
 * capability rather than describing the framework wants three fields, `deleteEntitlement`,
 * `deleteEntitlementActivation` and `deleteEntitlementKey`, each reaching its own service's `delete(id)`
 * under `ENTITLEMENTS_EDIT` (and `@Versioned` for the right, whose table carries a version), with
 * nothing else about this resolver changed.
 *
 * The retry key rides the same way and for the same reason: a mutation that mirrors a retry-safe route
 * declares the same `@Idempotent()` scope, and its `idempotencyKey` member is what a client presents
 * instead of the header REST carries it in.
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
@Resolver('Entitlement')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(EntitlementFeatures.ENTITLEMENT)
@Permissions(EntitlementPermissions.ENTITLEMENTS_VIEW)
export class EntitlementResolver {
	constructor(
		private readonly entitlementService: EntitlementService,
		private readonly entitlementKeyService: EntitlementKeyService,
		private readonly entitlementActivationService: EntitlementActivationService,
		private readonly entitlementCheckService: EntitlementCheckService,
		private readonly eventBus: EventBus,
		@Optional()
		@Inject(ENTITLEMENT_CATALOG_PORT)
		private readonly catalog?: IEntitlementCatalogPort
	) {}

	/**
	 * Lists rights.
	 *
	 * @param filter The right filter.
	 * @param page The page.
	 * @param withDeleted Whether retired rows are included.
	 * @returns One page of rights.
	 */
	@Versioned({ resource: EntitlementService, write: false })
	@Query('entitlements')
	async entitlements(
		@Args('filter') filter?: IEntitlementFilter,
		@Args('page') page?: IPageSelection,
		@Args('withDeleted', { type: () => Boolean, nullable: true }) withDeleted?: boolean
	) {
		const { skip, take } = resolvePageWindow(page);
		const result = await this.entitlementService.findAll({
			where: {
				...(filter?.status ? { status: filter.status } : {}),
				...(filter?.kind ? { kind: filter.kind } : {}),
				...(filter?.customerId ? { customerId: filter.customerId } : {}),
				...(filter?.orderId ? { orderId: filter.orderId } : {}),
				...(filter?.orderLineId ? { orderLineId: filter.orderLineId } : {}),
				...(filter?.subscriptionId ? { subscriptionId: filter.subscriptionId } : {}),
				...(filter?.productId ? { productId: filter.productId } : {}),
				...(filter?.variantId ? { variantId: filter.variantId } : {}),
				...(filter?.number ? { number: filter.number } : {})
			},
			skip,
			take,
			order: { createdAt: 'DESC' },
			...(withDeleted ? { withDeleted: true } : {})
		} as any);

		return buildConnection(result as IPagination<Entitlement>, skip);
	}

	/**
	 * Reads one right, with its activations and its keys.
	 *
	 * @param id The right.
	 * @returns The right, or null when it is not the caller's.
	 */
	@Versioned({ resource: EntitlementService, write: false })
	@Query('entitlement')
	async entitlement(@Args('id') id: ID): Promise<Entitlement | null> {
		try {
			return await this.entitlementService.findOneDetailed(id);
		} catch (error) {
			return null;
		}
	}

	/**
	 * Answers whether a right may be exercised.
	 *
	 * @param input What the caller holds.
	 * @returns The verdict and the code that explains it.
	 */
	@Versioned({ resource: EntitlementService, write: false })
	@Query('checkEntitlement')
	async checkEntitlement(@Args('input') input: Record<string, any>): Promise<IEntitlementCheckResult> {
		return await this.entitlementCheckService.check(input as any);
	}

	/**
	 * Grants a right.
	 *
	 * No version is stated: a right is created here rather than edited, so there is none to have read,
	 * and the created right carries its version back in the payload. The retry scope is
	 * `entitlement.create`, the scope the grant route declares.
	 *
	 * @param input The grant.
	 * @returns The payload, carrying the right and — once — the plaintext of any key it issued.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_GRANT)
	@Idempotent({ scope: 'entitlement.create', required: false, resourceType: 'entitlement' })
	@Versioned({ resource: EntitlementService, required: false })
	@Mutation('grantEntitlement')
	async grantEntitlement(@Args('input') input: IEntitlementGrantInput) {
		try {
			const result = await this.entitlementService.grant(input);

			return {
				entitlement: result.entitlement,
				key: result.key ?? null,
				plaintextKey: result.plaintextKey ?? null,
				created: result.created,
				userErrors: []
			};
		} catch (error) {
			return { entitlement: null, key: null, plaintextKey: null, created: false, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Withdraws a right.
	 *
	 * The retry scope is `entitlement.revoke`, the scope the withdrawal route declares, and the key is
	 * presented as the `idempotencyKey` argument this field advertises.
	 *
	 * @param id The right.
	 * @param reason Why.
	 * @param context The operation context, which carries the version the caller read the right at.
	 * @returns The payload.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Idempotent({ scope: 'entitlement.revoke', required: false, resourceType: 'entitlement' })
	@Versioned({ resource: EntitlementService })
	@Mutation('revokeEntitlement')
	async revokeEntitlement(@Args('id') id: ID, @Args('reason') reason: string, @Context() context: any) {
		try {
			return {
				entitlement: await this.entitlementService.revoke(id, reason, {}, versionExpectationOf(context?.req)),
				userErrors: []
			};
		} catch (error) {
			return { entitlement: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Extends the term of a right.
	 *
	 * The retry scope is `entitlement.extend`, the scope the extension route declares: an extension
	 * moves the right's own term, so a retry under one key must not move it twice.
	 *
	 * @param id The right.
	 * @param endsAt The new end of the term.
	 * @param quantity The quantity the renewal was billed for.
	 * @param context The operation context, which carries the version the caller read the right at.
	 * @returns The payload.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Idempotent({ scope: 'entitlement.extend', required: false, resourceType: 'entitlement' })
	@Versioned({ resource: EntitlementService })
	@Mutation('extendEntitlement')
	async extendEntitlement(
		@Args('id') id: ID,
		@Args('endsAt') endsAt: Date,
		@Args('quantity') quantity?: number,
		@Context() context?: any
	) {
		try {
			return {
				entitlement: await this.entitlementService.extend(
					id,
					{ endsAt: new Date(endsAt), quantity },
					{},
					versionExpectationOf(context?.req)
				),
				userErrors: []
			};
		} catch (error) {
			return { entitlement: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Edits a right: its ceiling, its term, its grace, its activation limit, its extras and its
	 * conditions.
	 *
	 * The route it mirrors is `PUT /entitlements/:id`, and this field makes the two calls that route
	 * makes, in the order it makes them: the changed fields are written under the version the caller
	 * read, and the conditions — which are `rule` rows the rule engine owns rather than columns — are
	 * replaced in their own statement. The right is then read back with its activations, its keys and
	 * the party it belongs to, which is the answer the route returns.
	 *
	 * **This input is deliberately narrower than the route's body, and the narrowing is measured rather
	 * than claimed.** `UpdateEntitlementDTO` is `PartialType(EntitlementDTO)`, so its live
	 * class-validator metadata also carries the provenance (`orderId`, `orderLineId`, `subscriptionId`,
	 * `productId`, `variantId`, `customerId`), the allocated `number`, the `kind`, the `status`, the
	 * revocation fields and the grant-only members — and `applyChanges` hands its patch to the
	 * conditional `update` without filtering a member, so a REST caller can write `status` directly,
	 * past the suspend/revoke transitions and the events that make them auditable, which
	 * `05-database-schema-spec.md` §19.1 makes the service's business. That is a defect on the REST side
	 * and not a capability to mirror: the controller's own docstring states the contract this field
	 * keeps ("A body may not write the provenance, the number or the state"), and the suite reads the
	 * omitted set out of the DTO's own metadata, so a member added there fails a test instead of
	 * arriving here unnoticed. The service is left as it is: repairing the REST hole is a change to the
	 * route's contract, which is the owner's call and not a parity wave's.
	 *
	 * No retry scope is declared, because the route declares none: an edit is idempotent by content — the
	 * same fields written twice leave the same row — and the version is what makes a repeated write
	 * visible rather than silent.
	 *
	 * @param id The right.
	 * @param input The fields to change.
	 * @param context The operation context, which carries the version the caller read the right at.
	 * @returns The payload, carrying the right as the edit left it.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Versioned({ resource: EntitlementService })
	@Mutation('updateEntitlement')
	async updateEntitlement(
		@Args('id') id: ID,
		@Args('input') input: IEntitlementEditInput,
		@Context() context?: any
	) {
		try {
			// The conditions are not part of the field write: they are `rule` rows the rule engine owns,
			// and the service replaces them in its own statement — the same split, and the same order, as
			// the route this field mirrors.
			const { conditions, ...changes } = input ?? {};

			if (Object.keys(changes).length) {
				await this.entitlementService.applyChanges(id, changes as any, versionExpectationOf(context?.req));
			}

			if (conditions) {
				await this.entitlementService.replaceConditions(id, conditions as any);
			}

			return { entitlement: await this.entitlementService.findOneDetailed(id), userErrors: [] };
		} catch (error) {
			return { entitlement: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Suspends a right temporarily.
	 *
	 * The retry scope is `entitlement.suspend`, the scope the suspension route declares: a suspension a
	 * client repeats under one key is answered from the first attempt rather than performed again, which
	 * matters because the service emits `entitlement.suspended` on the transition and nothing on the
	 * replay.
	 *
	 * The caller states the version it read, because a suspension is predicated on the row it was
	 * decided against — a right that moved on since, by a renewal or by another operator, is refused
	 * rather than suspended underneath that change.
	 *
	 * @param id The right.
	 * @param reason Why — `PAYMENT_FAILED` when dunning suspended it, or an operator's own note.
	 * @param context The operation context, which carries the version the caller read the right at.
	 * @returns The payload, carrying the suspended right.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Idempotent({ scope: 'entitlement.suspend', required: false, resourceType: 'entitlement' })
	@Versioned({ resource: EntitlementService })
	@Mutation('suspendEntitlement')
	async suspendEntitlement(
		@Args('id') id: ID,
		@Args('reason') reason?: string,
		@Context() context?: any
	) {
		try {
			return {
				entitlement: await this.entitlementService.suspend(id, reason, {}, versionExpectationOf(context?.req)),
				userErrors: []
			};
		} catch (error) {
			return { entitlement: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Returns a suspended right to force.
	 *
	 * The route takes no body, and neither does this field: resuming clears the suspension reason that
	 * suspending recorded, and a note supplied here would only be a second, unreadable explanation of
	 * the same fact.
	 *
	 * Two outcomes are worth stating rather than leaving to the service. A right whose term ran out
	 * while it was suspended is **expired** rather than resumed — resuming it would put a customer back
	 * in force for a period nobody paid for — and a right already in force is returned unchanged. The
	 * payload therefore carries the right as it ends up, not as the caller assumed it would.
	 *
	 * The retry scope is `entitlement.resume`, the scope the route declares.
	 *
	 * @param id The right.
	 * @param context The operation context, which carries the version the caller read the right at.
	 * @returns The payload, carrying the resumed — or expired — right.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Idempotent({ scope: 'entitlement.resume', required: false, resourceType: 'entitlement' })
	@Versioned({ resource: EntitlementService })
	@Mutation('resumeEntitlement')
	async resumeEntitlement(@Args('id') id: ID, @Context() context?: any) {
		try {
			return {
				entitlement: await this.entitlementService.resume(id, {}, versionExpectationOf(context?.req)),
				userErrors: []
			};
		} catch (error) {
			return { entitlement: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Lowers the ceiling a right carries, which is what a partial refund does.
	 *
	 * This is not `extendEntitlement` with a smaller number, and the difference is the whole reason the
	 * field exists rather than being folded into the extension. `extend` demands an `endsAt` later than
	 * the current one, forces the right back to `ACTIVE` and clears `suspendedReason` — so a partial
	 * refund answered with it would put a suspended or expired right back in force — and it never
	 * touches the activations, so lowering a ceiling through it leaves live slots above the new
	 * `quantity`, which is the invariant `05-database-schema-spec.md` I-68 and
	 * `02-commerce-domain-model.md` §4.8 E2 make the service's to keep. This field calls `reduce`, which
	 * revokes the surplus activations newest-first before the ceiling moves, revokes a right reduced to
	 * zero outright, leaves the term and the state alone, and emits `entitlement.reduced` with the ids
	 * it released.
	 *
	 * No retry scope is declared, because the route declares none.
	 *
	 * @param id The right.
	 * @param quantity The ceiling that remains.
	 * @param reason Why — `REFUNDED` and `QUANTITY_REDUCED` are the two the domain writes itself.
	 * @param context The operation context, which carries the version the caller read the right at.
	 * @returns The payload, carrying the reduced — or revoked — right.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Versioned({ resource: EntitlementService })
	@Mutation('reduceEntitlement')
	async reduceEntitlement(
		@Args('id') id: ID,
		@Args('quantity') quantity: number,
		@Args('reason') reason?: string,
		@Context() context?: any
	) {
		try {
			return {
				entitlement: await this.entitlementService.reduce(
					id,
					quantity,
					reason,
					{},
					versionExpectationOf(context?.req)
				),
				userErrors: []
			};
		} catch (error) {
			return { entitlement: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Retires a right recoverably, keeping the row and everything that hangs off it.
	 *
	 * The route it mirrors is `DELETE /entitlements/:id/soft`, which this plugin's controller overrides
	 * only to state the permission the inherited route left unstated. Without this field the only way to
	 * end a right over GraphQL was `revokeEntitlement` — terminal, and irreversible — so a client that
	 * retired the wrong right had no way back, while a REST caller had one.
	 *
	 * The permission is the route's own, `ENTITLEMENTS_EDIT`, and not the class-level view grant: taking
	 * a right out of force is the act the edit grant exists for.
	 *
	 * The answer is the payload the right's other mutations answer, `EntitlementPayload`, so an outcome
	 * this field's service refuses is reported in `userErrors` rather than as a GraphQL error — the
	 * treatment every other mutation of this plugin gives an outcome a caller could have avoided.
	 *
	 * @param id The right.
	 * @returns The payload, carrying the right as the soft delete left it.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Mutation('softDeleteEntitlement')
	async softDeleteEntitlement(@Args('id') id: ID) {
		try {
			return { entitlement: await this.entitlementService.softRemove(id), userErrors: [] };
		} catch (error) {
			return { entitlement: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Restores a right that was retired recoverably.
	 *
	 * The route it mirrors is `PUT /entitlements/:id/recover`. A restored right is eligible for the
	 * check, the activations and the renewals it was eligible for before, which is why the route states
	 * the destructive grant rather than the edit one — and why this field states `ENTITLEMENTS_EDIT`
	 * too, rather than the class-level view grant that would otherwise be all that is left in front of
	 * it.
	 *
	 * @param id The right.
	 * @returns The payload, carrying the restored right.
	 */
	@Permissions(EntitlementPermissions.ENTITLEMENTS_EDIT)
	@Mutation('recoverEntitlement')
	async recoverEntitlement(@Args('id') id: ID) {
		try {
			return { entitlement: await this.entitlementService.softRecover(id), userErrors: [] };
		} catch (error) {
			return { entitlement: null, userErrors: [toUserError(error)] };
		}
	}

	/**
	 * Streams rights that were granted or changed.
	 *
	 * @param entitlementId An optional right to narrow the stream to.
	 * @returns The stream.
	 */
	@Subscription('entitlementChanged')
	entitlementChanged(@Args('entitlementId') entitlementId?: ID): AsyncIterable<Entitlement> {
		return this.stream(this.eventBus.ofType(EntitlementChangedEvent), entitlementId);
	}

	/**
	 * Streams rights that had a slot taken.
	 *
	 * @param entitlementId An optional right to narrow the stream to.
	 * @returns The stream.
	 */
	@Subscription('entitlementActivated')
	entitlementActivated(@Args('entitlementId') entitlementId?: ID): AsyncIterable<Entitlement> {
		return this.stream(this.eventBus.ofType(EntitlementActivatedEvent), entitlementId);
	}

	/**
	 * Streams rights that were withdrawn.
	 *
	 * @param entitlementId An optional right to narrow the stream to.
	 * @returns The stream.
	 */
	@Subscription('entitlementRevoked')
	entitlementRevoked(@Args('entitlementId') entitlementId?: ID): AsyncIterable<Entitlement> {
		return this.stream(this.eventBus.ofType(EntitlementRevokedEvent), entitlementId);
	}

	/**
	 * Resolves the activations of a right.
	 *
	 * @param entitlement The right being read.
	 * @returns Its activations.
	 */
	@ResolveField('activations')
	async activations(@Parent() entitlement: Entitlement): Promise<EntitlementActivation[]> {
		if (Array.isArray(entitlement.activations)) {
			return entitlement.activations;
		}

		return await this.entitlementActivationService.findForEntitlement(entitlement.id);
	}

	/**
	 * Resolves the credentials issued against a right.
	 *
	 * @param entitlement The right being read.
	 * @returns Its keys. The digest and the ciphertext are not part of the answer.
	 */
	@ResolveField('keys')
	async keys(@Parent() entitlement: Entitlement): Promise<EntitlementKey[]> {
		if (Array.isArray(entitlement.keys)) {
			return entitlement.keys;
		}

		return await this.entitlementKeyService.findForEntitlement(entitlement.id);
	}

	/**
	 * Resolves the instant the right stops being exercisable, grace included.
	 *
	 * Resolved rather than stored: the grace period is a column and the instant is derived from it, so
	 * there is one source of truth for when a right ends.
	 *
	 * @param entitlement The right being read.
	 * @returns The instant, or null when the right is perpetual.
	 */
	@ResolveField('validUntil')
	async validUntil(@Parent() entitlement: Entitlement): Promise<Date | null> {
		if (!entitlement.endsAt) {
			return null;
		}

		const graceDays = Number(entitlement.gracePeriodDays ?? 0);

		return new Date(new Date(entitlement.endsAt).getTime() + graceDays * 24 * 60 * 60 * 1000);
	}

	/**
	 * Resolves the seats or uses still available.
	 *
	 * Resolved from the live activations rather than from the cached counter, because this is the
	 * number a customer acts on: the cache is what the hot path reads, and the audit is what keeps the
	 * two equal.
	 *
	 * @param entitlement The right being read.
	 * @returns The remaining quantity, or null when the right is unlimited.
	 */
	@ResolveField('remainingQuantity')
	async remainingQuantity(@Parent() entitlement: Entitlement): Promise<number | null> {
		if (Number(entitlement.quantity) === 0) {
			return null;
		}

		const activations = await this.activations(entitlement);
		const live = activations.filter((activation) => activation.status === EntitlementActivationStatus.ACTIVE).length;

		return Math.max(0, Number(entitlement.quantity) - live);
	}

	/**
	 * Resolves the product a right is over, through the catalogue capability when one is registered.
	 *
	 * The right stores the identifier and this package never maps another package's tables, so the
	 * object is asked for through the port. With no catalogue registered the reference resolves to
	 * null rather than to a second, staler copy of a row this package has no business reading.
	 *
	 * @param entitlement The right being read.
	 * @returns The product, or null.
	 */
	@ResolveField('product')
	async product(@Parent() entitlement: Entitlement) {
		if (!entitlement.productId || !this.catalog) {
			return null;
		}

		return await this.catalog.findProduct(entitlement.productId);
	}

	/**
	 * Resolves the variant a right is over, through the catalogue capability when one is registered.
	 *
	 * @param entitlement The right being read.
	 * @returns The variant, or null.
	 */
	@ResolveField('variant')
	async variant(@Parent() entitlement: Entitlement) {
		if (!entitlement.variantId || !this.catalog) {
			return null;
		}

		return await this.catalog.findVariant(entitlement.variantId);
	}

	/**
	 * @param source The event stream.
	 * @param entitlementId An optional right to narrow it to.
	 * @returns A stream of the rights the events name, re-read through the service so a subscriber
	 * never receives a snapshot that has already moved on.
	 */
	private stream(
		source: Observable<EntitlementChangedEvent | EntitlementActivatedEvent | EntitlementRevokedEvent>,
		entitlementId?: ID
	): AsyncIterable<Entitlement> {
		const narrowed = entitlementId ? source.pipe(filter((event) => event.entitlementId === entitlementId)) : source;

		return toAsyncIterable(
			new Observable<Entitlement>((subscriber) => {
				const subscription = narrowed.subscribe({
					next: (event) => {
						void this.entitlementService
							.findOneScoped(event.entitlementId)
							.then((entitlement) => subscriber.next(entitlement))
							.catch(() => subscriber.next(undefined as unknown as Entitlement));
					},
					error: (error) => subscriber.error(error),
					complete: () => subscriber.complete()
				});

				return () => subscription.unsubscribe();
			})
		);
	}
}
