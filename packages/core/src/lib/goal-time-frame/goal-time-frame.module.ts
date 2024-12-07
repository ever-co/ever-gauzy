import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { GoalTimeFrameController } from './goal-time-frame.controller';
import { GoalTimeFrameService } from './goal-time-frame.service';
import { GoalTimeFrame } from './goal-time-frame.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/goal-time-frame', module: GoalTimeFrameModule }]),
		TypeOrmModule.forFeature([GoalTimeFrame]),
		MikroOrmModule.forFeature([GoalTimeFrame]),
		RolePermissionModule
	],
	controllers: [GoalTimeFrameController],
	providers: [GoalTimeFrameService],
	exports: [GoalTimeFrameService]
})
export class GoalTimeFrameModule { }
