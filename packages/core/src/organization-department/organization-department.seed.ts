import { DataSource } from 'typeorm';
import { OrganizationDepartment } from './organization-department.entity';
import { faker } from '@faker-js/faker';
import { Tag } from '../tags/tag.entity';
import { DEFAULT_ORGANIZATION_DEPARTMENTS } from './default-organization-departments';
import { IOrganization, ITenant } from '@gauzy/contracts';

export const createDefaultOrganizationDepartments = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[]
) => {
	const tag = dataSource.getRepository(Tag).create({
		name: 'API',
		description: '',
		color: faker.color.human()
	});
	const departments: OrganizationDepartment[] = [];
	for (const organization of organizations) {
		DEFAULT_ORGANIZATION_DEPARTMENTS.forEach((name) => {
			const department = new OrganizationDepartment();
			department.tags = [tag];
			department.name = name;
			department.organization = organization;
			department.tenant = tenant;
			departments.push(department);
		});
	}
	return await dataSource.manager.save(departments);
};

export const seedRandomOrganizationDepartments = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<void> => {
	let departments: OrganizationDepartment[] = [];
	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		organizations.forEach(({ id: organizationId }) => {
			const organizationDepartments: OrganizationDepartment[] = DEFAULT_ORGANIZATION_DEPARTMENTS.map(
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
		await insertEmploymentDepartment(dataSource, departments);
	}
};

const insertEmploymentDepartment = async (
	dataSource: DataSource,
	employmentDepartment: OrganizationDepartment[]
): Promise<void> => {
	await dataSource.manager.save(employmentDepartment);
};
