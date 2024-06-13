import { Component } from '@angular/core';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { PaymentService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { IInvoice, IPayment } from '@gauzy/contracts';

@Component({
	selector: 'ga-payment-receipt-mutation',
	templateUrl: './payment-receipt-mutation.component.html',
	styleUrls: ['../payment-mutation/payment-mutation.component.scss']
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

	async send() {
		await this.paymentService.sendReceipt(this.payment, this.invoice);
	}

	cancel() {
		this.dialogRef.close();
	}
}
