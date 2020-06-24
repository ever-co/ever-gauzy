import { HelpCenter } from './help-center.entity';
import { IHelpCenter } from '@gauzy/models';
import { Connection } from 'typeorm';

const helpCenterMenuList: IHelpCenter[] = [
	{
		name: 'Gauzy Platform',
		icon: 'book-open-outline',
		flag: 'base',
		privacy: 'eye-outline',
		language: 'en',
		color: 'blue',
		index: 0,
		children: [
			{
				name: 'Cookies',
				icon: 'alert-circle-outline',
				flag: 'category',
				privacy: 'eye-outline',
				description: 'Information',
				language: 'en',
				color: 'black',
				index: 0
			},
			{
				name: 'Device',
				icon: 'book-open-outline',
				flag: 'category',
				privacy: 'eye-off-outline',
				description: 'Device Information',
				language: 'en',
				color: 'black',
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
				color: 'black',
				index: 2
			},
			{
				flag: 'category',
				icon: 'book-open-outline',
				privacy: 'eye-off-outline',
				name: 'Testing',
				description: 'Gauzy Testing',
				language: 'en',
				color: 'black',
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
		color: 'blue',
		index: 1,
		children: [
			{
				name: 'Cookies',
				icon: 'alert-circle-outline',
				flag: 'category',
				privacy: 'eye-outline',
				description: 'Information',
				language: 'en',
				color: 'black',
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
		color: 'black',
		index: 2,
		children: [
			{
				name: 'Cookies',
				icon: 'alert-circle-outline',
				flag: 'category',
				privacy: 'eye-outline',
				description: 'Information',
				language: 'en',
				color: 'black',
				index: 0
			}
		]
	}
];

export const createHelpCenter = async (
	connection: Connection
): Promise<IHelpCenter[]> => {
	for (const node of helpCenterMenuList) {
		const entity = await createEntity(connection, node);
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

const createEntity = async (connection: Connection, node: IHelpCenter) => {
	if (!node) {
		return;
	}
	return connection.manager.create(HelpCenter, node);
};
