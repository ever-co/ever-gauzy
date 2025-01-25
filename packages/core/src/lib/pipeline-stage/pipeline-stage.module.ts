import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PipelineStage } from './pipeline-stage.entity';
import { StageService } from './pipeline-stage.service';
import { TypeOrmPipelineStageRepository } from './repository/type-orm-pipeline-stage.repository';

@Module({
	imports: [TypeOrmModule.forFeature([PipelineStage]), MikroOrmModule.forFeature([PipelineStage])],
	providers: [StageService, TypeOrmPipelineStageRepository],
	exports: [StageService, TypeOrmPipelineStageRepository]
})
export class StageModule {}
