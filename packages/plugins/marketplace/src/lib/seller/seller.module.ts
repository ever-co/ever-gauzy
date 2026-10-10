import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventOutboxModule, RolePermissionModule } from '@gauzy/core';
import { Seller } from './seller.entity';
import { SellerController } from './seller.controller';
import { SellerService } from './seller.service';
import { TypeOrmSellerRepository } from './repository/type-orm-seller.repository';
import { MikroOrmSellerRepository } from './repository/mikro-orm-seller.repository';
import { SellerTransaction } from '../seller-transaction/seller-transaction.entity';
import { TypeOrmSellerTransactionRepository } from '../seller-transaction/repository/type-orm-seller-transaction.repository';
import { MikroOrmSellerTransactionRepository } from '../seller-transaction/repository/mikro-orm-seller-transaction.repository';
import { SellerPayout } from '../seller-payout/seller-payout.entity';
import { TypeOrmSellerPayoutRepository } from '../seller-payout/repository/type-orm-seller-payout.repository';
import { MikroOrmSellerPayoutRepository } from '../seller-payout/repository/mikro-orm-seller-payout.repository';
import { SellerSettlement } from '../seller-settlement/seller-settlement.entity';
import { TypeOrmSellerSettlementRepository } from '../seller-settlement/repository/type-orm-seller-settlement.repository';
import { MikroOrmSellerSettlementRepository } from '../seller-settlement/repository/mikro-orm-seller-settlement.repository';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';

/**
 * The seller aggregate.
 *
 * The module registers the ledger tables it reads as well as its own, because a seller's statement and
 * balance are summed from the ledger rather than cached on the seller: there is no balance column to
 * keep true, so there is nothing that can drift. Services in this package depend on repositories and
 * never on each other, which is what keeps the aggregate modules acyclic.
 */
@Module({
	controllers: [SellerController],
	imports: [
		// The controllers below are guarded, and the guard resolves the caller's permissions.
		RolePermissionModule,
		TypeOrmModule.forFeature([Seller, SellerTransaction, SellerPayout, SellerSettlement]),
		MikroOrmModule.forFeature([Seller, SellerTransaction, SellerPayout, SellerSettlement]),
		EventOutboxModule
	],
	providers: [
		SellerService,
		SellerAccessGuard,
		TypeOrmSellerRepository,
		MikroOrmSellerRepository,
		TypeOrmSellerTransactionRepository,
		MikroOrmSellerTransactionRepository,
		TypeOrmSellerPayoutRepository,
		MikroOrmSellerPayoutRepository,
		TypeOrmSellerSettlementRepository,
		MikroOrmSellerSettlementRepository
	],
	exports: [
		SellerService,
		SellerAccessGuard,
		TypeOrmSellerRepository,
		MikroOrmSellerRepository,
		TypeOrmSellerTransactionRepository,
		MikroOrmSellerTransactionRepository,
		TypeOrmSellerPayoutRepository,
		MikroOrmSellerPayoutRepository,
		TypeOrmSellerSettlementRepository,
		MikroOrmSellerSettlementRepository
	]
})
export class SellerModule {}
