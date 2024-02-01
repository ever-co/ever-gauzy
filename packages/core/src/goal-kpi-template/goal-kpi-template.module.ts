import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoalKpiTemplateController } from './goal-kpi-template.controller';
import { GoalKpiTemplateService } from './goal-kpi-template.service';
import { GoalKPITemplate } from './goal-kpi-template.entity';
import { TenantModule } from '../tenant/tenant.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/goal-kpi-template', module: GoalKpiTemplateModule }]),
		TypeOrmModule.forFeature([GoalKPITemplate]),
		MikroOrmModule.forFeature([GoalKPITemplate]),
		TenantModule
	],
	controllers: [GoalKpiTemplateController],
	providers: [GoalKpiTemplateService],
	exports: [GoalKpiTemplateService]
})
export class GoalKpiTemplateModule { }
