import { DataSource } from 'typeorm';
import { IOrganization, ITenant } from '@gauzy/contracts';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';

export const createDefaultEquipmentSharingPolicyForOrg = async (
	dataSource: DataSource,
	defaultData: {
		orgs: IOrganization[];
		tenant: ITenant;
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
			insertDefaultPolicy(dataSource, defaultEquipmentSharingPolicy)
		);
	});

	await Promise.all(promises);
};

const insertDefaultPolicy = async (
	dataSource: DataSource,
	defaultPolicy: EquipmentSharingPolicy
): Promise<void> => {
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(EquipmentSharingPolicy)
		.values(defaultPolicy)
		.execute();
};

export const createRandomEquipmentSharingPolicyForOrg = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
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
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(EquipmentSharingPolicy)
		.values(policies)
		.execute();

	return policies;
};
