import { Component, OnInit, OnDestroy } from '@angular/core';
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

@Component({
	templateUrl: './edit-organization.component.html',
	styleUrls: [
		'./edit-organization.component.scss',
		'../../dashboard/dashboard.component.scss'
	]
})
export class EditOrganizationComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	selectedOrg: Organization;
	selectedDate: Date;
	selectedOrgFromHeader: Organization;
	employeesCount: number;
	selectedOrgRecurringExpense: OrganizationRecurringExpense[];
	selectedRowIndexToShow: number;
	currencies = Object.values(CurrenciesEnum);
	selectedCurrency: string;
	showAddCard: boolean;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private organizationsService: OrganizationsService,
		private employeesService: EmployeesService,
		private organizationRecurringExpenseService: OrganizationRecurringExpenseService,
		private store: Store
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
		// TODO
		// await this.organizationRecurringExpenseService.create(expense);

		this.showAddCard = !this.showAddCard;
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

			console.error(this.selectedOrgRecurringExpense);
		}
	}
}
