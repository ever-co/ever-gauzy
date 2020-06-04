import { HelpCenter } from './help-center.entity';
import { IHelpCenter } from '@gauzy/models';
import { Connection } from 'typeorm';

const helpCenterMenuList: IHelpCenter[] = [
	{
		name: 'Gauzy Platform',
		icon: 'book-open-outline',
		flag: 'category',
		privacy: 'eye-outline',
		children: [
			{
				name: 'Cookies',
				icon: 'alert-circle-outline',
				flag: 'article',
				privacy: 'eye-outline',
				description: 'Information',
				data: 'Cookies and Similar Technologies Information'
			},
			{
				name: 'Device',
				icon: 'book-open-outline',
				flag: 'article',
				privacy: 'eye-off-outline',
				description: 'Device Information',
				data: 'We may collect certain information about your device'
			}
		]
	},
	{
		name: 'Ever Platform',
		icon: 'book-open-outline',
		flag: 'category',
		privacy: 'eye-off-outline',
		children: [
			{
				name: 'Cookies',
				icon: 'alert-circle-outline',
				flag: 'article',
				privacy: 'eye-outline',
				description: 'Information',
				data: 'Cookies and Similar Technologies Information'
			}
		]
	},
	{
		flag: 'article',
		icon: 'book-open-outline',
		privacy: 'eye-off-outline',
		name: 'Privacy',
		description: 'Gauzy Privacy Statement',
		data: 'Usage Information'
	}
];

export const createHelpCenter = async (
	connection: Connection

	// children?: IHelpCenter[]
): Promise<IHelpCenter[]> => {
	// const items =
	// 	children && children.length > 0
	// 		? children
	// 		: !children
	// 		? helpCenterMenuList
	// 		: null;
	// items.forEach(async (hs: IHelpCenter) => {
	// 	await insertHelpCenter(connection, hs);
	// 	if (hs.children) {
	// 		await createHelpCenter(
	// 			connection,
	// 			hs.children.map((child) => child) || []
	// 		);
	// 	}
	// });

	let defaultChildren: IHelpCenter[] = [];
	for (let i = 0; i < helpCenterMenuList.length; i++) {
		await insertHelpCenter(connection, helpCenterMenuList[i]);
		if (helpCenterMenuList[i].children) {
			helpCenterMenuList[i].children.forEach((child) => {
				defaultChildren = [...defaultChildren, { ...child }];
			});
			insertChildren(connection, defaultChildren);
		}
	}

	return helpCenterMenuList;
};

const insertHelpCenter = async (
	connection: Connection,
	node: IHelpCenter
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(HelpCenter)
		.values(node)
		.execute();
};

const insertChildren = async (
	connection: Connection,
	nodes: IHelpCenter[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(HelpCenter)
		.values(nodes)
		.execute();
};

// const insertChildren = async (
// 	connection: Connection,
// 	node: HelpCenter,
// 	nodes: HelpCenter[]
// ): Promise<void> => {
// 	await connection
// 		.createQueryBuilder()
// 		.insert()
// 		.into(HelpCenter)
// 		.values(nodes)
// 		.execute();
// };
