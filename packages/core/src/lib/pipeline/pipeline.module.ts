import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pipeline } from './pipeline.entity';
import { StageModule } from '../pipeline-stage/pipeline-stage.module';
import { DealModule } from '../deal/deal.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';
import { TypeOrmPipelineRepository } from './repository/type-orm-pipeline.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Pipeline]),
		MikroOrmModule.forFeature([Pipeline]),
		StageModule,
		DealModule,
		RolePermissionModule,
		UserModule
	],
	controllers: [PipelineController],
	providers: [PipelineService, TypeOrmPipelineRepository]
})
export class PipelineModule {}
