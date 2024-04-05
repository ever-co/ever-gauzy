import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { IntegrationMap, TaskStatus } from 'core/entities/internal';
import { OrganizationProjectModule } from './../organization-project/organization-project.module';
import { CommandHandlers } from './commands/handlers';
import { EventHandlers } from './events/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';
import { RoleModule } from './../role/role.module';
import { EmployeeModule } from './../employee/employee.module';
import { Task } from './task.entity';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { TypeOrmTaskRepository } from './repository';

const forFeatureEntities = [Task, TaskStatus, IntegrationMap];

@Module({
	imports: [
		RouterModule.register([{ path: '/tasks', module: TaskModule }]),
		TypeOrmModule.forFeature(forFeatureEntities),
		MikroOrmModule.forFeature(forFeatureEntities),
		RolePermissionModule,
		forwardRef(() => UserModule),
		RoleModule,
		EmployeeModule,
		OrganizationProjectModule,
		CqrsModule
	],
	controllers: [TaskController],
	providers: [TaskService, TypeOrmTaskRepository, ...CommandHandlers, ...EventHandlers],
	exports: [TypeOrmModule, MikroOrmModule, TaskService, TypeOrmTaskRepository]
})
export class TaskModule {}
