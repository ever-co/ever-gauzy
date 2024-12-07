import { DataSource } from 'typeorm';
import { IEmployeeLevelInput, IOrganization, ITenant } from '@gauzy/contracts';
import { EmployeeLevel } from './employee-level.entity';
import { DEFAULT_EMPLOYEE_LEVELS } from './default-employee-levels';

export const createEmployeeLevels = async (
	dataSource: DataSource,
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
	return insertLevels(dataSource, employeeLevels);
};

const insertLevels = async (
	dataSource: DataSource,
	employeeLevels: EmployeeLevel[]
) => await dataSource.manager.save(employeeLevels);
