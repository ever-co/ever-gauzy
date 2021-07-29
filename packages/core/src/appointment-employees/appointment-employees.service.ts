import { TenantAwareCrudService } from './../core/crud';
import { AppointmentEmployee } from './appointment-employees.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppointmentEmployeesService extends TenantAwareCrudService<AppointmentEmployee> {
	constructor(
		@InjectRepository(AppointmentEmployee)
		private readonly appointmentEmployeesRepository: Repository<AppointmentEmployee>
	) {
		super(appointmentEmployeesRepository);
	}
}
