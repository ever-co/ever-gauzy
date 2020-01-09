import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';

@Component({
	selector: 'ga-attach-receipt',
	templateUrl: './attach-receipt.component.html',
	styleUrls: ['./attach-receipt.component.scss']
})
export class AttachReceiptComponent implements OnInit {
	constructor(private dialogRef: NbDialogRef<AttachReceiptComponent>) {}

	imageUrl: string;
	currentReceipt: string;
	disable = true;

	ngOnInit() {
		this.imageUrl = this.currentReceipt;
	}

	updateImageUrl(url: string) {
		this.imageUrl = url;
		this.disable = false;
	}

	saveReceipt() {
		this.dialogRef.close(this.imageUrl);
	}

	cancelReceipt() {
		this.dialogRef.close(this.currentReceipt);
	}
}
