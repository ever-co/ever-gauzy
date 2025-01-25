import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GoalTimeFrameController } from './goal-time-frame.controller';
import { GoalTimeFrameService } from './goal-time-frame.service';
import { GoalTimeFrame } from './goal-time-frame.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmGoalTimeFrameRepository } from './repository/type-orm-goal-time-frame.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([GoalTimeFrame]),
		MikroOrmModule.forFeature([GoalTimeFrame]),
		RolePermissionModule
	],
	controllers: [GoalTimeFrameController],
	providers: [GoalTimeFrameService, TypeOrmGoalTimeFrameRepository]
})
export class GoalTimeFrameModule {}
