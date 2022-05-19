import { Component, Input, OnInit } from '@angular/core';
import { Location } from '@angular/common';

@Component({
	selector: 'ngx-back-navigation',
	templateUrl: './back-navigation.component.html',
	styleUrls: ['./back-navigation.component.scss']
})
export class BackNavigationComponent implements OnInit {
	@Input() haveLink = false;
	constructor(private location: Location) {}

	ngOnInit() {}

	goBack() {
		if (!this.haveLink) this.location.back();
	}
}
