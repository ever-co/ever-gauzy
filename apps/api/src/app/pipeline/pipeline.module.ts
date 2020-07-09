import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pipeline } from './pipeline.entity';
import { StageModule } from '../stage/stage.module';
import { DealModule } from '../deal/deal.module';
import { Deal } from '../deal/deal.entity';

@Module( {
  imports: [
    TypeOrmModule.forFeature( [ Pipeline, Deal ] ),
    StageModule,
    DealModule,
    AuthModule,
  ],
  controllers: [ PipelineController ],
  providers: [
    PipelineService,
  ],
  exports: [ PipelineService ],
} )
export class PipelineModule
{
}
