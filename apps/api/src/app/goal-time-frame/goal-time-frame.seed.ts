import { GoalTimeFrame } from './goal-time-frame.entity';
import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';
import * as moment from 'moment';

export const createTimeFrames = async (
	connection: Connection,
	tenant: Tenant,
	organizations: Organization[]
): Promise<GoalTimeFrame[]> => {
	const defaultTimeFrames = [];
	organizations.forEach((organization) => {
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
