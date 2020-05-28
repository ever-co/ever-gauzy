import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface IHelpCenter extends IBaseEntityModel {
	name: string;
	flag: string;
	privacy: string;
	description?: string;
	data?: string;
	children?: IHelpCenter[];
}

export const helpCenterMenuList: IHelpCenter[] = [
	{
		name: 'Knowledge base1',
		flag: 'category',
		privacy: 'public',
		children: [
			{
				name: 'article1.1',
				flag: 'article',
				privacy: 'public',
				description: 'desc1111',
				data: 'aaaaaa',
			},
			{
				name: 'article1.2',
				flag: 'article',
				privacy: 'public',
				description: 'desc122222',
				data: 'bbbbbb',
			},
		],
	},
	{
		name: 'Knowledge base2',
		flag: 'category',
		privacy: 'public',
		children: [
			{
				flag: 'article',
				privacy: 'public',
				name: 'article2.1',
				description: 'desc1',
				data: '',
			},
			{
				name: 'Base2.2',
				flag: 'category',
				privacy: 'public',
				children: [
					{
						flag: 'article',
						privacy: 'public',
						name: 'article3.1',
						description: 'desc1',
						data: '',
					},
				],
			},
		],
	},
];
