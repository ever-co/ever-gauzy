import { Component, OnInit } from '@angular/core';
import { TreeModel } from 'ng2-tree';

@Component({
	selector: 'ga-sidebar',
	templateUrl: './sidebar.component.html',
	styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnInit {
	constructor() {}
	// static articleName = 'Chose any article';
	// static articleNameContent = 'any article you will chose';
	public articleName = 'Chose any article';
	public articleNameContent = 'any article you will chose';
	public tree: TreeModel = {
		value: 'Knowledge Bases',
		children: [
			{
				value: 'Knowledge Base 1',
				children: [
					{
						value: 'Article1',
						icon: ''
					},
					{
						value: 'Article2',
						icon: ''
					},
					{
						value: 'Category1_1',
						children: [
							{
								value: 'Article1_1',
								icon: ''
							}
						]
					}
				]
			},
			{
				value: 'Knowledge Base2',
				children: [
					{
						value: 'Article3',
						icon: ''
					}
				]
			}
		]
	};
	// public settings: Ng2TreeSettings = {
	// 	rootIsVisible: false,
	// 	showCheckboxes: true
	// };

	public onEvent(node: TreeModel): void {
		this.articleName = node.node.value;
		this.articleNameContent = node.node.value;
	}

	// public onNodeRemoved(e: TreeModel): void {
	// 	SidebarComponent.onEvent(e, 'Removed');
	// }

	// public onNodeMoved(e: TreeModel): void {
	// 	SidebarComponent.onEvent(e, 'Moved');
	// }

	// public onNodeRenamed(e: TreeModel): void {
	// 	SidebarComponent.onEvent(e, 'Renamed');
	// }

	// public onNodeCreated(e: TreeModel): void {
	// 	SidebarComponent.onEvent(e, 'Created');
	// }

	// public onNodeSelected(e: TreeModel): void {
	// 	SidebarComponent.onEvent(e, 'Selected');
	// }

	// public onNodeUnselected(e: TreeModel): void {
	// 	SidebarComponent.onEvent(e, 'Unselected');
	// }

	// public onNodeExpanded(e: TreeModel): void {
	// 	SidebarComponent.onEvent(e, 'Expanded');
	// }

	// public onNodeCollapsed(e: TreeModel): void {
	// 	SidebarComponent.onEvent(e, 'Collapsed');
	// }
	addKnowledgeBase() {}
	ngOnInit() {}
}
