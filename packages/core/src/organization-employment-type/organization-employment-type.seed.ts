import { GenericEmploymentTypes, IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { Connection } from 'typeorm';
import { OrganizationEmploymentType } from './organization-employment-type.entity';
import { DEFAULT_ORGANIZATION_TEAMS } from '../organization-team/default-organization-teams';

export const seedDefaultEmploymentTypes = async (
	connection: Connection,
	tenant: ITenant,
	employees: IEmployee[],
	defaultOrganization: IOrganization
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
		if (name === GenericEmploymentTypes.CONTRACT) {
			employmentType.members = employees;
		} else if (name === GenericEmploymentTypes.FULL_TIME) {
			employmentType.members = employees.filter((e) =>
				fullTimeEmployees.includes(e.user.email)
			);
		} else if (name === GenericEmploymentTypes.CONTRACTOR) {
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
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<void> => {
	let employmentTypes: OrganizationEmploymentType[] = [];
	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for (const organization of organizations) {
			const organizationEmploymentTypes: OrganizationEmploymentType[] = Object.values(
				GenericEmploymentTypes
			).map((name) => {
				const employmentType = new OrganizationEmploymentType();
				employmentType.name = name;
				employmentType.organization = organization;
				employmentType.tenant = tenant;
				return employmentType;
			});
			employmentTypes = [
				...employmentTypes,
				...organizationEmploymentTypes
			];
		}
		await insertEmploymentType(connection, employmentTypes);
	}
};

const insertEmploymentType = async (
	connection: Connection,
	employmentType: OrganizationEmploymentType[]
): Promise<void> => {
	await connection.manager.save(employmentType);
};
