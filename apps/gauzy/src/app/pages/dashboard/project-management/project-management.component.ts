import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';

@Component({
	selector: 'ga-project-management',
	templateUrl: './project-management.component.html'
})
export class ProjectManagementComponent implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();

	constructor() {}

	async ngOnInit() {}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
