import { HelpCenter } from './help-center.entity';
import { IHelpCenter } from '@gauzy/models';
import { Connection } from 'typeorm';

const helpCenterMenuList: IHelpCenter[] = [
	{
		name: 'Knowledge base1',
		icon: 'book-open-outline',
		flag: 'category',
		privacy: 'eye-outline',
		children: [
			{
				name: 'article1.1',
				icon: 'alert-circle-outline',
				flag: 'article',
				privacy: 'eye-outline',
				description: 'desc1111',
				data: 'aaaaaa'
			},
			{
				name: 'article1.2',
				icon: 'book-open-outline',
				flag: 'article',
				privacy: 'eye-off-outline',
				description: 'desc122222',
				data: 'bbbbbb'
			}
		]
	},
	{
		name: 'Knowledge base2',
		icon: 'book-open-outline',
		flag: 'category',
		privacy: 'eye-off-outline',
		children: []
	},
	{
		flag: 'article',
		icon: 'book-open-outline',
		privacy: 'eye-off-outline',
		name: 'article2.1',
		description: 'desc1',
		data: 'aaaaa'
	}
];

export const createHelpCenter = async (
	connection: Connection
): Promise<IHelpCenter[]> => {
	// let defaultChildren: IHelpCenter[] = [];
	for (let i = 0; i < helpCenterMenuList.length; i++) {
		await insertHelpCenter(connection, helpCenterMenuList[i]);
		// if (helpCenterMenuList[i].children) {
		// 	helpCenterMenuList[i].children.forEach((child) => {
		// 		defaultChildren = [...defaultChildren, { ...child }];
		// 	});
		// 	insertChildren(connection, defaultChildren);
		// }
	}

	return helpCenterMenuList;
};

const insertHelpCenter = async (
	connection: Connection,
	node: HelpCenter
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(HelpCenter)
		.values(node)
		.execute();
};

// const insertChildren = async (
// 	connection: Connection,
// 	nodes: HelpCenter[]
// ): Promise<void> => {
// 	await connection
// 		.createQueryBuilder()
// 		.insert()
// 		.into(HelpCenter)
// 		.values(nodes)
// 		.execute();
// };
