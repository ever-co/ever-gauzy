import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { AppointmentEmployee } from './appointment-employees.entity';
import { AppointmentEmployeesController } from './appointment-employees.controller';
import { AppointmentEmployeesService } from './appointment-employees.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmAppointmentEmployeeRepository } from './repository/type-orm-appointment-employee.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([AppointmentEmployee]),
		MikroOrmModule.forFeature([AppointmentEmployee]),
		RolePermissionModule
	],
	controllers: [AppointmentEmployeesController],
	providers: [AppointmentEmployeesService, TypeOrmAppointmentEmployeeRepository]
})
export class AppointmentEmployeesModule {}
