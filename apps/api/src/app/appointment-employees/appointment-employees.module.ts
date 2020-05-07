import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentEmployees } from './appointment-employees.entity';

@Module({
	imports: [TypeOrmModule.forFeature([AppointmentEmployees])]
})
export class AppointmentEmployeesModule {}
