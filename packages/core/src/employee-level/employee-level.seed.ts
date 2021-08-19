import { Connection } from 'typeorm';
import { IEmployeeLevelInput, IOrganization, ITenant } from '@gauzy/contracts';
import { EmployeeLevel } from './employee-level.entity';
import { DEFAULT_EMPLOYEE_LEVELS } from './default-employee-levels';

export const createEmployeeLevels = async (
	connection: Connection,
	tenant: ITenant,
	organizations: IOrganization[]
): Promise<IEmployeeLevelInput[]> => {
	const employeeLevels: EmployeeLevel[] = [];
	DEFAULT_EMPLOYEE_LEVELS.forEach(({ level }) => {
		for (const organization of organizations) {
			const entity = new EmployeeLevel();
			entity.level = level;
			entity.organization = organization;
			entity.tenant = tenant;
			employeeLevels.push(entity);
		}
	});
	return insertLevels(connection, employeeLevels);
};

const insertLevels = async (
	connection: Connection,
	employeeLevels: EmployeeLevel[]
) => await connection.manager.save(employeeLevels);
