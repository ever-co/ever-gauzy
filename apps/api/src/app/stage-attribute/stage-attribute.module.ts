import { StageAttributeController } from './stage-attribute.controller';
import { StageAttributeService } from './stage-attribute.service';
import { StageAttribute } from './stage-attribute.entity';
import { AuthModule } from '../auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';



@Module({
  imports: [ TypeOrmModule.forFeature([ StageAttribute ] ), AuthModule ],
  controllers: [ StageAttributeController ],
  providers: [ StageAttributeService ],
  exports: [ StageAttributeService ],
})
export class StageAttributeModule
{
}
