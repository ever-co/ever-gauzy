import { DataSource } from 'typeorm';
import {
	ITimeOffPolicy as ITimeOfPolicy,
	IOrganization,
	IEmployee,
	ITenant
} from '@gauzy/contracts';
import { TimeOffPolicy } from './time-off-policy.entity';
import { faker } from '@faker-js/faker';
import { DEFAULT_TIMEOFF_POLICIES } from './default-time-off-policies';

export const createDefaultTimeOffPolicy = async (
	dataSource: DataSource,
	tenant: ITenant,
	organization: IOrganization,
	employees: IEmployee[]
): Promise<ITimeOfPolicy> => {
	const defaultTimeOffPolicy = new TimeOffPolicy();

	defaultTimeOffPolicy.name = 'Default Policy';
	defaultTimeOffPolicy.organization = organization;
	defaultTimeOffPolicy.tenant = tenant;
	defaultTimeOffPolicy.requiresApproval = false;
	defaultTimeOffPolicy.paid = true;
	defaultTimeOffPolicy.employees = employees;

	await insertDefaultPolicy(dataSource, defaultTimeOffPolicy);
	return defaultTimeOffPolicy;
};

const insertDefaultPolicy = async (
	dataSource: DataSource,
	defaultPolicy: TimeOffPolicy
): Promise<void> => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(TimeOffPolicy)
		.values(defaultPolicy)
		.execute();
};

export const createRandomTimeOffPolicies = async (
	dataSource: DataSource,
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
				policy.paid = faker.helpers.arrayElement([true, false]);
				policy.requiresApproval = faker.helpers.arrayElement([
					true,
					false
				]);
				policies.push(policy);
			});
		});
	});

	return await dataSource.manager.save(policies);
};
