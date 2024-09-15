import { AfterViewInit, Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
	selector: 'ngx-not-found',
	styleUrls: ['./not-found.component.scss'],
	templateUrl: './not-found.component.html'
})
export class NotFoundComponent implements AfterViewInit {
	constructor(private readonly router: Router) {}

	/**
	 * After view init
	 */
	ngAfterViewInit() {
		setTimeout(() => this.goToHome(), 3000);
	}

	/**
	 * Redirect to home page
	 */
	goToHome() {
		this.router.navigate(['/pages/dashboard']);
	}
}
