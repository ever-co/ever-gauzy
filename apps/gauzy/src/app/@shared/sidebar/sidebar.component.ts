import { nodes } from './../../../../../../libs/models/src/lib/help-center-menu.model';
import { Component, ViewChild } from '@angular/core';
import { ITreeOptions, TreeComponent } from 'angular-tree-component';
import { FormGroup, FormBuilder } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { IHelpCenter } from '@gauzy/models';
import { isEqual } from './delete-node';

@Component({
	selector: 'ga-sidebar',
	templateUrl: './sidebar.component.html',
	styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent {
	constructor(
		private readonly fb: FormBuilder,
		private sanitizer: DomSanitizer
	) {}
	form: FormGroup;
	public showDataEdit = false;
	public icons = ['🔥', '📎', '🌐', '🔎'];
	public chosenIcon = '';
	public articleName = 'Chose any article';
	public articleDesc = 'any article you will chose';
	public articleData: SafeHtml;
	public showPrivateButton = false;
	public showPublicButton = false;
	public nodeId = 0;
	public flag = 0;
	public isVisibleAdd = false;
	public isVisibleEdit = false;
	public isVisibleEditDesc = false;
	public iconsShow = false;
	public isChosenArticle = false;
	public value = '';
	public nodes: IHelpCenter[] = nodes;
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
						this.articleDesc = node.data.description;
						this.articleName = node.data.name;
						this.articleData = node.data.data;
						this.loadFormData();
					} else {
						this.showPrivateButton = false;
						this.showPublicButton = true;
					}
				},
			},
		},
		allowDrag: (node) => {
			return true;
		},
		allowDrop: (node) => {
			return true;
		},
		animateExpand: true,
		displayField: 'name',
	};

	@ViewChild(TreeComponent)
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
			description: 'desc1',
			data: '',
			children: [],
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
			this.articleDesc = someNode.description;
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
			this.articleDesc = someNode.description;
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
			this.articleName = event.target.value;
		}
		this.isVisibleEdit = false;
	}

	onEditArticleDesc() {
		this.isVisibleEditDesc = true;
	}

	editDesc(event: any) {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		someNode.data.description = event.target.value;
		this.tree.treeModel.update();
		if (!someNode.data.children) {
			this.articleDesc = event.target.value;
		}
		this.isVisibleEditDesc = false;
	}

	onCloseEdit() {
		this.isVisibleEdit = false;
		this.value = '';
	}

	onCloseDesc() {
		this.isVisibleEditDesc = false;
		this.value = '';
	}

	onDeleteArticle() {
		isEqual(this.nodes, this.nodeId);
		this.tree.treeModel.update();
		this.isChosenArticle = false;
		this.articleName = 'Chose any article';
		this.articleDesc = 'any article you will chose';
	}

	loadFormData() {
		this.form = this.fb.group({
			text: [this.articleData],
		});
	}

	onChange(value: string) {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		this.articleData = this.sanitizer.bypassSecurityTrustHtml(value);
		someNode.data.data = this.articleData;
	}

	editArticleData() {
		this.showDataEdit = true;
	}

	onSaveData() {
		this.showDataEdit = false;
	}
}
