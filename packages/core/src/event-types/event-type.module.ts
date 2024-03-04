import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventType } from './event-type.entity';
import { EventTypeService } from './event-type.service';
import { EventTypeController } from './event-type.controller';
import { CommandHandlers } from './commands/handlers';
import { Employee } from '../employee/employee.entity';
import { EmployeeService } from '../employee/employee.service';
import { Organization } from '../organization/organization.entity';
import { OrganizationService } from '../organization/organization.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/event-type', module: EventTypeModule }]),
		TypeOrmModule.forFeature([EventType, Employee, Organization]),
		MikroOrmModule.forFeature([EventType, Employee, Organization]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [EventTypeController],
	providers: [EventTypeService, EmployeeService, OrganizationService, ...CommandHandlers],
	exports: [EventTypeService]
})
export class EventTypeModule { }
