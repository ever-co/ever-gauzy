import { Connection } from 'typeorm';
import { OrganizationDepartment } from './organization-department.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';

let OrganizationDepartmentsArray = ([] = [
	'Designers',
	'QA',
	'Engineering',
	'Management',
	'Sales',
	'Marketing',
	'Frontend Developers',
	'Backend Developers'
]);

export const seedRandomOrganizationDepartments = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<void> => {
	let departments: OrganizationDepartment[] = [];

	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		organizations.forEach(({ id: organizationId }) => {
			const organizationDepartments: OrganizationDepartment[] = Object.values(
				OrganizationDepartmentsArray
			).map((name) => {
				const employmentDepartment = new OrganizationDepartment();
				employmentDepartment.name = name;
				employmentDepartment.organizationId = organizationId;
				employmentDepartment.tenant = tenant;
				return employmentDepartment;
			});
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
