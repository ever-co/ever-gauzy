import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { filter, firstValueFrom, tap } from 'rxjs';
import { NbDialogRef } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IEmployee, IOrganization, IOrganizationTeam, ITimeOffPolicy } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-sdk/common';
import { EmployeesService } from '../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-time-off-settings-mutation',
	templateUrl: './time-off-settings-mutation.component.html',
	styleUrls: ['../time-off-mutation.components.scss']
})
export class TimeOffSettingsMutationComponent implements OnInit, OnDestroy {
	constructor(
		protected readonly dialogRef: NbDialogRef<TimeOffSettingsMutationComponent>,
		private readonly employeesService: EmployeesService,
		private readonly store: Store
	) {}

	@Input() team?: IOrganizationTeam;

	policy: ITimeOffPolicy;
	organizationId: string;
	selectedEmployees: string[] = [];
	employees: IEmployee[] = [];
	name: string;
	requiresApproval: boolean;
	paid: boolean;
	showWarning = false;
	organization: IOrganization;

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => {
					this.organization = organization;
					this.organizationId = organization.id;
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.loadEmployees();
		this._initializeForm();
	}

	private async loadEmployees() {
		if (!this.organizationId) {
			return;
		}
		const { items } = await firstValueFrom(
			this.employeesService.getAll(['user'], {
				organization: { id: this.organizationId },
				tenantId: this.organization.tenantId
			})
		);

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
				tenantId: this.organization.tenantId,
				employees: this.selectedEmployees,
				requiresApproval: this.requiresApproval,
				paid: this.paid
			});
		} else {
			this.showWarning = true;

			const timeoutId: NodeJS.Timeout = setTimeout(() => {
				this.closeWarning();
			}, 3000); // 3000 milliseconds, adjust as needed

			// Later, if you want to cancel the timeout
			clearTimeout(timeoutId);
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

	ngOnDestroy() {}
}
