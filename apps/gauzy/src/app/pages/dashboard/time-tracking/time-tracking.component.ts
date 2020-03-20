import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';

@Component({
	selector: 'ga-time-tracking',
	templateUrl: './time-tracking.component.html'
})
export class TimeTrackingComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	constructor() {}

	async ngOnInit() {}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
