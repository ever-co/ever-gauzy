import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbToastrService, NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { first } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { OrganizationExpenseCategoriesService } from '../../../@core/services/organization-expense-categories.service';
import {
	ITag,
	IOrganizationExpenseCategory,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { Store } from '../../../@core/services/store.service';
import { ComponentEnum } from '../../../@core/constants/layout.constants';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NotesWithTagsComponent } from '../../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-expense-categories',
	templateUrl: './expense-categories.component.html'
})
export class ExpenseCategoriesComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	organizationId: string;
	tenantId: string;

	showAddCard: boolean;
	showEditDiv: boolean;
	settingsSmartTable: object;
	expenseCategories: IOrganizationExpenseCategory[];

	selectedExpenseCategory: IOrganizationExpenseCategory;
	tags: ITag[] = [];
	isGridEdit: boolean;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;

	constructor(
		private readonly organizationExpenseCategoryService: OrganizationExpenseCategoriesService,
		private readonly toastrService: NbToastrService,
		private store: Store,
		readonly translateService: TranslateService,
		private errorHandlingService: ErrorHandlingService,
		private readonly dialogService: NbDialogService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(untilDestroyed(this))
			.subscribe((organization) => {
				if (organization) {
					this.organizationId = organization.id;
					this.tenantId = organization.tenantId;
					this.loadCategories();
					this.loadSmartTable();
				}
			});
	}

	ngOnDestroy(): void {}

	setView() {
		this.viewComponentName = ComponentEnum.EXPENSES_CATEGORY;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
				this.selectedExpenseCategory = null;

				//when layout selector change then hide edit showcard
				this.showAddCard = false;
			});
	}

	showEditCard(expenseCategory: IOrganizationExpenseCategory) {
		this.showEditDiv = true;
		this.showAddCard = false;
		this.selectedExpenseCategory = expenseCategory;
		this.tags = expenseCategory.tags;
	}

	cancel() {
		this.showEditDiv = false;
		this.showAddCard = false;
		this.selectedExpenseCategory = null;
		this.isGridEdit = false;
		this.tags = [];
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'custom',
					class: 'align-row',
					renderComponent: NotesWithTagsComponent
				}
			}
		};
	}

	async removeCategory(id: string, name: string) {
		try {
			const result = await this.dialogService
				.open(DeleteConfirmationComponent, {
					context: {
						recordType: 'Expense Category'
					}
				})
				.onClose.pipe(first())
				.toPromise();

			if (result) {
				await this.organizationExpenseCategoryService.delete(id);
				this.toastrService.primary(
					this.getTranslation(
						'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.REMOVE_EXPENSE_CATEGORY',
						{
							name: name
						}
					),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
				this.loadCategories();
			}
		} catch (error) {
			this.errorHandlingService.handleError(error);
		}
	}

	save(name: string) {
		if (this.isGridEdit) {
			this.editCategory(this.selectedExpenseCategory.id, name);
		} else {
			this.addCategory(name);
		}
	}

	public async editCategory(id: string, name: string) {
		const expenseCategory = {
			name: name,
			tags: this.tags
		};
		await this.organizationExpenseCategoryService.update(
			id,
			expenseCategory
		);

		this.toastrService.primary(
			this.getTranslation(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.UPDATE_EXPENSE_CATEGORY',
				{ name: name }
			),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);

		this.loadCategories();
		this.cancel();
	}

	public async addCategory(name: string) {
		if (name) {
			await this.organizationExpenseCategoryService.create({
				name,
				organizationId: this.organizationId,
				tenantId: this.tenantId,
				tags: this.tags
			});

			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.ADD_EXPENSE_CATEGORY',
					{ name: name }
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.cancel();
			this.loadCategories();
		} else {
			// TODO translate
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.INVALID_EXPENSE_CATEGORY_NAME'
				),
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_EXPENSE_CATEGORY_INVALID_NAME'
				)
			);
		}
	}

	private async loadCategories() {
		if (!this.organizationId) {
			return;
		}
		const res = await this.organizationExpenseCategoryService.getAll(
			{
				organizationId: this.organizationId,
				tenantId: this.tenantId
			},
			['tags']
		);
		if (res) {
			this.expenseCategories = res.items;
		}
		this.emptyListInvoke();
	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}

	edit(expenseCategory: IOrganizationExpenseCategory) {
		this.showAddCard = true;
		this.isGridEdit = true;
		this.selectedExpenseCategory = expenseCategory;
		this.tags = expenseCategory.tags;
	}

	/*
	 * if empty employment levels then displayed add button
	 */
	private emptyListInvoke() {
		if (this.expenseCategories.length === 0) {
			this.cancel();
		}
	}
}
