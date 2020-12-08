import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { NbToastrService } from '@nebular/theme';
import { Store } from '../../../@core/services/store.service';
import { EventTypeService } from '../../../@core/services/event-type.service';
import { takeUntil } from 'rxjs/operators';

@Component({
	templateUrl: './pick-employee.component.html',
	styleUrls: ['pick-employee.component.scss']
})
export class PickEmployeeComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectorComponent;
	loading = true;
	_selectedOrganizationId: string;

	constructor(
		private router: Router,
		private toastrService: NbToastrService,
		readonly translateService: TranslateService,
		private eventTypeService: EventTypeService,
		private store: Store
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((org) => {
				if (org) {
					this._selectedOrganizationId = org.id;
				}
				setTimeout(() => (this.loading = false), 250);
			});
	}

	async bookAppointment() {
		const selectedEmployee = this.employeeSelector.selectedEmployee.id;
		if (selectedEmployee) {
			let { items } = await this.eventTypeService.getAll(
				['employee', 'employee.user', 'tags'],
				{
					employee: {
						id: selectedEmployee
					},
					isActive: true
				}
			);

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
				this.router.navigate([
					`/share/employee/${selectedEmployee}/${items[0].id}`
				]);
			} else {
				this.router.navigate([`/share/employee/${selectedEmployee}`]);
			}
		} else {
			this.toastrService.danger(
				this.getTranslation(
					'PUBLIC_APPOINTMENTS.SELECT_EMPLOYEE_ERROR'
				),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
