import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, first } from 'rxjs/operators';
import { Store } from '../../../@core/services/store.service';
import {
	Organization,
	OrganizationRecurringExpense,
	CurrenciesEnum
} from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { EmployeesService } from '../../../@core/services';
import { OrganizationRecurringExpenseService } from '../../../@core/services/organization-recurring-expense.service';
import { monthNames } from '../../../@core/utils/date';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { NbDialogService, NbToastrService } from '@nebular/theme';

@Component({
	templateUrl: './edit-organization.component.html',
	styleUrls: [
		'./edit-organization.component.scss',
		'../../dashboard/dashboard.component.scss'
	]
})
export class EditOrganizationComponent implements OnInit, OnDestroy {
	selectedOrg: Organization;
	selectedDate: Date;
	selectedOrgFromHeader: Organization;
	employeesCount: number;
	selectedOrgRecurringExpense: OrganizationRecurringExpense[];
	selectedRowIndexToShow: number;
	currencies = Object.values(CurrenciesEnum);
	selectedCurrency: string;
	showAddCard: boolean;

	private _ngDestroy$ = new Subject<void>();

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private organizationsService: OrganizationsService,
		private employeesService: EmployeesService,
		private organizationRecurringExpenseService: OrganizationRecurringExpenseService,
		private store: Store,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService
	) {}

	async ngOnInit() {
		this.selectedDate = this.store.selectedDate;

		this.store.selectedDate$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((date) => {
				this.selectedDate = date;
				this._loadOrgRecurringExpense();
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
				this.selectedCurrency = this.selectedOrg.currency;
				this.loadEmployeesCount();
				this._loadOrgRecurringExpense();
				this.store.selectedOrganization = this.selectedOrg;

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

	async addOrgRecurringExpense(expense: OrganizationRecurringExpense) {
		try {
			await this.organizationRecurringExpenseService.create(expense);
			this.showAddCard = !this.showAddCard;

			this.toastrService.info(
				'Organization recurring expense set.',
				'Success'
			);
			this._loadOrgRecurringExpense();
		} catch (error) {
			this.toastrService.danger(
				error.error ? error.error.message : error.message,
				'Error'
			);
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	getMonthString(month: number) {
		const months = monthNames;

		return months[month - 1];
	}

	showMenu(index: number) {
		this.selectedRowIndexToShow = index;
	}

	getDefaultDate() {
		const month = ('0' + (this.selectedDate.getMonth() + 1)).slice(-2);
		return `${this.selectedDate.getFullYear()}-${month}`;
	}

	getDateValue(value: string): { month: number; year: number } {
		if (value) {
			const res = value.split('-');

			return {
				year: +res[0],
				month: +res[1]
			};
		}
	}

	async deleteOrgRecurringExpense(i) {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent, {
				context: { recordType: 'Organization recurring expense' }
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			try {
				const deleteExpense = this.selectedOrgRecurringExpense[i];
				if (deleteExpense) {
					await this.organizationRecurringExpenseService.delete(
						deleteExpense.id
					);
				} else {
					throw new Error('Recurring monthly expense not found');
				}

				this.selectedRowIndexToShow = null;
				this.toastrService.info(
					'Organization recurring expense deleted.',
					'Success'
				);
				this._loadOrgRecurringExpense();
			} catch (error) {
				this.toastrService.danger(
					error.error ? error.error.message : error.message,
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
		if (this.selectedOrg) {
			this.selectedOrgRecurringExpense = (await this.organizationRecurringExpenseService.getAll(
				[],
				{
					orgId: this.selectedOrg.id,
					year: this.selectedDate.getFullYear(),
					month: this.selectedDate.getMonth() + 1
				}
			)).items;
		}
	}
}
