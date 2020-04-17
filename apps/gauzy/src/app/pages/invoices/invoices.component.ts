import { Component, OnInit, ViewChild } from '@angular/core';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { Invoice } from '@gauzy/models';
import { InvoicesService } from '../../@core/services/invoices.service';
import { InvoicesValueComponent } from './invoices-value.component';
import { Router } from '@angular/router';
import { first } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { InvoiceItemService } from '../../@core/services/invoice-item.service';

export interface SelectedInvoice {
	data: Invoice;
	isSelected: false;
}

@Component({
	selector: 'ngx-invoices',
	templateUrl: './invoices.component.html',
	styleUrls: ['./invoices.component.scss']
})
export class InvoicesComponent extends TranslationBaseComponent
	implements OnInit {
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	invoice: Invoice;
	selectedInvoice: Invoice;
	loading = false;
	disableButton = true;

	@ViewChild('invoicesTable', { static: false }) invoicesTable;

	constructor(
		readonly translateService: TranslateService,
		private store: Store,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private invoicesService: InvoicesService,
		private invoiceItemService: InvoiceItemService,
		private router: Router
	) {
		super(translateService);
	}

	ngOnInit() {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.loadSettings();
	}

	add() {
		this.router.navigate(['/pages/accounting/invoices/add']);
	}

	edit() {
		this.router.navigate([
			`/pages/accounting/invoices/edit/${this.selectedInvoice.id}`
		]);
	}

	async delete() {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			const items = await this.invoiceItemService.getAll();
			const itemsToDelete = items.items.filter(
				(i) => i.invoiceId === this.selectedInvoice.id
			);
			await this.invoicesService.delete(this.selectedInvoice.id);

			for (const item of itemsToDelete) {
				await this.invoiceItemService.delete(item.id);
			}

			this.loadSettings();
			this.toastrService.primary(
				this.getTranslation('INVOICES_PAGE.INVOICES_DELETE_INVOICE'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.disableButton = true;
	}

	async loadSettings() {
		this.selectedInvoice = null;
		const { items } = await this.invoicesService.getAll();
		this.loading = false;
		this.smartTableSource.load(items);
	}

	async selectInvoice($event: SelectedInvoice) {
		if ($event.isSelected) {
			this.selectedInvoice = $event.data;
			this.disableButton = false;
			this.invoicesTable.grid.dataSet.willSelect = false;
		} else {
			this.disableButton = true;
		}
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				invoiceNumber: {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER'),
					type: 'string'
				},
				totalValue: {
					title: this.getTranslation('INVOICES_PAGE.TOTAL_VALUE'),
					type: 'custom',
					renderComponent: InvoicesValueComponent
				},
				paid: {
					title: this.getTranslation('INVOICES_PAGE.PAID_STATUS'),
					type: 'string'
				}
			}
		};
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}
}
