import { GenericEmploymentTypes } from '@gauzy/contracts';
import { Connection } from 'typeorm';
import { OrganizationEmploymentType } from './organization-employment-type.entity';
import { Organization } from '../organization/organization.entity';
import { Employee } from '../employee/employee.entity';
import { Tenant } from '../tenant/tenant.entity';
import { DEFAULT_ORGANIZATION_TEAMS } from '../organization-team/default-organization-teams';

export const seedDefaultEmploymentTypes = async (
	connection: Connection,
	tenant: Tenant,
	employees: Employee[],
	defaultOrganization: Organization
) => {
	const defaultTeams = DEFAULT_ORGANIZATION_TEAMS;
	const fullTimeEmployees = defaultTeams[0].defaultMembers;
	const contractors = defaultTeams[1].defaultMembers;
	const employmentTypes: OrganizationEmploymentType[] = Object.values(
		GenericEmploymentTypes
	).map((name) => {
		const employmentType = new OrganizationEmploymentType();
		employmentType.name = name;
		employmentType.organizationId = defaultOrganization.id;
		employmentType.tenant = tenant;
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
				employmentType.tenant = tenant;
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
