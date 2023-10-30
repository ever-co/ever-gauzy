import { DataSource } from 'typeorm';
import { IOrganization, ITenant } from '@gauzy/contracts';
import { ApprovalPolicy } from './approval-policy.entity';
import { DEFAULT_APPROVAL_POLICIES } from './default-approval-policies';

export const createDefaultApprovalPolicyForOrg = async (
	dataSource: DataSource,
	defaultData: {
		orgs: IOrganization[];
	}
): Promise<ApprovalPolicy[]> => {
	const promises = [];

	defaultData.orgs.forEach((org) => {
		const defaultApprovalPolicy = new ApprovalPolicy();
		defaultApprovalPolicy.name = 'Default Approval Policy';
		defaultApprovalPolicy.organization = org;
		defaultApprovalPolicy.tenant = org.tenant;
		defaultApprovalPolicy.description = 'Default approval policy';
		defaultApprovalPolicy.approvalType = 'DEFAULT_APPROVAL_POLICY';
		promises.push(insertDefaultPolicy(dataSource, defaultApprovalPolicy));
	});

	return await Promise.all(promises);
};

const insertDefaultPolicy = async (
	dataSource: DataSource,
	defaultPolicy: ApprovalPolicy
): Promise<ApprovalPolicy> => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(ApprovalPolicy)
		.values(defaultPolicy)
		.execute();
	return defaultPolicy
};

export const createRandomApprovalPolicyForOrg = async (
	dataSource: DataSource,
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
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(ApprovalPolicy)
		.values(policies)
		.execute();

	return policies;
};
