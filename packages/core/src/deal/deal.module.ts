import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { Deal } from './deal.entity';
import { StageModule } from '../pipeline-stage/pipeline-stage.module';
import { AuthModule } from '../auth/auth.module';
import { DealController } from './deal.controller';
import { DealService } from './deal.service';
import { TenantModule } from '../tenant/tenant.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/deals', module: DealModule }]),
		TypeOrmModule.forFeature([Deal]),
		MikroOrmModule.forFeature([Deal]),
		StageModule,
		AuthModule,
		TenantModule
	],
	controllers: [DealController],
	providers: [DealService],
	exports: [DealService]
})
export class DealModule { }
