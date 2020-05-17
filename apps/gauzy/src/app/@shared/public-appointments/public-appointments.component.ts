import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../language-base/translation-base.component';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';
import { TimeOff } from '@gauzy/models';
import { EmployeeAppointmentService } from '../../@core/services/employee-appointment.service';
import { TranslateService } from '@ngx-translate/core';
import { timeOff } from './test-data';
import { takeUntil } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';

@Component({
	selector: 'ga-public-appointments',
	templateUrl: './public-appointments.component.html'
})
export class PublicAppointmentsComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	timeOff: TimeOff[] = timeOff;

	constructor(
		private router: Router,
		private store: Store,
		private employeeAppointmentService: EmployeeAppointmentService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	private _loadAppointments() {
		const findObj = {
			employee: {
				id: this.store.selectedEmployee
					? this.store.selectedEmployee.id
					: null
			}
		};

		this.employeeAppointmentService
			.getAll(['employee', 'employee.user'], findObj)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((appointments) => {
				console.log(appointments);
			});
	}

	ngOnInit(): void {
		this._loadAppointments();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
