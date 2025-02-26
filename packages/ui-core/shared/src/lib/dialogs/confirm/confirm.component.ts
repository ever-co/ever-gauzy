import { Component, OnInit, Input } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { AlertComponent } from '../alert/alert.component';

export interface ConfirmDialogOptions {
	title?: string;
	message?: string;
	yesText?: string;
	noText?: string;
}

@Component({
    selector: 'ngx-confirm',
    templateUrl: './confirm.component.html',
    styleUrls: ['./confirm.component.scss'],
    standalone: false
})
export class ConfirmComponent implements OnInit {
	@Input() data: ConfirmDialogOptions;

	constructor(private readonly dialogRef: NbDialogRef<AlertComponent>) {}

	ngOnInit() {}

	close(confirm: boolean = false) {
		this.dialogRef.close(confirm);
	}
}
