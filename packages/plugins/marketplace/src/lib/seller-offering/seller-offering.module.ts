import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { SellerOffering } from './seller-offering.entity';
import { SellerOfferingController } from './seller-offering.controller';
import { SellerOfferingService } from './seller-offering.service';
import { TypeOrmSellerOfferingRepository } from './repository/type-orm-seller-offering.repository';
import { MikroOrmSellerOfferingRepository } from './repository/mikro-orm-seller-offering.repository';
import { Seller } from '../seller/seller.entity';
import { TypeOrmSellerRepository } from '../seller/repository/type-orm-seller.repository';
import { SellerAccessGuard } from '../seller-scope/seller-access.guard';

/**
 * The offering aggregate.
 *
 * It reads the seller through the seller repository rather than through the seller service, which is
 * what keeps the aggregate modules acyclic: services depend on repositories, never on each other.
 */
@Module({
	controllers: [SellerOfferingController],
	imports: [TypeOrmModule.forFeature([SellerOffering, Seller]), MikroOrmModule.forFeature([SellerOffering, Seller])],
	providers: [
		SellerOfferingService,
		SellerAccessGuard,
		TypeOrmSellerOfferingRepository,
		MikroOrmSellerOfferingRepository,
		TypeOrmSellerRepository
	],
	exports: [SellerOfferingService, TypeOrmSellerOfferingRepository]
})
export class SellerOfferingModule {}
