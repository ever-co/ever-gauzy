import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GoalGeneralSettingController } from './goal-general-setting.controller';
import { GoalGeneralSetting } from './goal-general-setting.entity';
import { GoalGeneralSettingService } from './goal-general-setting.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/goal-general-setting', module: GoalGeneralSettingModule }]),
		TypeOrmModule.forFeature([GoalGeneralSetting]),
		MikroOrmModule.forFeature([GoalGeneralSetting]),
		RolePermissionModule
	],
	controllers: [GoalGeneralSettingController],
	providers: [GoalGeneralSettingService],
	exports: [GoalGeneralSettingService]
})
export class GoalGeneralSettingModule { }
