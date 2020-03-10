import { Connection } from 'typeorm';
import { EmployeeLevelInput } from '@gauzy/models';
import { EmployeeLevel } from './organization-employee-level.entity';

export const createEmployeeLevels = async (
	connection: Connection
): Promise<EmployeeLevelInput[]> => {
	const employeeLevels: EmployeeLevelInput[] = [
		{
			level: 'Level A',
			organizationId: '1'
		},
		{
			level: 'Level B',
			organizationId: '1'
		},
		{
			level: 'Level C',
			organizationId: '1'
		},
		{
			level: 'Level D',
			organizationId: '1'
		}
	];

	for (let i = 0; i < employeeLevels.length; i++) {
		await insertLevel(connection, employeeLevels[i]);
	}

	return employeeLevels;
};

const insertLevel = async (
	connection: Connection,
	employeeLevel: EmployeeLevelInput
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(EmployeeLevel)
		.values(employeeLevel)
		.execute();
};
