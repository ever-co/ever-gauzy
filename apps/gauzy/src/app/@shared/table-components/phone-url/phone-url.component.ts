import { Component, Input } from '@angular/core';

@Component({
	selector: 'ga-phone-url',
	templateUrl: './phone-url.component.html',
	styleUrls: ['./phone-url.component.scss']
})
export class PhoneUrlComponent {

	@Input() value: string | number;
	@Input() rowData: any;

	constructor() { }
}
