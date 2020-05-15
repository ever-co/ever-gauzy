import { Component, ViewChild } from '@angular/core';
import { TreeComponent } from 'angular-tree-component';

@Component({
	selector: 'ga-sidebar',
	templateUrl: './sidebar.component.html',
	styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
	public articleName = 'Chose any article';
	public articleNameContent = 'any article you will chose';
	public nodes = [
		{
			id: 1,
			name: 'Knowledge base1',
			children: [
				{ id: 2, name: 'article1.1' },
				{ id: 3, name: 'article1.2' }
			]
		},
		{
			id: 4,
			name: 'Knowledge base2',
			children: [
				{ id: 5, name: 'article2.1' },
				{
					id: 6,
					name: 'article2.2',
					children: [{ id: 7, name: 'article3.1' }]
				}
			]
		}
	];
	public options = {};
	@ViewChild(TreeComponent, { static: false })
	private tree: TreeComponent;

	onTap(a: any) {
		console.log(a);
	}
	addNode() {
		this.nodes.push({
			id: 5,
			name: 'New knowledge base',
			children: []
		});
		this.tree.treeModel.update();
	}
}
