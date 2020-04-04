import { Connection } from 'typeorm';
import {
	TimeOffPolicy as ITimeOfPolicy,
	Organization,
	Employee
} from '@gauzy/models';
import { TimeOffPolicy } from './time-off-policy.entity';

export const createDefaultTimeOffPolicy = async (
	connection: Connection,
	defaultData: {
		org: Organization;
		employees: Employee[];
	}
): Promise<ITimeOfPolicy> => {
	const defaultTimeOffPolicy = new TimeOffPolicy();

	defaultTimeOffPolicy.name = 'Default Policy';
	defaultTimeOffPolicy.organization = defaultData.org;
	defaultTimeOffPolicy.requiresApproval = false;
	defaultTimeOffPolicy.paid = true;
	defaultTimeOffPolicy.employees = defaultData.employees;

	await insertDefaultPolicy(connection, defaultTimeOffPolicy);
	return defaultTimeOffPolicy;
};

const insertDefaultPolicy = async (
	connection: Connection,
	defaultPolicy: TimeOffPolicy
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(TimeOffPolicy)
		.values(defaultPolicy)
		.execute();
};
