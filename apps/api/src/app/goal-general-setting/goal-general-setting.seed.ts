import { GoalOwnershipEnum } from '@gauzy/models';
import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import { GoalGeneralSetting } from './goal-general-setting.entity';

export const createDefaultGeneralGoalSetting = async (
	connection: Connection,
	tenant: Tenant,
	organizations: Organization[]
): Promise<GoalGeneralSetting[]> => {
	const defaultGeneralGoalSetting = [];
	organizations.forEach((organization) => {
		defaultGeneralGoalSetting.push({
			maxObjectives: 5,
			maxKeyResults: 5,
			employeeCanCreateObjective: true,
			canOwnObjectives: GoalOwnershipEnum.EMPLOYEES_AND_TEAMS,
			canOwnKeyResult: GoalOwnershipEnum.EMPLOYEES_AND_TEAMS,
			krTypeKPI: false,
			krTypeTask: false,
			organization: organization,
			tenant: tenant
		});
	});
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
