import { Component, OnInit } from '@angular/core';

@Component({
	selector: 'gauzy-root',
	template: '<router-outlet></router-outlet>',
})
export class AppComponent implements OnInit {
	constructor() {}

	ngOnInit(): void {
		console.log('on init');
	}
}
