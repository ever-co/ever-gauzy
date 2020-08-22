import { Module } from '@nestjs/common';
import { GoalKpiTemplateController } from './goal-kpi-template.controller';
import { GoalKpiTemplateService } from './goal-kpi-template.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoalKPITemplate } from './goal-kpi-template.entity';

@Module({
	imports: [TypeOrmModule.forFeature([GoalKPITemplate])],
	controllers: [GoalKpiTemplateController],
	providers: [GoalKpiTemplateService],
	exports: [GoalKpiTemplateService]
})
export class GoalKpiTemplateModule {}
