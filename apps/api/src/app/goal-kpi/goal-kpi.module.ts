import { Module } from '@nestjs/common';
import { GoalKpiController } from './goal-kpi.controller';
import { GoalKpiService } from './goal-kpi.service';
import { GoalKPI } from './goal-kpi.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [TypeOrmModule.forFeature([GoalKPI]), TenantModule],
	controllers: [GoalKpiController],
	providers: [GoalKpiService],
	exports: [GoalKpiService]
})
export class GoalKpiModule {}
