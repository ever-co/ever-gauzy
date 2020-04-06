import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
	selector: 'ga-onboarding-complete',
	templateUrl: './onboarding-complete.component.html',
	styleUrls: ['./onboarding-complete.component.scss']
})
export class OnboardingCompleteComponent {
	constructor(private router: Router) {}

	navigateTo(url: string) {
		this.router.navigate([url]);
	}
}
