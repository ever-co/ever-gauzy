import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { GoalTemplateController } from './goal-template.controller';
import { GoalTemplateService } from './goal-template.service';
import { GoalTemplate } from './goal-template.entity';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/goal-templates', module: GoalTemplateModule }
		]),
		TypeOrmModule.forFeature([GoalTemplate]),
		TenantModule
	],
	controllers: [GoalTemplateController],
	providers: [GoalTemplateService],
	exports: [GoalTemplateService]
})
export class GoalTemplateModule {}
