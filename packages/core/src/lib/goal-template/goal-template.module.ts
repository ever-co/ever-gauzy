import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GoalTemplateController } from './goal-template.controller';
import { GoalTemplateService } from './goal-template.service';
import { GoalTemplate } from './goal-template.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmGoalTemplateRepository } from './repository/type-orm-goal-template.repository';
import { MikroOrmGoalTemplateRepository } from './repository/mikro-orm-goal-template.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([GoalTemplate]),
		MikroOrmModule.forFeature([GoalTemplate]),
		RolePermissionModule
	],
	controllers: [GoalTemplateController],
	providers: [GoalTemplateService, TypeOrmGoalTemplateRepository, MikroOrmGoalTemplateRepository]
})
export class GoalTemplateModule {}