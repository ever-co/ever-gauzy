import { IHelpCenter } from '@gauzy/models';
import {
	Component,
	ViewChild,
	OnInit,
	OnDestroy,
	Output,
	EventEmitter
} from '@angular/core';
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
import { first, takeUntil } from 'rxjs/operators';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { EditBaseComponent } from './edit-base/edit-base.component';
import { EditCategoryComponent } from './edit-category/edit-category.component';
import { DeleteCategoryComponent } from './delete-category/delete-category.component';
import { DeleteBaseComponent } from './delete-base/delete-base.component';
import { HelpCenterService } from '../../@core/services/help-center.service';
import { Store } from '../../@core/services/store.service';

@Component({
	selector: 'ga-sidebar',
	templateUrl: './sidebar.component.html',
	styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	@Output() clickedNode = new EventEmitter<IHelpCenter>();
	@Output() deletedNode = new EventEmitter<any>();
	private _ngDestroy$ = new Subject<void>();
	constructor(
		private dialogService: NbDialogService,
		private readonly toastrService: NbToastrService,
		private helpService: HelpCenterService,
		readonly translateService: TranslateService,
		private errorHandler: ErrorHandlingService,
		private nbMenuService: NbMenuService,
		private store: Store
	) {
		super(translateService);
	}
	public tempNodes: IHelpCenter[] = [];
	public nodeId = '';
	public isChosenNode = false;
	public nodes: IHelpCenter[] = [];
	selectedOrganizationId: string;
	settingsContextMenu: NbMenuItem[];
	options: ITreeOptions = {
		getChildren: async (node: IHelpCenter) => {
			const res = await this.helpService.findByBaseId(node.id);
			return res;
		},
		allowDrag: true,
		allowDrop: (el, { parent, index }) => {
			if (parent.data.flag === 'category') {
				return false;
			} else {
				return true;
			}
		},
		childrenField: 'children'
	};
	@ViewChild(TreeComponent)
	private tree: TreeComponent;

	ngOnInit() {
		this.loadMenu();
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) this.selectedOrganizationId = organization.id;
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
			if (elem.item.title === 'Edit Knowledge Base') this.editBase();
			if (elem.item.title === 'Add Category') this.addCategory();
			if (elem.item.title === 'Delete Base') this.deleteBase();
		});
	}

	setClasses(node) {
		const classes = {
			child: node.data.flag === 'category' && node.data.parentId !== null,
			childout:
				node.data.flag === 'category' && node.data.parentId === null,
			parent: node.data.flag === 'base' && node.data.parentId === null,
			parentin: node.data.flag === 'base' && node.data.parentId !== null
		};
		return classes;
	}

	async addNode() {
		const chosenType = 'add';
		const dialog = this.dialogService.open(EditBaseComponent, {
			context: {
				base: null,
				editType: chosenType,
				organizationId: this.selectedOrganizationId
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
				editType: chosenType,
				organizationId: this.selectedOrganizationId
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
				editType: chosenType,
				organizationId: this.selectedOrganizationId
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
				editType: chosenType,
				organizationId: this.selectedOrganizationId
			}
		});
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('EDITED_CATEGORY');
			this.loadMenu();
			this.tree.treeModel.update();
		}
	}

	async deleteCategory(node) {
		const dialog = this.dialogService.open(DeleteCategoryComponent, {
			context: {
				category: node
			}
		});
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.deletedNode.emit();
			this.toastrSuccess('DELETED');
			this.loadMenu();
			this.tree.treeModel.update();
		}
	}

	async deleteBase() {
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		const dialog = this.dialogService.open(DeleteBaseComponent, {
			context: {
				base: someNode
			}
		});
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrSuccess('DELETED');
			await this.loadMenu();
			this.tree.treeModel.update();
		}
	}

	async updateIndexes(
		oldChildren: IHelpCenter[],
		newChildren: IHelpCenter[]
	) {
		try {
			await this.helpService.updateBulk(oldChildren, newChildren);
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	}

	async onMoveNode($event) {
		for (const node of this.tempNodes) {
			if (node.id === $event.node.id) {
				if (!$event.to.parent.virtual) {
					await this.helpService.update(node.id, {
						parent: $event.to.parent
					});
				} else {
					await this.helpService.update(node.id, {
						parent: null
					});
				}
			}
		}
		this.updateIndexes(
			$event.from.parent.children,
			$event.to.parent.children
		);
		await this.loadMenu();
		this.tree.treeModel.update();
	}

	onNodeClicked(node: any) {
		this.nodeId = node.id.toString();
		this.clickedNode.emit(node);
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
		try {
			await this.helpService.update(someNode.data.id, {
				privacy: `${someNode.data.privacy}`
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
		this.tree.treeModel.update();
	}

	async loadMenu() {
		const result = await this.helpService.getAll([
			'parent',
			'children',
			'organization'
		]);
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
