import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { BulkExecutor, EventOutboxModule, FieldVisibility, RolePermissionModule } from '@gauzy/core';
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
 *
 * The batch executor is declared here and handed on, because both surfaces apply a batch with it: the
 * controller that hosts the route resolves it from this module, and the GraphQL resolver — a provider of
 * the marketplace module, which imports this one — receives it through the export below. It decides what
 * a caller may do from the field visibility the platform reads everywhere else, so the offering resource
 * adopts the platform's bulk contract rather than assembling a runner of its own.
 */
@Module({
	controllers: [SellerOfferingController],
	imports: [
		// The controllers below are guarded, and the guard resolves the caller's permissions.
		RolePermissionModule,
		TypeOrmModule.forFeature([SellerOffering, Seller]),
		MikroOrmModule.forFeature([SellerOffering, Seller]),
		EventOutboxModule
	],
	providers: [
		SellerOfferingService,
		SellerAccessGuard,
		BulkExecutor,
		FieldVisibility,
		TypeOrmSellerOfferingRepository,
		MikroOrmSellerOfferingRepository,
		TypeOrmSellerRepository
	],
	exports: [SellerOfferingService, TypeOrmSellerOfferingRepository, BulkExecutor]
})
export class SellerOfferingModule {}
