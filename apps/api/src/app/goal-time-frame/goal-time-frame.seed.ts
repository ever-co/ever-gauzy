import { GoalTimeFrame } from './goal-time-frame.entity';
import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import * as seedData from './goal-time-frame.seed.data.json';

const predefinedTimeFrameList = seedData;

export const createTimeFrames = async (
	connection: Connection,
	tenant: Tenant,
	organizations: Organization[]
): Promise<GoalTimeFrame[]> => {
	const defaultTimeFrames = [];
	organizations.forEach((organization) => {
		predefinedTimeFrameList.forEach((timeFrame) => {
			defaultTimeFrames.push({
				...timeFrame,
				tenant: tenant,
				organization: organization
			});
		});
	});

	await insertTimeFrames(connection, defaultTimeFrames);

	return defaultTimeFrames;
};

const insertTimeFrames = async (
	connection: Connection,
	defaultTimeFrames: GoalTimeFrame[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(GoalTimeFrame)
		.values(defaultTimeFrames)
		.execute();
};
