import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventType } from './event-type.entity';
import { EventTypeService } from './event-type.service';
import { EventTypeController } from './event-type.controller';
import { CommandHandlers } from './commands/handlers';
import { EmployeeModule } from '../employee/employee.module';
import { OrganizationModule } from '../organization/organization.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/event-type', module: EventTypeModule }]),
		TypeOrmModule.forFeature([EventType]),
		MikroOrmModule.forFeature([EventType]),
		RolePermissionModule,
		EmployeeModule,
		OrganizationModule,
		CqrsModule
	],
	controllers: [EventTypeController],
	providers: [EventTypeService, ...CommandHandlers],
	exports: [EventTypeService]
})
export class EventTypeModule { }
