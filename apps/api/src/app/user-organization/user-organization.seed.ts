import { Connection } from "typeorm";
import { Organization, User, UserOrganization as IUserOrganization } from '@gauzy/models';
import { UserOrganization } from './user-organization.entity';

export const createUsersOrganizations = async (
    connection: Connection,
    defaultData: {
        org: Organization
        users: User[]
    },
    randomData: {
        orgs: Organization[]
        users: User[]
    }
): Promise<{ defaultUsersOrganizations: IUserOrganization[], randomUsersOrganizations: IUserOrganization[] }> => {
    const defaultUsersOrganizations: IUserOrganization[] = await createDefaultUsersOrganizations(
        connection, defaultData
    );

    const randomUsersOrganizations: IUserOrganization[] = await createRandomUsersOrganizations(
        connection, randomData
    );

    return { defaultUsersOrganizations, randomUsersOrganizations }
};

const createDefaultUsersOrganizations = async (connection: Connection,
    defaultData: {
        org: Organization
        users: User[]
    }): Promise<IUserOrganization[]> => {
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
}

const createRandomUsersOrganizations = async (connection: Connection,
    randomData: {
        orgs: Organization[]
        users: User[]
    }): Promise<IUserOrganization[]> => {
    let userOrganization: IUserOrganization;
    const usersOrganizations: IUserOrganization[] = [];
    const randomUsers = randomData.users;
    const randomOrgs = randomData.orgs;

    const averageUsersCount = Math.ceil(randomUsers.length / randomOrgs.length);

    for (const orgs of randomOrgs) {
        if (randomUsers.length) {
            for (let index = 0; index < averageUsersCount; index++) {
                userOrganization = new UserOrganization();
                userOrganization.orgId = orgs.id;
                userOrganization.userId = randomUsers.pop().id;

                if (userOrganization.userId) {
                    await insertUserOrganization(connection, userOrganization);
                    usersOrganizations.push(userOrganization);
                }
            }
        }
    }

    return usersOrganizations;
}

const insertUserOrganization = async (connection: Connection, userOrganization: IUserOrganization): Promise<void> => {
    await connection
        .createQueryBuilder()
        .insert()
        .into(UserOrganization)
        .values(userOrganization)
        .execute();
}
