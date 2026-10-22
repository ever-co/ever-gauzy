import { Injectable } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
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

	/**
	 * An invitation is its employee's, as the appointment it invites them to: a caller who may not act for other
	 * employees and has no employee record (a viewer, a candidate) reads, edits and deletes none, rather than every
	 * employee's through the tenant-wide default (`GET /appointment-employees/employee-appointments/:employeeId` listed
	 * any employee's appointments with them).
	 */
	protected override findConditionsWithoutOwnEmployee(): FindOptionsWhere<AppointmentEmployee> {
		return this.neverMatchingEmployeeCondition();
	}
}
