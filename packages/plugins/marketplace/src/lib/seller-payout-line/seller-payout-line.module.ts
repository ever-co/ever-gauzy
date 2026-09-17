import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SellerPayoutLine } from './seller-payout-line.entity';
import { SellerPayoutLineController } from './seller-payout-line.controller';
import { SellerPayoutLineService } from './seller-payout-line.service';
import { TypeOrmSellerPayoutLineRepository } from './repository/type-orm-seller-payout-line.repository';
import { MikroOrmSellerPayoutLineRepository } from './repository/mikro-orm-seller-payout-line.repository';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';

/**
 * The payout-line aggregate: the join that makes the "at most one live payout per transaction"
 * guarantee readable.
 */
@Module({
	controllers: [SellerPayoutLineController],
	imports: [TypeOrmModule.forFeature([SellerPayoutLine]), MikroOrmModule.forFeature([SellerPayoutLine])],
	providers: [
		SellerPayoutLineService,
		SellerAccessGuard,
		TypeOrmSellerPayoutLineRepository,
		MikroOrmSellerPayoutLineRepository
	],
	exports: [SellerPayoutLineService, TypeOrmSellerPayoutLineRepository, MikroOrmSellerPayoutLineRepository]
})
export class SellerPayoutLineModule {}
