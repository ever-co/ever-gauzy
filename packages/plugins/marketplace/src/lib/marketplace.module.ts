import { Module } from '@nestjs/common';
import { SellerModule } from './seller/seller.module';
import { SellerOfferingModule } from './seller-offering/seller-offering.module';
import { SellerTransactionModule } from './seller-transaction/seller-transaction.module';
import { SellerPayoutModule } from './seller-payout/seller-payout.module';
import { SellerPayoutLineModule } from './seller-payout-line/seller-payout-line.module';
import { SellerSettlementModule } from './seller-settlement/seller-settlement.module';
import { SellerCommissionService } from './commission/seller-commission.service';
import { SellerSplitService } from './split/seller-split.service';
import { TypeOrmSellerRepository } from './seller/repository/type-orm-seller.repository';
import { TypeOrmSellerOfferingRepository } from './seller-offering/repository/type-orm-seller-offering.repository';
import { TypeOrmSellerTransactionRepository } from './seller-transaction/repository/type-orm-seller-transaction.repository';

/**
 * The marketplace, as one module the plugin registers.
 *
 * The aggregate modules are imported rather than merged, so each one owns its controllers, its own
 * entity mapping and its own repositories, and the marketplace module is the single place the platform
 * sees. The commission resolution and the order split are provided here because they belong to no
 * single aggregate: the commission is resolved across the offering, the seller and the platform
 * default, and the split writes the ledger the other five aggregates read.
 */
@Module({
	imports: [
		SellerModule,
		SellerOfferingModule,
		SellerTransactionModule,
		SellerPayoutModule,
		SellerPayoutLineModule,
		SellerSettlementModule
	],
	providers: [
		SellerCommissionService,
		SellerSplitService,
		TypeOrmSellerRepository,
		TypeOrmSellerOfferingRepository,
		TypeOrmSellerTransactionRepository
	],
	exports: [
		SellerModule,
		SellerOfferingModule,
		SellerTransactionModule,
		SellerPayoutModule,
		SellerPayoutLineModule,
		SellerSettlementModule,
		SellerCommissionService,
		SellerSplitService
	]
})
export class MarketplaceModule {}
