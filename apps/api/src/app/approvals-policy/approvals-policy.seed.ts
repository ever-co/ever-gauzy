import { Connection } from 'typeorm';
import {
	ApprovalsPolicy as IApprovalsPolicy,
	Organization
} from '@gauzy/models';
import { ApprovalsPolicy } from './approvals-policy.entity';
import { Tenant } from './../tenant/tenant.entity';

export const createDefaultApprovalPolicy = async (
	connection: Connection,
	defaultData: {
		org: Organization;
		tenant: Tenant;
		type: number;
		description: string;
	}
): Promise<IApprovalsPolicy> => {
	const defaultTimeOffPolicy = new ApprovalsPolicy();

	defaultTimeOffPolicy.name = 'Default Policy';
	defaultTimeOffPolicy.organization = defaultData.org;
	defaultTimeOffPolicy.tenant = defaultData.tenant;
	defaultTimeOffPolicy.type = defaultData.type;
	defaultTimeOffPolicy.description = defaultData.description;

	// await insertDefaultPolicy(connection, defaultTimeOffPolicy);
	return defaultTimeOffPolicy;
};

const insertDefaultPolicy = async (
	connection: Connection,
	defaultPolicy: ApprovalsPolicy
): Promise<void> => {
	// await connection
	// 	.createQueryBuilder()
	// 	.insert()
	// 	.into(TimeOffPolicy)
	// 	.values(defaultPolicy)
	// 	.execute();
};
