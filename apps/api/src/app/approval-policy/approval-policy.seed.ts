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
		defaultApprovalPolicy.nameConst = 'DEFAULT_APPROVAL_POLICY';
		defaultApprovalPolicy.tenantId = org.tenant.id;
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
		'International Policies',
		'Time Off',
		'Equipment Sharing'
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
				policy.tenantId = tenant.id;
				policy.nameConst = name.replace(/\s+/g, '_').toUpperCase();
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
