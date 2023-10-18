import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { IntegrationMap } from 'core/entities/internal';
import { OrganizationProjectModule } from './../organization-project/organization-project.module';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';
import { UserModule } from './../user/user.module';
import { RoleModule } from './../role/role.module';
import { EmployeeModule } from './../employee/employee.module';
import { GithubModule } from './../integration/github/github.module';
import { Task } from './task.entity';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { IntegrationTenantModule } from './../integration-tenant/integration-tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/tasks', module: TaskModule }
		]),
		TypeOrmModule.forFeature([
			Task,
			IntegrationMap
		]),
		forwardRef(() => TenantModule),
		forwardRef(() => UserModule),
		GithubModule,
		RoleModule,
		EmployeeModule,
		OrganizationProjectModule,
		IntegrationTenantModule,
		CqrsModule,
	],
	controllers: [TaskController],
	providers: [TaskService, ...CommandHandlers],
	exports: [TypeOrmModule, TaskService],
})
export class TaskModule { }
