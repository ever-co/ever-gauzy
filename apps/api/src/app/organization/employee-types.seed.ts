import { EmployeeTypesCreateInput } from '@gauzy/models';
import { Connection } from 'typeorm';
import { EmployeeTypes } from '../employee-types/employee-types.entity';
import { GenericEmployeeTypes } from '../../app/employee-types/employee-types.model';

export const seedEmpTypes = async (connection: Connection) => {
	let genericEmployeeTypes: EmployeeTypesCreateInput[];
	genericEmployeeTypes = Object.values(GenericEmployeeTypes).map((t) => {
		const newType = {
			name: t,
			organizationId: `generic${t}`
		};
		return newType;
	});
	insertEmpTypes(connection, genericEmployeeTypes);
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
