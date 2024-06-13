import { Component, OnInit } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { IImageAsset } from '@gauzy/contracts';

@Component({
	selector: 'ga-attach-receipt',
	templateUrl: './attach-receipt.component.html',
	styleUrls: ['./attach-receipt.component.scss']
})
export class AttachReceiptComponent implements OnInit {
	constructor(private dialogRef: NbDialogRef<AttachReceiptComponent>) { }

	imageUrl: string;
	currentReceipt: string;
	hoverState: boolean;
	disable = true;

	ngOnInit() {
		this.imageUrl = this.currentReceipt;
	}

	/**
	 * Upload attach receipt
	 *
	 * @param image
	 */
	updateImageAsset(image: IImageAsset) {
		try {
			if (image && image.id) {
				this.imageUrl = image.fullUrl;
				this.disable = false;
			}
		} catch (error) {
			console.log('Error while uploading attach receipt');
		}
	}

	saveReceipt() {
		this.dialogRef.close(this.imageUrl);
	}

	cancelReceipt() {
		this.dialogRef.close(this.currentReceipt);
	}
}
