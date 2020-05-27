import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { ITreeOptions, TreeComponent } from 'angular-tree-component';
import { FormGroup, FormBuilder } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { IHelpCenter } from '@gauzy/models';
import { isEqual } from './delete-node';
import { HelpCenterService } from '../../@core/services/help-center.service';
import { Subject } from 'rxjs';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
	selector: 'ga-sidebar',
	templateUrl: './sidebar.component.html',
	styleUrls: ['./sidebar.component.scss'],
})
export class SidebarComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private readonly fb: FormBuilder,
		private sanitizer: DomSanitizer,
		private helpService: HelpCenterService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}
	form: FormGroup;
	public icons = ['🔥', '📎', '🌐', '🔎'];
	public chosenIcon = '';
	public articleName = 'Chose any article';
	public articleDesc = '';
	public articleData: SafeHtml;
	public showPrivateButton = false;
	public showPublicButton = false;
	public nodeId = 0;
	public flag = 0;
	public isVisibleAdd = false;
	public isVisibleEdit = false;
	public iconsShow = false;
	public isChosenArticle = false;
	public value = '';
	public nodes: IHelpCenter[] = [];
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
						this.articleData = node.data.data as SafeHtml;
						this.loadFormData();
					} else {
						this.showPrivateButton = false;
						this.showPublicButton = true;
						this.articleName = 'Chose any article';
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

	async addName(event: any) {
		this.isChosenArticle = false;
		this.value = event.target.value;
		await this.helpService.create({
			name: `${this.value}`,
			description: '',
			data: '',
			children: [],
		});
		this.loadMenu();
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
		this.iconsShow = false;
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

	editNameCategory(event: any) {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		someNode.data.name = event.target.value;
		this.isVisibleEdit = false;
	}

	onEditArticle() {
		this.isVisibleEdit = true;
	}

	async onDeleteArticle() {
		isEqual(this.nodes, this.nodeId);
		await this.helpService.delete(`${this.nodeId}`);
		this.tree.treeModel.update();
		this.isChosenArticle = false;
		this.articleName = 'Chose any article';
		this.articleDesc = 'any article you will chose';
	}

	loadFormData() {
		this.form = this.fb.group({
			name: [this.articleName],
			desc: [this.articleDesc],
			data: [this.articleData],
		});
	}

	editData(value: string) {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		this.articleData = this.sanitizer.bypassSecurityTrustHtml(value);
		someNode.data.data = this.articleData as string;
	}

	submit() {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		someNode.data.description = this.form.controls.desc.value;
		someNode.data.name = this.form.controls.name.value;
		this.articleDesc = someNode.data.description;
		this.articleName = someNode.data.name;
		this.tree.treeModel.update();
		this.isVisibleEdit = false;
	}

	private async loadMenu() {
		const result = await this.helpService.getAll();
		if (result) {
			this.nodes = result.items;
		}
	}
	ngOnInit() {
		this.loadMenu();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
