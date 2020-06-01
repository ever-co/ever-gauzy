import { HelpCenter } from './help-center.entity';
import { IHelpCenter } from '@gauzy/models';
import { Connection } from 'typeorm';

const helpCenterMenuList: IHelpCenter[] = [];

export const createHelpCenter = async (
	connection: Connection
): Promise<IHelpCenter[]> => {
	// try {
	// 	await treeWalk(connection, helpCenterMenuList);
	// } catch (e) {
	// 	console.log(e);
	// }
	for (let i = 0; i < helpCenterMenuList.length; i++) {
		await insertHelpCenter(connection, helpCenterMenuList[i]);
	}
	return helpCenterMenuList;
};

// async function treeWalk(helpCenterMenuList: IHelpCenter[]) {
// 	for (let i = 0; i < helpCenterMenuList.length; i++) {
// 		await insertHelpCenter(this.connection, helpCenterMenuList[i]);
// 		if (this.helpCenterMenuList[i].children) {
// 			treeWalk(helpCenterMenuList[i].children);
// 		}
// 	}
// }
// const treeWalk = async (
// 	connection: Connection,
// 	helpCenterMenuList: IHelpCenter[]
// ): Promise<void> => {
// 	for (let i = 0; i < helpCenterMenuList.length; i++) {
// 		await insertHelpCenter(this.connection, helpCenterMenuList[i]);
// 		if (this.helpCenterMenuList[i].children) {
// 			await treeWalk(helpCenterMenuList[i].children);
// 		}
// 	}
// };

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

// export const createHelpCenter = async (
// 	connection: Connection,
// 	sidebars: IHelpCenter[]
// ): Promise<HelpCenter[]> => {
// 	let defaultHelpCenterMenu = [];

// 	sidebars.forEach((sidebar) => {
// 		const menus = helpCenterMenuList.map((menu) => ({
// 			description: menu.description,
//             name: menu.name,
//             data: menu.data,
//             children: menu.children
// 		}));

// 		defaultHelpCenterMenu = [
// 			...defaultHelpCenterMenu,
// 			...menus
// 		];
// 	});

// 	insertHelpCenter(connection, defaultHelpCenterMenu);

// 	return defaultHelpCenterMenu;
// };

// export const createRandomHelpCenter = async (
// 	connection: Connection,
// 	tenants: Tenant[],
// 	tenantHelpCenterMap: Map<Tenant, IHelpCenter[]>
// ): Promise<Map<IHelpCenter, HelpCenter[]>> => {
// 	let helpMenus = [];
// 	const helpCenterMenuMap: Map<
//         IHelpCenter,
// 		HelpCenter[]
// 	> = new Map();

// 	(tenants || []).forEach((tenant) => {
// 		const sidebars = tenantHelpCenterMap.get(tenant);

// 		(sidebars || []).forEach((sidebar) => {
// 			const menus = helpCenterMenuList.map((menu) => ({
// 			    description: menu.description,
//                 name: menu.name,
//                 data: menu.data,
//                 children: menu.children
// 			}));

// 			helpCenterMenuMap.set(sidebar, menus);
// 			helpMenus = [...helpMenus, ...menus];
// 		});
// 	});

// 	await insertHelpCenter(connection, helpMenus);

// 	return helpCenterMenuMap;
// };

// const insertHelpCenter = async (
// 	connection: Connection,
// 	helpMenus: HelpCenter[]
// ) => {
// 	await connection
// 		.createQueryBuilder()
// 		.insert()
// 		.into(HelpCenter)
// 		.values(helpMenus)
// 		.execute();
// };
