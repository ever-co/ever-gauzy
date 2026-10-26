import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GoalGeneralSettingController } from './goal-general-setting.controller';
import { GoalGeneralSetting } from './goal-general-setting.entity';
import { GoalGeneralSettingResolver } from './goal-general-setting.resolver';
import { GoalGeneralSettingService } from './goal-general-setting.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmGoalGeneralSettingRepository } from './repository/type-orm-goal-general-setting.repository';
import { MikroOrmGoalGeneralSettingRepository } from './repository/mikro-orm-goal-general-setting.repository';

/**
 * The organization's policy for the objective programme.
 *
 * The resolver is declared here because a resolver can only inject services its own module can reach,
 * and this module is what reaches `GoalGeneralSettingService`; the service is exported beside it so a
 * module that hosts the resolver graph can import this one and receive what the resolver calls.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([GoalGeneralSetting]),
		MikroOrmModule.forFeature([GoalGeneralSetting]),
		RolePermissionModule
	],
	controllers: [GoalGeneralSettingController],
	providers: [
		GoalGeneralSettingService,
		// The GraphQL view of the same resource.
		GoalGeneralSettingResolver,
		TypeOrmGoalGeneralSettingRepository,
		MikroOrmGoalGeneralSettingRepository
	],
	exports: [GoalGeneralSettingService]
})
export class GoalGeneralSettingModule {}