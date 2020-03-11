import { EmployeeTypesCreateInput, GenericEmployeeTypes } from '@gauzy/models';
import { Connection } from 'typeorm';
import { EmployeeTypes } from '../employee-types/employee-types.entity';
import { Organization } from './organization.entity';

export const seedEmpTypes = async (
	connection: Connection,
	organizations: Organization[]
) => {
	organizations.forEach(({ id: organizationId }) => {
		const genericEmployeeTypes: EmployeeTypesCreateInput[] = Object.values(
			GenericEmployeeTypes
		).map((name) => {
			const newType = {
				name,
				organizationId
			};
			return newType;
		});
		insertEmpTypes(connection, genericEmployeeTypes);
	});
};
const insertEmpTypes = async (
	connection: Connection,
	empTypesArray: EmployeeTypesCreateInput[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(EmployeeTypes)
		.values(empTypesArray)
		.execute();
};
