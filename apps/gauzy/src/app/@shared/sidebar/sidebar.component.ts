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
	public showPrivateButton = false;
	public showPublicButton = false;
	public nodeId = 0;
	public isVisible = false;
	public isChosenArticle = false;
	public value = '';
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
			name: 'Knowledge base3',
			children: [
				{ id: 9, name: 'article1.1' },
				{ id: 10, name: 'article1.2' }
			]
		},
		{
			id: 11,
			name: 'Knowledge base4',
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
						this.showPrivateButton = true;
						this.showPublicButton = false;
						this.articleNameContent = node.data.name;
						this.articleName = node.data.name;
					} else {
						this.showPrivateButton = false;
						this.showPublicButton = true;
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

	makePrivate() {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		someNode.hide();
	}

	makePublic() {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		for (let i = 0; i < someNode.data.children.length; i++) {
			const newNode = this.tree.treeModel.getNodeById(
				someNode.data.children[i].id
			);
			newNode.show();
		}
	}

	onDeleteArticle() {
		this.isEqual(this.nodes, this.nodeId);
		this.tree.treeModel.update();
		this.isChosenArticle = false;
		this.articleName = 'Chose any article';
		this.articleNameContent = 'any article you will chose';
	}

	isEqual(graph, id) {
		const succeesCondition = (node) => node.id === id;
		const i = graph.findIndex(succeesCondition);
		if (i >= 0) {
			graph.splice(i, 1);
			return true;
		}
		for (let i = 0; i < graph.length; i++) {
			if (graph[i].children) {
				if (this.isEqual(graph[i].children, id)) {
					if (graph[i].children.length === 0) {
						delete graph[i].children;
					}
				}
			}
		}
	}
}
