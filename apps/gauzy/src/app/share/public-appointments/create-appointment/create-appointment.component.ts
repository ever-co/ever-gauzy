import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { Employee, IEventType } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { takeUntil } from 'rxjs/operators';
import { EmployeesService } from '../../../@core/services';
import { EventTypeService } from '../../../@core/services/event-type.service';
import { AppointmentComponent } from '../../../pages/employees/appointment/appointment.component';

@Component({
	templateUrl: './create-appointment.component.html',
	styleUrls: ['../public-appointments.component.scss'],
})
export class CreateAppointmentComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	employee: Employee;
	eventType: IEventType;
	loading = true;
	public appointmentFormURL: string;

	@ViewChild('appointmentCalendar')
	appointmentCalendar: AppointmentComponent;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private employeeService: EmployeesService,
		private eventTypeService: EventTypeService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (params) => {
				try {
					this.employee = await this.employeeService.getEmployeeById(
						params.id,
						['user']
					);
					this.eventType = await this.eventTypeService.getEventTypeById(
						params.eventId
					);
					this.loading = false;
					this.appointmentFormURL = `/share/employee/${params.id}/create-appointment`;
				} catch (error) {
					await this.router.navigate(['/share/404']);
				}
			});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
