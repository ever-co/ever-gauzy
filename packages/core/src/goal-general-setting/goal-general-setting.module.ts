import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoalGeneralSettingController } from './goal-general-setting.controller';
import { GoalGeneralSetting } from './goal-general-setting.entity';
import { GoalGeneralSettingService } from './goal-general-setting.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/goal-general-settings', module: GoalGeneralSettingModule }
		]),
		TypeOrmModule.forFeature([GoalGeneralSetting]),
		TenantModule
	],
	controllers: [GoalGeneralSettingController],
	providers: [GoalGeneralSettingService],
	exports: [GoalGeneralSettingService]
})
export class GoalGeneralSettingModule {}
