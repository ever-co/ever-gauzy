import { Component } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { OnInit } from '@angular/core';
import {
	IInvoice,
	InvoiceStatusTypesEnum,
	IInvoiceItem
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { NbDialogRef } from '@nebular/theme';
import { InvoicesService } from '../../../@core/services/invoices.service';
import { Store } from '../../../@core/services/store.service';
import { InvoiceEstimateHistoryService } from '../../../@core/services/invoice-estimate-history.service';
import { InvoiceItemService } from '../../../@core/services/invoice-item.service';
import { ToastrService } from '../../../@core/services/toastr.service';

@Component({
	selector: 'ga-invoice-email',
	templateUrl: './invoice-email-mutation.component.html'
})
export class InvoiceEmailMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
	invoice: IInvoice;
	form: FormGroup;
	isEstimate: boolean;
	saveAndSend: boolean;
	invoiceItems: IInvoiceItem[];
	createdInvoice: IInvoice;

	constructor(
		public readonly translateService: TranslateService,
		protected readonly dialogRef: NbDialogRef<InvoiceEmailMutationComponent>,
		private readonly fb: FormBuilder,
		private readonly toastrService: ToastrService,
		private readonly invoiceService: InvoicesService,
		private readonly store: Store,
		private readonly invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private readonly invoicesService: InvoicesService,
		private readonly invoiceItemService: InvoiceItemService
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
		const { id: organizationId, tenantId } = this.invoice.fromOrganization;
		if (this.saveAndSend) {
			const createdInvoice = await this.invoicesService.add(this.invoice);
			this.createdInvoice = createdInvoice;
			this.invoiceItemService
				.createBulk(createdInvoice.id, this.invoiceItems)
				.then(async () => {
					await this.createInvoiceEstimateHistory();
				});
		}

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
			await this.invoiceService.update(this.invoice.id, {
				status: InvoiceStatusTypesEnum.SENT
			});
		}

		await this.invoiceEstimateSendHistory();

		this.toastrService.success('INVOICES_PAGE.EMAIL.EMAIL_SENT');
		this.dialogRef.close('ok');
	}

	async createInvoiceEstimateHistory() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization;

		await this.invoiceEstimateHistoryService.add({
			action: this.isEstimate
				? this.getTranslation('INVOICES_PAGE.INVOICES_ADD_ESTIMATE')
				: this.getTranslation('INVOICES_PAGE.INVOICES_ADD_INVOICE'),
			invoice: this.createdInvoice,
			invoiceId: this.createdInvoice.id,
			user: this.store.user,
			userId: this.store.userId,
			organization: this.invoice.fromOrganization,
			organizationId,
			tenantId
		});
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
			invoiceId: this.createdInvoice
				? this.createdInvoice.id
				: this.invoice.id,
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
