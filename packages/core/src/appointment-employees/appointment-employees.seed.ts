import { Connection } from 'typeorm';
import { IAppointmentEmployee, IEmployee, ITenant } from '@gauzy/contracts';
import { AppointmentEmployee } from './appointment-employees.entity';
import * as faker from 'faker';

export const createRandomAppointmentEmployees = async (
	connection: Connection,
	tenants: ITenant[],
	tenantEmployeeMap: Map<ITenant, IEmployee[]>
): Promise<IAppointmentEmployee[]> => {
	if (!tenantEmployeeMap) {
		console.warn(
			'Warning: tenantEmployeeMap not found, Appointment Employees  will not be created'
		);
		return;
	}

	const appointEmployees: IAppointmentEmployee[] = [];
	for await (const tenant of tenants) {
		const tenantEmployees = tenantEmployeeMap.get(tenant);
		for await (const tenantEmployee of tenantEmployees) {
			for (let i = 0; i < faker.datatype.number(15); i++) {
				const appointemployee = new AppointmentEmployee();
				//todo: need to verify appointmentId is used anywhere else or not
				appointemployee.appointmentId = faker.datatype
					.number({ min: 100000, max: 1000000 })
					.toString();
				appointemployee.employeeId = tenantEmployee.id;
				appointemployee.organization = tenantEmployee.organization;
				appointemployee.tenant = tenant;

				appointEmployees.push(appointemployee);
			}
		}
	}

	await connection.manager.save(appointEmployees);
};
