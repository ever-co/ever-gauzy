import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AvailabilitySlot } from './availability-slots.entity';
import { AvailabilitySlotsService } from './availability-slots.service';
import { AvailabilitySlotsController } from './availability-slots.controller';
import { CommandHandlers } from './commands/handlers';
import { EmployeeModule } from './../employee/employee.module';
import { OrganizationModule } from './../organization/organization.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/availability-slots', module: AvailabilitySlotsModule }]),
		TypeOrmModule.forFeature([AvailabilitySlot]),
		MikroOrmModule.forFeature([AvailabilitySlot]),
		CqrsModule,
		EmployeeModule,
		OrganizationModule,
		RolePermissionModule
	],
	controllers: [AvailabilitySlotsController],
	providers: [AvailabilitySlotsService, ...CommandHandlers],
	exports: [AvailabilitySlotsService]
})
export class AvailabilitySlotsModule { }
