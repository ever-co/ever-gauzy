import { DataSource } from 'typeorm';
import { IOrganization, ITenant } from '@gauzy/contracts';
import { EquipmentSharingPolicy } from './equipment-sharing-policy.entity';

export const createDefaultEquipmentSharingPolicy = async (
	dataSource: DataSource,
	tenant: ITenant,
	organizations: IOrganization[]
): Promise<void> => {
	for await (const organization of organizations) {
		const defaultEquipmentSharingPolicy = new EquipmentSharingPolicy();
		defaultEquipmentSharingPolicy.name = 'Default Approval Policy';
		defaultEquipmentSharingPolicy.organization = organization;
		defaultEquipmentSharingPolicy.tenant = tenant;
		defaultEquipmentSharingPolicy.description = 'Default approval policy';
		await insertDefaultPolicy(dataSource, defaultEquipmentSharingPolicy);
	}
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

export const createRandomEquipmentSharingPolicy = async (
	dataSource: DataSource,
	tenants: ITenant[],
	tenantOrganizationsMap: Map<ITenant, IOrganization[]>
): Promise<EquipmentSharingPolicy[]> => {
	const policies: EquipmentSharingPolicy[] = [];
	const policyArray = ['Equipment Sharing Policy'];
	for await (const tenant of tenants) {
		const organizations = tenantOrganizationsMap.get(tenant);
		for await (const organization of organizations) {
			policyArray.forEach((name) => {
				const policy = new EquipmentSharingPolicy();
				policy.description = name;
				policy.name = name;
				policy.organization = organization;
				policy.tenant = tenant;
				policies.push(policy);
			});
		}
	}
	await dataSource
		.createQueryBuilder()
		.insert()
		.into(EquipmentSharingPolicy)
		.values(policies)
		.execute();
	return policies;
};
