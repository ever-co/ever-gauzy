import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentEmployees } from './appointment-employees.entity';
import { AppointmentEmployeesController } from './appointment-employees.controller';
import { AppointmentEmployeesService } from './appointment-employees.service';

@Module({
	imports: [TypeOrmModule.forFeature([AppointmentEmployees])],
	controllers: [AppointmentEmployeesController],
	providers: [AppointmentEmployeesService],
	exports: [AppointmentEmployeesService]
})
export class AppointmentEmployeesModule {}
