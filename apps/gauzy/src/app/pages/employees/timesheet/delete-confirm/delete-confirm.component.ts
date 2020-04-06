import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'ngx-delete-confirm',
	templateUrl: './delete-confirm.component.html',
	styleUrls: ['./delete-confirm.component.scss']
})
export class DeleteConfirmComponent implements OnInit {
	recordType: string;
	constructor(protected dialogRef: NbDialogRef<DeleteConfirmComponent>) {}

	close() {
		this.dialogRef.close();
	}

	delete() {
		this.dialogRef.close('ok');
	}

	ngOnInit() {}
}
