import { Connection } from 'typeorm';
import {
	IOrganization,
	IUser,
	IUserOrganization,
	ISeedUsers,
	ITenant
} from '@gauzy/contracts';
import { UserOrganization } from './user-organization.entity';

export const createDefaultUsersOrganizations = async (
	connection: Connection,
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
	return await insertUserOrganization(connection, usersOrganizations);
};

export const createRandomUsersOrganizations = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>,
	tenantSuperAdminsMap: Map<ITenant, IUser[]>,
	tenantUsersMap: Map<ITenant, ISeedUsers>,
	employeesPerOrganization: number
): Promise<IUserOrganization[]> => {
	const usersOrganizations: IUserOrganization[] = [];

	for (const tenant of tenants) {
		const orgs = tenantOrganizationsMap.get(tenant);
		const superAdmins = tenantSuperAdminsMap.get(tenant);
		const { adminUsers, employeeUsers } = tenantUsersMap.get(tenant);

		let start = 0;
		let end: number = employeesPerOrganization;

		let count = 0;

		orgs.forEach((org) => {
			const userList = [
				...employeeUsers.slice(start, end),
				adminUsers[count % adminUsers.length],
				...superAdmins
			];
			start = end;
			end = end + employeesPerOrganization;
			count++;

			userList.forEach(async (user) => {
				if (user.id) {
					const userOrganization = new UserOrganization();
					userOrganization.organizationId = org.id;
					userOrganization.userId = user.id;
					userOrganization.tenant = org.tenant;
					usersOrganizations.push(userOrganization);
				}
			});
		});
	}

	return await insertUserOrganization(connection, usersOrganizations);
};

const insertUserOrganization = async (
	connection: Connection,
	userOrganizations: IUserOrganization[]
): Promise<IUserOrganization[]> => {
	return await connection.manager.save(userOrganizations);
};
