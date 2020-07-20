import { GenericEmploymentTypes } from '@gauzy/models';
import { Connection } from 'typeorm';
import { OrganizationEmploymentType } from './organization-employment-type.entity';
import { Organization } from '../organization/organization.entity';
import { Employee } from '../employee/employee.entity';
import { Tenant } from '../tenant/tenant.entity';

export const seedDefaultEmploymentTypes = async (
	connection: Connection,
	employees: Employee[],
	defaultOrganization: Organization
) => {
	const defaultTeams = [
    {
      name: 'Employees',
      defaultMembers: [
        'admin@ever.co',
        'alish@ever.co',
        'blagovest@ever.co',
        'elvis@ever.co',
        'emil@ever.co',
        'boyan@ever.co',
        'atanas@ever.co',
        'hristo@ever.co',
        'alex@ever.co',
        'milena@ever.co',
        'sunko@ever.co',
        'lubomir@ever.co',
        'pavel@ever.co',
        'yavor@ever.co',
        'tsvetelina@ever.co',
        'everq@ever.co',
        'julia@ever.co'
      ],
      manager: ['ruslan@ever.co']
    },
    {
      name: 'Contractors',
      defaultMembers: [
        'dimana@ever.co',
        'deko898@hotmail.com',
        'muiz@smooper.xyz',
        'ckhandla94@gmail.com'
      ],
      manager: ['ruslan@ever.co', 'rachit@ever.co']
    },
    {
      name: 'Designers',
      defaultMembers: ['julia@ever.co', 'yordan@ever.co'],
      manager: []
    },
    {
      name: 'QA',
      defaultMembers: ['julia@ever.co', 'yordan@ever.co'],
      manager: []
    }
  ];
	const fullTimeEmployees = defaultTeams[0].defaultMembers;
	const contractors = defaultTeams[1].defaultMembers;
	const employmentTypes: OrganizationEmploymentType[] = Object.values(
		GenericEmploymentTypes
	).map((name) => {
		const employmentType = new OrganizationEmploymentType();
		employmentType.name = name;
		employmentType.organizationId = defaultOrganization.id;
		if (name === 'Contract') {
			employmentType.members = employees;
		} else if (name === 'Full-time') {
			employmentType.members = employees.filter((e) =>
				fullTimeEmployees.includes(e.user.email)
			);
		} else if (name === 'Contractor') {
			employmentType.members = employees.filter((e) =>
				contractors.includes(e.user.email)
			);
		} else {
			employmentType.members = [];
		}
		return employmentType;
	});
	for (const employmentType of employmentTypes) {
		insertEmploymentType(connection, [employmentType]);
	}
};

export const seedRandomEmploymentTypes = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<void> => {
	let employmentTypes: OrganizationEmploymentType[] = [];

	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		organizations.forEach(({ id: organizationId }) => {
			const organizationEmploymentTypes: OrganizationEmploymentType[] = Object.values(
				GenericEmploymentTypes
			).map((name) => {
				const employmentType = new OrganizationEmploymentType();
				employmentType.name = name;
				employmentType.organizationId = organizationId;
				return employmentType;
			});
			employmentTypes = [
				...employmentTypes,
				...organizationEmploymentTypes
			];
		});
		await insertEmploymentType(connection, employmentTypes);
	}
};

const insertEmploymentType = async (
	connection: Connection,
	employmentType: OrganizationEmploymentType[]
): Promise<void> => {
	await connection.manager.save(employmentType);
};
