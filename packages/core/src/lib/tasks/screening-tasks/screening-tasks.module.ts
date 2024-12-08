import { CqrsModule } from '@nestjs/cqrs';
import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskModule } from '../task.module';
import { CommandHandlers } from './commands/handlers';
import { ScreeningTasksService } from './screening-tasks.service';
import { ScreeningTasksController } from './screening-tasks.controller';
import { ScreeningTask } from './screening-task.entity';
import { TypeOrmScreeningTaskRepository } from './repository/type-orm-screening-task.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([ScreeningTask]),
		MikroOrmModule.forFeature([ScreeningTask]),
		RolePermissionModule,
		TaskModule,
		CqrsModule
	],
	providers: [ScreeningTasksService, TypeOrmScreeningTaskRepository, ...CommandHandlers],
	controllers: [ScreeningTasksController],
	exports: [ScreeningTasksService, TypeOrmModule, TypeOrmScreeningTaskRepository]
})
export class ScreeningTasksModule {}
