import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { IEventType } from '@gauzy/models';

@Component({
	templateUrl: './appointment-form.component.html'
})
export class AppointmentFormComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	loading: boolean;
	selectedRange: { start: Date; end: Date };
	selectedEventType: IEventType;
	allowedDuration: Number;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {
		this.selectedRange = {
			start: history.state.dateStart,
			end: history.state.dateEnd
		};

		this.selectedEventType = history.state.selectedEventType;

		if (this.selectedEventType) {
			this.allowedDuration =
				this.selectedEventType.durationUnit === 'Day(s)'
					? this.selectedEventType.duration * 24 * 60
					: this.selectedEventType.durationUnit === 'Hour(s)'
					? this.selectedEventType.duration * 60
					: this.selectedEventType.duration * 1;
		} else {
			history.go(-1);
		}
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
