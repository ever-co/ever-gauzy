import { IHelpCenter, IOrganization } from '@gauzy/contracts';
import {
	Component,
	ViewChild,
	OnInit,
	OnDestroy,
	Output,
	EventEmitter,
	AfterViewInit
} from '@angular/core';
import { TreeComponent, ITreeOptions } from '@circlon/angular-tree-component';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbMenuItem, NbMenuService } from '@nebular/theme';
import { AddIconComponent } from './add-icon/add-icon.component';
import { filter, first, tap } from 'rxjs/operators';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { EditBaseComponent } from './edit-base/edit-base.component';
import { EditCategoryComponent } from './edit-category/edit-category.component';
import { DeleteCategoryComponent } from './delete-category/delete-category.component';
import { DeleteBaseComponent } from './delete-base/delete-base.component';
import { HelpCenterService } from '../../@core/services/help-center.service';
import { Store } from '../../@core/services/store.service';
import { ToastrService } from '../../@core/services/toastr.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-sidebar',
	templateUrl: './sidebar.component.html',
	styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy, AfterViewInit {
	@Output() clickedNode = new EventEmitter<IHelpCenter>();
	@Output() deletedNode = new EventEmitter<any>();

	constructor(
		private dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
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
	settingsContextMenu: NbMenuItem[];
	options: ITreeOptions = {
		getChildren: async (node: IHelpCenter) => {
			const res = await this.helpService.findByBaseId(node.id);
			return res;
		},
		allowDrag: true,
		allowDrop: (el, { parent }) => {
			if (parent.data.flag === 'category') {
				return false;
			} else {
				return true;
			}
		},
		childrenField: 'children'
	};
	@ViewChild(TreeComponent) private tree: TreeComponent;
	organization: IOrganization;

	ngOnInit() {
		this.settingsContextMenu = [
			{
				title: this.getTranslation('HELP_PAGE.ADD_CATEGORY')
			},
			{
				title: this.getTranslation('HELP_PAGE.EDIT_BASE')
			},
			{
				title: this.getTranslation('HELP_PAGE.DELETE_BASE')
			}
		];
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => this.organization = organization),
				tap(() => this.loadMenu()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.nbMenuService.onItemClick().subscribe((elem) => {
			if (elem.item.title === this.getTranslation('HELP_PAGE.EDIT_BASE')) {
				this.addEditBase('edit');
			}
			if (elem.item.title === this.getTranslation('HELP_PAGE.ADD_CATEGORY')) { 
				this.addCategory();
			}
			if (elem.item.title === this.getTranslation('HELP_PAGE.DELETE_BASE')) {
				this.deleteBase();
			}
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

	async addEditBase(editType: string) {
		const context = {
			base: null,
			editType
		}
		if (editType === 'edit') {
			const { data } = this.tree.treeModel.getNodeById(this.nodeId);
			context['base'] = data;
		}
		const dialog = this.dialogService.open(EditBaseComponent, {
			context
		});
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			if (editType === 'edit') {
				this.toastrService.success('TOASTR.MESSAGE.EDITED_BASE', {
					name: context.base.name
				});
			} else {
				this.toastrService.success('TOASTR.MESSAGE.CREATED_BASE', {
					name: data.name
				});
			}
			this.loadMenu();
			this.tree.treeModel.update();
		}
	}

	async addCategory() {
		const { id: organizationId } = this.organization;
		const chosenType = 'add';
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		const dialog = this.dialogService.open(EditCategoryComponent, {
			context: {
				category: null,
				base: someNode.data,
				editType: chosenType,
				organizationId
			}
		});
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrService.success('TOASTR.MESSAGE.EDIT_ADD_CATEGORY', {
				name: data.name
			});
			this.loadMenu();
			this.tree.treeModel.update();
		}
	}

	async editCategory(node) {
		const { id: organizationId } = this.organization;
		const chosenType = 'edit';
		const someNode = this.tree.treeModel.getNodeById(this.nodeId);
		this.isChosenNode = true;
		const dialog = this.dialogService.open(EditCategoryComponent, {
			context: {
				base: someNode.data,
				category: node,
				editType: chosenType,
				organizationId
			}
		});
		const data = await dialog.onClose.pipe(first()).toPromise();
		if (data) {
			this.toastrService.success('TOASTR.MESSAGE.EDITED_CATEGORY', {
				name: someNode.data.name
			});
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
			this.toastrService.success('TOASTR.MESSAGE.DELETED_CATEGORY', {
				name: data.name
			});
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
			this.toastrService.success('TOASTR.MESSAGE.DELETED_BASE', {
				name: data.data.name
			});
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
		const { id: organizationId, tenantId } = this.organization;
		const result = await this.helpService.getAll(
			['parent', 'children', 'organization'],
			{ organizationId, tenantId }
		);
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

	ngOnDestroy() {}
}
