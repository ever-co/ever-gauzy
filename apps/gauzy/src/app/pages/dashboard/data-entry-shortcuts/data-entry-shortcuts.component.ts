import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '@gauzy/ui-core/core';
import { PermissionsEnum } from '@gauzy/contracts';

@UntilDestroy()
@Component({
	selector: 'ga-data-entry-shortcuts',
	templateUrl: './data-entry-shortcuts.component.html',
	styleUrls: ['./data-entry-shortcuts.component.scss']
})
export class DataEntryShortcutsComponent implements OnInit, OnDestroy {
	constructor(readonly router: Router, readonly store: Store) {}

	hasPermissionE = false;
	hasPermissionI = false;
	hasPermissionIEdit = false;
	hasPermissionEEdit = false;

	ngOnInit() {
		this.store.userRolePermissions$.pipe(untilDestroyed(this)).subscribe(() => {
			this.hasPermissionE = this.store.hasPermission(PermissionsEnum.ORG_EXPENSES_VIEW);
			this.hasPermissionI = this.store.hasPermission(PermissionsEnum.ORG_INCOMES_VIEW);
			this.hasPermissionEEdit = this.store.hasPermission(PermissionsEnum.ORG_EXPENSES_EDIT);
			this.hasPermissionIEdit = this.store.hasPermission(PermissionsEnum.ORG_INCOMES_EDIT);
		});
	}

	/**
	 * Navigate to the income page and open the add dialog.
	 */
	async addIncome(): Promise<void> {
		await this.router.navigateByUrl('pages/accounting/income?openAddDialog=true');
	}

	/**
	 * Navigate to the expenses page and open the add dialog.
	 */
	async addExpense(): Promise<void> {
		await this.router.navigateByUrl('pages/accounting/expenses?openAddDialog=true');
	}

	/**
	 * Navigate to the organizations page.
	 */
	async addOrganizationRecurringExpense(): Promise<void> {
		await this.router.navigateByUrl('pages/organizations');
	}

	/**
	 * Navigate to the employees page.
	 */
	async addEmployeeRecurringExpense(): Promise<void> {
		await this.router.navigateByUrl('pages/employees');
	}

	ngOnDestroy() {}
}
