import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { OnInit, Component, OnDestroy, ViewChild, Input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { takeUntil } from 'rxjs/operators';
import { Store } from '../../../@core/services/store.service';
import { Subject } from 'rxjs';
import { InvoicesService } from '../../../@core/services/invoices.service';
import { LocalDataSource } from 'ng2-smart-table';
import { Invoice } from '@gauzy/models';
import { Router } from '@angular/router';

export interface SelectedInvoice {
	data: Invoice;
	isSelected: false;
}

@Component({
	selector: 'ga-invoices-received',
	templateUrl: './invoices-received.component.html',
	styleUrls: ['./invoices-received.component.scss']
})
export class InvoicesReceivedComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	loading = true;
	private _ngDestroy$ = new Subject<void>();
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	selectedInvoice: Invoice;
	disableButton = true;

	@Input() isEstimate: boolean;
	@ViewChild('invoicesTable') invoicesTable;

	constructor(
		private store: Store,
		private invoicesService: InvoicesService,
		readonly translateService: TranslateService,
		private router: Router
	) {
		super(translateService);
	}

	ngOnInit() {
		if (!this.isEstimate) {
			this.isEstimate = false;
		}
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.getInvoices();
	}

	async getInvoices() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (organization) => {
				if (organization) {
					const invoices = await this.invoicesService.getAll([], {
						sentTo: organization.id,
						isEstimate: this.isEstimate
					});
					this.loading = false;
					this.smartTableSource.load(invoices.items);
				}
			});
	}

	view() {
		if (this.isEstimate) {
			this.router.navigate([
				`/pages/accounting/invoices/estimates/view/${this.selectedInvoice.id}`
			]);
		} else {
			this.router.navigate([
				`/pages/accounting/invoices/view/${this.selectedInvoice.id}`
			]);
		}
	}

	loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				invoiceNumber: {
					title: this.isEstimate
						? this.getTranslation('INVOICES_PAGE.ESTIMATE_NUMBER')
						: this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER'),
					type: 'string',
					sortDirection: 'asc'
				},
				totalValue: {
					title: this.getTranslation('INVOICES_PAGE.TOTAL_VALUE'),
					type: 'string',
					valuePrepareFunction: (cell, row) => {
						return `${row.currency} ${cell}`;
					}
				},
				paid: {
					title: this.getTranslation('INVOICES_PAGE.PAID_STATUS'),
					type: 'string'
				}
			}
		};
	}

	selectInvoice($event: SelectedInvoice) {
		if ($event.isSelected) {
			this.selectedInvoice = $event.data;
			this.disableButton = false;
			this.invoicesTable.grid.dataSet.willSelect = false;
		} else {
			this.disableButton = true;
		}
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
