import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { TaskView } from './view.entity';
import { CommandHandlers } from './commands/handlers';
import { TaskViewService } from './view.service';
import { TaskViewController } from './view.controller';
import { TypeOrmTaskViewRepository } from './repository/type-orm-task-view.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([TaskView]),
		MikroOrmModule.forFeature([TaskView]),
		RolePermissionModule,
		CqrsModule
	],
	providers: [TaskViewService, TypeOrmTaskViewRepository, ...CommandHandlers],
	controllers: [TaskViewController],
	exports: [TaskViewService, TypeOrmTaskViewRepository]
})
export class TaskViewModule {}
