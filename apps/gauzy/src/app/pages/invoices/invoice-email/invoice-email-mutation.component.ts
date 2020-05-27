import { Component } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { OnInit } from '@angular/core';
import { Invoice, OrganizationClients, Organization } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { InvoicesService } from '../../../@core/services/invoices.service';
import * as jspdf from 'jspdf';
import * as html2canvas from 'html2canvas';

@Component({
	selector: 'ga-invoice-email',
	templateUrl: './invoice-email-mutation.component.html',
})
export class InvoiceEmailMutationComponent extends TranslationBaseComponent
	implements OnInit {
	invoice: Invoice;
	client: OrganizationClients;
	organization: Organization;
	form: FormGroup;

	constructor(
		readonly translateService: TranslateService,
		protected dialogRef: NbDialogRef<InvoiceEmailMutationComponent>,
		private fb: FormBuilder,
		private invoicesService: InvoicesService,
		private toastrService: NbToastrService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.initializeForm();
	}

	initializeForm() {
		this.form = this.fb.group({
			email: ['', Validators.required],
		});
	}

	sendEmail() {
		const data = document.getElementsByClassName('contentToConvert')[0];
		(html2canvas as any)(data).then((canvas) => {
			const imgWidth = 102;
			const imgHeight = (canvas.height * imgWidth) / canvas.width;
			const contentDataURL = canvas.toDataURL('image/png');
			const pdf = new jspdf('p', 'mm', 'a4');
			pdf.addImage(contentDataURL, 'PNG', 0, 0, imgWidth, imgHeight);
			this.invoicesService.sendEmail(this.form.value.email);
		});
		this.toastrService.primary(
			this.getTranslation('INVOICES_PAGE.EMAIL.EMAIL_SENT'),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
		this.dialogRef.close();
	}

	cancel() {
		this.dialogRef.close();
	}
}
