import { HelpCenterActionEnum, HelpCenterFlagEnum, IHelpCenter, IOrganization } from '@gauzy/contracts';
import { Component, ViewChild, OnInit, OnDestroy, Output, EventEmitter, AfterViewInit } from '@angular/core';
import { TreeComponent, ITreeOptions } from '@ali-hm/angular-tree-component';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { ErrorHandlingService, ToastrService } from '@gauzy/ui-sdk/core';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbMenuItem, NbMenuService } from '@nebular/theme';
import { AddIconComponent } from './add-icon/add-icon.component';
import { filter, tap } from 'rxjs/operators';
import { DeleteCategoryComponent } from './delete-category/delete-category.component';
import { DeleteBaseComponent } from './delete-base/delete-base.component';
import { HelpCenterService } from '@gauzy/ui-sdk/core';
import { Store } from '@gauzy/ui-sdk/common';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { KnowledgeBaseComponent } from './knowledeg-base/knowledeg-base.component';
import { firstValueFrom } from 'rxjs';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-sidebar',
	templateUrl: './sidebar.component.html',
	styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent extends TranslationBaseComponent implements OnInit, OnDestroy, AfterViewInit {
	public organization: IOrganization;
	public actionEnum = HelpCenterActionEnum;
	public tempNodes: IHelpCenter[] = [];
	public nodeId = '';
	public isChosenNode = false;
	public nodes: IHelpCenter[] = [];
	public settingsContextMenu: NbMenuItem[];

	/**
	 *
	 */
	public options: ITreeOptions = {
		getChildren: (node: IHelpCenter) => this.helpService.findByBaseId(node.id),
		allowDrag: true,
		allowDrop: (el, { parent }) => parent.data.flag !== HelpCenterFlagEnum.CATEGORY,
		childrenField: 'children'
	};

	/**
	 *
	 */
	@Output() clickedNode = new EventEmitter<IHelpCenter>();
	@Output() deletedNode = new EventEmitter<any>();

	/**
	 *
	 */
	@ViewChild(TreeComponent) private tree: TreeComponent;

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
				tap((organization) => (this.organization = organization)),
				tap(() => this.loadMenu()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this.nbMenuService.onItemClick().subscribe((elem) => {
			if (elem.item.title === this.getTranslation('HELP_PAGE.EDIT_BASE')) {
				this.addEditBase(HelpCenterActionEnum.EDIT);
			}
			if (elem.item.title === this.getTranslation('HELP_PAGE.ADD_CATEGORY')) {
				this.addEditCategory(HelpCenterActionEnum.ADD);
			}
			if (elem.item.title === this.getTranslation('HELP_PAGE.DELETE_BASE')) {
				this.deleteBase();
			}
		});
	}

	setClasses(node) {
		const classes = {
			child: node.data.flag === HelpCenterFlagEnum.CATEGORY && node.data.parentId !== null,
			childout: node.data.flag === HelpCenterFlagEnum.CATEGORY && node.data.parentId === null,
			parent: node.data.flag === HelpCenterFlagEnum.BASE && node.data.parentId === null,
			parentin: node.data.flag === HelpCenterFlagEnum.BASE && node.data.parentId !== null
		};
		return classes;
	}

	async addEditBase(editType: string) {
		const context = {
			base: null,
			editType,
			flag: HelpCenterFlagEnum.BASE,
			parentId: null
		};
		if (editType === HelpCenterActionEnum.EDIT) {
			const { data } = this.tree.treeModel.getNodeById(this.nodeId);
			context['base'] = data;
		}
		this.dialogService
			.open(KnowledgeBaseComponent, {
				context
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (data) => {
				if (data) {
					if (editType === HelpCenterActionEnum.EDIT) {
						this.toastrService.success('TOASTR.MESSAGE.EDITED_BASE', {
							name: context.base.name
						});
					} else {
						this.toastrService.success('TOASTR.MESSAGE.CREATED_BASE', {
							name: data.name
						});
					}
				}
				this.loadMenu();
				this.tree.treeModel.update();
			});
	}

	async addEditCategory(editType: string, node?: IHelpCenter) {
		const { data } = this.tree.treeModel.getNodeById(this.nodeId);
		const context = {
			base: null,
			parentId: data.id,
			editType,
			flag: HelpCenterFlagEnum.CATEGORY
		};
		if (editType === HelpCenterActionEnum.EDIT) {
			context['base'] = node;
			this.isChosenNode = true;
		}
		this.dialogService
			.open(KnowledgeBaseComponent, {
				context
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async (data) => {
				if (data) {
					if (editType === HelpCenterActionEnum.EDIT) {
						this.toastrService.success('TOASTR.MESSAGE.EDITED_CATEGORY', {
							name: context.base.name
						});
					} else {
						this.toastrService.success('TOASTR.MESSAGE.EDIT_ADD_CATEGORY', {
							name: data.name
						});
					}
				}
				this.loadMenu();
				this.tree.treeModel.update();
			});
	}

	async deleteCategory(node) {
		const dialog = this.dialogService.open(DeleteCategoryComponent, {
			context: {
				category: node
			}
		});
		const data = await firstValueFrom(dialog.onClose);
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
		const data = await firstValueFrom(dialog.onClose);
		if (data) {
			this.toastrService.success('TOASTR.MESSAGE.DELETED_BASE', {
				name: data.data.name
			});
			await this.loadMenu();
			this.tree.treeModel.update();
		}
	}

	async updateIndexes(oldChildren: IHelpCenter[], newChildren: IHelpCenter[]) {
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
		this.updateIndexes($event.from.parent.children, $event.to.parent.children);
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
		const chosenIcon = await firstValueFrom(dialog.onClose);
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
		someNode.data.privacy = someNode.data.privacy === 'eye-outline' ? 'eye-off-outline' : 'eye-outline';
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
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const result = await this.helpService.getAll(['parent', 'children', 'organization'], {
			organizationId,
			tenantId
		});
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
