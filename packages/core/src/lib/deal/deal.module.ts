import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { Deal } from './deal.entity';
import { DealController } from './deal.controller';
import { DealService } from './deal.service';
import { TypeOrmDealRepository } from './repository/type-orm-deal.repository';

@Module({
	imports: [TypeOrmModule.forFeature([Deal]), MikroOrmModule.forFeature([Deal]), RolePermissionModule],
	controllers: [DealController],
	providers: [DealService, TypeOrmDealRepository],
	exports: [DealService, TypeOrmDealRepository]
})
export class DealModule {}
