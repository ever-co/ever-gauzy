import { Component, Input } from '@angular/core';
import { NbDialogRef, NbCardModule, NbButtonModule } from '@nebular/theme';
import { TranslatePipe } from '@ngx-translate/core';

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
    imports: [NbCardModule, NbButtonModule, TranslatePipe]
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
