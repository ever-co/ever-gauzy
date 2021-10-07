import { Component, Input, OnInit } from '@angular/core';
import { progressStatus } from '@gauzy/common-angular';

@Component({
	selector: 'ngx-progress-status',
	templateUrl: './progress-status.component.html',
	styleUrls: ['./progress-status.component.scss']
})
export class ProgressStatusComponent implements OnInit {

	progressStatus = progressStatus;

	/*
	* Getter & Setter
	*/
	private _percentage: any;
	get percentage(): boolean {
		return this._percentage;
	}
	@Input() set percentage(value: boolean) {
		this._percentage = value;
	}

	constructor() {}

	ngOnInit(): void {}
}
