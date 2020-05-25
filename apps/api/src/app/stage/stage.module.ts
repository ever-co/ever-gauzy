import { StageController } from './stage.controller';
import { AuthModule } from '../auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StageService } from './stage.service';
import { Module } from '@nestjs/common';
import { Stage } from './stage.entity';



@Module({
  imports: [ TypeOrmModule.forFeature([ Stage ] ), AuthModule ],
  controllers: [ StageController ],
  providers: [ StageService ],
  exports: [ StageService ],
})
export class StageModule
{
}
