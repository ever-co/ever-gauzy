import { Component } from '@angular/core';
import { TreeNode } from './tree/tree.component';

@Component({
	selector: 'ga-sidebar',
	templateUrl: './sidebar.component.html',
	styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
	public knowledgeBases: TreeNode;
	public selectedTreeNode: TreeNode | null;

	addKnowledgeBase() {}
	constructor() {
		this.selectedTreeNode = null;
		this.knowledgeBases = {
			label: 'first',
			children: [
				{
					label: 'second-a',
					children: [
						{
							label: 'third-a',
							children: [
								{
									label: 'fourth-a',
									children: [
										{
											label: 'fifth-a',
											children: []
										}
									]
								}
							]
						}
					]
				},
				{
					label: 'second-b',
					children: [
						{
							label: 'third-a',
							children: []
						}
					]
				}
			]
		};

		// 	{
		// 		label: 'first',
		// 		children: [
		// 			{
		// 				label: 'second-a',
		// 				children: []
		// 			},
		// 			{
		// 				label: 'second-b',
		// 				children: []
		// 			},
		// 		]
		// 	}
		// ];
	}
}
