import { Component, ViewChild } from '@angular/core';
import { ITreeOptions, TreeComponent } from 'angular-tree-component';

@Component({
	selector: 'ga-sidebar',
	templateUrl: './sidebar.component.html',
	styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
	public articleName = 'Chose any article';
	public articleNameContent = 'any article you will chose';
	public nodeId = 0;
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
					name: 'Base2.2',
					children: [{ id: 7, name: 'article3.1' }]
				}
			]
		},
		{
			id: 8,
			name: 'Knowledge base1',
			children: [
				{ id: 9, name: 'article1.1' },
				{ id: 10, name: 'article1.2' }
			]
		},
		{
			id: 11,
			name: 'Knowledge base2',
			children: [
				{ id: 12, name: 'article2.1' },
				{
					id: 13,
					name: 'Base2.2',
					children: [{ id: 14, name: 'article3.1' }]
				}
			]
		}
	];
	options: ITreeOptions = {
		isExpandedField: 'expanded',
		actionMapping: {
			mouse: {
				click: (tree, node, $event) => {
					this.nodeId = node.data.id;
					this.isChosenArticle = true;
					if (!node.hasChildren) {
						this.articleNameContent = node.data.name;
						this.articleName = node.data.name;
					}
				}
			}
		},
		allowDrag: (node) => {
			return true;
		},
		allowDrop: (node) => {
			return true;
		},
		animateExpand: true
	};
	@ViewChild(TreeComponent, { static: false })
	private tree: TreeComponent;
	public isVisible = false;
	public isChosenArticle = false;
	public value = '';
	public queue = [];
	public values = [];

	addNode() {
		this.isVisible = true;
	}
	addName(event: any) {
		this.isChosenArticle = false;
		this.value = event.target.value;
		this.nodes.push({
			id: 20,
			name: `${this.value}`,
			children: []
		});
		this.tree.treeModel.update();
		this.isVisible = false;
	}
	onCloseInput() {
		this.isVisible = false;
		this.value = '';
	}
	addIcon() {}
	changePrivacy() {}
	onDeleteArticle() {
		// const someNode = this.tree.treeModel.getNodeById(1);
		// console.log(someNode);
		this.tree.treeModel.update();
		this.isChosenArticle = false;
	}
	// public searchNode() {
	// 	this.queue.push(this.nodes);
	// 	while (this.queue.length > 0) {
	// 		const tempNode = this.queue.shift();
	// 		this.values.push(tempNode.value);
	// 		console.log(tempNode);
	// 		if (tempNode.left) {
	// 			this.queue.push(tempNode.left);
	// 		}
	// 		if (tempNode.right) {
	// 			this.queue.push(tempNode.right);
	// 		}
	// 	}
	// 	console.log(this.values);
	// 	return this.values;
	// }
}
