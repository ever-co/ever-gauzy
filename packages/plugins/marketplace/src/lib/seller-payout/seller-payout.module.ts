import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventOutboxModule, SequenceModule, RolePermissionModule } from '@gauzy/core';
import { SellerPayout } from './seller-payout.entity';
import { SellerPayoutController } from './seller-payout.controller';
import { SellerPayoutService } from './seller-payout.service';
import { TypeOrmSellerPayoutRepository } from './repository/type-orm-seller-payout.repository';
import { MikroOrmSellerPayoutRepository } from './repository/mikro-orm-seller-payout.repository';
import { SellerPayoutLine } from '../seller-payout-line/seller-payout-line.entity';
import { TypeOrmSellerPayoutLineRepository } from '../seller-payout-line/repository/type-orm-seller-payout-line.repository';
import { SellerTransaction } from '../seller-transaction/seller-transaction.entity';
import { TypeOrmSellerTransactionRepository } from '../seller-transaction/repository/type-orm-seller-transaction.repository';
import { Seller } from '../seller/seller.entity';
import { TypeOrmSellerRepository } from '../seller/repository/type-orm-seller.repository';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';

/**
 * The payout aggregate: the instruction side of money movement.
 *
 * Numbering comes from the platform's sequence service, which is why the module imports it: a payout
 * number is a document number like any other, and drawing it from a second mechanism would give the
 * platform two answers to "what is the next payout number".
 */
@Module({
	controllers: [SellerPayoutController],
	imports: [
		// The controllers below are guarded, and the guard resolves the caller's permissions.
		RolePermissionModule,
		TypeOrmModule.forFeature([SellerPayout, SellerPayoutLine, SellerTransaction, Seller]),
		MikroOrmModule.forFeature([SellerPayout, SellerPayoutLine, SellerTransaction, Seller]),
		EventOutboxModule,
		SequenceModule
	],
	providers: [
		SellerPayoutService,
		SellerAccessGuard,
		TypeOrmSellerPayoutRepository,
		MikroOrmSellerPayoutRepository,
		TypeOrmSellerPayoutLineRepository,
		TypeOrmSellerTransactionRepository,
		TypeOrmSellerRepository
	],
	exports: [SellerPayoutService, TypeOrmSellerPayoutRepository, TypeOrmSellerPayoutLineRepository]
})
export class SellerPayoutModule {}
