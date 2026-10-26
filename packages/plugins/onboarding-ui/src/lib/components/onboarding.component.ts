import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ga-onboarding',
    template: `
		<nb-layout windowMode>
			<ngx-theme-settings></ngx-theme-settings>
			<nb-layout-column>
				<router-outlet></router-outlet>
			</nb-layout-column>
		</nb-layout>
	`,
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class OnboardingComponent {}
