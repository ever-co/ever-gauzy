import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { NbToastrService } from '@nebular/theme';

@Component({
	templateUrl: './pick-employee.component.html',
	styleUrls: ['pick-employee.component.scss']
})
export class PickEmployeeComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	@ViewChild('employeeSelector')
	employeeSelector: EmployeeSelectorComponent;
	loading: boolean = true;

	constructor(
		private router: Router,
		private toastrService: NbToastrService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		setTimeout(() => (this.loading = false), 250);
	}

	bookAppointment() {
		const selectedEmployee = this.employeeSelector.selectedEmployee.id;
		if (selectedEmployee) {
			this.router.navigate([`/share/employee/${selectedEmployee}`]);
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
