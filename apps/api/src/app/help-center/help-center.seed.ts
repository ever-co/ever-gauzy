import { HelpCenter } from './help-center.entity';
import { IHelpCenter } from '@gauzy/models';
import { Connection } from 'typeorm';

const helpCenterMenuList: IHelpCenter[] = [
	{
		name: 'Gauzy Platform',
		icon: 'book-open-outline',
		flag: 'category',
		privacy: 'eye-outline',
		language: 'en',
		color: 'blue',
		children: [
			{
				name: 'Cookies',
				icon: 'alert-circle-outline',
				flag: 'article',
				privacy: 'eye-outline',
				description: 'Information',
				data: 'Cookies and Similar Technologies Information',
				language: 'en',
				color: 'black'
			},
			{
				name: 'Device',
				icon: 'book-open-outline',
				flag: 'article',
				privacy: 'eye-off-outline',
				description: 'Device Information',
				data: 'We may collect certain information about your device',
				language: 'en',
				color: 'black'
			}
		]
	},
	{
		name: 'Ever Platform',
		icon: 'book-open-outline',
		flag: 'category',
		privacy: 'eye-off-outline',
		language: 'en',
		color: 'blue',
		children: [
			{
				name: 'Cookies',
				icon: 'alert-circle-outline',
				flag: 'article',
				privacy: 'eye-outline',
				description: 'Information',
				data: 'Cookies and Similar Technologies Information',
				language: 'en',
				color: 'black'
			}
		]
	},
	{
		flag: 'article',
		icon: 'book-open-outline',
		privacy: 'eye-off-outline',
		name: 'Privacy',
		description: 'Gauzy Privacy Statement',
		data: 'Usage Information',
		language: 'en',
		color: 'black'
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
			defaultChildren.forEach(async (item) => {
				helpCenterMenuList[i].children.push(item);
			});
			insertChildren(connection, helpCenterMenuList[i]);
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
	node: IHelpCenter
): Promise<void> => {
	// nodes.forEach(async (item) => {
	// 	parent.children.push(item);
	// });
	await connection.manager.save(node);
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
