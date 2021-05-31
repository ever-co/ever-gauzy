import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { OnInit, Component, OnDestroy, ViewChild, Input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Store } from '../../../@core/services/store.service';
import { InvoicesService } from '../../../@core/services/invoices.service';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import {
	IInvoice,
	ComponentLayoutStyleEnum,
	IOrganization
} from '@gauzy/contracts';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { InvoicePaidComponent } from '../table-components/invoice-paid.component';
import { ComponentEnum } from '../../../@core/constants/layout.constants';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../../@core/services/toastr.service';
import { distinctUntilChange } from '@gauzy/common-angular';
import { Subject } from 'rxjs/internal/Subject';
import { ServerDataSource } from '../../../@core/utils/smart-table/server.data-source';
import { API_PREFIX } from '../../../@core/constants';
import { HttpClient } from '@angular/common/http';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoices-received',
	templateUrl: './invoices-received.component.html',
	styleUrls: ['./invoices-received.component.scss']
})
export class InvoicesReceivedComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	loading: boolean = false;
	settingsSmartTable: object;
	smartTableSource: ServerDataSource;
	selectedInvoice: IInvoice;
	invoices: IInvoice[];
	disableButton = true;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	organization: IOrganization;
	subject$: Subject<any> = new Subject();
	perPage: number = 10;
	pagination: any = {
		totalItems: 0,
		activePage: 1,
		itemsPerPage: this.perPage
	};
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;

	/*
	* getter setter for check esitmate or invoice
	*/
	private _isEstimate: boolean = false;
	@Input() set isEstimate(val: boolean) {
		this._isEstimate = val;
	}
	get isEstimate() {
		return this._isEstimate;
	}

	invoicesTable: Ng2SmartTableComponent;
	@ViewChild('invoicesTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.invoicesTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private readonly store: Store,
		private readonly invoicesService: InvoicesService,
		public readonly translateService: TranslateService,
		private readonly router: Router,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly toastrService: ToastrService,
		private readonly httpClient: HttpClient,
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();

		this.subject$
			.pipe(
				debounceTime(200),
				tap(() => this.loading = true),
				tap(() => this.getInvoices()),
				tap(() => this.clearItem()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				debounceTime(100),
				filter((organization) => !!organization),
				distinctUntilChange(),
				tap((organization) => (this.organization = organization)),
				tap(() => this.subject$.next()),
				untilDestroyed(this)
			)
			.subscribe();
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					console.log(event);
					this.setView();
				}
			});
	}

	onPageChange(selectedPage: number) {
		this.pagination['activePage'] = selectedPage;
		this.subject$.next();
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
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.subject$.next()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	* Register Smart Table Source Config 
	*/
	setSmartTableSource() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/invoices/search/filter`,
			relations: [
				'payments'
			],
			where: {
				sentTo: organizationId,
				tenantId,
				isEstimate: (this.isEstimate === true) ? 1 : 0
			},
			resultMap: (invoice: IInvoice) => {
				return Object.assign({}, invoice, {
					totalValue: `${invoice.currency} ${invoice.totalValue}`				
				});
			},
			finalize: () => {
				this.loading = false;
			}
		});
	}

	async getInvoices() {
		try {
			this.setSmartTableSource();
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {

				// Initiate GRID view pagination
				const { activePage, itemsPerPage } = this.pagination;
				this.smartTableSource.setPaging(activePage, itemsPerPage, false);

				await this.smartTableSource.getElements();
				this.invoices = this.smartTableSource.getData();

				this.pagination['totalItems'] =  this.smartTableSource.count();
			}
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
		const { id } = this.selectedInvoice;
		if (this.isEstimate) {
			this.router.navigate([ `/pages/accounting/invoices/estimates/view`, id ]);
		} else {
			this.router.navigate([ `/pages/accounting/invoices/view`, id ]);
		}
	}

	async accept(selectedItem?: IInvoice) {
		try {
			if (selectedItem) {
				this.selectInvoice({
					isSelected: true,
					data: selectedItem
				});
			}
			await this.invoicesService.update(this.selectedInvoice.id, {
				isAccepted: true
			}).then(() => {
				this.subject$.next();
				this.toastrService.success('INVOICES_PAGE.INVOICE_ACCEPTED');
			});
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}
	}

	async reject(selectedItem?: IInvoice) {
		try {
			if (selectedItem) {
				this.selectInvoice({
					isSelected: true,
					data: selectedItem
				});
			}
			await this.invoicesService.update(this.selectedInvoice.id, {
				isAccepted: false
			}).then(() => {
				this.subject$.next();
				this.toastrService.success('INVOICES_PAGE.INVOICE_REJECTED');
			});
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}
	}

	private _loadSettingsSmartTable() {
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
					type: 'string'
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

	private selectInvoice({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedInvoice = isSelected ? data : null;
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSettingsSmartTable()),
				untilDestroyed(this)
			)
			.subscribe();
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
