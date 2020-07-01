import { HelpCenter } from './help-center.entity';
import { IHelpCenter } from '@gauzy/models';
import { Connection } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { Organization } from '../organization/organization.entity';

const helpCenterMenuList: IHelpCenter[] = [
	{
		name: 'Gauzy Platform',
		icon: 'book-open-outline',
		flag: 'base',
		privacy: 'eye-outline',
		language: 'en',
		color: '#d53636',
		index: 0,
		children: [
			{
				name: 'Cookies',
				icon: 'alert-circle-outline',
				flag: 'category',
				privacy: 'eye-outline',
				description: 'Information',
				language: 'en',
				color: '#d53636',
				index: 0
			},
			{
				name: 'Device',
				icon: 'book-open-outline',
				flag: 'category',
				privacy: 'eye-off-outline',
				description: 'Device Information',
				language: 'en',
				color: '#d53636',
				index: 1
			},
			{
				flag: 'category',
				icon: 'book-open-outline',
				privacy: 'eye-off-outline',
				name: 'Privacy',
				description: 'Gauzy Privacy Statement',
				data: 'Usage Information',
				language: 'en',
				color: '#d53636',
				index: 2
			},
			{
				flag: 'category',
				icon: 'book-open-outline',
				privacy: 'eye-off-outline',
				name: 'Testing',
				description: 'Gauzy Testing',
				language: 'en',
				color: '#d53636',
				index: 3
			}
		]
	},
	{
		name: 'Ever Platform',
		icon: 'book-open-outline',
		flag: 'base',
		privacy: 'eye-off-outline',
		language: 'en',
		color: '#d53636',
		index: 1,
		children: [
			{
				name: 'Cookies',
				icon: 'alert-circle-outline',
				flag: 'category',
				privacy: 'eye-outline',
				description: 'Information',
				language: 'en',
				color: '#d53636',
				index: 0
			}
		]
	},
	{
		flag: 'base',
		icon: 'book-open-outline',
		privacy: 'eye-off-outline',
		name: 'Privacy',
		language: 'en',
		color: '#d53636',
		index: 2,
		children: [
			{
				name: 'Cookies',
				icon: 'alert-circle-outline',
				flag: 'category',
				privacy: 'eye-outline',
				description: 'Information',
				language: 'en',
				color: '#d53636',
				index: 0
			}
		]
	}
];

export const createHelpCenter = async (
	connection: Connection,
	{
		tenant,
		org
	}: {
		tenant: Tenant;
		org: Organization;
	}
): Promise<IHelpCenter[]> => {
	for (const node of helpCenterMenuList) {
		const helpCenter: HelpCenter = { ...node, tenant, organization: org };
		helpCenter.children.forEach((child: HelpCenter) => {
			child.organization = org;
			child.tenant = tenant;
		});
		const entity = await createEntity(connection, helpCenter);
		await save(connection, entity);
	}

	return helpCenterMenuList;
};

const save = async (
	connection: Connection,
	node: IHelpCenter
): Promise<void> => {
	await connection.manager.save(node);
};

const createEntity = async (connection: Connection, node: HelpCenter) => {
	if (!node) {
		return;
	}
	return connection.manager.create(HelpCenter, node);
};
