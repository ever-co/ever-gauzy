import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { firstValueFrom, switchMap } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { IEventType, IEmployee } from '@gauzy/contracts';
import { EmployeesService } from '@gauzy/ui-core/core';

@UntilDestroy()
@Component({
	templateUrl: './appointment-form.component.html'
})
export class AppointmentFormComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public loading = true;
	public selectedRange: { start: Date; end: Date };
	public selectedEventType: IEventType;
	public allowedDuration: number;
	public employee: IEmployee;

	constructor(
		readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly employeeService: EmployeesService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.route.queryParams.subscribe((params) => {
			this.selectedRange = {
				start: params?.dateStart,
				end: params?.dateEnd
			};
		});

		this.route.params
			.pipe(
				switchMap(async (params) => {
					if (!params.id) return;

					try {
						// Get employee by ID
						this.employee = await firstValueFrom(this.employeeService.getEmployeeById(params.id, ['user']));

						this.selectedEventType = history.state.selectedEventType;
						if (this.selectedEventType) {
							this.allowedDuration = this.calculateAllowedDuration(this.selectedEventType);
							this.loading = false;
						} else {
							history.go(-1);
						}
					} catch (error) {
						console.log('Error while loading employee', error);
						await this.router.navigate(['/share/404']);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Calculate allowed duration in minutes
	 *
	 * @param eventType
	 * @returns
	 */
	private calculateAllowedDuration(eventType: any): number {
		switch (eventType.durationUnit) {
			case 'Day(s)':
				return eventType.duration * 24 * 60;
			case 'Hour(s)':
				return eventType.duration * 60;
			default:
				return eventType.duration * 1;
		}
	}

	ngOnDestroy() {}
}
