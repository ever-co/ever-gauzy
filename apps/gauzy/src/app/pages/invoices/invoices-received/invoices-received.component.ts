import { OnInit, Component, OnDestroy, ViewChild, Input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import {
	IInvoice,
	ComponentLayoutStyleEnum,
	IOrganization,
	EstimateColumnsEnum,
	InvoiceColumnsEnum,
	ITag,
	IDateRangePicker
} from '@gauzy/contracts';
import * as moment from 'moment';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import { InvoicePaidComponent } from '../table-components/invoice-paid.component';
import { ComponentEnum } from '../../../@core/constants/layout.constants';
import { ServerDataSource } from '../../../@core/utils/smart-table/server.data-source';
import { API_PREFIX } from '../../../@core/constants';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { ErrorHandlingService, InvoicesService, Store, ToastrService } from '../../../@core/services';
import { InvoiceEstimateTotalValueComponent } from '../table-components/invoice-total-value.component';
import { InputFilterComponent } from '../../../@shared/table-filters/input-filter.component';
import { ContactLinksComponent, DateViewComponent, NotesWithTagsComponent, TagsOnlyComponent } from '../../../@shared/table-components';
import { StatusBadgeComponent } from '../../../@shared/status-badge/status-badge.component';
import { TagsColorFilterComponent } from '../../../@shared/table-filters';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoices-received',
	templateUrl: './invoices-received.component.html',
	styleUrls: ['./invoices-received.component.scss']
})
export class InvoicesReceivedComponent extends TranslationBaseComponent
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
	selectedDateRange: IDateRangePicker;
	subject$: Subject<any> = new Subject();
	perPage: number = 10;
	pagination: any = {
		totalItems: 0,
		activePage: 1,
		itemsPerPage: this.perPage
	};
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	columns: any;

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

	/*
	 * getter setter for filters
	 * getter setter for filters
	 * getter setter for filters
	 */
	private _filters: any = {};
	set filters(val: any) {
		this._filters = val;
	}
	get filters() {
		return this._filters;
	}

	invoiceReceivedTable: Ng2SmartTableComponent;
	@ViewChild('invoiceReceivedTable', { static: false }) set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.invoiceReceivedTable = content;
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
		private readonly httpClient: HttpClient
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.columns = this.getColumns();
		this._loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();

		this.subject$
			.pipe(
				debounceTime(500),
				tap(() => this.getInvoices()),
				tap(() => this.clearItem()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeDateRange$ = this.store.selectedDateRange$;
		combineLatest([storeOrganization$, storeDateRange$])
			.pipe(
				filter(([organization]) => !!organization),
				distinctUntilChange(),
				tap(([organization, dateRange]) => {
					this.organization = organization as IOrganization;
					this.selectedDateRange = dateRange as IDateRangePicker;
				}),
				tap(() => this.refreshPagination()),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	onPageChange(selectedPage: number) {
		this.pagination['activePage'] = selectedPage;
		this.subject$.next(true);
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.invoiceReceivedTable.source.onChangedSource
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
				tap(
					(componentLayout) =>
						(this.dataLayoutStyle = componentLayout)
				),
				filter(
					(componentLayout) =>
						componentLayout === ComponentLayoutStyleEnum.CARDS_GRID
				),
				tap(() => this.refreshPagination()),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Register Smart Table Source Config
	 * Register Smart Table Source Config
	 * Register Smart Table Source Config
	 * Register Smart Table Source Config
	 * Register Smart Table Source Config
	 * Register Smart Table Source Config
	 * Register Smart Table Source Config
	 * Register Smart Table Source Config
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}
		this.loading = true;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { startDate, endDate } = this.selectedDateRange;

		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/invoices/pagination`,
			relations: ['payments', 'tags', 'toContact'],
			join: {
				alias: 'invoice',
				leftJoin: {
					tags: 'invoice.tags',
					toContact: 'invoice.toContact'
				}
			},
			where: {
				sentTo: organizationId,
				tenantId,
				isEstimate: this.isEstimate === true ? 1 : 0,
				invoiceDate: {
					startDate: moment(startDate).format('YYYY-MM-DD HH:mm:ss'),
					endDate: moment(endDate).format('YYYY-MM-DD HH:mm:ss')
				},
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (invoice: IInvoice) => {
				return Object.assign({}, invoice, {
					status: this.statusMapper(invoice.status)
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
			if (
				this.dataLayoutStyle === ComponentLayoutStyleEnum.TABLE ||
				this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID
			) {
				// Initiate TABLE and GRID view pagination
				const { activePage, itemsPerPage } = this.pagination;
				this.smartTableSource.setPaging(
					activePage,
					itemsPerPage,
					false
				);

				await this.smartTableSource.getElements();
				this.invoices = this.smartTableSource.getData();

				this.pagination['totalItems'] = this.smartTableSource.count();
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
			this.router.navigate([
				`/pages/accounting/invoices/estimates/view`,
				id
			]);
		} else {
			this.router.navigate([`/pages/accounting/invoices/view`, id]);
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
			await this.invoicesService
				.updateEstimate(this.selectedInvoice.id, {
					isAccepted: true
				})
				.then(() => {
					this.subject$.next(true);
					this.toastrService.success(
						'INVOICES_PAGE.INVOICE_ACCEPTED'
					);
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
			await this.invoicesService
				.updateEstimate(this.selectedInvoice.id, {
					isAccepted: false
				})
				.then(() => {
					this.subject$.next(true);
					this.toastrService.success(
						'INVOICES_PAGE.INVOICE_REJECTED'
					);
				});
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}
	}

	private _loadSettingsSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			pager: {
				display: false,
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
					type: this.isEstimate ? 'string' : 'custom',
					renderComponent: this.isEstimate
						? null
						: NotesWithTagsComponent,
					sortDirection: 'asc',
					width: '20%',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value) => {
						if (isNotEmpty(value)) {
							this.filters = {
								where: {
									...this.filters.where,
									invoiceNumber: value
								}
							};
						} else {
							delete this.filters.where.invoiceNumber;
						}
						this.subject$.next(true);
					}
				},
				invoiceDate: {
					title: this.isEstimate
						? this.getTranslation('INVOICES_PAGE.ESTIMATE_DATE')
						: this.getTranslation('INVOICES_PAGE.INVOICE_DATE'),
					type: 'custom',
					filter: false,
					width: '10%',
					renderComponent: DateViewComponent
				},
				dueDate: {
					title: this.getTranslation('INVOICES_PAGE.DUE_DATE'),
					type: 'custom',
					filter: false,
					width: '10%',
					renderComponent: DateViewComponent
				},
				totalValue: {
					title: this.getTranslation('INVOICES_PAGE.TOTAL_VALUE'),
					type: 'custom',
					renderComponent: InvoiceEstimateTotalValueComponent,
					width: '10%',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value) => {
						if (isNotEmpty(value)) {
							this.filters = {
								where: {
									...this.filters.where,
									totalValue: value
								}
							};
						} else {
							delete this.filters.where.totalValue;
						}
						this.subject$.next(true);
					}
				}
			}
		};
		if (this.columns.includes(InvoiceColumnsEnum.CONTACT)) {
			this.settingsSmartTable['columns']['toContact'] = {
				title: this.getTranslation('INVOICES_PAGE.SENDER'),
				type: 'custom',
				filter: false,
				sort: false,
				renderComponent: ContactLinksComponent
			};
		}
		if (!this.isEstimate) {
			this.settingsSmartTable['columns']['paid'] = {
				title: this.getTranslation('INVOICES_PAGE.PAID_STATUS'),
				type: 'custom',
        width: '15%',
				renderComponent: InvoicePaidComponent,
				filter: false
			};
		}
		if (this.isEstimate) {
			this.settingsSmartTable['columns']['tags'] = {
				title: this.getTranslation('SM_TABLE.TAGS'),
				type: 'custom',
				class: 'align-row',
				width: '10%',
				renderComponent: TagsOnlyComponent,
				filter: {
					type: 'custom',
					component: TagsColorFilterComponent
				},
				filterFunction: (tags: ITag[]) => {
					const tagIds = [];
					for (const tag of tags) {
						tagIds.push(tag.id);
					}
					this.filters = tagIds;
				},
				sort: false
			};
		}
		if (this.columns.includes(InvoiceColumnsEnum.STATUS)) {
			this.settingsSmartTable['columns']['status'] = {
				title: this.getTranslation('INVOICES_PAGE.STATUS'),
				type: 'custom',
				width: '5%',
				renderComponent: StatusBadgeComponent,
				filter: {
					type: 'custom',
					component: InputFilterComponent
				}
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
	 * refresh pagination
	 */
	refreshPagination() {
		this.pagination['activePage'] = 1;
	}

	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.invoiceReceivedTable && this.invoiceReceivedTable.grid) {
			this.invoiceReceivedTable.grid.dataSet['willSelect'] = 'false';
			this.invoiceReceivedTable.grid.dataSet.deselectAll();
		}
	}

	onUpdateOption($event: number) {
		this.pagination.itemsPerPage = $event;
		this.getInvoices();
	}

	getColumns(): string[] {
		if (this.isEstimate) {
			return Object.values(EstimateColumnsEnum);
		}
		return Object.values(InvoiceColumnsEnum);
	}

	private statusMapper = (value: string) => {
		let badgeClass;
		if (value) {
			badgeClass = [
				'sent',
				'viewed',
				'accepted',
				'active',
				'fully paid'
			].includes(value.toLowerCase())
				? 'success'
				: ['void', 'draft', 'partially paid'].includes(
						value.toLowerCase()
				  )
				? 'warning'
				: 'danger';
		}
		return {
			originalValue: value,
			text: this.getTranslation(
				`INVOICES_PAGE.STATUSES.${value.toUpperCase()}`
			),
			class: badgeClass
		};
	};

	ngOnDestroy() {}
}
