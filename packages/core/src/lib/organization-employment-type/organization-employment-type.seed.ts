import { GenericEmploymentTypes, IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { DataSource } from 'typeorm';
import { OrganizationEmploymentType } from './organization-employment-type.entity';
import { DEFAULT_ORGANIZATION_TEAMS } from '../organization-team/default-organization-teams';

export const seedDefaultEmploymentTypes = async (
	dataSource: DataSource,
	tenant: ITenant,
	employees: IEmployee[],
	defaultOrganization: IOrganization
) => {
	const defaultTeams = DEFAULT_ORGANIZATION_TEAMS;
	const fullTimeEmployees = defaultTeams[0].defaultMembers;
	const contractors = defaultTeams[1].defaultMembers;
	const employmentTypes: OrganizationEmploymentType[] = Object.values(GenericEmploymentTypes).map((name: string) => {
		const employmentType = new OrganizationEmploymentType();
		employmentType.name = name;
		employmentType.organizationId = defaultOrganization.id;
		employmentType.tenant = tenant;
		if (name === GenericEmploymentTypes.CONTRACT) {
			employmentType.members = employees;
		} else if (name === GenericEmploymentTypes.FULL_TIME) {
			employmentType.members = employees.filter((e) => fullTimeEmployees.includes(e.user.email));
		} else if (name === GenericEmploymentTypes.CONTRACTOR) {
			employmentType.members = employees.filter((e) => contractors.includes(e.user.email));
		} else {
			employmentType.members = [];
		}
		return employmentType;
	});
	for await (const employmentType of employmentTypes) {
		await insertEmploymentType(dataSource, [employmentType]);
	}
};

export const seedRandomEmploymentTypes = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<void> => {
	let employmentTypes: OrganizationEmploymentType[] = [];
	for (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for (const organization of organizations) {
			const organizationEmploymentTypes: OrganizationEmploymentType[] = Object.values(GenericEmploymentTypes).map(
				(name: string) => {
					const employmentType = new OrganizationEmploymentType();
					employmentType.name = name;
					employmentType.organization = organization;
					employmentType.tenant = tenant;
					return employmentType;
				}
			);
			employmentTypes = [...employmentTypes, ...organizationEmploymentTypes];
		}
		await insertEmploymentType(dataSource, employmentTypes);
	}
};

const insertEmploymentType = async (
	dataSource: DataSource,
	employmentTypes: OrganizationEmploymentType[]
): Promise<void> => {
	await dataSource.transaction(async (manager) => {
		for (const employmentType of employmentTypes) {
			await manager.save(employmentType);
		}
	});
};
