import { Component, OnInit } from '@angular/core';
import { NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { ErrorHandlingService } from 'apps/gauzy/src/app/@core/services/error-handling.service';
import { OrganizationExpenseCategoriesService } from 'apps/gauzy/src/app/@core/services/organization-expense-categories.service';
import { Tag } from '@gauzy/models';
import { IOrganizationExpenseCategory } from 'libs/models/src/lib/organization-expense-category.model';
import { Store } from '../../../@core/services/store.service';

@Component({
	selector: 'ga-expense-categories',
	templateUrl: './expense-categories.component.html'
})
export class ExpenseCategoriesComponent extends TranslationBaseComponent
	implements OnInit {
	private _ngDestroy$ = new Subject<void>();
	expenseCategoryId: string;

	showAddCard: boolean;
	showEditDiv: boolean;

	expenseCategories: IOrganizationExpenseCategory[];

	selectedExpenseCategory: IOrganizationExpenseCategory;
	tags: Tag[] = [];

	constructor(
		private readonly organizationExpenseCategoryService: OrganizationExpenseCategoriesService,
		private readonly toastrService: NbToastrService,
		private store: Store,
		readonly translateService: TranslateService,
		private errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.expenseCategoryId = organization.id;
					this.loadCategories();
				}
			});
	}

	showEditCard(expenseCategory: IOrganizationExpenseCategory) {
		this.showEditDiv = true;
		this.selectedExpenseCategory = expenseCategory;
		this.tags = expenseCategory.tags;
	}

	cancel() {
		this.showEditDiv = !this.showEditDiv;
		this.selectedExpenseCategory = null;
	}

	async removeCategory(id: string, name: string) {
		try {
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
		} catch (error) {
			this.errorHandlingService.handleError(error);
		}
	}

	async editCategory(id: string, name: string) {
		const expenseCategory = {
			name: name,
			tags: this.tags
		};
		await this.organizationExpenseCategoryService.update(
			id,
			expenseCategory
		);
		this.loadCategories();
		this.toastrService.success('Successfully updated');
		this.showEditDiv = !this.showEditDiv;
		this.tags = [];
	}

	private async addCategory(name: string) {
		if (name) {
			await this.organizationExpenseCategoryService.create({
				name,
				organizationId: this.expenseCategoryId,
				tags: this.tags
			});

			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.ADD_EXPENSE_CATEGORY',
					{
						name: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.showAddCard = !this.showAddCard;
			this.loadCategories();
		} else {
			// TODO translate
			this.toastrService.danger(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.INVALID_EXPENSE_CATEGORY_NAME'
				),
				this.getTranslation(
					'TOASTR.MESSAGE.NEW_ORGANIZATION_VENDOR_INVALID_NAME'
				)
			);
		}
	}

	private async loadCategories() {
		if (!this.expenseCategoryId) {
			return;
		}

		const res = await this.organizationExpenseCategoryService.getAll(
			{
				organizationId: this.expenseCategoryId
			},
			['tags']
		);
		if (res) {
			this.expenseCategories = res.items;
		}
	}

	selectedTagsEvent(ev) {
		this.tags = ev;
	}
}
