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
	public handleSelection(node: TreeNode): void {
		this.selectedTreeNode = node;

		console.group('Selected Tree Node');
		console.log('Label:', node.label);
		console.log('Children:', node.children.length);
		console.groupEnd();
	}
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
