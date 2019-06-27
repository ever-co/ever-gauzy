import { Connection } from "typeorm";
import { Organization } from '../../organization';
import { environment as env } from '@env-api/environment'

export const createOrganizations = async (
    connection: Connection
): Promise<Organization[]> => {
    const organizations: Organization[] = [];

    const organizationsNames = env.dummyOrganizationsNames || [];

    for (const name of organizationsNames) {
        const organization = new Organization();
        organization.name = name;

        await connection.createQueryBuilder().insert().into(Organization).values(organization).execute();
        organizations.push(organization);
    }

    return organizations;
};
