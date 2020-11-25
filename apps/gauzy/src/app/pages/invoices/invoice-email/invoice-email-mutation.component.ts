import { Component } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { OnInit } from '@angular/core';
import { IInvoice, InvoiceStatusTypesEnum, IInvoiceItem } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { InvoicesService } from '../../../@core/services/invoices.service';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { Store } from '../../../@core/services/store.service';
import { InvoiceEstimateHistoryService } from '../../../@core/services/invoice-estimate-history.service';
import { InvoiceItemService } from '../../../@core/services/invoice-item.service';

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
	docDefinition: any;

	constructor(
		readonly translateService: TranslateService,
		protected dialogRef: NbDialogRef<InvoiceEmailMutationComponent>,
		private fb: FormBuilder,
		private toastrService: NbToastrService,
		private invoiceService: InvoicesService,
		private store: Store,
		private invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private invoicesService: InvoicesService,
		private invoiceItemService: InvoiceItemService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.initializeForm();
	}

	getDocDef(event) {
		this.docDefinition = event;
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
			this.invoiceItems.forEach(async (item) => {
				item['invoiceId'] = createdInvoice.id;
				await this.invoiceItemService.add(item);
			});
			await this.invoiceEstimateHistoryService.add({
				action: this.isEstimate ? 'Estimate added' : 'Invoice added',
				invoice: createdInvoice,
				invoiceId: createdInvoice.id,
				user: this.store.user,
				userId: this.store.userId,
				organization: this.invoice.fromOrganization,
				organizationId,
				tenantId
			});
		}
		pdfMake.vfs = pdfFonts.pdfMake.vfs;

		const pdfDocGenerator = pdfMake.createPdf(this.docDefinition);
		pdfDocGenerator.getBase64(async (data) => {
			await this.invoiceService.sendEmail(
				this.form.value.email,
				data,
				this.invoice.invoiceNumber,
				this.invoice.id ? this.invoice.id : this.createdInvoice.id,
				this.isEstimate,
				organizationId,
				tenantId
			);
		});

		if (this.invoice.id) {
			await this.invoiceService.update(this.invoice.id, {
				status: InvoiceStatusTypesEnum.SENT
			});
		}

		await this.invoiceEstimateHistoryService.add({
			action: this.isEstimate
				? `Estimate sent to ${this.form.value.email}`
				: `Invoice sent to ${this.form.value.email}`,
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

		this.toastrService.primary(
			this.getTranslation('INVOICES_PAGE.EMAIL.EMAIL_SENT'),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
		this.dialogRef.close('ok');
	}

	cancel() {
		this.dialogRef.close();
	}
}
