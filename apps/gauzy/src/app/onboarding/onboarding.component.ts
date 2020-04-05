import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { AuthService } from '../@core/services/auth.service';
import { Store } from '../@core/services/store.service';
import { takeUntil } from 'rxjs/operators';

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

	async ngOnInit() {
		let result = 'ORGANIZATIONS_PAGE.ORGANIZATIONS';
		this.translate
			.get('ORGANIZATIONS_PAGE.ORGANIZATIONS')
			.subscribe((res) => {
				result = res;
			});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
