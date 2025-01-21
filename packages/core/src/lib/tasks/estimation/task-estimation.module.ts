import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskEstimation } from './task-estimation.entity';
import { TaskEstimationController } from './task-estimation.controller';
import { TaskEstimationService } from './task-estimation.service';
import { TaskModule } from '../task.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmTaskEstimationRepository } from './repository/type-orm-estimation.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([TaskEstimation]),
		MikroOrmModule.forFeature([TaskEstimation]),
		RolePermissionModule,
		CqrsModule,
		TaskModule
	],
	controllers: [TaskEstimationController],
	providers: [TaskEstimationService, TypeOrmTaskEstimationRepository, ...CommandHandlers]
})
export class TaskEstimationModule {}
