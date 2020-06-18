import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

export interface AlertOptions {
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
	alertOptions: AlertOptions;
	constructor(private dialogRef: NbDialogRef<AlertModalComponent>) {}

	ngOnInit(): void {}

	closeDialog(val) {
		// will return 'no' or 'yes'
		this.dialogRef.close(val);
	}
}
