import { CrudService } from '../core';
import { AppointmentEmployees } from './appointment-employees.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppointmentEmployeesService extends CrudService<
	AppointmentEmployees
> {
	constructor(
		@InjectRepository(AppointmentEmployees)
		private readonly appointmentEmployeesRepository: Repository<
			AppointmentEmployees
		>
	) {
		super(appointmentEmployeesRepository);
	}
}
