import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { Task } from './task.entity';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { OrganizationProjectModule } from './../organization-project/organization-project.module';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { RoleModule } from './../role/role.module';
import { EmployeeModule } from './../employee/employee.module';
import { TaskPriorityModule } from './priorities/priority.module';
import { TaskSizeModule } from './sizes/size.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/tasks', module: TaskModule,
				children: [
					{ path: '/priorities', module: TaskPriorityModule },
					{ path: '/sizes', module: TaskSizeModule },
					{ path: '/', module: TaskModule }
				]
			}
		]),
		TypeOrmModule.forFeature([
			Task
		]),
		TaskPriorityModule,
		TaskSizeModule,
		TenantModule,
		UserModule,
		RoleModule,
		EmployeeModule,
		OrganizationProjectModule,
		CqrsModule
	],
	controllers: [TaskController],
	providers: [
		TaskService,
		...CommandHandlers
	],
	exports: [TypeOrmModule, TaskService]
})
export class TaskModule {}
