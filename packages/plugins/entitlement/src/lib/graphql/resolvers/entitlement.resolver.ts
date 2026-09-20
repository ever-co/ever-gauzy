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
 */
@Resolver('Entitlement')
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard)
@FeatureFlag(FEATURE_GRAPHQL)
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
	 * @returns One page of rights.
	 */
	@Versioned({ resource: EntitlementService, write: false })
	@Query('entitlements')
	async entitlements(@Args('filter') filter?: IEntitlementFilter, @Args('page') page?: IPageSelection) {
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
			order: { createdAt: 'DESC' }
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
