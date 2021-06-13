import { Component, OnInit, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
export interface AlertDialogOptions {
	title?: string;
	message?: string;
	status?: string;
}
@Component({
	selector: 'ngx-alert',
	templateUrl: './alert.component.html',
	styleUrls: ['./alert.component.scss']
})
export class AlertComponent implements OnInit {
	@Input() data: AlertDialogOptions;

	constructor(private dialogRef: NbDialogRef<AlertComponent>) {}

	ngOnInit() {}

	dismiss() {
		this.dialogRef.close();
	}
}
