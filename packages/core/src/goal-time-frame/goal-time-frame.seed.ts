import { GoalTimeFrame } from './goal-time-frame.entity';
import { Connection } from 'typeorm';
import * as moment from 'moment';
import { IOrganization, ITenant } from '@gauzy/contracts';

export const createDefaultTimeFrames = async (
	connection: Connection,
	tenant: ITenant,
	organizations: IOrganization[]
): Promise<GoalTimeFrame[]> => {
	const defaultTimeFrames = [];
	for (const organization of organizations) {
		// Annual time frame current year
		defaultTimeFrames.push({
			name: `Annual-${moment().year()}`,
			status: 'Active',
			startDate: moment().startOf('year').toDate(),
			endDate: moment().endOf('year').toDate(),
			tenant: tenant,
			organization: organization
		});
		// will add all 4 Quarters of current year
		for (let i = 1; i <= 4; i++) {
			const start = moment().quarter(i).startOf('quarter').toDate();
			const end = moment().quarter(i).endOf('quarter').toDate();
			defaultTimeFrames.push({
				name: `Q${i}-${moment().year()}`,
				status: 'Active',
				startDate: start,
				endDate: end,
				tenant: tenant,
				organization: organization
			});
		}
	}

	await insertDefaultTimeFrames(connection, defaultTimeFrames);
	return defaultTimeFrames;
};

const insertDefaultTimeFrames = async (
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
