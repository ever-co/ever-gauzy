import { Component, OnInit } from '@angular/core';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { Invoice, CurrenciesEnum, Payment } from '@gauzy/models';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { PaymentService } from '../../../../@core/services/payment.service';
import { Store } from '../../../../@core/services/store.service';

@Component({
	selector: 'ga-payment-add',
	templateUrl: './payment-mutation.component.html',
	styleUrls: ['./payment-mutation.component.scss']
})
export class PaymentMutationComponent extends TranslationBaseComponent
	implements OnInit {
	constructor(
		readonly translateService: TranslateService,
		private fb: FormBuilder,
		protected dialogRef: NbDialogRef<PaymentMutationComponent>,
		private paymentService: PaymentService,
		private store: Store,
		private toastrService: NbToastrService
	) {
		super(translateService);
	}

	invoice: Invoice;
	payment: Payment;
	form: FormGroup;
	currencies = Object.values(CurrenciesEnum);
	get currency() {
		return this.form.get('currency');
	}

	ngOnInit() {
		this.initializeForm();
		if (this.currency && !this.currency.value) {
			this.currency.setValue(this.invoice.currency);
		}
		this.form.get('currency').disable();
	}

	initializeForm() {
		if (this.payment) {
			this.form = this.fb.group({
				amount: [
					this.payment.amount,
					Validators.compose([Validators.required, Validators.min(1)])
				],
				currency: [this.payment.currency, Validators.required],
				paymentDate: [
					new Date(this.payment.paymentDate),
					Validators.required
				],
				note: [this.payment.note, Validators.required]
			});
		} else {
			this.form = this.fb.group({
				amount: [
					'',
					Validators.compose([Validators.required, Validators.min(1)])
				],
				currency: ['', Validators.required],
				paymentDate: ['', Validators.required],
				note: ['', Validators.required]
			});
		}
	}

	async addPayment() {
		const paymentData = this.form.value;
		await this.paymentService.add({
			amount: paymentData.amount,
			paymentDate: paymentData.paymentDate,
			note: paymentData.note,
			currency: this.currency.value,
			invoice: this.invoice,
			invoiceId: this.invoice.id,
			organizationId: this.invoice.organizationId,
			recordedBy: this.store.user,
			userId: this.store.userId
		});

		this.toastrService.primary(
			this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_ADD'),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
		this.dialogRef.close();
	}

	async editPayment() {
		const paymentData = this.form.value;
		await this.paymentService.update(this.payment.id, {
			amount: paymentData.amount,
			paymentDate: paymentData.paymentDate,
			note: paymentData.note,
			currency: this.currency.value
		});

		this.toastrService.primary(
			this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_EDIT'),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
		this.dialogRef.close();
	}

	cancel() {
		this.dialogRef.close();
	}
}
