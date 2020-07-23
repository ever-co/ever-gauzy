import { Connection } from 'typeorm';
import { Organization } from '@gauzy/models';
import { ApprovalPolicy } from './approval-policy.entity';
import { Tenant } from '../tenant/tenant.entity';

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
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<ApprovalPolicy[]> => {
	let policies: ApprovalPolicy[] = [];
	let policyArray = [
		'Trade Policy',
		'Union Budget',
		'Definition, Licensing Policies and Registration',
		'State Government Industrial Policies',
		'Reservation Policy',
		'National Policies',
		'International Policies'
	];
	for (const tenant of tenants) {
		const orgs = tenantOrganizationsMap.get(tenant);
		orgs.forEach((org) => {
			policyArray.forEach((name) => {
				let policy = new ApprovalPolicy();
				policy.description = name;
				policy.name = name;
				policy.tenant = tenant;
				policy.organization = org;
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
