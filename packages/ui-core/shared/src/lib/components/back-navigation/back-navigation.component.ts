import { Component, Input } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

@Component({
	selector: 'ngx-back-navigation',
	templateUrl: './back-navigation.component.html',
	styleUrls: ['./back-navigation.component.scss'],
	standalone: false
})
export class BackNavigationComponent {
	@Input() haveLink = false;
	@Input() link: string;

	constructor(private readonly location: Location, private readonly router: Router) {}

	goBack() {
		if (this.link) {
			this.router.navigateByUrl(this.link);
		} else if (!this.haveLink) {
			this.location.back();
		}
	}
}
