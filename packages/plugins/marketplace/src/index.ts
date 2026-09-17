/**
 * Public API surface of @gauzy/plugin-marketplace
 *
 * The plugin class is the entry point the platform loads; everything else is exported because a
 * consumer outside this package legitimately needs it — the order package calls the split, the payment
 * package records what a provider settled, and a report reads the ledger.
 */
export * from './lib/marketplace.plugin';
export * from './lib/marketplace.module';
export * from './lib/marketplace.permissions';
export * from './lib/marketplace.features';
export * from './lib/marketplace.settings';

/* Aggregates — every entity is exported, because a table an ORM is not told about is a table that does
 * not exist at runtime, and every service is exported because the aggregates that read each other do so
 * through them. */
export * from './lib/seller/seller.entity';
export * from './lib/seller/seller.service';
export * from './lib/seller/seller.controller';
export * from './lib/seller/seller.module';
export * from './lib/seller-offering/seller-offering.entity';
export * from './lib/seller-offering/seller-offering.service';
export * from './lib/seller-offering/seller-offering.controller';
export * from './lib/seller-offering/seller-offering.module';
export * from './lib/seller-transaction/seller-transaction.entity';
export * from './lib/seller-transaction/seller-transaction.service';
export * from './lib/seller-transaction/seller-transaction.controller';
export * from './lib/seller-transaction/seller-transaction.module';
export * from './lib/seller-payout/seller-payout.entity';
export * from './lib/seller-payout/seller-payout.service';
export * from './lib/seller-payout/seller-payout.controller';
export * from './lib/seller-payout/seller-payout.module';
export * from './lib/seller-payout-line/seller-payout-line.entity';
export * from './lib/seller-payout-line/seller-payout-line.service';
export * from './lib/seller-payout-line/seller-payout-line.controller';
export * from './lib/seller-payout-line/seller-payout-line.module';
export * from './lib/seller-settlement/seller-settlement.entity';
export * from './lib/seller-settlement/seller-settlement.service';
export * from './lib/seller-settlement/seller-settlement.controller';
export * from './lib/seller-settlement/seller-settlement.module';

/* Repositories — exported so either ORM's implementation can be injected by a consumer. */
export * from './lib/seller/repository/type-orm-seller.repository';
export * from './lib/seller/repository/mikro-orm-seller.repository';
export * from './lib/seller-offering/repository/type-orm-seller-offering.repository';
export * from './lib/seller-offering/repository/mikro-orm-seller-offering.repository';
export * from './lib/seller-transaction/repository/type-orm-seller-transaction.repository';
export * from './lib/seller-transaction/repository/mikro-orm-seller-transaction.repository';
export * from './lib/seller-payout/repository/type-orm-seller-payout.repository';
export * from './lib/seller-payout/repository/mikro-orm-seller-payout.repository';
export * from './lib/seller-payout-line/repository/type-orm-seller-payout-line.repository';
export * from './lib/seller-payout-line/repository/mikro-orm-seller-payout-line.repository';
export * from './lib/seller-settlement/repository/type-orm-seller-settlement.repository';
export * from './lib/seller-settlement/repository/mikro-orm-seller-settlement.repository';

/* Commission, the order split and the seller scope. */
export * from './lib/commission/seller-commission.service';
export * from './lib/split/seller-split.service';
export * from './lib/seller-scope/seller-scope';
export * from './lib/seller-scope/seller-access.guard';

/* Persistence and the API surface. */
export * from './lib/database/migrations/1791000000380-CreateMarketplaceTables';
export * from './lib/graphql';
