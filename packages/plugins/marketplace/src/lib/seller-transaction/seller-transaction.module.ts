import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventOutboxModule } from '@gauzy/core';
import { SellerTransaction } from './seller-transaction.entity';
import { SellerTransactionController } from './seller-transaction.controller';
import { SellerTransactionService } from './seller-transaction.service';
import { TypeOrmSellerTransactionRepository } from './repository/type-orm-seller-transaction.repository';
import { MikroOrmSellerTransactionRepository } from './repository/mikro-orm-seller-transaction.repository';
import { Seller } from '../seller/seller.entity';
import { TypeOrmSellerRepository } from '../seller/repository/type-orm-seller.repository';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';

/**
 * The seller ledger aggregate.
 *
 * The controller class is named after the aggregate while the file keeps the entity's name, so the
 * contract check finds one controller per aggregate folder without renaming the entity.
 */
@Module({
	controllers: [SellerTransactionController],
	imports: [
		TypeOrmModule.forFeature([SellerTransaction, Seller]),
		MikroOrmModule.forFeature([SellerTransaction, Seller]),
		EventOutboxModule
	],
	providers: [
		SellerTransactionService,
		SellerAccessGuard,
		TypeOrmSellerTransactionRepository,
		MikroOrmSellerTransactionRepository,
		TypeOrmSellerRepository
	],
	exports: [SellerTransactionService, TypeOrmSellerTransactionRepository, TypeOrmSellerRepository]
})
export class SellerTransactionModule {}
