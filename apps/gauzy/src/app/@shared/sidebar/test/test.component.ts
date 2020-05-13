import { Component, Input, OnInit } from '@angular/core';

@Component({
	selector: 'ga-test',
	templateUrl: './test.component.html'
})
export class TestComponent implements OnInit {
	constructor() {}
	@Input() childCategories?: any;
	ngOnInit() {
		console.log(this.childCategories);
	}
}
