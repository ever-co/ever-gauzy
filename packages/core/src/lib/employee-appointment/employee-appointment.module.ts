import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EmployeeAppointment } from './employee-appointment.entity';
import { EmployeeAppointmentController } from './employee-appointment.controller';
import { EmployeeAppointmentResolver } from './employee-appointment.resolver';
import { EmployeeAppointmentService } from './employee-appointment.service';
import { CommandHandlers } from './commands/handlers';
import { EmailSendModule } from '../email-send/email-send.module';
import { EmployeeModule } from '../employee/employee.module';
import { OrganizationModule } from '../organization/organization.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmEmployeeAppointmentRepository } from './repository/type-orm-employee-appointment.repository';
import { MikroOrmEmployeeAppointmentRepository } from './repository/mikro-orm-employee-appointment.repository';

/**
 * The employee appointment: a booked slot on one employee's calendar, and the invitation rows that name
 * it as an appointment's invitees.
 *
 * **The resolver is declared here, beside the service it calls**, because a resolver is an ordinary Nest
 * provider and can only inject what the module hosting it can reach.
 *
 * **`CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's non-service
 * dependency resolvable.** The two write fields dispatch the same commands the controller dispatches, so
 * the resolver injects the command bus — and a resolver is a provider of whichever module the Apollo
 * configuration names, which receives the bus only if this module hands it on. The REST controller beside
 * it resolves the bus from this module's own imports, which is why nothing needed re-exporting until the
 * GraphQL view of the same resource existed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([EmployeeAppointment]),
		MikroOrmModule.forFeature([EmployeeAppointment]),
		EmailSendModule,
		EmployeeModule,
		OrganizationModule,
		RolePermissionModule,
		CqrsModule
	],
	controllers: [EmployeeAppointmentController],
	providers: [
		EmployeeAppointmentService,
		// The GraphQL view of the same resource.
		EmployeeAppointmentResolver,
		TypeOrmEmployeeAppointmentRepository,
		MikroOrmEmployeeAppointmentRepository,
		...CommandHandlers
	],
	exports: [
		EmployeeAppointmentService,
		TypeOrmEmployeeAppointmentRepository,
		MikroOrmEmployeeAppointmentRepository,
		// Re-exported for the resolver, which is hosted by the module that names the GraphQL endpoint.
		CqrsModule
	]
})
export class EmployeeAppointmentModule {}