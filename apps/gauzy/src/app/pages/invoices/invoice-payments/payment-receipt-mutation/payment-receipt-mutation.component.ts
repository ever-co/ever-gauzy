import { Component, ChangeDetectionStrategy } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { PaymentService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { IInvoice, IPayment } from '@gauzy/contracts';

@Component({
    selector: 'ga-payment-receipt-mutation',
    templateUrl: './payment-receipt-mutation.component.html',
    styleUrls: ['../payment-mutation/payment-mutation.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class InvoicePaymentReceiptMutationComponent extends TranslationBaseComponent {
	constructor(
		readonly translateService: TranslateService,
		private paymentService: PaymentService,
		protected dialogRef: NbDialogRef<InvoicePaymentReceiptMutationComponent>
	) {
		super(translateService);
	}
	invoice: IInvoice;
	payment: IPayment;

	/**
	 * Sends the receipt, then closes with what the send answered — `true` sent, `false` the mail could not be sent or
	 * the request was refused — so the page that opened the dialog can say which.
	 */
	async send() {
		try {
			const sent = await this.paymentService.sendReceipt(this.payment, this.invoice);
			this.dialogRef.close(sent !== false);
		} catch {
			this.dialogRef.close(false);
		}
	}

	cancel() {
		this.dialogRef.close();
	}
}
