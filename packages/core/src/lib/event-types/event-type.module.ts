import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EventType } from './event-type.entity';
import { EventTypeService } from './event-type.service';
import { EventTypeController } from './event-type.controller';
import { CommandHandlers } from './commands/handlers';
import { EmployeeModule } from '../employee/employee.module';
import { OrganizationModule } from '../organization/organization.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmEventTypeRepository } from './repository/type-orm-event-types.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([EventType]),
		MikroOrmModule.forFeature([EventType]),
		RolePermissionModule,
		EmployeeModule,
		OrganizationModule,
		CqrsModule
	],
	controllers: [EventTypeController],
	providers: [EventTypeService, TypeOrmEventTypeRepository, ...CommandHandlers]
})
export class EventTypeModule {}
