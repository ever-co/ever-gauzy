import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Seller } from './seller/seller.entity';
import { SellerOffering } from './seller-offering/seller-offering.entity';
import { SellerTransaction } from './seller-transaction/seller-transaction.entity';
import { AdjustmentModule, EventOutboxModule, RolePermissionModule } from '@gauzy/core';
import { Module } from '@nestjs/common';
import { SellerModule } from './seller/seller.module';
import { SellerOfferingModule } from './seller-offering/seller-offering.module';
import { SellerTransactionModule } from './seller-transaction/seller-transaction.module';
import { SellerPayoutModule } from './seller-payout/seller-payout.module';
import { SellerPayoutLineModule } from './seller-payout-line/seller-payout-line.module';
import { SellerSettlementModule } from './seller-settlement/seller-settlement.module';
import { SellerCommissionService } from './commission/seller-commission.service';
import { SellerSplitService } from './split/seller-split.service';
import { SellerFundingService } from './funding/seller-funding.service';
import { resolvers } from './graphql/resolvers';
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
		// The repositories declared below are bound to their entities, so the module registers them here -
		// the same registration every aggregate module performs for the entities it owns.
		TypeOrmModule.forFeature([Seller, SellerOffering, SellerTransaction]),
		MikroOrmModule.forFeature([Seller, SellerOffering, SellerTransaction]),
		// The funding reader asks the kernel's ledger service which discounts a line carries and who bore
		// them, so the module that provides it imports the kernel's adjustment module rather than mapping
		// the ledger a second time.
		AdjustmentModule,
		EventOutboxModule,
		// The resolver provided below carries the platform's permission guards, and a guard is resolved
		// in the context of the module that hosts the handler it protects — so the module that hosts the
		// resolver has to reach the permission service the guard asks for. The aggregate modules import
		// this for their own controllers; this one hosts the resolver, so it imports it too.
		RolePermissionModule,
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
		SellerFundingService,
		TypeOrmSellerRepository,
		TypeOrmSellerOfferingRepository,
		TypeOrmSellerTransactionRepository,
		// The GraphQL resolver is a provider here for the same reason each controller is a provider of
		// its own aggregate module: it injects the six aggregate services this module imports, so it
		// belongs in an injector context that can reach them. The plugin hands the composition pass the
		// same classes through `extensions.resolvers`, so there is one resolver implementation per rule
		// rather than one per surface.
		...resolvers
	],
	exports: [
		SellerModule,
		SellerOfferingModule,
		SellerTransactionModule,
		SellerPayoutModule,
		SellerPayoutLineModule,
		SellerSettlementModule,
		SellerCommissionService,
		SellerSplitService,
		SellerFundingService
	]
})
export class MarketplaceModule {}
