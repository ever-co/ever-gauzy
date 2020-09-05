import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Employee, Organization } from '@gauzy/models';
import { EmployeeAppointment } from './employee-appointment.entity';
import * as faker from 'faker';
import * as moment from 'moment';
import { AppointmentEmployees } from '../appointment-employees/appointment-employees.entity';

const agendas = ['Meeting', 'Knowledge Transfer', 'Query Solution', 'Sprint Planning'];

export const createDefaultEmployeeAppointment = async (
  connection: Connection,
  tenant: Tenant,
  Employees: Employee[],
  Organizations
): Promise<EmployeeAppointment[]> => {
  if (!Employees) {
    console.warn(
      'Warning: Employees not found, Default Employee Appointment  will not be created'
    );
    return;
  }
  if (!Organizations) {
    console.warn(
      'Warning: tenantOrganizations not found, Default Employee Appointment  will not be created'
    );
    return;
  }

  let employeesAppointments: EmployeeAppointment[] = [];

  for (const employee of Employees) {
    employeesAppointments = await dataOperation(connection, employeesAppointments, employee, [Organizations], tenant);
  }
  await connection.manager.save(employeesAppointments);
};

export const createRandomEmployeeAppointment = async (
  connection: Connection,
  tenants: Tenant[],
  tenantEmployeeMap: Map<Tenant, Employee[]>,
  tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<EmployeeAppointment[]> => {
  if (!tenantEmployeeMap) {
    console.warn(
      'Warning: tenantEmployeeMap not found, Employee Appointment  will not be created'
    );
    return;
  }
  if (!tenantOrganizationsMap) {
    console.warn(
      'Warning: tenantOrganizationsMap not found, Employee Appointment  will not be created'
    );
    return;
  }

  let  employeesAppointments: EmployeeAppointment[] = [];

  for (const tenant of tenants) {
    const tenantEmployees = tenantEmployeeMap.get(tenant);
    const tenantOrgs = tenantOrganizationsMap.get(tenant);

    for (const tenantEmployee of tenantEmployees) {
      employeesAppointments = await dataOperation(connection, employeesAppointments, tenantEmployee, tenantOrgs, tenant);
    }
  }
};

const dataOperation = async (connection: Connection, employeesAppointments, tenantEmployee, organizations, tenant)=>{
  for (const organization of organizations) {
    const employeesAppointment = new EmployeeAppointment();

        const Invitees = await connection.manager.find(AppointmentEmployees, {
          where: [{ employeeId: tenantEmployee.id }]
        });

        employeesAppointment.employee = tenantEmployee;
        employeesAppointment.organization = organization;
        employeesAppointment.description = faker.name.jobDescriptor();
        employeesAppointment.location = faker.address.city();
        employeesAppointment.startDateTime = faker.date.between(new Date(),moment(new Date()).add(2, 'months').toDate());
        employeesAppointment.endDateTime = moment(employeesAppointment.startDateTime).add(1, 'hours').toDate();
        employeesAppointment.invitees = Invitees;
        employeesAppointment.tenant = tenant;
        employeesAppointment.agenda = faker.random.arrayElement(agendas);

    employeesAppointments.push(employeesAppointment);
  }

  await connection.manager.save(employeesAppointments);
  return employeesAppointments;
}
