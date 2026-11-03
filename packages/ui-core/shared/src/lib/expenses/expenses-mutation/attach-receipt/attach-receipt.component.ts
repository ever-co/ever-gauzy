import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { IImageAsset } from '@gauzy/contracts';
import { toActualReceipt } from '../expense-receipt.utils';

/** The image types the upload endpoint accepts: SVG is refused there, so the picker does not offer it. */
export const RECEIPT_ACCEPT = '.png,.jpg,.jpeg,.gif,.webp,.bmp,image/png,image/jpeg,image/gif,image/webp,image/bmp';

/**
 * Attaches, replaces or removes an expense's receipt. Closes with the receipt to keep — the new one, `null`
 * once removed — or with the receipt it was opened on when cancelled.
 */
@Component({
	selector: 'ga-attach-receipt',
	templateUrl: './attach-receipt.component.html',
	styleUrls: ['./attach-receipt.component.scss'],
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class AttachReceiptComponent implements OnInit {
	constructor(private dialogRef: NbDialogRef<AttachReceiptComponent>) {}

	readonly accept = RECEIPT_ACCEPT;
	/** Lays the uploader's transparent file input over the area that should open the picker. */
	readonly pickerStyles = {
		position: 'absolute',
		inset: '0',
		width: '100%',
		height: '100%',
		opacity: '0',
		zIndex: 2,
		cursor: 'pointer'
	};

	/** The receipt the dialog was opened on. */
	currentReceipt: string;
	/** The receipt as it stands in the dialog: what Save keeps. */
	imageUrl: string | null = null;
	/** A file is being uploaded: the picker and Save wait for it. */
	uploading = false;
	/** Why the last upload failed, as the server said — or a key of the generic message. */
	error: string | null = null;
	/** The preview could not be loaded: the receipt is offered as a link instead. */
	previewBroken = false;

	ngOnInit() {
		// Without a receipt the dialog shows only the upload prompt, never the old sample invoice.
		this.imageUrl = toActualReceipt(this.currentReceipt);
	}

	/** Save is offered once the receipt differs from the one the dialog was opened on. */
	get changed(): boolean {
		return this.imageUrl !== toActualReceipt(this.currentReceipt);
	}

	onUploadStarted() {
		this.uploading = true;
		this.error = null;
	}

	/**
	 * Upload attach receipt
	 *
	 * @param image
	 */
	updateImageAsset(image: IImageAsset) {
		this.uploading = false;
		if (!image?.id || !(image.fullUrl || image.url)) {
			this.handleUploadError(null);
			return;
		}
		this.imageUrl = image.fullUrl || image.url;
		this.previewBroken = false;
		this.error = null;
	}

	/**
	 * Shows why the receipt could not be uploaded: the server's reason when it gave one (an unsupported file, a file
	 * too large), a generic message otherwise.
	 *
	 * @param error The error body the uploader emitted.
	 */
	handleUploadError(error: any) {
		this.uploading = false;
		const message = Array.isArray(error?.message) ? error.message.join(' ') : error?.message;
		this.error = message || 'EXPENSE_VIEW.RECEIPT_UPLOAD_FAILED';
	}

	/** Takes the receipt off the expense; Save keeps that. */
	removeReceipt() {
		this.imageUrl = null;
		this.previewBroken = false;
		this.error = null;
	}

	saveReceipt() {
		this.dialogRef.close(this.imageUrl);
	}

	cancelReceipt() {
		this.dialogRef.close(this.currentReceipt);
	}
}
