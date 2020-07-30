import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import {
	Organization,
	OrganizationRecurringExpense,
	Tag,
	PermissionsEnum,
	RecurringExpenseDefaultCategoriesEnum,
	RecurringExpenseDeletionEnum
} from '@gauzy/models';
import { Subject } from 'rxjs';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { OrganizationRecurringExpenseService } from '../../@core/services/organization-recurring-expense.service';
import { takeUntil, first } from 'rxjs/operators';
import { monthNames } from '../../@core/utils/date';
import { RecurringExpenseDeleteConfirmationComponent } from '../../@shared/expenses/recurring-expense-delete-confirmation/recurring-expense-delete-confirmation.component';
import {
	RecurringExpenseMutationComponent,
	COMPONENT_TYPE
} from '../../@shared/expenses/recurring-expense-mutation/recurring-expense-mutation.component';
import { Store } from '../../@core/services/store.service';

@Component({
	templateUrl: './expense-recurring.component.html',
	styleUrls: [
		'./expense-recurring.component.scss',
		'../dashboard/dashboard.component.scss'
	]
})
export class ExpenseRecurringComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	selectedOrg: Organization;
	selectedDate: Date;
	selectedOrgFromHeader: Organization;
	selectedOrgRecurringExpense: OrganizationRecurringExpense[];
	selectedRowIndexToShow: number;
	editExpenseId: string;
	hasEditExpensePermission = false;
	private _ngDestroy$ = new Subject<void>();
	fetchedHistories: Object = {};
	tags: Tag[];

	loading = true;
	constructor(
		private organizationRecurringExpenseService: OrganizationRecurringExpenseService,
		private store: Store,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.selectedDate = this.store.selectedDate;

		this.store.selectedDate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((date) => {
				this.selectedDate = date;
				this._loadOrgRecurringExpense();
			});

		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasEditExpensePermission = this.store.hasPermission(
					PermissionsEnum.ORG_EXPENSES_EDIT
				);
			});

		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((organization) => {
				if (organization) {
					this.selectedOrg = organization;
					this._loadOrgRecurringExpense();
					this.selectedOrgFromHeader = this.selectedOrg;
					this.store.selectedOrganization = this.selectedOrg;
					this.store.selectedEmployee = null;
				}
			});
	}
	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	getMonthString(month: number) {
		return monthNames[month];
	}

	getCategoryName(categoryName: string) {
		return categoryName in RecurringExpenseDefaultCategoriesEnum
			? this.getTranslation(
					`EXPENSES_PAGE.DEFAULT_CATEGORY.${categoryName}`
			  )
			: categoryName;
	}

	showMenu(index: number) {
		this.selectedRowIndexToShow = index;
	}

	async deleteOrgRecurringExpense(index: number) {
		const selectedExpense = this.selectedOrgRecurringExpense[index];
		const result: RecurringExpenseDeletionEnum = await this.dialogService
			.open(RecurringExpenseDeleteConfirmationComponent, {
				context: {
					recordType: 'Organization recurring expense',
					start: `${this.getMonthString(
						selectedExpense.startMonth
					)}, ${selectedExpense.startYear}`,
					current: `${this.getMonthString(
						this.selectedDate.getMonth()
					)}, ${this.selectedDate.getFullYear()}`,
					end: selectedExpense.endMonth
						? `${this.getMonthString(selectedExpense.endMonth)}, ${
								selectedExpense.endYear
						  }`
						: 'end'
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			try {
				const id = selectedExpense.id;
				await this.organizationRecurringExpenseService.delete(id, {
					deletionType: result,
					month: this.selectedDate.getMonth(),
					year: this.selectedDate.getFullYear()
				});
				this.selectedRowIndexToShow = null;

				this.toastrService.primary(
					this.selectedOrg.name + ' recurring expense deleted.',
					'Success'
				);
				setTimeout(() => {
					this._loadOrgRecurringExpense();
				}, 100);
			} catch (error) {
				this.toastrService.danger(
					error.error.message || error.message,
					'Error'
				);
			}
		}
	}

	async addOrganizationRecurringExpense() {
		const result = await this.dialogService
			.open(RecurringExpenseMutationComponent, {
				context: {
					componentType: COMPONENT_TYPE.ORGANIZATION,
					selectedDate: this.selectedDate
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			try {
				await this.organizationRecurringExpenseService.create({
					organizationId: this.selectedOrg.id,
					...result
				});

				this.toastrService.primary(
					this.selectedOrg.name + ' recurring expense set.',
					'Success'
				);
				this._loadOrgRecurringExpense();
			} catch (error) {
				this.toastrService.danger(
					error.error.message || error.message,
					'Error'
				);
			}
		}
	}

	async editOrganizationRecurringExpense(index: number) {
		const result = await this.dialogService
			.open(RecurringExpenseMutationComponent, {
				context: {
					recurringExpense: this.selectedOrgRecurringExpense[index],
					componentType: COMPONENT_TYPE.ORGANIZATION,
					selectedDate: this.selectedDate
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			try {
				const id = this.selectedOrgRecurringExpense[index].id;
				await this.organizationRecurringExpenseService.update(
					id,
					result
				);
				this.selectedRowIndexToShow = null;
				this._loadOrgRecurringExpense();

				this.toastrService.primary(
					this.selectedOrg.name + ' recurring expense edited.',
					'Success'
				);
				setTimeout(() => {
					this._loadOrgRecurringExpense();
				}, 300);
			} catch (error) {
				this.toastrService.danger(
					error.error.message || error.message,
					'Error'
				);
			}
		}
	}
	private async _loadOrgRecurringExpense() {
		this.fetchedHistories = {};

		if (this.selectedOrg && this.selectedDate) {
			this.selectedOrgRecurringExpense = (
				await this.organizationRecurringExpenseService.getAllByMonth({
					organizationId: this.selectedOrg.id,
					year: this.selectedDate.getFullYear(),
					month: this.selectedDate.getMonth()
				})
			).items;
			this.loading = false;
		}
	}

	public async fetchHistory(i: number) {
		this.fetchedHistories[i] = (
			await this.organizationRecurringExpenseService.getAll(
				[],
				{
					parentRecurringExpenseId: this.selectedOrgRecurringExpense[
						i
					].parentRecurringExpenseId
				},
				{
					startDate: 'ASC'
				}
			)
		).items;
	}
}
