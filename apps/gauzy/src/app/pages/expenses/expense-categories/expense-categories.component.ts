import { Component, OnInit, OnDestroy } from '@angular/core';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import {
	ITag,
	IOrganizationExpenseCategory,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Subject } from 'rxjs';
import { API_PREFIX, ComponentEnum } from '../../../@core/constants';
import { NotesWithTagsComponent } from '../../../@shared/table-components';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { ErrorHandlingService, OrganizationExpenseCategoriesService, Store, ToastrService } from '../../../@core/services';
import { distinctUntilChange } from '@gauzy/common-angular';
import { ServerDataSource } from '../../../@core/utils/smart-table/server.data-source';
import { HttpClient } from '@angular/common/http';
import { combineLatest } from 'rxjs';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-expense-categories',
	templateUrl: './expense-categories.component.html',
	styles: [':host > nb-card { min-height: 47.50rem; }']
})
export class ExpenseCategoriesComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	smartTableSource: ServerDataSource;
	organization: IOrganization;
	showAddCard: boolean;
	showEditDiv: boolean;
	settingsSmartTable: object;
	expenseCategories: IOrganizationExpenseCategory[];
	selectedExpenseCategory: IOrganizationExpenseCategory;
	tags: ITag[] = [];
	isGridEdit: boolean;
	viewComponentName: ComponentEnum = ComponentEnum.EXPENSES_CATEGORY;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	subject$: Subject<any> = new Subject();
	pagination: any = {
		totalItems: 0,
		activePage: 1,
		itemsPerPage: 8
	};
	loading: boolean;

	constructor(
		private readonly organizationExpenseCategoryService: OrganizationExpenseCategoriesService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		readonly translateService: TranslateService,
		private readonly errorHandlingService: ErrorHandlingService,
		private readonly dialogService: NbDialogService,
		private readonly httpClient: HttpClient,
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this._loadSettingsSmartTable();
		this.subject$
			.pipe(
				tap(() => this.loading = true),
				debounceTime(300),
				tap(() => this.cancel()),
				tap(() => this.getCategories()),
				untilDestroyed(this)
			)
			.subscribe();

		const storeOrganization$ = this.store.selectedOrganization$;
		const componentLayout$ = this.store.componentLayout$(this.viewComponentName);
		combineLatest([storeOrganization$, componentLayout$])
			.pipe(
				debounceTime(300),
				filter(([ organization, componentLayout ]) => !!organization && !!componentLayout),
				distinctUntilChange(),
				tap(([organization, componentLayout]) => {
					this.organization = organization;
					this.dataLayoutStyle = componentLayout;
					this.refreshPagination();
					this.subject$.next();
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngOnDestroy(): void {}

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

	async _loadSettingsSmartTable() {
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
						recordType: 'EXPENSES_PAGE.EXPENSE_CATEGORY'
					}
				})
				.onClose.pipe(first())
				.toPromise();

			if (result) {
				await this.organizationExpenseCategoryService.delete(id);
				this.subject$.next();
				this.toastrService.success(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.REMOVE_EXPENSE_CATEGORY',
					{ name }
				);
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
		this.subject$.next();
		this.toastrService.success(
			'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.UPDATE_EXPENSE_CATEGORY',
			{ name }
		);
	}

	public async addCategory(name: string) {
		if (name) {
			const { id: organizationId } = this.organization;
			const { tenantId } = this.store.user;

			await this.organizationExpenseCategoryService.create({
				name,
				organizationId,
				tenantId,
				tags: this.tags
			});
			this.subject$.next();
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.ADD_EXPENSE_CATEGORY',
				{ name }
			);
		} else {
			// TODO translate
			this.toastrService.danger(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_EXPENSE_CATEGORIES.INVALID_EXPENSE_CATEGORY_NAME',
				'TOASTR.MESSAGE.NEW_ORGANIZATION_EXPENSE_CATEGORY_INVALID_NAME'
			);
		}
	}

	/*
	* Register Smart Table Source Config 
	*/
	setSmartTableSource() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/expense-categories/pagination`,
			relations: [
				'tags'
			],
			where: {
				organizationId,
				tenantId
			},
			finalize: () => {
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
			const { activePage, itemsPerPage } = this.pagination;
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			await this.smartTableSource.getElements();
			this.expenseCategories = this.smartTableSource.getData();
			
			this.pagination['totalItems'] =  this.smartTableSource.count();
			this.emptyListInvoke();
		} catch (error) {
			this.errorHandlingService.handleError(error);
		}
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

	onPageChange(selectedPage: number) {
		this.pagination['activePage'] = selectedPage;
		this.subject$.next();
	}

	/*
	* refresh pagination
	*/
	refreshPagination() {
		this.pagination['activePage'] = 1;
	}
}
