import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationSprintService } from './organization-sprint.service';
import { OrganizationSprintController } from './organization-sprint.controller';
import { OrganizationSprint } from './organization-sprint.entity';
import { Task } from '../tasks/task.entity';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/organization-sprint', module: OrganizationSprintModule }]),
		TypeOrmModule.forFeature([OrganizationSprint, Task]),
		MikroOrmModule.forFeature([OrganizationSprint, Task]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [OrganizationSprintController],
	providers: [OrganizationSprintService, ...CommandHandlers],
	exports: [OrganizationSprintService]
})
export class OrganizationSprintModule { }
