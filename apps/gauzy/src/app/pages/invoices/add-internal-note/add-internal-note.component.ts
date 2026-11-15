import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
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
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AddInternalNoteComponent extends TranslationBaseComponent implements OnInit {
	invoice: IInvoice;
	form: UntypedFormGroup;
	/** The note is being saved: the dialog cannot be cancelled meanwhile, or the list behind would miss it (#12011). */
	saving = false;
	/** The note was saved. */
	private saved = false;
	/** Ends with the save on its way, if any. */
	private _settled: Promise<void> = Promise.resolve();

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
		if (this.saving) {
			return;
		}
		this.saving = true;
		let settle = (): void => undefined;
		this._settled = new Promise<void>((resolve) => (settle = resolve));
		try {
			await this.invoiceService.updateAction(this.invoice.id, {
				internalNote: this.form.value.internalNote
			});
			this.saved = true;
			this.toastrService.success('INVOICES_PAGE.INTERNAL_NOTE.NOTE_SAVED');
			// The list behind it refreshes only on this answer, not on a cancel
			this.dialogRef.close(true);
		} finally {
			this.saving = false;
			settle();
		}
	}

	/**
	 * Whether the note was saved, once a save on its way has ended. Escape and the backdrop close the dialog
	 * without an answer, even mid-save: the list behind asks this instead (#12011).
	 */
	async changed(): Promise<boolean> {
		await this._settled;
		return this.saved;
	}

	cancel() {
		this.dialogRef.close();
	}
}
