import { DataSource } from 'typeorm';
import {
	IOrganization,
	IUser,
	IUserOrganization,
	ISeedUsers,
	ITenant
} from '@gauzy/contracts';
import { chunks } from '@gauzy/common';
import { UserOrganization } from './user-organization.entity';

export const createDefaultUsersOrganizations = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[],
	users: IUser[]
): Promise<IUserOrganization[]> => {
	let userOrganization: IUserOrganization;
	const usersOrganizations: IUserOrganization[] = [];
	for (const organization of organizations) {
		for (const user of users) {
			userOrganization = new UserOrganization();
			userOrganization.organization = organization;
			userOrganization.tenant = tenant;
			userOrganization.user = user;
			usersOrganizations.push(userOrganization);
		}
	}
	return await insertUserOrganization(dataSource, usersOrganizations);
};

export const createRandomUsersOrganizations = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	tenantSuperAdminsMap: Map<ITenant, IUser[]>,
	tenantUsersMap: Map<ITenant, ISeedUsers>,
	employeesPerOrganization: number,
	adminPerOrganization: number
): Promise<Map<IOrganization, IUser[]>> => {
	const usersOrganizations: IUserOrganization[] = [];
	const organizationUsersMap: Map<IOrganization, IUser[]> = new Map();

	for await (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		const superAdmins = tenantSuperAdminsMap.get(tenant);
		const { adminUsers, employeeUsers } = tenantUsersMap.get(tenant);
		for await (const [key, organization] of Object.entries(organizations)) {
			const employees: IUser[] = chunks(employeeUsers, employeesPerOrganization)[key] || [];
			const admins: IUser[] = chunks(adminUsers, adminPerOrganization)[key] || [];
			const users = [
				...superAdmins || [],
				...admins,
				...employees
			];
			for await (const user of users) {
				if (user.id) {
					const userOrganization = new UserOrganization();
					userOrganization.organizationId = organization.id;
					userOrganization.tenantId = organization.tenantId;
					userOrganization.userId = user.id;
					usersOrganizations.push(userOrganization);
				}
			}
			organizationUsersMap.set(organization, employees);
		}
	}
	await insertUserOrganization(dataSource, usersOrganizations);
	return organizationUsersMap;
};

const insertUserOrganization = async (
	dataSource: DataSource,
	userOrganizations: IUserOrganization[]
): Promise<IUserOrganization[]> => {
	return await dataSource.manager.save(userOrganizations);
};