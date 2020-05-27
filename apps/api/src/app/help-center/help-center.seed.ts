// import { HelpCenter } from './help-center.entity';
// import { IHelpCenter } from '@gauzy/models';
// import { Connection } from 'typeorm';
// import { Tenant } from '../tenant/tenant.entity';
// const helpCenterMenuList: IHelpCenter[] = [
// 	{
// 		id: '1',
// 		name: '🔥Knowledge base1',
// 		description: 'desc1',
// 		data: '',
// 		children: [
// 			{
// 				id: '2',
// 				name: '📎article1.1',
// 				description: 'desc1111',
// 				data: 'aaaaaa',
// 			},
// 			{
// 				id: '3',
// 				name: '🌐article1.2',
// 				description: 'desc122222',
// 				data: 'bbbbbb',
// 			},
// 		],
// 	},
// 	{
// 		id: '4',
// 		name: 'Knowledge base2',
// 		description: 'desc1',
// 		data: '',
// 		children: [
// 			{ id: '5', name: 'article2.1', description: 'desc1', data: '' },
// 			{
// 				id: '6',
// 				name: 'Base2.2',
// 				description: 'desc1',
// 				data: '',
// 				children: [
// 					{
// 						id: '7',
// 						name: 'article3.1',
// 						description: 'desc1',
// 						data: '',
// 					},
// 				],
// 			},
// 		],
// 	},
// 	{
// 		id: '8',
// 		name: 'Knowledge base3',
// 		description: 'desc1',
// 		data: '',
// 		children: [
// 			{ id: '9', name: 'article1.1', description: 'desc1', data: '' },
// 			{ id: '10', name: 'article1.2', description: 'desc1', data: '' },
// 		],
// 	},
// 	{
// 		id: '11',
// 		name: 'Knowledge base4',
// 		description: 'desc1',
// 		data: '',
// 		children: [
// 			{ id: '12', name: 'article2.1', description: 'desc1', data: '' },
// 			{
// 				id: '13',
// 				name: 'Base2.2',
// 				description: 'desc1',
// 				data: '',
// 				children: [
// 					{
// 						id: '14',
// 						name: 'article3.1',
// 						description: 'desc1',
// 						data: '',
// 					},
// 				],
// 			},
// 		],
// 	},
// ];
// export const createHelpCenterMenu = async (
// 	connection: Connection,
// 	candidates: Candidate[]
// ): Promise<HelpCenter[]> => {
// 	let defaultHelpCenterMenu = [];

// 	candidates.forEach((candidate) => {
// 		const menus = helpCenterMenuList.map((menu) => ({
// 			name: menu.name,
// 		}));

// 		defaultHelpCenterMenu = [...defaultHelpCenterMenu, ...menus];
// 	});

// 	insertHelpCenterMenu(connection, defaultHelpCenterMenu);

// 	return defaultHelpCenterMenu;
// };

// export const createRandomHelpCenter = async (
// 	connection: Connection,
// 	tenants: Tenant[],
// 	tenantHelpCenterMap: Map<Tenant, Candidate[]>
// ): Promise<Map<Candidate, HelpCenter[]>> => {
// 	let helpCenter = [];
// 	const helpCenterMap: Map<Candidate, HelpCenter[]> = new Map();

// 	(tenants || []).forEach((tenant) => {
// 		const candidates = tenantHelpCenterMap.get(tenant);

// 		(candidates || []).forEach((candidate) => {
// 			const menus = helpCenterMenuList.map((menu) => ({
// 				name: menu.name,
// 			}));

// 			helpCenterMap.set(candidate, menus);
// 			helpCenter = [...helpCenter, ...menus];
// 		});
// 	});

// 	await insertHelpCenterMenu(connection, helpCenter);

// 	return helpCenterMap;
// };

// const insertHelpCenterMenu = async (
// 	connection: Connection,
// 	helpCenter: HelpCenter[]
// ) => {
// 	await connection
// 		.createQueryBuilder()
// 		.insert()
// 		.into(HelpCenter)
// 		.values(helpCenter)
// 		.execute();
// };
