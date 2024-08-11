import { Component, Input } from '@angular/core';
import { progressStatus } from '@gauzy/ui-core/common';
import { NbComponentOrCustomStatus } from '@nebular/theme';

@Component({
	selector: 'ngx-progress-status',
	templateUrl: './progress-status.component.html',
	styleUrls: ['./progress-status.component.scss']
})
export class ProgressStatusComponent {
	/*
	 * Getter & Setter for Percentage
	 */
	private _percentage: any;
	get percentage(): number {
		return this._percentage;
	}
	@Input() set percentage(value: number) {
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

	public progressStatus(percentage: number) {
		return progressStatus(percentage);
	}
}
