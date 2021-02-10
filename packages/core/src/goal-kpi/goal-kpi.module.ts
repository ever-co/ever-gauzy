import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { GoalKpiController } from './goal-kpi.controller';
import { GoalKpiService } from './goal-kpi.service';
import { GoalKPI } from './goal-kpi.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([{ path: '/goal-kpi', module: GoalKpiModule }]),
		TypeOrmModule.forFeature([GoalKPI]),
		TenantModule
	],
	controllers: [GoalKpiController],
	providers: [GoalKpiService],
	exports: [GoalKpiService]
})
export class GoalKpiModule {}
