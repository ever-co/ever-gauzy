import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { IEventType, Employee } from '@gauzy/models';
import { takeUntil } from 'rxjs/operators';
import { EmployeesService } from '../../../@core/services';

@Component({
	templateUrl: './appointment-form.component.html'
})
export class AppointmentFormComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	loading: boolean = true;
	selectedRange: { start: Date; end: Date };
	selectedEventType: IEventType;
	allowedDuration: Number;
	employee: Employee;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private employeeService: EmployeesService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.selectedRange = {
			start: history.state.dateStart,
			end: history.state.dateEnd
		};

		this.route.params
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (params) => {
				try {
					this.employee = await this.employeeService.getEmployeeById(
						params.employeeid,
						['user']
					);

					this.selectedEventType = history.state.selectedEventType;

					if (this.selectedEventType) {
						this.allowedDuration =
							this.selectedEventType.durationUnit === 'Day(s)'
								? this.selectedEventType.duration * 24 * 60
								: this.selectedEventType.durationUnit ===
								  'Hour(s)'
								? this.selectedEventType.duration * 60
								: this.selectedEventType.duration * 1;

						this.loading = false;
					} else {
						history.go(-1);
					}
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
