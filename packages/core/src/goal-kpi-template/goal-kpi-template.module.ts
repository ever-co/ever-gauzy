import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoalKpiTemplateController } from './goal-kpi-template.controller';
import { GoalKpiTemplateService } from './goal-kpi-template.service';
import { GoalKPITemplate } from './goal-kpi-template.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/goal-kpi-template', module: GoalKpiTemplateModule }]),
		TypeOrmModule.forFeature([GoalKPITemplate]),
		TenantModule
	],
	controllers: [GoalKpiTemplateController],
	providers: [GoalKpiTemplateService],
	exports: [GoalKpiTemplateService]
})
export class GoalKpiTemplateModule {}
