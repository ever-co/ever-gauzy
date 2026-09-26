import { CampaignBudgetUsageResolver } from './campaign-budget-usage.resolver';
import { CampaignBudgetResolver } from './campaign-budget.resolver';
import { CampaignResolver } from './campaign.resolver';
import { CouponResolver } from './coupon.resolver';
import { GiftCardTransactionResolver } from './gift-card-transaction.resolver';
import { GiftCardResolver } from './gift-card.resolver';
import { PromotionActionResolver } from './promotion-action.resolver';
import { PromotionUsageResolver } from './promotion-usage.resolver';
import { PromotionResolver } from './promotion.resolver';

/**
 * Every resolver this plugin contributes to the platform schema.
 *
 * The list is what the plugin hands the composition pass, and each class is also a provider of the
 * plugin's module — a resolver injects the same services the REST controllers do, so both surfaces
 * run through one implementation of every rule. There is one class per aggregate, mirroring the
 * controllers one for one: an aggregate the REST surface exposes is reachable over GraphQL, whether
 * through a root field of its own or through the relation that owns it.
 *
 * The three aggregates with no root **read** — the promotion action, the per-value budget consumption
 * and the gift-card movement — are read through their parents, which is where they are read in
 * practice: `Promotion.actions`, `CampaignBudget.usages` and `GiftCard.transactions`. They are no longer
 * absent from the mutation block: each of their controllers inherits `DELETE /:id/soft` and
 * `PUT /:id/recover` from `CrudController` — and overrides both, to state the permission the base leaves
 * unstated — so §3.1's capability parity puts `softDelete<Resource>` and `recover<Resource>` on each of
 * them, beside the pair the promotion itself already answered.
 */
export const resolvers = [
	PromotionResolver,
	PromotionActionResolver,
	CampaignResolver,
	CampaignBudgetResolver,
	CampaignBudgetUsageResolver,
	CouponResolver,
	PromotionUsageResolver,
	GiftCardResolver,
	GiftCardTransactionResolver
];

export {
	PromotionResolver,
	PromotionActionResolver,
	CampaignResolver,
	CampaignBudgetResolver,
	CampaignBudgetUsageResolver,
	CouponResolver,
	PromotionUsageResolver,
	GiftCardResolver,
	GiftCardTransactionResolver
};
