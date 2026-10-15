import { Args, Context, ID, Resolver, Subscription } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import {
	FEATURE_GRAPHQL,
	FeatureFlagGuard,
	GraphqlPubSub,
	PermissionGuard,
	Permissions,
	SubscriberScope,
	SubscriptionEnvelope,
	TenantPermissionGuard,
	deliverPayloadAsIs,
	tenantScopedTopicStream
} from '@gauzy/core';
import { FeatureFlag } from '@gauzy/common';
import { MarketplaceFeatures } from '../marketplace.features';
import { MARKETPLACE_STREAMED_EVENTS } from '../marketplace-streamed-events';
import { Seller } from '../seller/seller.entity';
import { SellerService } from '../seller/seller.service';
import { SellerOffering } from '../seller-offering/seller-offering.entity';
import { SellerOfferingService } from '../seller-offering/seller-offering.service';
import { SellerPayout } from '../seller-payout/seller-payout.entity';
import { SellerPayoutService } from '../seller-payout/seller-payout.service';
import { SellerSettlement } from '../seller-settlement/seller-settlement.entity';
import { SellerSettlementService } from '../seller-settlement/seller-settlement.service';
import { SellerTransaction } from '../seller-transaction/seller-transaction.entity';
import { SellerTransactionService } from '../seller-transaction/seller-transaction.service';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';
import { ISellerScope } from '../seller-scope/seller-scope';
import { MarketplacePayoutsGate } from './marketplace-gates';

/**
 * The streamed marketplace facts of one aggregate: the members of {@link MARKETPLACE_STREAMED_EVENTS} whose name is
 * `<aggregate>.<action>`.
 *
 * Read off the declared catalogue rather than restated, so each field follows exactly what `Subscription.events` may
 * select for that aggregate and no more — `seller_offering.updated` stays withheld here as it is there, and `seller.*`
 * does not reach the three-segment ledger names, which are `seller.transaction`'s.
 *
 * @param aggregate The aggregate, as the names state it.
 * @returns Its streamed names.
 */
export function marketplaceStreamNamesOf(aggregate: string): readonly string[] {
	return MARKETPLACE_STREAMED_EVENTS.filter((name) => name.slice(0, name.lastIndexOf('.')) === aggregate);
}

/**
 * The marketplace streams: typed fields over the seller, offering, payout, settlement and ledger facts the
 * marketplace services already append to the outbox.
 *
 * `Subscription.events(names: ["seller.*"])` hands a client an untyped envelope; these fields hand it the row, as the
 * marketplace's own reads answer it. Each fact is appended in the transaction that makes the move it describes, the
 * outbox consumer publishes it on `<event>:<tenantId>` — the topics these fields open — and so a move reaches a
 * subscriber once it committed, and never from another tenant's topic.
 *
 * **Three lines of isolation, the first two the kernel's.** `tenantScopedTopicStream` opens the subscriber's own
 * tenant topics only, drops an envelope that states another tenant or none, drops one of another organization, and
 * re-checks the row the read returns. The read is the service's own scoped read (`getSeller`, `getOffering`,
 * `getPayout`, `getSettlement`, `getTransaction`) — run inside the subscriber's context, so it reads the subscriber's
 * tenant and organization — **and it is handed the seller scope**, which is the third line and the marketplace's: a
 * subscriber who is one of a seller's own people is narrowed to that seller exactly as the queries narrow it, so a
 * fact about another seller's payout is re-read, refused by `assertSellerScope`, and never delivered.
 *
 * **The scope is resolved by the guard the queries mount.** `SellerAccessGuard` runs on the subscription operation
 * like on any other, reads the seller the field names (`sellerId`), resolves the caller's membership and attaches the
 * scope to the operation's context; the field captures it when the stream opens, so every later fact is decided
 * against the same scope — never against whatever request happens to be publishing.
 *
 * **The gates are the queries'**: the tenant, permission, feature and seller-access guards in that order; the GraphQL
 * feature and the marketplace feature on the class, the payouts feature as well on the payout and settlement streams
 * ({@link MarketplacePayoutsGate}); and on each field the view permission its rows' list query states.
 *
 * Handover 2026-10-13 §4.J (owner decision 8, "Add a gate + build backlog"): `sellerChanged` was promised by the
 * design and served by nothing (§7.65 item 19); the other four are the typed fields for the aggregates the plugin
 * already streams (`tools/scripts/subscription-parity-check.mjs`).
 */
@Resolver()
@UseGuards(TenantPermissionGuard, PermissionGuard, FeatureFlagGuard, SellerAccessGuard)
@FeatureFlag(FEATURE_GRAPHQL)
@FeatureFlag(MarketplaceFeatures.MARKETPLACE)
export class MarketplaceSubscriptionResolver {
	constructor(
		private readonly sellerService: SellerService,
		private readonly sellerOfferingService: SellerOfferingService,
		private readonly sellerPayoutService: SellerPayoutService,
		private readonly sellerSettlementService: SellerSettlementService,
		private readonly sellerTransactionService: SellerTransactionService,
		private readonly pubSub: GraphqlPubSub
	) {}

	/**
	 * Every move of a seller account of the caller's tenant: created, edited, submitted, verified, activated,
	 * suspended, rejected, offboarding started.
	 *
	 * @param sellerId Narrows the stream to one seller — and is the seller the access guard resolves membership of.
	 * @param action Narrows it to one move — the event name's last segment (`activated`, `offboarding-started`, …).
	 * @param context The operation's context, which carries the seller scope the guard resolved.
	 * @returns The seller as `seller(idOrCode:)` reads it when the move is delivered — a later move may already show.
	 */
	@Subscription('sellerChanged', { resolve: deliverPayloadAsIs })
	@Permissions(PermissionsEnum.SELLERS_VIEW)
	sellerChanged(
		@Args('sellerId', { type: () => ID }) sellerId?: string,
		@Args('action') action?: string,
		@Context() context?: any
	) {
		const scope = this.sellerScopeOf(context);

		return tenantScopedTopicStream<SubscriptionEnvelope, Seller>(this.pubSub, marketplaceStreamNamesOf('seller'), {
			narrow: (envelope) =>
				(!sellerId || String(envelope.aggregate?.id ?? '') === String(sellerId)) &&
				(!action || envelope.name === `seller.${action}`),
			read: async (envelope) => {
				const id = envelope.aggregate?.id;

				return id ? await this.sellerService.getSeller(id, scope) : null;
			}
		});
	}

	/**
	 * Every streamed move of a seller's offering of the caller's tenant: listed (created) or withdrawn.
	 *
	 * @param sellerOfferingId Narrows the stream to one offering.
	 * @param sellerId Narrows it to one seller's offerings, read from the offering itself.
	 * @param action Narrows it to one move (`created`, `withdrawn`).
	 * @param context The operation's context, which carries the seller scope the guard resolved.
	 * @returns The offering as it reads when the move is delivered — a later change may already show.
	 */
	@Subscription('sellerOfferingChanged', { resolve: deliverPayloadAsIs })
	@Permissions(PermissionsEnum.SELLER_OFFERINGS_VIEW)
	sellerOfferingChanged(
		@Args('sellerOfferingId', { type: () => ID }) sellerOfferingId?: string,
		@Args('sellerId', { type: () => ID }) sellerId?: string,
		@Args('action') action?: string,
		@Context() context?: any
	) {
		const scope = this.sellerScopeOf(context);

		return tenantScopedTopicStream<SubscriptionEnvelope, SellerOffering>(
			this.pubSub,
			marketplaceStreamNamesOf('seller_offering'),
			{
				narrow: (envelope) =>
					(!sellerOfferingId || String(envelope.aggregate?.id ?? '') === String(sellerOfferingId)) &&
					(!action || envelope.name === `seller_offering.${action}`),
				read: async (envelope) => {
					const id = envelope.aggregate?.id;

					return id ? this.ofSeller(await this.sellerOfferingService.getOffering(id, scope), sellerId) : null;
				}
			}
		);
	}

	/**
	 * Every move of a payout of the caller's tenant: created, paid, failed, canceled.
	 *
	 * @param sellerPayoutId Narrows the stream to one payout.
	 * @param sellerId Narrows it to one seller's payouts, read from the payout itself.
	 * @param action Narrows it to one move (`paid`, `failed`, …).
	 * @param context The operation's context, which carries the seller scope the guard resolved.
	 * @returns The payout with its lines, as `sellerPayout(id:)` reads it.
	 */
	@MarketplacePayoutsGate()
	@Subscription('sellerPayoutChanged', { resolve: deliverPayloadAsIs })
	@Permissions(PermissionsEnum.SELLER_PAYOUTS_VIEW)
	sellerPayoutChanged(
		@Args('sellerPayoutId', { type: () => ID }) sellerPayoutId?: string,
		@Args('sellerId', { type: () => ID }) sellerId?: string,
		@Args('action') action?: string,
		@Context() context?: any
	) {
		const scope = this.sellerScopeOf(context);

		return tenantScopedTopicStream<SubscriptionEnvelope, SellerPayout>(this.pubSub, marketplaceStreamNamesOf('seller_payout'), {
			narrow: (envelope) =>
				(!sellerPayoutId || String(envelope.aggregate?.id ?? '') === String(sellerPayoutId)) &&
				(!action || envelope.name === `seller_payout.${action}`),
			read: async (envelope) => {
				const id = envelope.aggregate?.id;

				return id ? this.ofSeller(await this.sellerPayoutService.getPayout(id, scope), sellerId) : null;
			}
		});
	}

	/**
	 * Every move of a provider settlement of the caller's tenant: recorded, closed.
	 *
	 * @param sellerSettlementId Narrows the stream to one settlement.
	 * @param sellerId Narrows it to one seller's settlements, read from the settlement itself.
	 * @param action Narrows it to one move (`recorded`, `closed`).
	 * @param context The operation's context, which carries the seller scope the guard resolved.
	 * @returns The settlement as it reads when the move is delivered — a later move may already show.
	 */
	@MarketplacePayoutsGate()
	@Subscription('sellerSettlementChanged', { resolve: deliverPayloadAsIs })
	@Permissions(PermissionsEnum.SELLER_SETTLEMENTS_VIEW)
	sellerSettlementChanged(
		@Args('sellerSettlementId', { type: () => ID }) sellerSettlementId?: string,
		@Args('sellerId', { type: () => ID }) sellerId?: string,
		@Args('action') action?: string,
		@Context() context?: any
	) {
		const scope = this.sellerScopeOf(context);

		return tenantScopedTopicStream<SubscriptionEnvelope, SellerSettlement>(
			this.pubSub,
			marketplaceStreamNamesOf('seller_settlement'),
			{
				narrow: (envelope) =>
					(!sellerSettlementId || String(envelope.aggregate?.id ?? '') === String(sellerSettlementId)) &&
					(!action || envelope.name === `seller_settlement.${action}`),
				read: async (envelope) => {
					const id = envelope.aggregate?.id;

					return id ? this.ofSeller(await this.sellerSettlementService.getSettlement(id, scope), sellerId) : null;
				}
			}
		);
	}

	/**
	 * Every move of the seller ledger of the caller's tenant: a sale recorded, a row made settleable, a reversal.
	 *
	 * One fact can move several rows — recording an order's sale writes one row per seller-owned line — so the field
	 * answers the rows the fact moved, each re-read as the subscriber; a seller's own person is answered only its own
	 * seller's rows, and a fact that moved none of them is not delivered at all.
	 *
	 * @param sellerId Narrows the stream to one seller's rows.
	 * @param orderId Narrows it to the rows of one order.
	 * @param action Narrows it to one move (`recorded`, `settleable`, `reversed`).
	 * @param context The operation's context, which carries the seller scope the guard resolved.
	 * @returns The ledger rows the move wrote or changed.
	 */
	@Subscription('sellerTransactionChanged', { resolve: deliverPayloadAsIs })
	@Permissions(PermissionsEnum.SELLER_TRANSACTIONS_VIEW)
	sellerTransactionChanged(
		@Args('sellerId', { type: () => ID }) sellerId?: string,
		@Args('orderId', { type: () => ID }) orderId?: string,
		@Args('action') action?: string,
		@Context() context?: any
	) {
		const scope = this.sellerScopeOf(context);

		return tenantScopedTopicStream<SubscriptionEnvelope, SellerTransaction[]>(
			this.pubSub,
			marketplaceStreamNamesOf('seller.transaction'),
			{
				narrow: (envelope) => !action || envelope.name === `seller.transaction.${action}`,
				read: async (envelope, subscriber) => {
					const rows: SellerTransaction[] = [];

					for (const id of this.transactionIdsOf(envelope)) {
						try {
							rows.push(await this.sellerTransactionService.getTransaction(id, scope));
						} catch {
							// A row the subscriber may not read — another seller's, for a seller's own person — is one it
							// is not told about; the rest of the fact still is.
						}
					}

					const delivered = rows.filter(
						(row) =>
							this.isSubscribers(row, subscriber) &&
							(!sellerId || String(row.sellerId ?? '') === String(sellerId)) &&
							(!orderId || String(row.orderId ?? '') === String(orderId))
					);

					return delivered.length ? delivered : null;
				}
			}
		);
	}

	/**
	 * The ledger rows a fact names.
	 *
	 * `seller.transaction.recorded` is an order's fact — its aggregate is the order — and names the rows it wrote in
	 * `transactionIds`; the other two are a row's own, and a reversal also names the row it reverses, whose status a
	 * completing reversal moves. The ids are only ever handed to the scoped read, so an id the subscriber may not read
	 * is refused there rather than trusted here.
	 *
	 * @param envelope The fact.
	 * @returns The row ids, each once.
	 */
	private transactionIdsOf(envelope: SubscriptionEnvelope): string[] {
		const data = (envelope.data ?? {}) as { transactionIds?: unknown; transactionId?: unknown };
		const ids = Array.isArray(data.transactionIds)
			? data.transactionIds
			: [envelope.aggregate?.id, typeof data.transactionId === 'string' ? data.transactionId : undefined];

		return [...new Set(ids.filter((id): id is string => typeof id === 'string' && id !== ''))];
	}

	/**
	 * Whether a ledger row is of the subscriber's tenant and organization.
	 *
	 * The kernel re-checks a delivered value's own `tenantId`; a list carries none of its own, so each row is checked
	 * here against the scope the stream captured.
	 *
	 * @param row The row.
	 * @param subscriber The subscriber.
	 * @returns True when the row is the subscriber's to see.
	 */
	private isSubscribers(row: SellerTransaction, subscriber: SubscriberScope): boolean {
		if (String(row.tenantId ?? '') !== subscriber.tenantId) return false;

		return !subscriber.organizationId || !row.organizationId || String(row.organizationId) === subscriber.organizationId;
	}

	/**
	 * The row, when it is of the seller the subscriber narrowed by.
	 *
	 * @param row The re-read row.
	 * @param sellerId The seller the subscriber narrowed by.
	 * @returns The row, or null when it is another seller's.
	 */
	private ofSeller<T extends { sellerId?: string | null }>(row: T, sellerId?: string): T | null {
		return !sellerId || String(row.sellerId ?? '') === String(sellerId) ? row : null;
	}

	/**
	 * The seller scope `SellerAccessGuard` attached to the operation.
	 *
	 * @param context The operation's context.
	 * @returns The scope, or undefined when the guard attached none.
	 */
	private sellerScopeOf(context: any): ISellerScope | undefined {
		return (context?.req?.sellerScope ?? context?.sellerScope) as ISellerScope | undefined;
	}
}
