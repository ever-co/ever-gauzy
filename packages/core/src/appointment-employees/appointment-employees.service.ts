import { TenantAwareCrudService } from './../core/crud';
import { AppointmentEmployee } from './appointment-employees.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';

@Injectable()
export class AppointmentEmployeesService extends TenantAwareCrudService<AppointmentEmployee> {
	constructor(
		@InjectRepository(AppointmentEmployee)
		appointmentEmployeesRepository: Repository<AppointmentEmployee>,
		@MikroInjectRepository(AppointmentEmployee)
		mikroAppointmentEmployeesRepository: EntityRepository<AppointmentEmployee>
	) {
		super(appointmentEmployeesRepository, mikroAppointmentEmployeesRepository);
	}
}
