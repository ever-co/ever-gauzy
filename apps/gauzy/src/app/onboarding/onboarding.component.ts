import { Component, OnDestroy, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';

@Component({
	selector: 'ga-onboarding',
	template: `
		<nb-layout windowMode>
			<ngx-theme-settings></ngx-theme-settings>
			<nb-layout-column>
				<router-outlet></router-outlet>
			</nb-layout-column>
		</nb-layout>
	`
})
export class OnboardingComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	constructor(private translate: TranslateService) {}

	async ngOnInit() {}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
