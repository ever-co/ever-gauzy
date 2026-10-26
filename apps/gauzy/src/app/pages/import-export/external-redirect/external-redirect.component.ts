import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ngx-external-redirect',
    template: '',
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ExternalRedirectComponent implements OnInit {
	constructor() {}

	ngOnInit() {
		console.log('Redirecting to external URL');
	}
}
