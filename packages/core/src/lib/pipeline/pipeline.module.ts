import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pipeline } from './pipeline.entity';
import { StageModule } from '../pipeline-stage/pipeline-stage.module';
import { DealModule } from '../deal/deal.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';
import { TypeOrmPipelineRepository } from './repository';

@Module({
	imports: [
		RouterModule.register([
			{ path: '/pipelines', module: PipelineModule }
		]),
		TypeOrmModule.forFeature([Pipeline]),
		MikroOrmModule.forFeature([Pipeline]),
		StageModule,
		DealModule,
		RolePermissionModule,
		UserModule
	],
	controllers: [PipelineController],
	providers: [PipelineService, TypeOrmPipelineRepository],
	exports: [PipelineService, TypeOrmPipelineRepository]
})
export class PipelineModule { }
