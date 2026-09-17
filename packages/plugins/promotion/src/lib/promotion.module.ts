import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventBusModule, RolePermissionModule } from '@gauzy/core';
import { resolvers } from './graphql/resolvers';
import { ALL_PROMOTION_ENTITIES } from './promotion.entities';
import { Campaign } from './campaign/campaign.entity';
import { CampaignBudget } from './campaign-budget/campaign-budget.entity';
import { CampaignBudgetUsage } from './campaign-budget-usage/campaign-budget-usage.entity';
import { Promotion } from './promotion/promotion.entity';
import { PromotionAction } from './promotion-action/promotion-action.entity';
import { Coupon } from './coupon/coupon.entity';
import { PromotionUsage } from './promotion-usage/promotion-usage.entity';
import { GiftCard } from './gift-card/gift-card.entity';
import { GiftCardTransaction } from './gift-card-transaction/gift-card-transaction.entity';
import { CampaignService } from './campaign/campaign.service';
import { CampaignBudgetService } from './campaign-budget/campaign-budget.service';
import { CampaignBudgetUsageService } from './campaign-budget-usage/campaign-budget-usage.service';
import { PromotionService } from './promotion/promotion.service';
import { PromotionActionService } from './promotion-action/promotion-action.service';
import { CouponService } from './coupon/coupon.service';
import { PromotionUsageService } from './promotion-usage/promotion-usage.service';
import { GiftCardService } from './gift-card/gift-card.service';
import { GiftCardTransactionService } from './gift-card-transaction/gift-card-transaction.service';
import { PromotionController } from './promotion/promotion.controller';
import { CampaignController } from './campaign/campaign.controller';
import { CampaignBudgetController } from './campaign-budget/campaign-budget.controller';
import { CampaignBudgetUsageController } from './campaign-budget-usage/campaign-budget-usage.controller';
import { PromotionActionController } from './promotion-action/promotion-action.controller';
import { CouponController } from './coupon/coupon.controller';
import { PromotionUsageController } from './promotion-usage/promotion-usage.controller';
import { GiftCardController } from './gift-card/gift-card.controller';
import { GiftCardTransactionController } from './gift-card-transaction/gift-card-transaction.controller';
import { TypeOrmCampaignRepository } from './campaign/repository/type-orm-campaign.repository';
import { MikroOrmCampaignRepository } from './campaign/repository/mikro-orm-campaign.repository';
import { TypeOrmCampaignBudgetRepository } from './campaign-budget/repository/type-orm-campaign-budget.repository';
import { MikroOrmCampaignBudgetRepository } from './campaign-budget/repository/mikro-orm-campaign-budget.repository';
import { TypeOrmCampaignBudgetUsageRepository } from './campaign-budget-usage/repository/type-orm-campaign-budget-usage.repository';
import { MikroOrmCampaignBudgetUsageRepository } from './campaign-budget-usage/repository/mikro-orm-campaign-budget-usage.repository';
import { TypeOrmPromotionRepository } from './promotion/repository/type-orm-promotion.repository';
import { MikroOrmPromotionRepository } from './promotion/repository/mikro-orm-promotion.repository';
import { TypeOrmPromotionActionRepository } from './promotion-action/repository/type-orm-promotion-action.repository';
import { MikroOrmPromotionActionRepository } from './promotion-action/repository/mikro-orm-promotion-action.repository';
import { TypeOrmCouponRepository } from './coupon/repository/type-orm-coupon.repository';
import { MikroOrmCouponRepository } from './coupon/repository/mikro-orm-coupon.repository';
import { TypeOrmPromotionUsageRepository } from './promotion-usage/repository/type-orm-promotion-usage.repository';
import { MikroOrmPromotionUsageRepository } from './promotion-usage/repository/mikro-orm-promotion-usage.repository';
import { TypeOrmGiftCardRepository } from './gift-card/repository/type-orm-gift-card.repository';
import { MikroOrmGiftCardRepository } from './gift-card/repository/mikro-orm-gift-card.repository';
import { TypeOrmGiftCardTransactionRepository } from './gift-card-transaction/repository/type-orm-gift-card-transaction.repository';
import { MikroOrmGiftCardTransactionRepository } from './gift-card-transaction/repository/mikro-orm-gift-card-transaction.repository';

/**
 * The NestJS module of the promotion domain.
 *
 * Every entity is registered with both ORMs, because an installation selects its ORM at boot and an
 * entity that only one of them knows is a table no repository can reach. The repositories are
 * providers rather than bare `Repository<T>` injections so a service depends on one class under
 * either ORM, and the services are exported because the cart, order and returns domains consume the
 * promotion engine through them rather than through their own copy of it — and because a resolver is
 * hosted by the platform's composition module, which reaches a plugin's services through what the
 * plugin's own module exports.
 */
@Module({
	imports: [
		// The controllers below are guarded, and the guard resolves the caller's permissions.
		RolePermissionModule,
		TypeOrmModule.forFeature(ALL_PROMOTION_ENTITIES),
		MikroOrmModule.forFeature(ALL_PROMOTION_ENTITIES),
		EventBusModule,
		CqrsModule
	],
	controllers: [
		PromotionController,
		CampaignController,
		CampaignBudgetController,
		CampaignBudgetUsageController,
		PromotionActionController,
		CouponController,
		PromotionUsageController,
		GiftCardController,
		GiftCardTransactionController
	],
	providers: [
		CampaignService,
		CampaignBudgetService,
		CampaignBudgetUsageService,
		PromotionService,
		PromotionActionService,
		CouponService,
		PromotionUsageService,
		GiftCardService,
		GiftCardTransactionService,
		TypeOrmCampaignRepository,
		MikroOrmCampaignRepository,
		TypeOrmCampaignBudgetRepository,
		MikroOrmCampaignBudgetRepository,
		TypeOrmCampaignBudgetUsageRepository,
		MikroOrmCampaignBudgetUsageRepository,
		TypeOrmPromotionRepository,
		MikroOrmPromotionRepository,
		TypeOrmPromotionActionRepository,
		MikroOrmPromotionActionRepository,
		TypeOrmCouponRepository,
		MikroOrmCouponRepository,
		TypeOrmPromotionUsageRepository,
		MikroOrmPromotionUsageRepository,
		TypeOrmGiftCardRepository,
		MikroOrmGiftCardRepository,
		TypeOrmGiftCardTransactionRepository,
		MikroOrmGiftCardTransactionRepository,
		// The GraphQL resolvers are providers here because they inject the same services the REST
		// controllers do; the plugin hands the composition pass the same classes through
		// `extensions.resolvers`, so there is one implementation per rule rather than one per surface.
		...resolvers
	],
	exports: [
		CampaignService,
		CampaignBudgetService,
		CampaignBudgetUsageService,
		PromotionService,
		PromotionActionService,
		CouponService,
		PromotionUsageService,
		GiftCardService,
		GiftCardTransactionService
	]
})
export class PromotionModule {}

/**
 * The entities of this package, exported so a host application can register them without importing
 * each class by name.
 */
export { Campaign, CampaignBudget, CampaignBudgetUsage, Promotion, PromotionAction, Coupon, PromotionUsage, GiftCard, GiftCardTransaction };
