import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { Deal } from './deal.entity';
import { DealController } from './deal.controller';
import { DealResolver } from './deal.resolver';
import { DealService } from './deal.service';
import { TypeOrmDealRepository } from './repository/type-orm-deal.repository';
import { MikroOrmDealRepository } from './repository/mikro-orm-deal.repository';

/**
 * The sales opportunity.
 *
 * The resolver is declared here, beside the service it calls, because a resolver is an ordinary Nest
 * provider and can only inject what the module hosting it can reach. It adds one provider and no
 * second dependency: this resolver injects `DealService` and nothing else.
 */
@Module({
	imports: [TypeOrmModule.forFeature([Deal]), MikroOrmModule.forFeature([Deal]), RolePermissionModule],
	controllers: [DealController],
	providers: [
		DealService,
		// The GraphQL view of the same resource.
		DealResolver,
		TypeOrmDealRepository,
		MikroOrmDealRepository
	],
	exports: [DealService, TypeOrmDealRepository, MikroOrmDealRepository]
})
export class DealModule {}