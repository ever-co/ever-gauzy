import { Connection } from 'typeorm';
import {
	ITimeOffPolicy as ITimeOfPolicy,
	IOrganization,
	IEmployee,
	ITenant
} from '@gauzy/contracts';
import { TimeOffPolicy } from './time-off-policy.entity';
import * as faker from 'faker';
import { DEFAULT_TIMEOFF_POLICIES } from './default-time-off-policies';

export const createDefaultTimeOffPolicy = async (
	connection: Connection,
	defaultData: {
		org: IOrganization;
		employees: IEmployee[];
	}
): Promise<ITimeOfPolicy> => {
	const defaultTimeOffPolicy = new TimeOffPolicy();

	defaultTimeOffPolicy.name = 'Default Policy';
	defaultTimeOffPolicy.organization = defaultData.org;
	defaultTimeOffPolicy.tenant = defaultData.org.tenant;
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

export const createRandomTimeOffPolicies = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<TimeOffPolicy[]> => {
	const policies: TimeOffPolicy[] = [];
	(tenants || []).forEach((tenant) => {
		const organizations = tenantOrganizationsMap.get(tenant);
		(organizations || []).forEach((organization) => {
			DEFAULT_TIMEOFF_POLICIES.forEach((name) => {
				const policy = new TimeOffPolicy();
				policy.name = name;
				policy.organization = organization;
				policy.tenant = tenant;
				policy.paid = faker.random.arrayElement([true, false]);
				policy.requiresApproval = faker.random.arrayElement([
					true,
					false
				]);
				policies.push(policy);
			});
		});
	});

	return await connection.manager.save(policies);
};
