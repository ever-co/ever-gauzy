import { Connection } from 'typeorm';
import { Organization } from '@gauzy/models';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';
import { Tenant } from '../tenant/tenant.entity';

export const createDefaultEquipmentSharingPolicyForOrg = async (
	connection: Connection,
	defaultData: {
		orgs: Organization[];
	}
): Promise<void> => {
	const promises = [];

	defaultData.orgs.forEach((org) => {
		const defaultEquipmentSharingPolicy = new EquipmentSharingPolicy();
		defaultEquipmentSharingPolicy.name = 'Default Approval Policy';
		defaultEquipmentSharingPolicy.organizationId = org.id;
		defaultEquipmentSharingPolicy.description = 'Default approval policy';
		promises.push(
			insertDefaultPolicy(connection, defaultEquipmentSharingPolicy)
		);
	});

	await Promise.all(promises);
};

const insertDefaultPolicy = async (
	connection: Connection,
	defaultPolicy: EquipmentSharingPolicy
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(EquipmentSharingPolicy)
		.values(defaultPolicy)
		.execute();
};

export const createRandomEquipmentSharingPolicyForOrg = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationsMap: Map<Tenant, Organization[]>
): Promise<EquipmentSharingPolicy[]> => {
	const policies: EquipmentSharingPolicy[] = [];
	const policyArray = ['Equipment Sharing Policy'];
	for (const tenant of tenants) {
		const orgs = tenantOrganizationsMap.get(tenant);
		orgs.forEach((org) => {
			policyArray.forEach((name) => {
				const policy = new EquipmentSharingPolicy();
				policy.description = name;
				policy.name = name;
				policy.organization = org;
				policies.push(policy);
			});
		});
	}
	await connection
		.createQueryBuilder()
		.insert()
		.into(EquipmentSharingPolicy)
		.values(policies)
		.execute();

	return policies;
};
