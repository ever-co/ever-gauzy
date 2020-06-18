import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pipeline } from './pipeline.entity';
import { StageModule } from '../stage/stage.module';

@Module({
	imports: [TypeOrmModule.forFeature([Pipeline]), StageModule, AuthModule],
	controllers: [PipelineController],
	providers: [PipelineService],
	exports: [PipelineService]
})
export class PipelineModule {}
