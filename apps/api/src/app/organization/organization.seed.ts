import { Connection } from "typeorm";
import { environment as env } from '@env-api/environment'
import { Organization } from './organization.entity';

export const createOrganizations = async (
    connection: Connection
): Promise<Organization[]> => {
    const organizations: Organization[] = [];

    const organizationsNames = env.dummyOrganizationsNames || [];

    for (const name of organizationsNames) {
        const organization = new Organization();
        organization.name = name;

        await connection
            .createQueryBuilder()
            .insert()
            .into(Organization)
            .values(organization)
            .execute();

        organizations.push(organization);
    }

    return organizations;
};
