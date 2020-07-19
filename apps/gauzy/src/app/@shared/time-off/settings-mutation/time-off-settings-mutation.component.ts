import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { Employee, OrganizationTeam } from '@gauzy/models';
import { EmployeesService } from '../../../@core/services';
import { first, takeUntil } from 'rxjs/operators';
import { Store } from '../../../@core/services/store.service';
import { Subject } from 'rxjs';
import { TimeOffPolicyVM } from '../../../pages/time-off/time-off-settings/time-off-settings.component';

@Component({
	selector: 'ngx-time-off-settings-mutation',
	templateUrl: './time-off-settings-mutation.component.html',
	styleUrls: ['../time-off-mutation.components.scss']
})
export class TimeOffSettingsMutationComponent implements OnInit, OnDestroy {
	constructor(
		protected dialogRef: NbDialogRef<TimeOffSettingsMutationComponent>,
		private employeesService: EmployeesService,
		private store: Store
	) {}

	private _ngDestroy$ = new Subject<void>();

	@Input()
	team?: OrganizationTeam;

	policy: TimeOffPolicyVM;
	organizationId: string;
	selectedEmployees: string[] = [];
	employees: Employee[] = [];
	name: string;
	requiresApproval: boolean;
	paid: boolean;
	showWarning = false;

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				this.organizationId = org.id;
			});

		this.loadEmployees();
		this._initializeForm();
	}

	private async loadEmployees() {
		if (!this.organizationId) {
			return;
		}
		const { items } = await this.employeesService
			.getAll(['user'], { organization: { id: this.organizationId } })
			.pipe(first())
			.toPromise();

		this.employees = items;

		if (this.policy) {
			this.policy.employees.forEach((employee) => {
				this.selectedEmployees.push(employee.id);
			});
		}
	}

	private _initializeForm() {
		if (this.policy) {
			this.name = this.policy.name;
			this.paid = this.policy.paid;
			this.requiresApproval = this.policy.requiresApproval;
		} else {
			this.name = '';
			this.paid = true;
			this.requiresApproval = false;
		}
	}

	addOrEditPolicy() {
		if (this.name && this.selectedEmployees) {
			this.dialogRef.close({
				name: this.name,
				organizationId: this.organizationId,
				employees: this.selectedEmployees,
				requiresApproval: this.requiresApproval,
				paid: this.paid
			});
		} else {
			this.showWarning = true;
			setTimeout(() => {
				this.closeWarning();
			}, 3000);
		}
	}

	onEmployeesSelected(employees: string[]) {
		this.selectedEmployees = employees;
	}

	changeRequiresApproval(checked: boolean) {
		this.requiresApproval = checked;
	}

	changePaidStatus(checked: boolean) {
		this.paid = checked;
	}

	closeWarning() {
		this.showWarning = !this.showWarning;
	}

	close() {
		this.dialogRef.close();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
		clearTimeout();
	}
}
