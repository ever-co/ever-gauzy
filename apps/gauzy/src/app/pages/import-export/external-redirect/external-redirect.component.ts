import { Component, OnInit } from '@angular/core';

@Component({
	selector: 'ngx-external-redirect',
	template: ''
})
export class ExternalRedirectComponent implements OnInit {
	constructor() {}

	ngOnInit() {
		console.log('Redirecting to external URL');
	}
}
