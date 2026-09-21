import { RolePermissionModule } from '@gauzy/core';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SellerPayoutLine } from './seller-payout-line.entity';
import { SellerPayoutLineController } from './seller-payout-line.controller';
import { SellerPayoutLineService } from './seller-payout-line.service';
import { TypeOrmSellerPayoutLineRepository } from './repository/type-orm-seller-payout-line.repository';
import { MikroOrmSellerPayoutLineRepository } from './repository/mikro-orm-seller-payout-line.repository';
import { SellerPayout } from '../seller-payout/seller-payout.entity';
import { TypeOrmSellerPayoutRepository } from '../seller-payout/repository/type-orm-seller-payout.repository';
import { Seller } from '../seller/seller.entity';
import { TypeOrmSellerRepository } from '../seller/repository/type-orm-seller.repository';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';

/**
 * The payout-line aggregate: the join that makes the "at most one live payout per transaction"
 * guarantee readable, and the reads that keep one seller out of another's payments.
 *
 * The seller table is registered here although this aggregate owns no column of it: the access guard
 * this module mounts resolves a caller's membership against the seller's **party**, which is a column
 * of the seller row, so the guard needs the seller repository in whichever module's injector it is
 * instantiated. A module that mounts the guard without it starts the application and then fails to
 * resolve the guard, which is a boot failure rather than a refusal.
 */
@Module({
	controllers: [SellerPayoutLineController],
	imports: [
		// The controllers below are guarded, and the guard resolves the caller's permissions.
		RolePermissionModule,
		TypeOrmModule.forFeature([SellerPayoutLine, SellerPayout, Seller]),
		MikroOrmModule.forFeature([SellerPayoutLine, SellerPayout, Seller])
	],
	providers: [
		SellerPayoutLineService,
		SellerAccessGuard,
		TypeOrmSellerPayoutLineRepository,
		MikroOrmSellerPayoutLineRepository,
		TypeOrmSellerPayoutRepository,
		TypeOrmSellerRepository
	],
	exports: [SellerPayoutLineService, TypeOrmSellerPayoutLineRepository, MikroOrmSellerPayoutLineRepository]
})
export class SellerPayoutLineModule {}
