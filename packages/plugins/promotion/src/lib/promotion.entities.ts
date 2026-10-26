import { Campaign } from './campaign/campaign.entity';
import { CampaignBudget } from './campaign-budget/campaign-budget.entity';
import { CampaignBudgetUsage } from './campaign-budget-usage/campaign-budget-usage.entity';
import { Coupon } from './coupon/coupon.entity';
import { GiftCard } from './gift-card/gift-card.entity';
import { GiftCardTransaction } from './gift-card-transaction/gift-card-transaction.entity';
import { Promotion } from './promotion/promotion.entity';
import { PromotionAction } from './promotion-action/promotion-action.entity';
import { PromotionUsage } from './promotion-usage/promotion-usage.entity';

/**
 * Every table this plugin owns, declared once.
 *
 * The array is the single source of the plugin's entity list and of the module's ORM registration,
 * because two lists are how an entity comes to be mapped by one ORM and not the other, and the
 * application then fails to boot with a metadata error that names neither.
 *
 * It lives in its own module rather than beside the plugin class, and that placement is load-bearing.
 * The module registers these entities and the plugin declares them, so the module has to import the
 * array — and the plugin has to import the module. Declaring the array in the plugin makes those two
 * imports a cycle: whichever of the pair is evaluated first reaches the other, which reaches back for
 * an array that its own module has not finished defining, and `forFeature(undefined)` fails the boot
 * with a message about `entities` that names no entity. A third module both of them import has no
 * such order.
 */
export const ALL_PROMOTION_ENTITIES = [
	Campaign,
	CampaignBudget,
	CampaignBudgetUsage,
	Promotion,
	PromotionAction,
	Coupon,
	PromotionUsage,
	GiftCard,
	GiftCardTransaction
];

export {
	Campaign,
	CampaignBudget,
	CampaignBudgetUsage,
	Coupon,
	GiftCard,
	GiftCardTransaction,
	Promotion,
	PromotionAction,
	PromotionUsage
};
