import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { AvailabilitySlot } from './availability-slots.entity';
import { AvailabilitySlotsService } from './availability-slots.service';
import { AvailabilitySlotsController } from './availability-slots.controller';
import { CommandHandlers } from './commands/handlers';
import { EmployeeModule } from './../employee/employee.module';
import { OrganizationModule } from './../organization/organization.module';
import { UserModule } from './../user/user.module';
import { TenantModule } from './../tenant/tenant.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/availability-slots', module: AvailabilitySlotsModule }]),
		UserModule,
		TypeOrmModule.forFeature([AvailabilitySlot]),
		MikroOrmModule.forFeature([AvailabilitySlot]),
		CqrsModule,
		TenantModule,
		EmployeeModule,
		OrganizationModule
	],
	controllers: [AvailabilitySlotsController],
	providers: [AvailabilitySlotsService, ...CommandHandlers],
	exports: [AvailabilitySlotsService]
})
export class AvailabilitySlotsModule { }
