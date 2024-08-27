import { Component, Input } from '@angular/core';
import { progressStatus } from '@gauzy/ui-core/common';
import { NbComponentOrCustomStatus } from '@nebular/theme';

export interface IProgressStatusDisplayValue {
	in?: boolean;
	out?: boolean;
}

@Component({
	selector: 'ngx-progress-status',
	templateUrl: './progress-status.component.html',
	styleUrls: ['./progress-status.component.scss']
})
export class ProgressStatusComponent {
	/*
	 * Getter & Setter for Percentage
	 */
	private _percentage: number = 0;
	get percentage(): number {
		return this._percentage;
	}
	@Input() set percentage(value: number) {
		this._percentage = value;
	}

	/*
	 * Getter & Setter for Percentage
	 */
	private _displayValue: IProgressStatusDisplayValue = {
		in: false,
		out: true
	};
	get displayValue(): IProgressStatusDisplayValue {
		return this._displayValue;
	}
	@Input() set displayValue(value: IProgressStatusDisplayValue) {
		this._displayValue = value;
	}

	/*
	 * Getter & Setter for NbComponentOrCustomStatus
	 */
	private _defaultStatus: NbComponentOrCustomStatus = 'success';
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
