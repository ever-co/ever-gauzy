import { Component, ViewChild } from '@angular/core';
import { ITreeOptions, TreeComponent } from 'angular-tree-component';

@Component({
	selector: 'ga-sidebar',
	templateUrl: './sidebar.component.html',
	styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
	public icons = ['🔥', '📎', '🌐', '🔎'];
	public chosenIcon = '';
	public articleName = 'Chose any article';
	public articleNameContent = 'any article you will chose';
	public showPrivateButton = false;
	public showPublicButton = false;
	public nodeId = 0;
	public flag = 0;
	public isVisibleAdd = false;
	public isVisibleEdit = false;
	public iconsShow = false;
	public isChosenArticle = false;
	public value = '';
	public nodes = [
		{
			id: 1,
			name: 'Knowledge base1',
			data: '',
			children: [
				{ id: 2, name: 'article1.1', data: '' },
				{ id: 3, name: 'article1.2', data: '' }
			]
		},
		{
			id: 4,
			name: 'Knowledge base2',
			data: '',
			children: [
				{ id: 5, name: 'article2.1', data: '' },
				{
					id: 6,
					name: 'Base2.2',
					data: '',
					children: [{ id: 7, name: 'article3.1', data: '' }]
				}
			]
		},
		{
			id: 8,
			name: 'Knowledge base3',
			data: '',
			children: [
				{ id: 9, name: 'article1.1', data: '' },
				{ id: 10, name: 'article1.2', data: '' }
			]
		},
		{
			id: 11,
			name: 'Knowledge base4',
			data: '',
			children: [
				{ id: 12, name: 'article2.1', data: '' },
				{
					id: 13,
					name: 'Base2.2',
					data: '',
					children: [{ id: 14, name: 'article3.1', data: '' }]
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
		animateExpand: true,
		displayField: 'name'
	};
	@ViewChild(TreeComponent, { static: false })
	private tree: TreeComponent;

	addNode() {
		this.isVisibleAdd = true;
	}

	addName(event: any) {
		this.isChosenArticle = false;
		this.value = event.target.value;
		this.nodes.push({
			id: 20,
			name: `${this.value}`,
			data: '',
			children: []
		});
		this.tree.treeModel.update();
		this.isVisibleAdd = false;
	}

	onCloseInput() {
		this.isVisibleAdd = false;
		this.value = '';
	}

	addIcon() {
		this.iconsShow = true;
		this.flag = 0;
		this.chosenIcon = '';
	}

	onIconset(icon) {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId).data;
		for (const i of this.icons) {
			if (someNode.name.indexOf(i) === -1) {
				this.flag += 1;
			} else {
				this.chosenIcon = i;
			}
		}
		if (this.flag === this.icons.length)
			someNode.name = `${icon} ${someNode.name}`;
		if (this.flag === this.icons.length - 1)
			someNode.name = someNode.name.replace(this.chosenIcon, icon);
		this.tree.treeModel.update();
		if (!someNode.children) {
			this.articleNameContent = someNode.name;
			this.articleName = someNode.name;
		}
		this.iconsShow = false;
	}

	removeIcon() {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId).data;
		this.flag = 0;
		for (const i of this.icons) {
			if (someNode.name.indexOf(i) === -1) {
				this.flag += 1;
			} else {
				this.chosenIcon = i;
			}
		}
		if (this.flag === this.icons.length - 1) {
			someNode.name = someNode.name.slice(this.chosenIcon.length);
		}
		this.tree.treeModel.update();
		if (!someNode.children) {
			this.articleNameContent = someNode.name;
			this.articleName = someNode.name;
		}
	}

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

	onEditArticle() {
		this.isVisibleEdit = true;
	}

	editName(event: any) {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		someNode.data.name = event.target.value;
		this.tree.treeModel.update();
		if (!someNode.data.children) {
			this.articleNameContent = event.target.value;
			this.articleName = event.target.value;
		}
		this.isVisibleEdit = false;
	}

	onCloseEdit() {
		this.isVisibleEdit = false;
		this.value = '';
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
