import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GoalGeneralSettingController } from './goal-general-setting.controller';
import { GoalGeneralSetting } from './goal-general-setting.entity';
import { GoalGeneralSettingService } from './goal-general-setting.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmGoalGeneralSettingRepository } from './repository/type-orm-goal-general-setting.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([GoalGeneralSetting]),
		MikroOrmModule.forFeature([GoalGeneralSetting]),
		RolePermissionModule
	],
	controllers: [GoalGeneralSettingController],
	providers: [GoalGeneralSettingService, TypeOrmGoalGeneralSettingRepository]
})
export class GoalGeneralSettingModule {}
