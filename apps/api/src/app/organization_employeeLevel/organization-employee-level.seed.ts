import { Connection } from 'typeorm';
import { IEmployeeLevelInput } from '@gauzy/models';
import { EmployeeLevel } from './organization-employee-level.entity';
import { Organization } from '../organization/organization.entity';

const DEFAULT_EMPLOYEE_LEVELS = [
	{
		level: 'Level A'
	},
	{
		level: 'Level B'
	},
	{
		level: 'Level C'
	},
	{
		level: 'Level D'
	}
];

export const createEmployeeLevels = async (
	connection: Connection,
	organizations: Organization[]
): Promise<IEmployeeLevelInput[]> => {
	const employeeLevels: IEmployeeLevelInput[] = [];
	DEFAULT_EMPLOYEE_LEVELS.forEach(({ level }) => {
		organizations.forEach((organization: Organization) => {
			const entity = new EmployeeLevel();
			entity.level = level;
			entity.organization = organization;
			entity.tenant = organization.tenant;
			employeeLevels.push(entity);
		});
	});

	insertLevels(connection, employeeLevels);
	return employeeLevels;
};

const insertLevels = async (
	connection: Connection,
	employeeLevel: IEmployeeLevelInput[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(EmployeeLevel)
		.values(employeeLevel)
		.execute();
};
