import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';
import { Store } from '../../../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';
import { PermissionsEnum } from '@gauzy/models';

@Component({
	selector: 'ga-data-entry-shortcuts',
	templateUrl: './data-entry-shortcuts.component.html',
	styleUrls: ['./data-entry-shortcuts.component.scss']
})
export class DataEntryShortcutsComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	constructor(
		private readonly router: Router,
		private readonly store: Store
	) {}

	hasPermissionE = false;
	hasPermissionI = false;
	hasPermissionIEdit = false;
	hasPermissionEEdit = false;

	async ngOnInit() {
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasPermissionE = this.store.hasPermission(
					PermissionsEnum.ORG_EXPENSES_VIEW
				);
				this.hasPermissionI = this.store.hasPermission(
					PermissionsEnum.ORG_INCOMES_VIEW
				);
				this.hasPermissionEEdit = this.store.hasPermission(
					PermissionsEnum.ORG_EXPENSES_EDIT
				);
				this.hasPermissionIEdit = this.store.hasPermission(
					PermissionsEnum.ORG_INCOMES_EDIT
				);
			});
	}

	async addIncome() {
		this.router.navigateByUrl('pages/income?openAddDialog=true');
	}

	async addExpense() {
		this.router.navigateByUrl('pages/expenses?openAddDialog=true');
	}

	async addOrganizationRecurringExpense() {
		this.router.navigateByUrl('pages/organizations');
	}

	async addEmployeeRecurringExpense() {
		this.router.navigateByUrl('pages/employees');
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
