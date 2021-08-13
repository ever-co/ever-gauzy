import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { RouterModule } from 'nest-router';
import { CqrsModule } from '@nestjs/cqrs';
import { EmployeeAppointment } from './employee-appointment.entity';
import { EmployeeAppointmentController } from './employee-appointment.controller';
import { EmployeeAppointmentService } from './employee-appointment.service';
import { CommandHandlers } from './commands/handlers';
import { EmailModule } from '../email/email.module';
import { EmployeeModule } from '../employee/employee.module';
import { OrganizationModule } from '../organization/organization.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/employee-appointment', module: EmployeeAppointmentModule }
		]),
		TypeOrmModule.forFeature([EmployeeAppointment]),
		EmailModule,
		EmployeeModule,
		OrganizationModule,
		CqrsModule,
		TenantModule
	],
	controllers: [EmployeeAppointmentController],
	providers: [
		EmployeeAppointmentService,
		...CommandHandlers
	],
	exports: [EmployeeAppointmentService]
})
export class EmployeeAppointmentModule {}
