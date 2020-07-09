import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Deal } from './deal.entity';
import { StageModule } from '../stage/stage.module';
import { AuthModule } from '../auth/auth.module';
import { DealController } from './deal.controller';
import { DealService } from './deal.service';

@Module( {
  imports: [
    TypeOrmModule.forFeature( [ Deal ] ),
    StageModule,
    AuthModule,
  ],
  controllers: [
    DealController,
  ],
  providers: [
    DealService,
  ],
  exports: [
    DealService,
  ],
} )
export class DealModule
{
}
