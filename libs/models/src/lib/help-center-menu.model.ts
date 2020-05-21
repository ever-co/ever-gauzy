import { SafeHtml } from '@angular/platform-browser';

export interface IHelpCenter {
	id: number;
	name: string;
	description?: string;
	data?: SafeHtml;
	children?: IHelpCenter[];
}

export const nodes = [
	{
		id: 1,
		name: '🔥Knowledge base1',
		description: 'desc1',
		data: '',
		children: [
			{
				id: 2,
				name: '📎article1.1',
				description: 'desc1111',
				data: 'aaaaaa',
			},
			{
				id: 3,
				name: '🌐article1.2',
				description: 'desc122222',
				data: 'bbbbbb',
			},
		],
	},
	{
		id: 4,
		name: 'Knowledge base2',
		description: 'desc1',
		data: '',
		children: [
			{ id: 5, name: 'article2.1', description: 'desc1', data: '' },
			{
				id: 6,
				name: 'Base2.2',
				description: 'desc1',
				data: '',
				children: [
					{
						id: 7,
						name: 'article3.1',
						description: 'desc1',
						data: '',
					},
				],
			},
		],
	},
	{
		id: 8,
		name: 'Knowledge base3',
		description: 'desc1',
		data: '',
		children: [
			{ id: 9, name: 'article1.1', description: 'desc1', data: '' },
			{ id: 10, name: 'article1.2', description: 'desc1', data: '' },
		],
	},
	{
		id: 11,
		name: 'Knowledge base4',
		description: 'desc1',
		data: '',
		children: [
			{ id: 12, name: 'article2.1', description: 'desc1', data: '' },
			{
				id: 13,
				name: 'Base2.2',
				description: 'desc1',
				data: '',
				children: [
					{
						id: 14,
						name: 'article3.1',
						description: 'desc1',
						data: '',
					},
				],
			},
		],
	},
];
