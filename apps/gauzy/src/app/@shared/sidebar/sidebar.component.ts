import { IHelpCenter } from '@gauzy/models';
import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import {
	TreeComponent,
	ITreeOptions,
	TreeModel,
	TreeNode
} from 'angular-tree-component';
import { FormGroup, FormBuilder } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { isEqual } from './delete-node';
import { Subject } from 'rxjs';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService } from '@nebular/theme';
import { AddIconComponent } from './add-icon/add-icon.component';
import { first } from 'rxjs/operators';
import { HelpCenterService } from '../../@core/services/help-center.service';

@Component({
	selector: 'ga-sidebar',
	templateUrl: './sidebar.component.html',
	styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private dialogService: NbDialogService,
		private readonly fb: FormBuilder,
		private sanitizer: DomSanitizer,
		private helpService: HelpCenterService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}
	form: FormGroup;
	public articleName = 'Chose any article';
	public articleDesc = '';
	public articleData: SafeHtml;
	public showArticleButton = false;
	public showCategoryButton = false;
	public nodeId = 0;
	public chosenCategory = false;
	public chosenArticle = false;
	public isVisibleAdd = false;
	public isVisibleEdit = false;
	public isChosenNode = false;
	public nodes: IHelpCenter[] = [];
	options: ITreeOptions = {
		// allowDrag: (node) => node.isLeaf,
		allowDrag: true,
		allowDrop: (el, { parent, index }) => {
			if (parent.data.flag === 'article') {
				return false;
			} else {
				return true;
			}
		}
	};
	@ViewChild(TreeComponent)
	private tree: TreeComponent;

	async onMoveNode($event) {
		const movedNode = $event.node;
		await this.helpService.delete(`${movedNode.id}`);
		// await this.helpService.update($event.to.parent.id, {
		// 	children: []
		// });
		// if (movedNode.flag === 'category') {
		// 	await this.helpService.create({
		// 		name: `${movedNode.name}`,
		// 		icon: `${movedNode.icon}`,
		// 		flag: 'category',
		// 		privacy: `${movedNode.privacy}`,
		// 		children: movedNode.children
		// 	});
		// } else {
		// 	await this.helpService.create({
		// 		name: `${movedNode.name}`,
		// 		icon: `${movedNode.icon}`,
		// 		flag: 'article',
		// 		privacy: `${movedNode.privacy}`,
		// 		description: `${movedNode.description}`,
		// 		data: `${movedNode.data}`
		// 	});
		// }
		// console.log(
		// 	'Moved',
		// 	movedNode,
		// 	'to',
		// 	$event.to.parent.name,
		// 	'to',
		// 	$event.to.index
		// );
	}

	addNode() {
		this.isVisibleAdd = true;
	}
	showInput(key: number) {
		if (key === 1) {
			this.showArticleButton = true;
		} else {
			this.showCategoryButton = true;
		}
	}

	async addName(event: any, key: number) {
		if (key !== 1) {
			await this.helpService.create({
				name: `${event.target.value}`,
				icon: 'book-open-outline',
				flag: 'category',
				privacy: 'eye-outline',
				children: []
			});
		} else {
			await this.helpService.create({
				name: `${event.target.value}`,
				icon: 'book-open-outline',
				flag: 'article',
				privacy: 'eye-outline',
				description: '',
				data: ''
			});
		}
		this.loadMenu();
		this.tree.treeModel.update();
		this.isVisibleAdd = false;
		this.showArticleButton = false;
		this.showCategoryButton = false;
	}
	onNodeClicked(node: any) {
		this.nodeId = node.data.id;
		this.isChosenNode = true;
		this.articleName = node.data.name;
		if (node.data.flag === 'article') {
			this.articleDesc = node.data.description;
			this.articleData = node.data.data as SafeHtml;
			this.chosenCategory = false;
			this.chosenArticle = true;
			this.loadFormData();
		} else {
			this.chosenCategory = true;
			this.chosenArticle = false;
		}
	}
	onCloseAdding() {
		this.isVisibleAdd = false;
	}
	onCloseInput() {
		this.showArticleButton = false;
		this.showCategoryButton = false;
	}

	async addIcon(node) {
		this.onNodeClicked(node);
		const dialog = this.dialogService.open(AddIconComponent);
		const chosenIcon = await dialog.onClose.pipe(first()).toPromise();
		if (chosenIcon) {
			const someNode = this.tree.treeModel.getNodeById(this.nodeId);
			someNode.data.icon = chosenIcon;
			await this.helpService.update(someNode.data.id, {
				icon: `${someNode.data.icon}`
			});
		}

		this.tree.treeModel.update();
	}

	async changePrivacy(node: any) {
		this.onNodeClicked(node);
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		if (someNode.data.privacy === 'eye-outline') {
			someNode.data.privacy = 'eye-off-outline';
		} else {
			someNode.data.privacy = 'eye-outline';
		}
		await this.helpService.update(someNode.data.id, {
			privacy: `${someNode.data.privacy}`
		});
		this.tree.treeModel.update();
	}

	async editNameCategory(event: any) {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		someNode.data.name = event.target.value;
		this.isVisibleEdit = false;
		await this.helpService.update(someNode.data.id, {
			name: `${someNode.data.name}`
		});
		this.loadMenu();
	}
	onCloseEditing() {
		this.isVisibleEdit = false;
	}

	onEditArticle() {
		this.isVisibleEdit = true;
	}

	async onDeleteArticle() {
		isEqual(this.nodes, this.nodeId);
		await this.helpService.delete(`${this.nodeId}`);
		this.tree.treeModel.update();
		this.isChosenNode = false;
		this.articleName = 'Chose any article';
	}

	loadFormData() {
		this.form = this.fb.group({
			name: [this.articleName],
			desc: [this.articleDesc],
			data: [this.articleData]
		});
	}

	editData(value: string) {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		this.articleData = this.sanitizer.bypassSecurityTrustHtml(value);
		someNode.data.data = this.articleData;
	}

	async submit() {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		someNode.data.description = this.form.controls.desc.value;
		someNode.data.name = this.form.controls.name.value;
		this.articleDesc = someNode.data.description;
		this.articleName = someNode.data.name;
		await this.helpService.update(someNode.data.id, {
			name: `${someNode.data.name}`,
			description: `${someNode.data.description}`,
			data: `${someNode.data.data}`
		});
		this.loadMenu();
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
