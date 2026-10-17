import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Location } from '@angular/common';

@Component({
    selector: 'ngx-back-navigation',
    templateUrl: './back-navigation.component.html',
    styleUrls: ['./back-navigation.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class BackNavigationComponent implements OnInit {
	@Input() haveLink = false;

	constructor(private readonly location: Location) {}

	ngOnInit() {}

	goBack() {
		if (!this.haveLink) this.location.back();
	}
}
