import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PipelineStage } from './pipeline-stage.entity';
import { StageService } from './pipeline-stage.service';
import { TypeOrmPipelineStageRepository } from './repository/type-orm-pipeline-stage.repository';
import { MikroOrmPipelineStageRepository } from './repository/mikro-orm-pipeline-stage.repository';

@Module({
	imports: [TypeOrmModule.forFeature([PipelineStage]), MikroOrmModule.forFeature([PipelineStage])],
	providers: [StageService, TypeOrmPipelineStageRepository, MikroOrmPipelineStageRepository],
	exports: [StageService, TypeOrmPipelineStageRepository, MikroOrmPipelineStageRepository]
})
export class StageModule {}