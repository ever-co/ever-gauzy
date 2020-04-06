import { Connection } from 'typeorm';
import {
	Organization,
	User,
	UserOrganization as IUserOrganization
} from '@gauzy/models';
import { UserOrganization } from './user-organization.entity';

export const createUsersOrganizations = async (
	connection: Connection,
	defaultData: {
		org: Organization;
		users: User[];
	},
	randomData: {
		orgs: Organization[];
		users: User[];
		superAdminUsers: User[];
	}
): Promise<{
	defaultUsersOrganizations: IUserOrganization[];
	randomUsersOrganizations: IUserOrganization[];
}> => {
	const defaultUsersOrganizations: IUserOrganization[] = await createDefaultUsersOrganizations(
		connection,
		defaultData
	);

	const randomUsersOrganizations: IUserOrganization[] = await createRandomUsersOrganizations(
		connection,
		randomData
	);

	return { defaultUsersOrganizations, randomUsersOrganizations };
};

const createDefaultUsersOrganizations = async (
	connection: Connection,
	defaultData: {
		org: Organization;
		users: User[];
	}
): Promise<IUserOrganization[]> => {
	let userOrganization: IUserOrganization;
	const usersOrganizations: IUserOrganization[] = [];
	const defaultUsers = defaultData.users;
	const defaultOrg = defaultData.org;

	for (const user of defaultUsers) {
		userOrganization = new UserOrganization();
		userOrganization.orgId = defaultOrg.id;
		userOrganization.userId = user.id;

		await insertUserOrganization(connection, userOrganization);

		usersOrganizations.push(userOrganization);
	}

	return usersOrganizations;
};

const createRandomUsersOrganizations = async (
	connection: Connection,
	randomData: {
		orgs: Organization[];
		users: User[];
		superAdminUsers: User[];
	}
): Promise<IUserOrganization[]> => {
	const { orgs, users, superAdminUsers } = randomData;
	const usersOrganizations: IUserOrganization[] = [];

	const usersPerOrg: number = Math.ceil(users.length / orgs.length);
	let start = 0;
	let end: number = usersPerOrg;

	orgs.forEach((org) => {
		const userList = [...users.slice(start, end), ...superAdminUsers];
		start = end;
		end = end + usersPerOrg;

		userList.forEach(async (user) => {
			if (user.id) {
				const userOrganization = new UserOrganization();
				userOrganization.orgId = org.id;
				userOrganization.userId = user.id;
				await insertUserOrganization(connection, userOrganization);
				usersOrganizations.push(userOrganization);
			}
		});
	});

	return usersOrganizations;
};

const insertUserOrganization = async (
	connection: Connection,
	userOrganization: IUserOrganization
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(UserOrganization)
		.values(userOrganization)
		.execute();
};
