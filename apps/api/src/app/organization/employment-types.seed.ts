import {
	EmploymentTypesCreateInput,
	GenericEmploymentTypes
} from '@gauzy/models';
import { Connection } from 'typeorm';
import { EmploymentTypes } from '../employment-types/employment-types.entity';
import { Organization } from './organization.entity';

export const seedEmpTypes = async (
	connection: Connection,
	organizations: Organization[]
) => {
	organizations.forEach(({ id: organizationId }) => {
		const genericEmploymentTypes: EmploymentTypesCreateInput[] = Object.values(
			GenericEmploymentTypes
		).map((name) => {
			const newType = {
				name,
				organizationId
			};
			return newType;
		});
		insertEmpTypes(connection, genericEmploymentTypes);
	});
};
const insertEmpTypes = async (
	connection: Connection,
	empTypesArray: EmploymentTypesCreateInput[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(EmploymentTypes)
		.values(empTypesArray)
		.execute();
};
