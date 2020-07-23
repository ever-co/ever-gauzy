import { Connection } from 'typeorm';
import { OrganizationDepartment } from './organization-department.entity';
import * as faker from 'faker';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import { Tag } from '../tags/tag.entity';

const organizationDepartmentsArray = [
	'Designers',
	'QA',
	'Engineering',
	'Management',
	'Sales',
	'Marketing',
	'Frontend Developers',
	'Backend Developers'
];

export const createDefaultOrganizationDepartments = async (
	connection: Connection,
	defaultOrganizations: Organization[]
) => {
	const tag = await connection.getRepository(Tag).create({
		name: 'API',
		description: '',
		color: faker.commerce.color()
	});
	const departments: OrganizationDepartment[] = [];

	const organizations = faker.random.arrayElement(defaultOrganizations);

	organizationDepartmentsArray.forEach((name) => {
		const department = new OrganizationDepartment();
		department.tags = [tag];
		department.name = name;
		department.organizationId = organizations.id;
		department.tenant = organizations.tenant;
		departments.push(department);
	});
	return await connection.manager.save(departments);
};

export const seedRandomOrganizationDepartments = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<void> => {
	let departments: OrganizationDepartment[] = [];

	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		organizations.forEach(({ id: organizationId }) => {
			const organizationDepartments: OrganizationDepartment[] = organizationDepartmentsArray.map(
				(name) => {
					const employmentDepartment = new OrganizationDepartment();
					employmentDepartment.name = name;
					employmentDepartment.organizationId = organizationId;
					employmentDepartment.tenant = tenant;
					return employmentDepartment;
				}
			);
			departments = [...departments, ...organizationDepartments];
		});
		await insertEmploymentDepartment(connection, departments);
	}
};

const insertEmploymentDepartment = async (
	connection: Connection,
	employmentDepartment: OrganizationDepartment[]
): Promise<void> => {
	await connection.manager.save(employmentDepartment);
};
