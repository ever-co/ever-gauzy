import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmployeeAppointment } from './employee-appointment.entity';
import { EmployeeAppointmentController } from './employee-appointment.controller';
import { EmployeeAppointmentService } from './employee-appointment.service';
import { CommandHandlers } from './commands/handlers';
import { EmailSendModule } from '../email-send/email-send.module';
import { EmployeeModule } from '../employee/employee.module';
import { OrganizationModule } from '../organization/organization.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/employee-appointment', module: EmployeeAppointmentModule }]),
		TypeOrmModule.forFeature([EmployeeAppointment]),
		MikroOrmModule.forFeature([EmployeeAppointment]),
		EmailSendModule,
		EmployeeModule,
		OrganizationModule,
		RolePermissionModule,
		CqrsModule
	],
	controllers: [EmployeeAppointmentController],
	providers: [EmployeeAppointmentService, ...CommandHandlers],
	exports: [EmployeeAppointmentService]
})
export class EmployeeAppointmentModule {}
