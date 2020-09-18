import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { IEmployee } from '@gauzy/models';
import { AppointmentEmployee } from './appointment-employees.entity';
import * as faker from 'faker';

export const createRandomAppointmentEmployees = async (
	connection: Connection,
	tenants: Tenant[],
	tenantEmployeeMap: Map<Tenant, IEmployee[]>
): Promise<AppointmentEmployee[]> => {
	if (!tenantEmployeeMap) {
		console.warn(
			'Warning: tenantEmployeeMap not found, Appointment Employees  will not be created'
		);
		return;
	}

	const AppointEmployees: AppointmentEmployee[] = [];

	for (const tenant of tenants) {
		const tenantEmployees = tenantEmployeeMap.get(tenant);
		for (const tenantEmployee of tenantEmployees) {
			for (let i = 0; i < faker.random.number(15); i++) {
				const Appointemployee = new AppointmentEmployee();
				//todo: need to verify appointmentId is used anywhere else or not
				Appointemployee.appointmentId = faker.random
					.number({ min: 100000, max: 1000000 })
					.toString();
				Appointemployee.employeeId = tenantEmployee.id;

				AppointEmployees.push(Appointemployee);
			}
		}
	}

	await connection.manager.save(AppointEmployees);
};
