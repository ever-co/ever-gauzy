import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { IntegrationMap, TaskStatus } from 'core/entities/internal';
import { OrganizationProjectModule } from './../organization-project/organization-project.module';
import { CommandHandlers } from './commands/handlers';
import { EventHandlers } from './events/handlers';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { RoleModule } from './../role/role.module';
import { EmployeeModule } from './../employee/employee.module';
import { Task } from './task.entity';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';

const entities = [
	Task,
	TaskStatus,
	IntegrationMap
];

@Module({
	imports: [
		RouterModule.register([
			{ path: '/tasks', module: TaskModule }
		]),
		MikroOrmModule.forFeature([
			...entities
		]),
		TypeOrmModule.forFeature([
			...entities
		]),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		RoleModule,
		EmployeeModule,
		OrganizationProjectModule,
		CqrsModule
	],
	controllers: [TaskController],
	providers: [TaskService, ...CommandHandlers, ...EventHandlers],
	exports: [TypeOrmModule, TaskService]
})
export class TaskModule { }
