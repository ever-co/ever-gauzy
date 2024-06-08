import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { Store } from '@gauzy/ui-sdk/common';
import { EventTypeService, ToastrService } from '@gauzy/ui-sdk/core';
import { filter } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: '<ga-pick-employee>',
	templateUrl: './pick-employee.component.html',
	styleUrls: ['pick-employee.component.scss']
})
export class PickEmployeeComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectorComponent;
	loading: boolean;
	_selectedOrganizationId: string;

	constructor(
		private router: Router,
		private toastrService: ToastrService,
		readonly translateService: TranslateService,
		private eventTypeService: EventTypeService,
		private store: Store
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
