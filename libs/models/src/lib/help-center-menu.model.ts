import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';

export interface IHelpCenter extends IBaseEntityModel {
	name: string;
	icon?: string;
	flag: string;
	privacy: string;
	description?: string;
	data?: string;
	children?: IHelpCenter[];
}

export const helpCenterMenuList: IHelpCenter[] = [
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
		children: [
			{
				flag: 'article',
				icon: 'book-open-outline',
				privacy: 'eye-off-outline',
				name: 'article2.1',
				description: 'desc1',
				data: ''
			},
			{
				name: 'Base2.2',
				icon: 'book-open-outline',
				flag: 'category',
				privacy: 'eye-off-outline',
				children: [
					{
						flag: 'article',
						privacy: 'eye-off-outline',
						name: 'article3.1',
						icon: 'book-open-outline',
						description: 'desc1',
						data: ''
					}
				]
			}
		]
	}
];
