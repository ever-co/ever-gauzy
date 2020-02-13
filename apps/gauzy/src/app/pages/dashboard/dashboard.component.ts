import { Component, OnDestroy, OnInit } from '@angular/core';
import { PermissionsEnum } from '@gauzy/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { SelectedEmployee } from '../../@theme/components/header/selectors/employee/employee.component';

enum DASHBOARD_TYPES {
	LOADING = 'LOADING',
	ORGANIZATION_EMPLOYEES = 'ORGANIZATION_EMPLOYEES',
	EMPLOYEE_STATISTICS = 'EMPLOYEE_STATISTICS',
	DATA_ENTRY_SHORTCUTS = 'DATA_ENTRY_SHORTCUTS'
}

@Component({
	templateUrl: './dashboard.component.html',
	styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	selectedEmployee: SelectedEmployee;

	dashboardType = DASHBOARD_TYPES.LOADING;

	constructor(private store: Store) {}

	ngOnInit(): void {
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.store.selectedEmployee$
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((emp) => {
						if (emp) {
							this._loadDashboard(emp);
						}
					});
			});
	}

	_loadDashboard(emp: SelectedEmployee) {
		if (this.store.hasPermission(PermissionsEnum.ADMIN_DASHBOARD_VIEW)) {
			this.selectedEmployee = emp;
			this.dashboardType =
				emp && emp.id
					? DASHBOARD_TYPES.EMPLOYEE_STATISTICS
					: DASHBOARD_TYPES.ORGANIZATION_EMPLOYEES;
		} else {
			this.dashboardType = DASHBOARD_TYPES.DATA_ENTRY_SHORTCUTS;
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
