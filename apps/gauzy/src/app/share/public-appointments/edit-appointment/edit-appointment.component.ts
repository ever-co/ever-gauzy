import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { EmployeeAppointmentService } from '../../../@core/services/employee-appointment.service';

@Component({
	templateUrl: './edit-appointment.component.html'
})
export class EditAppointmentComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	loading: boolean;
	appointmentID: string;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private employeeAppointmentService: EmployeeAppointmentService,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.route.queryParams.subscribe(async ({ token }) => {
			try {
				if (!token) throw new Error('token missing');
				this.appointmentID = await this.employeeAppointmentService.decodeToken(
					token
				);
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
