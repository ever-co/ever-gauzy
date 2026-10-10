import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AppointmentEmployee } from './appointment-employees.entity';
import { AppointmentEmployeesController } from './appointment-employees.controller';
import { AppointmentEmployeesResolver } from './appointment-employees.resolver';
import { AppointmentEmployeesService } from './appointment-employees.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmAppointmentEmployeeRepository } from './repository/type-orm-appointment-employee.repository';
import { MikroOrmAppointmentEmployeeRepository } from './repository/mikro-orm-appointment-employee.repository';

/**
 * The appointment's invitation: one employee, named as an invitee of one appointment.
 *
 * **The resolver is declared here, beside the service it calls**, because a resolver is an ordinary Nest
 * provider and can only inject what the module hosting it can reach — and this one injects the service and
 * nothing else, so the module needs no import it did not already carry. The service is exported for the
 * same reason: a resolver is a provider of whichever module the Apollo configuration names, and that
 * module receives what this one hands on.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([AppointmentEmployee]),
		MikroOrmModule.forFeature([AppointmentEmployee]),
		RolePermissionModule
	],
	controllers: [AppointmentEmployeesController],
	providers: [
		AppointmentEmployeesService,
		// The GraphQL view of the same resource.
		AppointmentEmployeesResolver,
		TypeOrmAppointmentEmployeeRepository,
		MikroOrmAppointmentEmployeeRepository
	],
	exports: [AppointmentEmployeesService]
})
export class AppointmentEmployeesModule {}