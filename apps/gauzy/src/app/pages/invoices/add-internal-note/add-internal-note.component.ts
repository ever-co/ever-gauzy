import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { IInvoice } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { InvoicesService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { InvoiceEmailMutationComponent } from '../invoice-email/invoice-email-mutation.component';
import { ToastrService } from '@gauzy/ui-core/core';

@Component({
    selector: 'ga-add-internal-note',
    templateUrl: './add-internal-note.component.html',
    styleUrls: ['./add-internal-note.component.scss'],
    standalone: false
})
export class AddInternalNoteComponent extends TranslationBaseComponent implements OnInit {
	invoice: IInvoice;
	form: UntypedFormGroup;

	constructor(
		readonly translateService: TranslateService,
		protected dialogRef: NbDialogRef<InvoiceEmailMutationComponent>,
		private fb: UntypedFormBuilder,
		private toastrService: ToastrService,
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
		await this.invoiceService.updateAction(this.invoice.id, {
			internalNote: this.form.value.internalNote
		});
		this.toastrService.success('INVOICES_PAGE.INTERNAL_NOTE.NOTE_SAVED');
		this.dialogRef.close();
	}

	cancel() {
		this.dialogRef.close();
	}
}
