import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { EmployeeAppointment } from './employee-appointment.entity';
import { EmployeeAppointmentController } from './employee-appointment.controller';
import { EmployeeAppointmentService } from './employee-appointment.service';
import { CqrsModule } from '@nestjs/cqrs';
import { EmployeeAppointmentCreateHandler } from './commands/handlers/employee-appointment.create.handler';
import { EmployeeAppointmentUpdateHandler } from './commands/handlers/employee-appointment.update.handler';

@Module({
	imports: [TypeOrmModule.forFeature([EmployeeAppointment]), CqrsModule],
	controllers: [EmployeeAppointmentController],
	providers: [
		EmployeeAppointmentService,
		EmployeeAppointmentCreateHandler,
		EmployeeAppointmentUpdateHandler
	],
	exports: [EmployeeAppointmentService]
})
export class EmployeeAppointmentModule {}
