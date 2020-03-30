import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
	CurrenciesEnum,
	Organization,
	OrganizationRecurringExpense,
	RecurringExpenseDeletionEnum,
	RecurringExpenseDefaultCategoriesEnum,
	PermissionsEnum
} from '@gauzy/models';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { first, takeUntil } from 'rxjs/operators';

import { EmployeesService } from '../../../@core/services';
import { OrganizationRecurringExpenseService } from '../../../@core/services/organization-recurring-expense.service';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { Store } from '../../../@core/services/store.service';
import { monthNames } from '../../../@core/utils/date';
import { RecurringExpenseDeleteConfirmationComponent } from '../../../@shared/expenses/recurring-expense-delete-confirmation/recurring-expense-delete-confirmation.component';
import {
	RecurringExpenseMutationComponent,
	COMPONENT_TYPE
} from '../../../@shared/expenses/recurring-expense-mutation/recurring-expense-mutation.component';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

@Component({
	templateUrl: './edit-organization.component.html',
	styleUrls: [
		'./edit-organization.component.scss',
		'../../dashboard/dashboard.component.scss'
	]
})
export class EditOrganizationComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	selectedOrg: Organization;
	selectedDate: Date;
	selectedOrgFromHeader: Organization;
	employeesCount: number;
	selectedOrgRecurringExpense: OrganizationRecurringExpense[];
	selectedRowIndexToShow: number;
	currencies = Object.values(CurrenciesEnum);
	editExpenseId: string;
	hasEditPermission = false;
	hasEditExpensePermission = false;
	private _ngDestroy$ = new Subject<void>();
	fetchedHistories: Object = {};

	loading = true;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private organizationsService: OrganizationsService,
		private employeesService: EmployeesService,
		private organizationRecurringExpenseService: OrganizationRecurringExpenseService,
		private store: Store,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	async ngOnInit() {
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
				this.hasEditPermission = this.store.hasPermission(
					PermissionsEnum.ALL_ORG_EDIT
				);
				this.hasEditExpensePermission = this.store.hasPermission(
					PermissionsEnum.ORG_EXPENSES_EDIT
				);
			});

		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (params) => {
				const id = params.id;

				this.selectedOrg = await this.organizationsService
					.getById(id)
					.pipe(first())
					.toPromise();
				this.selectedOrgFromHeader = this.selectedOrg;
				this.loadEmployeesCount();
				this._loadOrgRecurringExpense();
				this.store.selectedOrganization = this.selectedOrg;
				this.store.selectedEmployee = null;

				this.store.selectedOrganization$
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((org) => {
						this.selectedOrgFromHeader = org;
						if (org && org.id) {
							this.router.navigate([
								'/pages/organizations/edit/' + org.id
							]);
						}
					});
			});
	}

	editOrg() {
		this.router.navigate([
			'/pages/organizations/edit/' + this.selectedOrg.id + '/settings'
		]);
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
					orgId: this.selectedOrg.id,
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

	private async loadEmployeesCount() {
		const { total } = await this.employeesService
			.getAll([], { organization: { id: this.selectedOrg.id } })
			.pipe(first())
			.toPromise();

		this.employeesCount = total;
	}

	private async _loadOrgRecurringExpense() {
		this.fetchedHistories = {};

		if (this.selectedOrg && this.selectedDate) {
			this.selectedOrgRecurringExpense = (
				await this.organizationRecurringExpenseService.getAllByMonth({
					orgId: this.selectedOrg.id,
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
