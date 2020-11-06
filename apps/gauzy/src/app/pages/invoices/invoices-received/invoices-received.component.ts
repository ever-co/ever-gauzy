import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { OnInit, Component, OnDestroy, ViewChild, Input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { Store } from '../../../@core/services/store.service';
import { InvoicesService } from '../../../@core/services/invoices.service';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import {
	IInvoice,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/models';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { InvoicePaidComponent } from '../table-components/invoice-paid.component';
import { ComponentEnum } from '../../../@core/constants/layout.constants';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoices-received',
	templateUrl: './invoices-received.component.html',
	styleUrls: ['./invoices-received.component.scss']
})
export class InvoicesReceivedComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	loading = true;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	selectedInvoice: IInvoice;
	invoices: IInvoice[];
	disableButton = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	organization: IOrganization;

	@Input() isEstimate: boolean;

	invoicesTable: Ng2SmartTableComponent;
	@ViewChild('invoicesTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.invoicesTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private store: Store,
		private invoicesService: InvoicesService,
		readonly translateService: TranslateService,
		private router: Router,
		private _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		if (!this.isEstimate) {
			this.isEstimate = false;
		}
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe((organization) => {
				if (organization) {
					this.getInvoices();
				}
			});
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.invoicesTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.INVOICE_RECEIVED;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	async getInvoices() {
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			const invoices = await this.invoicesService.getAll(['payments'], {
				sentTo: organizationId,
				isEstimate: this.isEstimate,
				tenantId
			});
			this.loading = false;
			this.invoices = invoices.items;
			this.smartTableSource.load(invoices.items);
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}
	}

	view(selectedItem?: IInvoice) {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}
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

	async accept(selectedItem?: IInvoice) {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}
		await this.invoicesService.update(this.selectedInvoice.id, {
			isAccepted: true
		});
		await this.getInvoices();
	}

	async reject(selectedItem?: IInvoice) {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}
		await this.invoicesService.update(this.selectedInvoice.id, {
			isAccepted: false
		});
		await this.getInvoices();
	}

	loadSettingsSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			pager: {
				display: true,
				perPage: 10
			},
			mode: 'external',
			editable: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
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
				}
			}
		};
		if (!this.isEstimate) {
			this.settingsSmartTable['columns']['paid'] = {
				title: this.getTranslation('INVOICES_PAGE.PAID_STATUS'),
				type: 'custom',
				renderComponent: InvoicePaidComponent,
				filter: false,
				width: '33%'
			};
		}
	}

	selectInvoice({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedInvoice = isSelected ? data : null;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSettingsSmartTable();
			});
	}

	clearItem() {
		this.selectInvoice({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		this.invoicesTable.grid.dataSet['willSelect'] = 'false';
		this.invoicesTable.grid.dataSet.deselectAll();
	}

	ngOnDestroy() {}
}
