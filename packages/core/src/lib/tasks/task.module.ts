import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventBusModule } from '../event-bus/event-bus.module';
import { IntegrationMap, TaskStatus } from '../core/entities/internal';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';
import { RoleModule } from './../role/role.module';
import { EmployeeModule } from './../employee/employee.module';
import { OrganizationProjectModule } from './../organization-project/organization-project.module';
import { OrganizationSprintModule } from './../organization-sprint/organization-sprint.module';
import { TaskViewModule } from './views/view.module';
import { Task } from './task.entity';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { TypeOrmTaskRepository } from './repository/type-orm-task.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Task, TaskStatus, IntegrationMap]),
		MikroOrmModule.forFeature([Task, TaskStatus, IntegrationMap]),
		RolePermissionModule,
		forwardRef(() => UserModule),
		RoleModule,
		EmployeeModule,
		OrganizationProjectModule,
		OrganizationSprintModule,
		TaskViewModule,
		CqrsModule,
		EventBusModule
	],
	controllers: [TaskController],
	providers: [TaskService, TypeOrmTaskRepository, ...CommandHandlers],
	exports: [TaskService, TypeOrmTaskRepository]
})
export class TaskModule {}
