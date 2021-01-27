import { Module } from '@nestjs/common';
import { GoalTimeFrameController } from './goal-time-frame.controller';
import { GoalTimeFrameService } from './goal-time-frame.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoalTimeFrame } from './goal-time-frame.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [TypeOrmModule.forFeature([GoalTimeFrame]), TenantModule],
	controllers: [GoalTimeFrameController],
	providers: [GoalTimeFrameService],
	exports: [GoalTimeFrameService]
})
export class GoalTimeFrameModule {}
