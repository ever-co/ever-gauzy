import { Component, OnInit, Input, ChangeDetectionStrategy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

export interface AlertDialogOptions {
	title?: string;
	message?: string;
	closeText?: string;
}

@Component({
    selector: 'ngx-alert',
    templateUrl: './alert.component.html',
    styleUrls: ['./alert.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AlertComponent implements OnInit {
	@Input() data: AlertDialogOptions;

	constructor(private readonly dialogRef: NbDialogRef<AlertComponent>) {}

	ngOnInit() {}

	/**
	 * Closes the dialog.
	 *
	 * @return {void} No return value.
	 */
	closeDialog(): void {
		this.dialogRef.close();
	}
}
