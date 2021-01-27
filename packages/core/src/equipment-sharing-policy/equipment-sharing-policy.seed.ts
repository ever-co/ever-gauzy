import { Connection } from 'typeorm';
import { IOrganization } from '@gauzy/contracts';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';
import { Tenant } from '../tenant/tenant.entity';

export const createDefaultEquipmentSharingPolicyForOrg = async (
	connection: Connection,
	defaultData: {
		orgs: IOrganization[];
		tenant: Tenant;
	}
): Promise<void> => {
	const promises = [];

	defaultData.orgs.forEach((org) => {
		const defaultEquipmentSharingPolicy = new EquipmentSharingPolicy();
		defaultEquipmentSharingPolicy.name = 'Default Approval Policy';
		defaultEquipmentSharingPolicy.organization = org;
		defaultEquipmentSharingPolicy.tenant = org.tenant;
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
	tenantOrganizationsMap: Map<Tenant, IOrganization[]>
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
				policy.tenant = tenant;
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
