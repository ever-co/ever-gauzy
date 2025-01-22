import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../core/crud/tenant-aware-crud.service';
import { TypeOrmAppointmentEmployeeRepository } from './repository/type-orm-appointment-employee.repository';
import { MikroOrmAppointmentEmployeeRepository } from './repository/mikro-orm-appointment-employee.repository';
import { AppointmentEmployee } from './appointment-employees.entity';

@Injectable()
export class AppointmentEmployeesService extends TenantAwareCrudService<AppointmentEmployee> {
	constructor(
		typeOrmAppointmentEmployeeRepository: TypeOrmAppointmentEmployeeRepository,
		mikroOrmAppointmentEmployeeRepository: MikroOrmAppointmentEmployeeRepository
	) {
		super(typeOrmAppointmentEmployeeRepository, mikroOrmAppointmentEmployeeRepository);
	}
}
