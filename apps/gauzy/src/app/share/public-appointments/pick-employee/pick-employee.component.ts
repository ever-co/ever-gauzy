import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { Store } from '@gauzy/ui-sdk/common';
import { EventTypeService, ToastrService } from '@gauzy/ui-sdk/core';
import { EmployeeSelectorComponent } from '@gauzy/ui-sdk/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: '<ga-pick-employee>',
	templateUrl: './pick-employee.component.html',
	styleUrls: ['pick-employee.component.scss']
})
export class PickEmployeeComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public loading: boolean;
	public _selectedOrganizationId: string;

	@ViewChild('employeeSelector') employeeSelector: EmployeeSelectorComponent;

	constructor(
		public readonly translateService: TranslateService,
		private readonly router: Router,
		private readonly toastrService: ToastrService,
		private readonly eventTypeService: EventTypeService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.loading = true;
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((org) => {
				this._selectedOrganizationId = org.id;
				this.loading = false;
			});
	}

	async bookAppointment() {
		const selectedEmployee = this.employeeSelector.selectedEmployee.id;
		if (selectedEmployee) {
			let { items } = await this.eventTypeService.getAll(['employee', 'employee.user', 'tags'], {
				employee: {
					id: selectedEmployee
				},
				isActive: true
			});

			if (items.length === 0) {
				const { tenantId } = this.store.user;
				items = (
					await this.eventTypeService.getAll(['tags'], {
						organizationId: this._selectedOrganizationId,
						tenantId,
						isActive: true
					})
				).items;
			}

			if (items.length === 1) {
				this.router.navigate([`/share/employee/${selectedEmployee}/${items[0].id}`]);
			} else {
				this.router.navigate([`/share/employee/${selectedEmployee}`]);
			}
		} else {
			this.toastrService.danger(this.getTranslation('PUBLIC_APPOINTMENTS.SELECT_EMPLOYEE_ERROR'));
		}
	}

	ngOnDestroy() {}
}
