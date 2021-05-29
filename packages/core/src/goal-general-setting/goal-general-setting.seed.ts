import { GoalOwnershipEnum, IOrganization, ITenant } from '@gauzy/contracts';
import { Connection } from 'typeorm';
import { GoalGeneralSetting } from './goal-general-setting.entity';

export const createDefaultGeneralGoalSetting = async (
	connection: Connection,
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
		connection,
		defaultGeneralGoalSetting
	);
	return defaultGeneralGoalSetting;
};

const insertDefaultGeneralGoalSetting = async (
	connection: Connection,
	defaultGeneralGoalSetting: GoalGeneralSetting[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(GoalGeneralSetting)
		.values(defaultGeneralGoalSetting)
		.execute();
};
