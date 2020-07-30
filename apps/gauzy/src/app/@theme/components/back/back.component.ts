import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { Location } from '@angular/common';

@Component({
	selector: 'ga-back-selector',
	templateUrl: './back.component.html'
})
export class BackComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	constructor(private location: Location) {}

	ngOnInit() {}

	goBack() {
		this.location.back();
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
