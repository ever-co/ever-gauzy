import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { IEmployee, IEventType } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { EmployeesService, EventTypeService } from '@gauzy/ui-core/core';
import { AppointmentComponent } from '../../../pages/employees/appointment/appointment.component';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './create-appointment.component.html',
	styleUrls: ['../public-appointments.component.scss'],
	providers: [EventTypeService]
})
export class CreateAppointmentComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	employee: IEmployee;
	eventType: IEventType;
	loading: boolean = true;
	public appointmentFormURL: string;

	@ViewChild('appointmentCalendar')
	appointmentCalendar: AppointmentComponent;

	constructor(
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly employeeService: EmployeesService,
		private readonly eventTypeService: EventTypeService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.route.params.pipe(untilDestroyed(this)).subscribe(async (params) => {
			try {
				if (!params.id) {
					return;
				}

				this.employee = await firstValueFrom(this.employeeService.getEmployeeById(params.id, ['user']));
				this.eventType = await this.eventTypeService.getEventTypeById(params.eventId);
				this.loading = false;
				this.appointmentFormURL = `/share/employee/${params.id}/create-appointment`;
			} catch (error) {
				await this.router.navigate(['/share/404']);
			}
		});
	}

	ngOnDestroy() {}
}
