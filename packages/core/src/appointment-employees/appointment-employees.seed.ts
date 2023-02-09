import { DataSource } from 'typeorm';
import { IAppointmentEmployee, IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { AppointmentEmployee } from './appointment-employees.entity';
import { faker } from '@faker-js/faker';

export const createRandomAppointmentEmployees = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>
): Promise<IAppointmentEmployee[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Appointment Employees  will not be created'
		);
		return;
	}
	if (!organizationEmployeesMap) {
		console.warn(
			'Warning: organizationEmployeesMap not found, Appointment Employees  will not be created'
		);
		return;
	}

	const appointEmployees: IAppointmentEmployee[] = [];
	for await (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for await (const organization of organizations) {
			const tenantEmployees = organizationEmployeesMap.get(organization);
			for await (const tenantEmployee of tenantEmployees) {
				for (let i = 0; i < faker.number.int(15); i++) {
					const appointemployee = new AppointmentEmployee();
					//todo: need to verify appointmentId is used anywhere else or not
					appointemployee.appointmentId = faker.number.int({ min: 100000, max: 1000000 }).toString();
					appointemployee.employeeId = tenantEmployee.id;
					appointemployee.organization = tenantEmployee.organization;
					appointemployee.tenant = tenant;

					appointEmployees.push(appointemployee);
				}
			}
		}
	}
	await dataSource.manager.save(appointEmployees);
};
