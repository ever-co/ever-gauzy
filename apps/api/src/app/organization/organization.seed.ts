import { Connection } from "typeorm";
import { environment as env } from '@env-api/environment'
import { Organization } from './organization.entity';
import * as faker from 'faker';
import { getDummyImage } from '../core';

export const createOrganizations = async (
    connection: Connection
): Promise<{ defaultOrganization: Organization, randomOrganizations: Organization[] }> => {
    const defaultOrganization = new Organization()
    defaultOrganization.name = env.defaultOrganizationsName;
    await insertOrganization(connection, defaultOrganization);

    const randomOrganizations: Organization[] = [];

    for (let index = 0; index < 5; index++) {
        const organization = new Organization();
        const name = faker.company.companyName();

        organization.name = name;
        organization.imageUrl = getDummyImage(330, 300, name.charAt(0).toUpperCase());

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
