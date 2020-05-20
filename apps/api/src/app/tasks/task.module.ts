import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { CommandHandlers } from './commands/handlers';
import { CqrsModule } from '@nestjs/cqrs';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { Employee } from '../employee/employee.entity';
import { EmployeeService } from '../employee/employee.service';

@Module({
	imports: [
		TypeOrmModule.forFeature([Task, OrganizationProjects, User, Employee]),
		CqrsModule
	],
	controllers: [TaskController],
	providers: [TaskService, EmployeeService, ...CommandHandlers, UserService],
	exports: [TaskService]
})
export class TaskModule {}
