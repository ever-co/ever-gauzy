import { Connection } from 'typeorm';
import { EmployeeLevelInput } from '@gauzy/models';
import { EmployeeLevel } from './organization-employee-level.entity';
import { Organization } from '../organization/organization.entity';

export const createEmployeeLevels = async (
	connection: Connection
): Promise<EmployeeLevelInput[]> => {
	let employeeLevels: EmployeeLevelInput[] = [];

	const organizations = await connection
		.createQueryBuilder()
		.select('organization')
		.from(Organization, 'organization')
		.getMany();

	for (let i = 0; i < organizations.length; i++) {
		const orgArray = [
			{
				level: 'Level A',
				organizationId: organizations[i]['id']
			},
			{
				level: 'Level B',
				organizationId: organizations[i]['id']
			},
			{
				level: 'Level C',
				organizationId: organizations[i]['id']
			},
			{
				level: 'Level D',
				organizationId: organizations[i]['id']
			}
		];
		employeeLevels = employeeLevels.concat(orgArray);
	}

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
