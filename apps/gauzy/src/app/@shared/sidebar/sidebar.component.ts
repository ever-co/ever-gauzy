import { IHelpCenter } from '@gauzy/models';
import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { TreeComponent, ITreeOptions } from 'angular-tree-component';
import { FormGroup, FormBuilder } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { isEqual } from './delete-node';
import { Subject } from 'rxjs';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import {
	NbDialogService,
	NbToastrService,
	NbMenuItem,
	NbMenuService
} from '@nebular/theme';
import { AddIconComponent } from './add-icon/add-icon.component';
import { first } from 'rxjs/operators';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { AddBaseComponent } from './add-base/add-base.component';
import { EditBaseComponent } from './edit-base/edit-base.component';
import { AddCategoryComponent } from './add-category/add-category.component';
import { EditCategoryComponent } from './edit-category/edit-category.component';
import { DeleteCategoryComponent } from './delete-category/delete-category.component';
import { DeleteBaseComponent } from './delete-base/delete-base.component';
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
		private readonly toastrService: NbToastrService,
		private sanitizer: DomSanitizer,
		private helpService: HelpCenterService,
		readonly translateService: TranslateService,
		private errorHandler: ErrorHandlingService,
		private nbMenuService: NbMenuService
	) {
		super(translateService);
	}
	form: FormGroup;
	public articleName = 'Chose any article';
	public articleDesc = '';
	public articleData: SafeHtml;
	public tempData: string;
	public tempNodes: IHelpCenter[] = [];
	public showArticleButton = false;
	public showCategoryButton = false;
	public nodeId = '';
	public chosenCategory = false;
	public chosenArticle = false;
	public isVisibleAdd = false;
	public isVisibleEdit = false;
	public isChosenNode = false;
	public isLoadBase = false;
	public nodes: IHelpCenter[] = [];
	settingsContextMenu: NbMenuItem[];
	options: ITreeOptions = {
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

	ngOnInit() {
		this.loadMenu();
		this.form = this.fb.group({
			name: [''],
			desc: [''],
			data: ['']
		});
		this.settingsContextMenu = [
			{
				title: 'Add Category'
			},
			{
				title: 'Edit Knowledge Base'
			},
			{
				title: 'Delete Base'
			}
		];
		this.nbMenuService.onItemClick().subscribe((elem) => {
			if (elem.item.title === 'Edit Knowledge Base')
				this.dialogService.open(EditBaseComponent);
			if (elem.item.title === 'Add Category')
				this.dialogService.open(AddCategoryComponent);
			if (elem.item.title === 'Delete Base')
				this.dialogService.open(DeleteBaseComponent);
		});
	}

	editCategory() {
		this.dialogService.open(EditCategoryComponent);
	}

	deleteCategory() {
		this.dialogService.open(DeleteCategoryComponent);
	}

	// async updateIndexes(
	// 	oldChildren: IHelpCenter[],
	// 	newChildren: IHelpCenter[]
	// ) {
	// 	try {
	// 		await this.helpService.createBulk(oldChildren, newChildren);
	// 	} catch (error) {
	// 		this.errorHandler.handleError(error);
	// 	}
	// }
	async onMoveNode($event) {
		// this.updateIndexes(
		// 	$event.from.parent.children,
		// 	$event.to.parent.children
		// );
		for (const node of this.tempNodes) {
			if (node.id === $event.node.id) {
				// if (!$event.to.parent.virtual) {
				// 	await this.helpService.update(node.id, {
				// 		parent: $event.to.parent
				// 	});
				// } else {
				// 	await this.helpService.update(node.id, {
				// 		parent: null
				// 	});
				// }
				if (node.children.length !== 0) {
					this.toastrSuccess('MOVED_CATEGORY');
				} else {
					this.toastrSuccess('MOVED_ARTICLE');
				}
			}
		}
		// this.loadMenu();
		this.tree.treeModel.update();
	}
	async addNode() {
		this.dialogService.open(AddBaseComponent);
		// const chosenIcon = await dialog.onClose.pipe(first()).toPromise();
		// if (chosenIcon) {
		// 	const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		// 	someNode.data.icon = chosenIcon;
		// 	await this.helpService.update(someNode.data.id, {
		// 		icon: `${someNode.data.icon}`
		// 	});
		// }

		// this.tree.treeModel.update();
		// this.isVisibleAdd = true;
	}
	// showInput(key: number) {
	// 	if (key === 1) {
	// 		this.showArticleButton = true;
	// 	} else {
	// 		this.showCategoryButton = true;
	// 	}
	// }

	// async addName(event: any, key: number) {
	// 	if (key !== 1) {
	// 		await this.helpService.create({
	// 			name: `${event.target.value}`,
	// 			icon: 'book-open-outline',
	// 			flag: 'category',
	// 			privacy: 'eye-outline',
	// 			language: 'en',
	// 			color: 'black',
	// 			index: this.nodes.length,
	// 			children: []
	// 		});
	// 		this.toastrSuccess('CREATED_CATEGORY');
	// 	} else {
	// 		await this.helpService.create({
	// 			name: `${event.target.value}`,
	// 			icon: 'book-open-outline',
	// 			flag: 'article',
	// 			privacy: 'eye-outline',
	// 			description: '',
	// 			language: 'en',
	// 			color: 'black',
	// 			index: this.nodes.length,
	// 			data: ''
	// 		});
	// 		this.toastrSuccess('CREATED_ARTICLE');
	// 	}
	// 	this.loadMenu();
	// 	this.tree.treeModel.update();
	// 	this.isVisibleAdd = false;
	// 	this.showArticleButton = false;
	// 	this.showCategoryButton = false;
	// }
	onNodeClicked(node: any) {
		this.nodeId = node.id.toString();
		this.isChosenNode = true;
		this.articleName = node.name;
		if (node.flag === 'article') {
			this.articleDesc = node.description;
			this.articleData = this.sanitizer.bypassSecurityTrustHtml(
				`${node.data}`
			);
			this.chosenCategory = false;
			this.chosenArticle = true;
			this.loadFormData(node);
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
		someNode.data.privacy =
			someNode.data.privacy === 'eye-outline'
				? 'eye-off-outline'
				: 'eye-outline';
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
		this.toastrSuccess('EDITED_CATEGORY');
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
		this.toastrSuccess('DELETED');
	}

	prevArticle() {
		for (const node of this.tempNodes)
			if (node.id === this.nodeId.toString()) {
				const childNodes = this.tempNodes.filter(
					(item) =>
						((item.parent &&
							node.parent &&
							item.parent.id === node.parent.id) ||
							(item.parent === null && node.parent === null)) &&
						item.flag === 'article'
				);
				childNodes.forEach((child) => {
					if (child.index === node.index - 1) {
						this.nodeId = child.id;
						this.articleName = child.name;
						this.articleDesc = child.description;
						this.articleData = this.sanitizer.bypassSecurityTrustHtml(
							`${child.data}`
						);
						this.loadFormData(child);
					}
				});
			}
	}

	nextArticle() {
		for (const node of this.tempNodes)
			if (node.id === this.nodeId.toString()) {
				const childNodes = this.tempNodes.filter(
					(item) =>
						((item.parent &&
							node.parent &&
							item.parent.id === node.parent.id) ||
							(item.parent === null && node.parent === null)) &&
						item.flag === 'article'
				);
				childNodes.forEach((child) => {
					if (child.index === node.index + 1) {
						this.nodeId = child.id;
						this.articleName = child.name;
						this.articleDesc = child.description;
						this.articleData = this.sanitizer.bypassSecurityTrustHtml(
							`${child.data}`
						);
						this.loadFormData(child);
					}
				});
			}
	}

	loadFormData(data) {
		this.form.patchValue({
			name: data.name,
			desc: data.description,
			data: data.data.toString()
		});
	}

	editData(value: string) {
		this.tempData = value;
	}

	async submit() {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		someNode.data.description = this.form.controls.desc.value;
		someNode.data.name = this.form.controls.name.value;
		this.articleDesc = someNode.data.description;
		this.articleName = someNode.data.name;
		this.articleData = this.tempData;
		await this.helpService.update(someNode.data.id, {
			name: `${someNode.data.name}`,
			description: `${someNode.data.description}`,
			data: this.tempData
		});
		this.toastrSuccess('EDITED_ARTICLE');
		this.loadMenu();
		this.isVisibleEdit = false;
	}

	async loadMenu() {
		const result = await this.helpService.getAll(['parent', 'children']);
		if (result) {
			this.tempNodes = result.items;
			this.nodes = this.tempNodes.filter((item) => item.parent === null);
			this.sortMenu(this.nodes);
		}
	}

	sortMenu(nodes) {
		for (const node of nodes) {
			if (node.children) {
				this.sortMenu(node.children);
			}
			nodes.sort((a, b) => a.index - b.index);
		}
	}

	private toastrSuccess(text: string) {
		this.toastrService.success(
			this.getTranslation('TOASTR.TITLE.SUCCESS'),
			this.getTranslation(`TOASTR.MESSAGE.${text}`)
		);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
