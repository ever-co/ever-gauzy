import { Component } from '@angular/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { OnInit } from '@angular/core';
import { IInvoice, InvoiceStatusTypesEnum, IInvoiceItem } from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { InvoiceEstimateHistoryService, InvoicesService, Store, ToastrService } from '@gauzy/ui-core/core';

@Component({
    selector: 'ga-invoice-email',
    templateUrl: './invoice-email-mutation.component.html',
    styleUrls: ['./invoice-email-mutation.component.scss'],
    standalone: false
})
export class InvoiceEmailMutationComponent extends TranslationBaseComponent implements OnInit {
	invoice: IInvoice;
	form: UntypedFormGroup;
	isEstimate: boolean;
	invoiceItems: IInvoiceItem[];
	createdInvoice: IInvoice;

	constructor(
		public readonly translateService: TranslateService,
		protected readonly dialogRef: NbDialogRef<InvoiceEmailMutationComponent>,
		private readonly fb: UntypedFormBuilder,
		private readonly toastrService: ToastrService,
		private readonly invoiceService: InvoicesService,
		private readonly store: Store,
		private readonly invoiceEstimateHistoryService: InvoiceEstimateHistoryService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.initializeForm();
	}

	initializeForm() {
		this.form = this.fb.group({
			email: ['', Validators.required]
		});
	}

	async sendEmail() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.invoice.fromOrganization;
		const { email } = this.form.value;

		await this.invoiceService.sendEmail(
			email,
			this.invoice.invoiceNumber,
			this.invoice.id ? this.invoice.id : this.createdInvoice.id,
			this.isEstimate,
			organizationId,
			tenantId
		);

		if (this.invoice.id) {
			await this.invoiceService.updateAction(this.invoice.id, {
				status: InvoiceStatusTypesEnum.SENT
			});
		}

		await this.invoiceEstimateSendHistory();

		this.toastrService.success('INVOICES_PAGE.EMAIL.EMAIL_SENT');
		this.dialogRef.close('ok');
	}

	async invoiceEstimateSendHistory() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization;

		await this.invoiceEstimateHistoryService.add({
			action: this.isEstimate
				? this.getTranslation('INVOICES_PAGE.ESTIMATE_SENT_TO', {
						name: this.form.value.email
				  })
				: this.getTranslation('INVOICES_PAGE.INVOICE_SENT_TO', {
						name: this.form.value.email
				  }),
			invoice: this.createdInvoice ? this.createdInvoice : this.invoice,
			invoiceId: this.createdInvoice ? this.createdInvoice.id : this.invoice.id,
			user: this.store.user,
			userId: this.store.userId,
			organization: this.invoice.fromOrganization,
			organizationId,
			tenantId
		});
	}

	cancel() {
		this.dialogRef.close();
	}
}
