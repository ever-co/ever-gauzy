import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';

@Component({
	selector: 'ngx-back-navigation',
	templateUrl: './back-navigation.component.html',
	styleUrls: ['./back-navigation.component.scss']
})
export class BackNavigationComponent implements OnInit {
	constructor(private location: Location) {}

	ngOnInit() {}

	goBack() {
		this.location.back();
	}
}
