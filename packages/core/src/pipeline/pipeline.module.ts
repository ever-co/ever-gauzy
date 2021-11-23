import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { AuthModule } from '../auth/auth.module';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pipeline } from './pipeline.entity';
import { StageModule } from '../pipeline-stage/pipeline-stage.module';
import { DealModule } from '../deal/deal.module';
import { Deal } from '../deal/deal.entity';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/pipelines', module: PipelineModule }
		]),
		TypeOrmModule.forFeature([Pipeline, Deal]),
		StageModule,
		DealModule,
		AuthModule,
		TenantModule,
		UserModule
	],
	controllers: [PipelineController],
	providers: [PipelineService],
	exports: [PipelineService]
})
export class PipelineModule {}
