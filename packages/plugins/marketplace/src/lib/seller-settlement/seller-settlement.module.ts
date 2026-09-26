import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventOutboxModule, RolePermissionModule } from '@gauzy/core';
import { SellerSettlement } from './seller-settlement.entity';
import { SellerSettlementController } from './seller-settlement.controller';
import { SellerSettlementService } from './seller-settlement.service';
import { TypeOrmSellerSettlementRepository } from './repository/type-orm-seller-settlement.repository';
import { MikroOrmSellerSettlementRepository } from './repository/mikro-orm-seller-settlement.repository';
import { SellerTransaction } from '../seller-transaction/seller-transaction.entity';
import { TypeOrmSellerTransactionRepository } from '../seller-transaction/repository/type-orm-seller-transaction.repository';
import { Seller } from '../seller/seller.entity';
import { TypeOrmSellerRepository } from '../seller/repository/type-orm-seller.repository';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';

/**
 * The settlement aggregate: the provider's report, recorded as reported.
 *
 * It reads the ledger to compute a discrepancy, which is what makes the reconciliation a comparison
 * rather than an assertion.
 *
 * The seller table is registered here although this aggregate owns no column of it: the access guard
 * this module mounts resolves a caller's membership against the seller's **party**, which is a column
 * of the seller row, so the guard needs the seller repository in whichever module's injector it is
 * instantiated.
 */
@Module({
	controllers: [SellerSettlementController],
	imports: [
		// The controllers below are guarded, and the guard resolves the caller's permissions.
		RolePermissionModule,
		TypeOrmModule.forFeature([SellerSettlement, SellerTransaction, Seller]),
		MikroOrmModule.forFeature([SellerSettlement, SellerTransaction, Seller]),
		EventOutboxModule
	],
	providers: [
		SellerSettlementService,
		SellerAccessGuard,
		TypeOrmSellerSettlementRepository,
		MikroOrmSellerSettlementRepository,
		TypeOrmSellerTransactionRepository,
		TypeOrmSellerRepository
	],
	exports: [SellerSettlementService, TypeOrmSellerSettlementRepository]
})
export class SellerSettlementModule {}
