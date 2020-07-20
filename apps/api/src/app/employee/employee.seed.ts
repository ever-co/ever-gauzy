import { Tenant } from '../tenant/tenant.entity';
import { Connection } from 'typeorm';
import { Employee } from './employee.entity';
import { Organization } from '../organization/organization.entity';
import { User } from '../user/user.entity';
import { date as fakerDate } from 'faker';
import { ISeedUsers, LanguagesEnum } from '@gauzy/models';

export const createDefaultEmployees = async (
	connection: Connection,
	defaultData: {
		tenant: Tenant;
		org: Organization;
		users: User[];
	}
): Promise<Employee[]> => {
	const defaultEmployees = [
    {
      email: 'ruslan@ever.co',
      password: '123456',
      firstName: 'Ruslan',
      lastName: 'Konviser',
      imageUrl: 'assets/images/avatars/ruslan.jpg',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'alish@ever.co',
      password: '123456',
      firstName: 'Alish',
      lastName: 'Meklyov',
      imageUrl: 'assets/images/avatars/alish.jpg',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'blagovest@ever.co',
      password: '123456',
      firstName: 'Blagovest',
      lastName: 'Gerov',
      imageUrl: 'assets/images/avatars/blagovest.jpg',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'elvis@ever.co',
      password: '123456',
      firstName: 'Elvis',
      lastName: 'Arabadjiiski',
      imageUrl: 'assets/images/avatars/elvis.jpg',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'emil@ever.co',
      password: '123456',
      firstName: 'Emil',
      lastName: 'Momchilov',
      imageUrl: 'assets/images/avatars/emil.jpg',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'boyan@ever.co',
      password: '123456',
      firstName: 'Boyan',
      lastName: 'Stanchev',
      imageUrl: 'assets/images/avatars/boyan.jpg',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'hristo@ever.co',
      password: '123456',
      firstName: 'Hristo',
      lastName: 'Hristov',
      imageUrl: 'assets/images/avatars/hristo.jpg',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'alex@ever.co',
      password: '123456',
      firstName: 'Aleksandar',
      lastName: 'Tasev',
      imageUrl: 'assets/images/avatars/alexander.jpg',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'milena@ever.co',
      password: '123456',
      firstName: 'Milena',
      lastName: 'Dimova',
      imageUrl: 'assets/images/avatars/milena.jpg',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'rachit@ever.co',
      password: '123456',
      firstName: 'Rachit',
      lastName: 'Magon',
      imageUrl: 'assets/images/avatars/rachit.png',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'atanas@ever.co',
      password: '123456',
      firstName: 'Atanas',
      lastName: 'Yonkov',
      imageUrl: 'assets/images/avatars/atanas.jpeg',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'dimana@ever.co',
      password: '123456',
      firstName: 'Dimana',
      lastName: 'Tsvetkova',
      imageUrl: 'assets/images/avatars/dimana.jpeg',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'yordan@ever.co',
      password: '123456',
      firstName: 'Yordan ',
      lastName: 'Genovski',
      imageUrl: 'assets/images/avatars/yordan.jpg',
      startedWorkOn: '2018-08-01',
      endWork: null,
      employeeLevel: 'C',
      preferredLanguage: LanguagesEnum.ENGLISH
    }
  ];
	let employee: Employee;
	const employees: Employee[] = [];
	const defaultUsers = defaultData.users;
	const defaultOrg = defaultData.org;
	const defaultTenant = defaultData.tenant;

	let counter = 0;
	for (const user of defaultUsers) {
		employee = new Employee();
		employee.organization = defaultOrg;
		employee.user = user;
		employee.tenant = defaultTenant;
		employee.employeeLevel = defaultEmployees.filter(
			(e) => e.email === employee.user.email
		)[0].employeeLevel;
		employee.startedWorkOn = getDate(
			defaultEmployees.filter((e) => e.email === employee.user.email)[0]
				.startedWorkOn
		);
		employee.endWork = getDate(
			defaultEmployees.filter((e) => e.email === employee.user.email)[0]
				.endWork
		);
		await insertEmployee(connection, employee);
		employees.push(employee);
		counter++;
	}

	return employees;
};

export const createRandomEmployees = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>,
	tenantUsersMap: Map<Tenant, ISeedUsers>,
	employeesPerOrganization: number
): Promise<Map<Tenant, Employee[]>> => {
	const employeeMap: Map<Tenant, Employee[]> = new Map();

	for (const tenant of tenants) {
		let employee: Employee;
		const employees: Employee[] = [];
		const randomUsers = tenantUsersMap.get(tenant).employeeUsers;
		const randomOrgs = tenantOrganizationsMap.get(tenant);

		for (const organization of randomOrgs) {
			if (randomUsers.length) {
				for (let index = 0; index < employeesPerOrganization; index++) {
					employee = new Employee();
					employee.organization = organization;
					employee.user = randomUsers.pop();
					employee.isActive = true;
					employee.endWork = null;
					employee.startedWorkOn = fakerDate.past(index % 5);
					employee.tenant = tenant;

					if (employee.user) {
						employees.push(employee);
					}
				}
			}
		}
		employeeMap.set(tenant, employees);
		await insertEmployees(connection, employees);
	}

	return employeeMap;
};

const insertEmployees = async (
	connection: Connection,
	employees: Employee[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Employee)
		.values(employees)
		.execute();
};

const insertEmployee = async (
	connection: Connection,
	employee: Employee
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(Employee)
		.values(employee)
		.execute();
};

const getDate = (dateString: string): Date => {
	if (dateString) {
		const date = new Date(dateString);
		return date;
	}
	return null;
};
