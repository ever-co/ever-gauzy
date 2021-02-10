import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { AppointmentEmployee } from './appointment-employees.entity';
import { AppointmentEmployeesController } from './appointment-employees.controller';
import { AppointmentEmployeesService } from './appointment-employees.service';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{
				path: '/appointment-employees',
				module: AppointmentEmployeesModule
			}
		]),
		TypeOrmModule.forFeature([AppointmentEmployee]),
		TenantModule
	],
	controllers: [AppointmentEmployeesController],
	providers: [AppointmentEmployeesService],
	exports: [AppointmentEmployeesService]
})
export class AppointmentEmployeesModule {}
