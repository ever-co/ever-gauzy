import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskEstimation } from './task-estimation.entity';
import { TaskEstimationController } from './task-estimation.controller';
import { TaskEstimationService } from './task-estimation.service';
import { TaskModule } from '../task.module';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.register([{ path: '/task-estimation', module: TaskEstimationModule }]),
		TypeOrmModule.forFeature([TaskEstimation]),
		MikroOrmModule.forFeature([TaskEstimation]),
		RolePermissionModule,
		CqrsModule,
		TaskModule
	],
	controllers: [TaskEstimationController],
	providers: [TaskEstimationService, ...CommandHandlers],
	exports: [TaskEstimationService]
})
export class TaskEstimationModule { }
