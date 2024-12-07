import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GoalTemplateController } from './goal-template.controller';
import { GoalTemplateService } from './goal-template.service';
import { GoalTemplate } from './goal-template.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/goal-templates', module: GoalTemplateModule }]),
		TypeOrmModule.forFeature([GoalTemplate]),
		MikroOrmModule.forFeature([GoalTemplate]),
		RolePermissionModule
	],
	controllers: [GoalTemplateController],
	providers: [GoalTemplateService],
	exports: [GoalTemplateService]
})
export class GoalTemplateModule { }
