import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AuthModule } from '../auth/auth.module';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pipeline } from './pipeline.entity';
import { StageModule } from '../pipeline-stage/pipeline-stage.module';
import { DealModule } from '../deal/deal.module';
import { Deal } from '../deal/deal.entity';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/pipelines', module: PipelineModule }]),
		TypeOrmModule.forFeature([Pipeline, Deal]),
		MikroOrmModule.forFeature([Pipeline, Deal]),
		StageModule,
		DealModule,
		AuthModule,
		TenantModule,
		RolePermissionModule,
		UserModule
	],
	controllers: [PipelineController],
	providers: [PipelineService],
	exports: [PipelineService]
})
export class PipelineModule { }
