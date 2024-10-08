import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationSprintEmployee } from './organization-sprint-employee.entity';
import { RoleModule } from './../role/role.module';
import { EmployeeModule } from './../employee/employee.module';
import { OrganizationSprintService } from './organization-sprint.service';
import { OrganizationSprintController } from './organization-sprint.controller';
import { OrganizationSprint } from './organization-sprint.entity';
import { Task } from '../tasks/task.entity';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmOrganizationSprintRepository } from './repository/type-orm-organization-sprint.repository';
import { TypeOrmOrganizationSprintEmployeeRepository } from './repository/type-orm-organization-sprint-employee.repository';

@Module({
	imports: [
		RouterModule.register([{ path: '/organization-sprint', module: OrganizationSprintModule }]),
		TypeOrmModule.forFeature([OrganizationSprint, Task, OrganizationSprintEmployee]),
		MikroOrmModule.forFeature([OrganizationSprint, Task, OrganizationSprintEmployee]),
		RoleModule,
		EmployeeModule,
		RolePermissionModule,
		CqrsModule
	],
	controllers: [OrganizationSprintController],
	providers: [
		OrganizationSprintService,
		TypeOrmOrganizationSprintRepository,
		TypeOrmOrganizationSprintEmployeeRepository,
		...CommandHandlers
	],
	exports: [
		TypeOrmModule,
		MikroOrmModule,
		OrganizationSprintService,
		TypeOrmOrganizationSprintRepository,
		TypeOrmOrganizationSprintEmployeeRepository
	]
})
export class OrganizationSprintModule {}
