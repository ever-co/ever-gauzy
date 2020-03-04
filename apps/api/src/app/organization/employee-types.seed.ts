import { EmployeeTypesCreateInput } from '@gauzy/models';
import * as fs from 'fs';
import { Connection } from 'typeorm';
import { EmployeeTypes } from '../employee-types/employee-types.entity';

export const seedEmpTypes = async (connection: Connection) => {
	let empTypes = '';
	const empTypesArray: EmployeeTypesCreateInput[] = [];
	fs.readFile(
		'C:/Coding/gauzy/apps/api/src/app/organization/et.txt',
		'utf8',
		async (err, data) => {
			if (err) {
				console.error(err);
			}
			empTypes = data;

			for (const t of empTypes.split(', ')) {
				const type: EmployeeTypesCreateInput = {
					name: t,
					organizationId: '1'
				};
				empTypesArray.push(type);
			}
			await insertEmpTypes(connection, empTypesArray);
		}
	);
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
