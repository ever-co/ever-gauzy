import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PipelineStage } from './pipeline-stage.entity';
import { StageService } from './pipeline-stage.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([PipelineStage]),
		MikroOrmModule.forFeature([PipelineStage])
	],
	providers: [StageService],
	exports: [StageService]
})
export class StageModule { }
