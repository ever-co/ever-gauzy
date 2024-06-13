import { Component, Input, OnInit } from '@angular/core';
import { progressStatus } from '@gauzy/ui-sdk/common';
import { NbComponentOrCustomStatus } from '@nebular/theme';

@Component({
	selector: 'ngx-progress-status',
	templateUrl: './progress-status.component.html',
	styleUrls: ['./progress-status.component.scss']
})
export class ProgressStatusComponent implements OnInit {
	progressStatus = progressStatus;

	/*
	 * Getter & Setter for Percentage
	 */
	private _percentage: any;
	get percentage(): boolean {
		return this._percentage;
	}
	@Input() set percentage(value: boolean) {
		this._percentage = value;
	}

	/*
	 * Getter & Setter for NbComponentOrCustomStatus
	 */
	private _defaultStatus: NbComponentOrCustomStatus;
	get defaultStatus(): NbComponentOrCustomStatus {
		return this._defaultStatus;
	}
	@Input() set defaultStatus(value: NbComponentOrCustomStatus) {
		this._defaultStatus = value;
	}

	constructor() {}

	ngOnInit(): void {}
}
