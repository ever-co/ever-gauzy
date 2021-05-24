import { Connection } from 'typeorm';
import { IOrganization, ITenant } from '@gauzy/contracts';
import { ApprovalPolicy } from './approval-policy.entity';
import { DEFAULT_APPROVAL_POLICIES } from './default-approval-policies';

export const createDefaultApprovalPolicyForOrg = async (
	connection: Connection,
	defaultData: {
		orgs: IOrganization[];
	}
): Promise<void> => {
	const promises = [];

	defaultData.orgs.forEach((org) => {
		const defaultApprovalPolicy = new ApprovalPolicy();
		defaultApprovalPolicy.name = 'Default Approval Policy';
		defaultApprovalPolicy.organization = org;
		defaultApprovalPolicy.tenant = org.tenant;
		defaultApprovalPolicy.description = 'Default approval policy';
		defaultApprovalPolicy.approvalType = 'DEFAULT_APPROVAL_POLICY';
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

export const createRandomApprovalPolicyForOrg = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<ApprovalPolicy[]> => {
	const policies: ApprovalPolicy[] = [];
	for (const tenant of tenants) {
		const orgs = tenantOrganizationsMap.get(tenant);
		orgs.forEach((org) => {
			DEFAULT_APPROVAL_POLICIES.forEach((name) => {
				const policy = new ApprovalPolicy();
				policy.description = name;
				policy.name = name;
				policy.tenant = tenant;
				policy.organizationId = org.id;
				policy.approvalType = name.replace(/\s+/g, '_').toUpperCase();
				policies.push(policy);
			});
		});
	}
	await connection
		.createQueryBuilder()
		.insert()
		.into(ApprovalPolicy)
		.values(policies)
		.execute();

	return policies;
};
