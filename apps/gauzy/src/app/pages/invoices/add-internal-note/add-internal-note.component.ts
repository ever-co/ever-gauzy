import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { IInvoice } from '@gauzy/models';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { InvoicesService } from '../../../@core/services/invoices.service';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { InvoiceEmailMutationComponent } from '../invoice-email/invoice-email-mutation.component';

@Component({
	selector: 'ga-add-internal-note',
	templateUrl: './add-internal-note.component.html',
	styleUrls: ['./add-internal-note.component.scss']
})
export class AddInternalNoteComponent
	extends TranslationBaseComponent
	implements OnInit {
	invoice: IInvoice;
	form: FormGroup;

	constructor(
		readonly translateService: TranslateService,
		protected dialogRef: NbDialogRef<InvoiceEmailMutationComponent>,
		private fb: FormBuilder,
		private toastrService: NbToastrService,
		private invoiceService: InvoicesService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.initializeForm();
	}

	initializeForm() {
		this.form = this.fb.group({
			internalNote: [this.invoice.internalNote]
		});
	}

	async addNote() {
		await this.invoiceService.update(this.invoice.id, {
			internalNote: this.form.value.internalNote
		});
		this.toastrService.primary(
			this.getTranslation('INVOICES_PAGE.INTERNAL_NOTE.NOTE_SAVED'),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
		this.dialogRef.close();
	}

	cancel() {
		this.dialogRef.close();
	}
}
