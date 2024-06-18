import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
	selector: 'ngx-not-found',
	styleUrls: ['./not-found.component.scss'],
	templateUrl: './not-found.component.html'
})
export class NotFoundComponent implements OnInit {
	constructor(private readonly router: Router) {}

	ngOnInit() {
		setTimeout(() => this.goToHome(), 3000);
	}

	goToHome() {
		this.router.navigate(['/pages/dashboard']);
	}
}
