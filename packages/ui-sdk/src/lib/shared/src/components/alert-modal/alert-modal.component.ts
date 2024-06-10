import { Component, Input, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

export interface AlertModalOptions {
	title?: string;
	message?: string;
	status?: string;
}

@Component({
	selector: 'ga-alert-modal',
	templateUrl: './alert-modal.component.html',
	styleUrls: ['./alert-modal.component.scss']
})
export class AlertModalComponent implements OnInit {
	@Input() public data: AlertModalOptions;

	constructor(private readonly dialogRef: NbDialogRef<AlertModalComponent>) {}

	ngOnInit(): void {}

	/**
	 * Closes the dialog and returns the provided value.
	 *
	 * @param {any} val - The value to be returned when the dialog is closed.
	 * @return {void} This function does not return a value.
	 */
	closeDialog(val: string): void {
		// will return 'no' or 'yes'
		this.dialogRef.close(val);
	}
}
