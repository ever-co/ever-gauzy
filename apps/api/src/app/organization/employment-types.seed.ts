import {
	GenericEmploymentTypes,
	OrganizationEmploymentTypeCreateInput
} from '@gauzy/models';
import { Connection } from 'typeorm';
import { OrganizationEmploymentType } from '../organization-employment-type/organization-employment-type.entity';
import { Organization } from './organization.entity';

export const seedEmploymentTypes = async (
	connection: Connection,
	organizations: Organization[]
) => {
	organizations.forEach(({ id: organizationId }) => {
		const genericEmploymentTypes: OrganizationEmploymentTypeCreateInput[] = Object.values(
			GenericEmploymentTypes
		).map((name) => {
			const newType = {
				name,
				organizationId
			};
			return newType;
		});
		insertEmploymentTypes(connection, genericEmploymentTypes);
	});
};
const insertEmploymentTypes = async (
	connection: Connection,
	employmentTypesArray: OrganizationEmploymentTypeCreateInput[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(OrganizationEmploymentType)
		.values(employmentTypesArray)
		.execute();
};
