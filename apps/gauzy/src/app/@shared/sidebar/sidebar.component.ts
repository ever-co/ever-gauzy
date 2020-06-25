import { IHelpCenter } from '@gauzy/models';
import { Component, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { TreeComponent, ITreeOptions } from 'angular-tree-component';
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
import { EditBaseComponent } from './edit-base/edit-base.component';
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
		private readonly toastrService: NbToastrService,
		private helpService: HelpCenterService,
		readonly translateService: TranslateService,
		private errorHandler: ErrorHandlingService,
		private nbMenuService: NbMenuService
	) {
		super(translateService);
	}
	public tempNodes: IHelpCenter[] = [];
	public nodeId = '';
	public isChosenNode = false;
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
			if (elem.item.title === 'Edit Knowledge Base') this.editBase();
			if (elem.item.title === 'Add Category') this.addCategory();
			if (elem.item.title === 'Delete Base')
				this.dialogService.open(DeleteBaseComponent);
		});
	}

	setClasses(node) {
		const classes = {
			child: node.data.flag === 'category',
			parent: node.data.flag === 'base'
		};
		return classes;
	}

	async addNode() {
		const chosenType = 'add';
		const dialog = this.dialogService.open(EditBaseComponent, {
			context: {
				base: null,
				editType: chosenType
			}
		});
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('CREATED_BASE');
			this.loadMenu();
			this.tree.treeModel.update();
		}
	}

	async editBase() {
		const chosenType = 'edit';
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		const dialog = this.dialogService.open(EditBaseComponent, {
			context: {
				base: someNode.data,
				editType: chosenType
			}
		});
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('EDITED_BASE');
			this.loadMenu();
			this.tree.treeModel.update();
		}
	}

	async addCategory() {
		const chosenType = 'add';
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		const dialog = this.dialogService.open(EditCategoryComponent, {
			context: {
				category: null,
				base: someNode.data,
				editType: chosenType
			}
		});
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('CREATED_CATEGORY');
			this.loadMenu();
			this.tree.treeModel.update();
		}
	}

	async editCategory(node) {
		const chosenType = 'edit';
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		this.isChosenNode = true;
		const dialog = this.dialogService.open(EditCategoryComponent, {
			context: {
				base: someNode.data,
				category: node,
				editType: chosenType
			}
		});
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('EDITED_CATEGORY');
			this.loadMenu();
			this.tree.treeModel.update();
		}
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

	onNodeClicked(node: any) {
		this.nodeId = node.id.toString();
		this.isChosenNode = true;
	}

	async addIcon() {
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

	async changePrivacy(node) {
		this.nodeId = node.id.toString();
		this.isChosenNode = true;
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

	// nextArticle() {
	// 	for (const node of this.tempNodes)
	// 		if (node.id === this.nodeId.toString()) {
	// 			const childNodes = this.tempNodes.filter(
	// 				(item) =>
	// 					((item.parent &&
	// 						node.parent &&
	// 						item.parent.id === node.parent.id) ||
	// 						(item.parent === null && node.parent === null)) &&
	// 					item.flag === 'article'
	// 			);
	// 			childNodes.forEach((child) => {
	// 				if (child.index === node.index + 1) {
	// 					this.nodeId = child.id;
	// 					this.articleName = child.name;
	// 					this.articleDesc = child.description;
	// 					this.articleData = this.sanitizer.bypassSecurityTrustHtml(
	// 						`${child.data}`
	// 					);
	// 					this.loadFormData(child);
	// 				}
	// 			});
	// 		}
	// }

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
