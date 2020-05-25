import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { AuthModule } from '../auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pipeline } from './pipeline.entity';
import { Module } from '@nestjs/common';



@Module({
  imports: [ TypeOrmModule.forFeature([ Pipeline ] ), AuthModule ],
  controllers: [ PipelineController ],
  providers: [ PipelineService ],
  exports: [ PipelineService ],
})
export class PipelineModule
{
}
