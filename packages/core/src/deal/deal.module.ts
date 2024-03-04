import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Deal } from './deal.entity';
import { StageModule } from '../pipeline-stage/pipeline-stage.module';
import { AuthModule } from '../auth/auth.module';
import { DealController } from './deal.controller';
import { DealService } from './deal.service';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/deals', module: DealModule }]),
		TypeOrmModule.forFeature([Deal]),
		MikroOrmModule.forFeature([Deal]),
		StageModule,
		AuthModule,
		TenantModule,
		RolePermissionModule
	],
	controllers: [DealController],
	providers: [DealService],
	exports: [DealService]
})
export class DealModule { }
