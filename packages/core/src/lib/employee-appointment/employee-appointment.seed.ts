import { DataSource } from 'typeorm';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { faker } from '@faker-js/faker';
import * as moment from 'moment';
import { EmployeeAppointment } from './employee-appointment.entity';
import { AGENDAS } from './default-employee-appointment';
import { AppointmentEmployee } from './../core/entities/internal';

export const createDefaultEmployeeAppointment = async (
	dataSource: DataSource,
	tenant: ITenant,
	employees: IEmployee[],
	organizations
): Promise<EmployeeAppointment[]> => {
	if (!employees) {
		console.warn(
			'Warning: Employees not found, Default Employee Appointment  will not be created'
		);
		return;
	}
	if (!organizations) {
		console.warn(
			'Warning: tenantOrganizations not found, Default Employee Appointment  will not be created'
		);
		return;
	}

	let employeesAppointments: EmployeeAppointment[] = [];
	for (const employee of employees) {
		employeesAppointments = await dataOperation(
			dataSource,
			employeesAppointments,
			employee,
			[organizations],
			tenant
		);
	}
	await dataSource.manager.save(employeesAppointments);
};

export const createRandomEmployeeAppointment = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	organizationEmployeesMap: Map<IOrganization, IEmployee[]>
): Promise<EmployeeAppointment[]> => {
	if (!tenantOrganizationsMap) {
		console.warn(
			'Warning: tenantOrganizationsMap not found, Employee Appointment  will not be created'
		);
		return;
	}
	if (!organizationEmployeesMap) {
		console.warn(
			'Warning: organizationEmployeesMap not found, Employee Appointment  will not be created'
		);
		return;
	}

	let employeesAppointments: EmployeeAppointment[] = [];

	for await (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for await (const organization of organizations) {
			const tenantEmployees = organizationEmployeesMap.get(organization);
			const tenantOrgs = tenantOrganizationsMap.get(tenant);

			for (const tenantEmployee of tenantEmployees) {
				employeesAppointments = await dataOperation(
					dataSource,
					employeesAppointments,
					tenantEmployee,
					tenantOrgs,
					tenant
				);
			}
		}
	}
};

const dataOperation = async (
	dataSource: DataSource,
	employeesAppointments,
	tenantEmployee,
	organizations: IOrganization[],
	tenant: ITenant
) => {
	for (const organization of organizations) {
		const employeesAppointment = new EmployeeAppointment();

		const invitees = await dataSource.manager.find(AppointmentEmployee, {
			where: [{ employeeId: tenantEmployee.id }]
		});

		employeesAppointment.employee = tenantEmployee;
		employeesAppointment.organization = organization;
		employeesAppointment.description = faker.person.jobDescriptor();
		employeesAppointment.location = faker.location.city();
		employeesAppointment.startDateTime = faker.date.between({
			from: new Date(),
			to: moment(new Date()).add(2, 'months').toDate()
		});
		employeesAppointment.endDateTime = moment(
			employeesAppointment.startDateTime
		)
			.add(1, 'hours')
			.toDate();
		employeesAppointment.invitees = invitees;
		employeesAppointment.agenda = faker.helpers.arrayElement(AGENDAS);
		employeesAppointment.tenant = tenant;
		employeesAppointments.push(employeesAppointment);
	}

	await dataSource.manager.save(employeesAppointments);
	return employeesAppointments;
};
