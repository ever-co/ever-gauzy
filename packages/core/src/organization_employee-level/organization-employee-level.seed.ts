import { Connection } from 'typeorm';
import { IEmployeeLevelInput } from '@gauzy/contracts';
import { EmployeeLevel } from './organization-employee-level.entity';
import { Organization } from '../organization/organization.entity';
import { DEFAULT_EMPLOYEE_LEVELS } from './default-organization-employee-levels';

export const createEmployeeLevels = async (
	connection: Connection,
	organizations: Organization[]
): Promise<IEmployeeLevelInput[]> => {
	const employeeLevels: EmployeeLevel[] = [];
	DEFAULT_EMPLOYEE_LEVELS.forEach(({ level }) => {
		organizations.forEach((organization: Organization) => {
			const entity = new EmployeeLevel();
			entity.level = level;
			entity.organization = organization;
			entity.tenant = organization.tenant;
			employeeLevels.push(entity);
		});
	});

	return insertLevels(connection, employeeLevels);
};

const insertLevels = async (
	connection: Connection,
	employeeLevels: EmployeeLevel[]
) => await connection.manager.save(employeeLevels);
