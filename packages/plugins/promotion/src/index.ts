/**
 * Public API Surface of @gauzy/plugin-promotion
 *
 * The package exports its plugin class, its module, its entities, its services and its GraphQL
 * contribution. A consumer that needs the promotion engine takes `PromotionService` from here rather
 * than re-implementing an evaluation; a consumer that needs the tables takes the entity classes.
 */
export * from './lib/promotion.plugin';
export * from './lib/promotion.module';
export * from './lib/promotion.types';
export * from './lib/promotion.permissions';
export * from './lib/promotion.features';
export * from './lib/promotion.settings';
export * from './lib/promotion.validators';
export * from './lib/events';

// Migrations. The class is exported from the package root rather than from a barrel inside the
// migrations directory, because every file in that directory is read as a migration and must carry
// the three dialect bodies — a barrel there would be indistinguishable from one that had lost them.
export * from './lib/migrations/1791000000260-CreatePromotionTables';

// Entities
export * from './lib/campaign/campaign.entity';
export * from './lib/campaign-budget/campaign-budget.entity';
export * from './lib/campaign-budget-usage/campaign-budget-usage.entity';
export * from './lib/promotion/promotion.entity';
export * from './lib/promotion-action/promotion-action.entity';
export * from './lib/coupon/coupon.entity';
export * from './lib/promotion-usage/promotion-usage.entity';
export * from './lib/gift-card/gift-card.entity';
export * from './lib/gift-card-transaction/gift-card-transaction.entity';

// Services
export * from './lib/campaign/campaign.service';
export * from './lib/campaign-budget/campaign-budget.service';
export * from './lib/campaign-budget-usage/campaign-budget-usage.service';
export * from './lib/promotion/promotion.service';
export * from './lib/promotion-action/promotion-action.service';
export * from './lib/coupon/coupon.service';
export * from './lib/promotion-usage/promotion-usage.service';
export * from './lib/gift-card/gift-card.service';
export * from './lib/gift-card-transaction/gift-card-transaction.service';

// Controllers
export * from './lib/campaign/campaign.controller';
export * from './lib/campaign-budget/campaign-budget.controller';
export * from './lib/campaign-budget-usage/campaign-budget-usage.controller';
export * from './lib/promotion/promotion.controller';
export * from './lib/promotion-action/promotion-action.controller';
export * from './lib/coupon/coupon.controller';
export * from './lib/promotion-usage/promotion-usage.controller';
export * from './lib/gift-card/gift-card.controller';
export * from './lib/gift-card-transaction/gift-card-transaction.controller';

// GraphQL
export * from './lib/graphql/schema-extensions';
export * from './lib/graphql/resolvers';
export * from './lib/graphql/types';
