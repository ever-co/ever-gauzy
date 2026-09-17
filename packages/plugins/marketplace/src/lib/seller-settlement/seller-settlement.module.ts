import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventOutboxModule } from '@gauzy/core';
import { SellerSettlement } from './seller-settlement.entity';
import { SellerSettlementController } from './seller-settlement.controller';
import { SellerSettlementService } from './seller-settlement.service';
import { TypeOrmSellerSettlementRepository } from './repository/type-orm-seller-settlement.repository';
import { MikroOrmSellerSettlementRepository } from './repository/mikro-orm-seller-settlement.repository';
import { SellerTransaction } from '../seller-transaction/seller-transaction.entity';
import { TypeOrmSellerTransactionRepository } from '../seller-transaction/repository/type-orm-seller-transaction.repository';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';

/**
 * The settlement aggregate: the provider's report, recorded as reported.
 *
 * It reads the ledger to compute a discrepancy, which is what makes the reconciliation a comparison
 * rather than an assertion.
 */
@Module({
	controllers: [SellerSettlementController],
	imports: [
		TypeOrmModule.forFeature([SellerSettlement, SellerTransaction]),
		MikroOrmModule.forFeature([SellerSettlement, SellerTransaction]),
		EventOutboxModule
	],
	providers: [
		SellerSettlementService,
		SellerAccessGuard,
		TypeOrmSellerSettlementRepository,
		MikroOrmSellerSettlementRepository,
		TypeOrmSellerTransactionRepository
	],
	exports: [SellerSettlementService, TypeOrmSellerSettlementRepository]
})
export class SellerSettlementModule {}
