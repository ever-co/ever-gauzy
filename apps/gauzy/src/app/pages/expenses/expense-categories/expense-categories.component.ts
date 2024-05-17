import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, Subject, firstValueFrom } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import {
	IOrganizationExpenseCategory,
	ComponentLayoutStyleEnum,
	IOrganization,
	IExpenseCategory
} from '@gauzy/contracts';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from '../../../@shared/pagination/pagination-filter-base.component';
import { NotesWithTagsComponent } from '../../../@shared/table-components';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms';
import { API_PREFIX, ComponentEnum } from '../../../@core/constants';
import {
	ErrorHandlingService,
	OrganizationExpenseCategoriesService,
	Store,
	ToastrService
} from '../../../@core/services';
import { ServerDataSource } from '@gauzy/ui-sdk/core';
import { ExpenseCategoryMutationComponent } from './expense-category-mutation/expense-category-mutation.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-expense-categories',
	templateUrl: './expense-categories.component.html',
	styleUrls: ['expense-categories.component.scss']
})
export class ExpenseCategoriesComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	loading: boolean = false;
	disableButton: boolean = true;
	smartTableSource: ServerDataSource;
	settingsSmartTable: object;

	expenseCategories: IOrganizationExpenseCategory[] = [];
	selected = {
		expenseCategory: null,
		state: false
	};

	viewComponentName: ComponentEnum = ComponentEnum.EXPENSES_CATEGORY;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;

	public organization: IOrganization;
	categories$: Subject<any> = this.subject$;
	private _refresh$: Subject<boolean> = new Subject();

	constructor(
		private readonly organizationExpenseCategoryService: OrganizationExpenseCategoriesService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		readonly translateService: TranslateService,
		private readonly errorHandlingService: ErrorHandlingService,
		private readonly dialogService: NbDialogService,
		private readonly httpClient: HttpClient
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._loadSmartTableSettings();
		this.categories$
			.pipe(
				debounceTime(100),
				tap(() => this.cancel()),
				tap(() => this.getCategories()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.categories$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const componentLayout$ = this.store.componentLayout$(this.viewComponentName);
		combineLatest([storeOrganization$, componentLayout$])
			.pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter(([organization, componentLayout]) => !!organization && !!componentLayout),
				tap(([organization, componentLayout]) => {
					this.organization = organization;
					this.dataLayoutStyle = componentLayout;
				}),
				tap(() => this._refresh$.next(true)),
				tap(() => this.categories$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				tap(() => this.refreshPagination()),
				tap(() => (this.expenseCategories = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	cancel() {
		this.selected = {
			expenseCategory: null,
			state: false
		};
		this.disableButton = true;
	}

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : this.minItemPerPage
			},
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.EXPENSE_CATEGORY'),
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
			const result = await firstValueFrom(
				this.dialogService.open(DeleteConfirmationComponent, {
					context: {
						recordType: 'EXPENSES_PAGE.EXPENSE_CATEGORY'
					}
				}).onClose
			);

			if (result) {
				await this.organizationExpenseCategoryService.delete(id);
				this._refresh$.next(true);
				this.categories$.next(true);
				this.toastrService.success(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.REMOVE_EXPENSE_CATEGORY',
					{
						name
					}
				);
			}
		} catch (error) {
			this.errorHandlingService.handleError(error);
		}
	}

	public async addCategory(category: IExpenseCategory) {
		try {
			const { name } = category;
			if (name) {
				const { id: organizationId } = this.organization;
				const { tenantId } = this.store.user;

				await this.organizationExpenseCategoryService.create({
					organizationId,
					tenantId,
					...category
				});
				this.toastrService.success(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.ADD_EXPENSE_CATEGORY',
					{
						name
					}
				);
				this._refresh$.next(true);
				this.categories$.next(true);
			} else {
				this.toastrService.danger(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.INVALID_EXPENSE_CATEGORY_NAME',
					'TOASTR.MESSAGE.NEW_ORGANIZATION_EXPENSE_CATEGORY_INVALID_NAME'
				);
			}
		} catch (error) {
			console.log('Error while creating expense category', error);
			if (error instanceof HttpErrorResponse) {
				const messages = error.error.message.join(' & ');
				this.toastrService.error(messages);
			}
		}
	}

	public async editCategory(category: IExpenseCategory) {
		try {
			const { name } = category;
			if (name) {
				const { id } = this.selected.expenseCategory;
				const { id: organizationId } = this.organization;
				const { tenantId } = this.store.user;

				await this.organizationExpenseCategoryService.update(id, {
					id,
					organizationId,
					tenantId,
					...category
				});
				this.toastrService.success(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.UPDATE_EXPENSE_CATEGORY',
					{
						name
					}
				);
				this._refresh$.next(true);
				this.categories$.next(true);
			} else {
				this.toastrService.danger(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.INVALID_EXPENSE_CATEGORY_NAME',
					'TOASTR.MESSAGE.NEW_ORGANIZATION_EXPENSE_CATEGORY_INVALID_NAME'
				);
			}
		} catch (error) {
			console.log('Error while creating expense category', error);
			if (error instanceof HttpErrorResponse) {
				const messages = error.error.message.join(' & ');
				this.toastrService.error(messages);
			}
		}
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}
		this.loading = true;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/expense-categories/pagination`,
			relations: ['tags'],
			join: {
				alias: 'expense_category',
				leftJoin: {
					tags: 'expense_category.tags'
				}
			},
			where: {
				organizationId,
				tenantId,
				...(this.filters.where ? this.filters.where : {})
			},
			finalize: () => {
				this.expenseCategories.push(...this.smartTableSource.getData());
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}

	private async getCategories() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();
			// Initiate GRID view pagination
			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			await this.smartTableSource.getElements();
		} catch (error) {
			this.errorHandlingService.handleError(error);
		}
	}

	selectExpenseCategory(expenseCategory: any) {
		if (expenseCategory.data) expenseCategory = expenseCategory.data;

		const res =
			this.selected.expenseCategory && expenseCategory === this.selected.expenseCategory
				? { state: !this.selected.state }
				: { state: true };
		this.selected.state = res.state;
		this.disableButton = !res.state;
		this.selected.expenseCategory = this.selected.state ? expenseCategory : null;
	}

	/**
	 * Add Expense Category Dialog
	 */
	add() {
		this.dialogService
			.open(ExpenseCategoryMutationComponent)
			.onClose.pipe(
				filter((category: IExpenseCategory) => !!category),
				tap((category: IExpenseCategory) => this.addCategory(category)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Edit Expense Category Dialog
	 */
	edit() {
		if (!this.selected.expenseCategory) {
			return;
		}
		this.dialogService
			.open(ExpenseCategoryMutationComponent, {
				context: {
					category: this.selected.expenseCategory
				}
			})
			.onClose.pipe(
				filter((category: IExpenseCategory) => !!category),
				tap((category: IExpenseCategory) => this.editCategory(category)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}
}
