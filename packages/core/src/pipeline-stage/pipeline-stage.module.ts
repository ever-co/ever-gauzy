import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PipelineStage } from './pipeline-stage.entity';
import { StageService } from './pipeline-stage.service';

@Module({
	imports: [TypeOrmModule.forFeature([PipelineStage]), AuthModule],
	providers: [StageService],
	exports: [StageService]
})
export class StageModule {}
