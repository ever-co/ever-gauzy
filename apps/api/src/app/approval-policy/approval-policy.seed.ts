import { Connection } from 'typeorm';
import { Organization, ApprovalPolicyTypesEnum } from '@gauzy/models';
import { ApprovalPolicy } from './approval-policy.entity';

export const createDefaultApprovalPolicyForOrg = async (
	connection: Connection,
	defaultData: {
		orgs: Organization[];
	}
): Promise<void> => {
	const promises = [];

	defaultData.orgs.forEach((org) => {
		const defaultApprovalPolicy = new ApprovalPolicy();
		defaultApprovalPolicy.name = 'Default Approval Policy';
		defaultApprovalPolicy.organizationId = org.id;
		defaultApprovalPolicy.description = 'Default approval policy';
		defaultApprovalPolicy.tenantId = org.tenantId;
		defaultApprovalPolicy.type = ApprovalPolicyTypesEnum.BUSINESS_TRIP;
		promises.push(insertDefaultPolicy(connection, defaultApprovalPolicy));
	});

	await Promise.all(promises);
};

const insertDefaultPolicy = async (
	connection: Connection,
	defaultPolicy: ApprovalPolicy
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(ApprovalPolicy)
		.values(defaultPolicy)
		.execute();
};
