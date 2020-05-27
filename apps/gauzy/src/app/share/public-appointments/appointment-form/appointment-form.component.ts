import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { Subject } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

@Component({
	templateUrl: './appointment-form.component.html',
})
export class AppointmentFormComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	loading: boolean;

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit(): void {}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
