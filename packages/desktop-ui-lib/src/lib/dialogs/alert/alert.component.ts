import { Component, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

export interface AlertDialogOptions {
	title?: string;
	message?: string;
	status?: string;
	confirmText?: string;
	dismissText?: string;
}
@Component({
	selector: 'ngx-alert',
	templateUrl: './alert.component.html',
	styleUrls: ['./alert.component.scss'],
	standalone: false
})
export class AlertComponent {
	@Input() data: AlertDialogOptions;

	constructor(private dialogRef: NbDialogRef<AlertComponent>) {}

	public confirm() {
		this.dialogRef.close(true);
	}

	public dismiss() {
		this.dialogRef.close(false);
	}
}
