import { Connection } from "typeorm";
import { environment as env } from '@env-api/environment'
import { Organization } from './organization.entity';
import * as faker from 'faker';

export const createOrganizations = async (
    connection: Connection
): Promise<{ defaultOrganization: Organization, randomOrganizations: Organization[] }> => {
    const defaultOrganization = new Organization()
    defaultOrganization.name = env.defaultOrganizationsName;
    await insertOrganization(connection, defaultOrganization);

    const randomOrganizations: Organization[] = [];

    for (let index = 0; index < 5; index++) {
        const organization = new Organization();
        organization.name = faker.company.companyName();
        await insertOrganization(connection, organization);
        randomOrganizations.push(organization);
    }

    return { defaultOrganization, randomOrganizations };
};

const insertOrganization = async (connection: Connection, organization: Organization): Promise<void> => {
    await connection
        .createQueryBuilder()
        .insert()
        .into(Organization)
        .values(organization)
        .execute();
}
