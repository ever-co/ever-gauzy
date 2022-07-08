import { GoalOwnershipEnum, IOrganization, ITenant } from '@gauzy/contracts';
import { DataSource } from 'typeorm';
import { GoalGeneralSetting } from './goal-general-setting.entity';

export const createDefaultGeneralGoalSetting = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[]
): Promise<GoalGeneralSetting[]> => {
	const defaultGeneralGoalSetting = [];
	for (const organization of organizations) {
		defaultGeneralGoalSetting.push({
			maxObjectives: 5,
			maxKeyResults: 5,
			employeeCanCreateObjective: true,
			canOwnObjectives: GoalOwnershipEnum.EMPLOYEES_AND_TEAMS,
			canOwnKeyResult: GoalOwnershipEnum.EMPLOYEES_AND_TEAMS,
			krTypeKPI: true,
			krTypeTask: true,
			organization: organization,
			tenant: tenant
		});
	}
	await insertDefaultGeneralGoalSetting(
		dataSource,
		defaultGeneralGoalSetting
	);
	return defaultGeneralGoalSetting;
};

const insertDefaultGeneralGoalSetting = async (
	dataSource: DataSource,
	defaultGeneralGoalSetting: GoalGeneralSetting[]
) => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(GoalGeneralSetting)
		.values(defaultGeneralGoalSetting)
		.execute();
};
