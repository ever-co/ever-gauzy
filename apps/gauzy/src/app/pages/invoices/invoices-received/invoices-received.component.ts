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
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange, toUTC } from '@gauzy/common-angular';
import { NbDialogService } from '@nebular/theme';
import { API_PREFIX, ComponentEnum } from '../../../@core/constants';
import { ServerDataSource } from '../../../@core/utils/smart-table';
import {
	DateRangePickerBuilderService,
	ErrorHandlingService,
	InvoicesService,
	Store,
	ToastrService
} from '../../../@core/services';
import {
	InvoiceEstimateTotalValueComponent,
	InvoicePaidComponent
} from '../table-components';
import {
	ContactLinksComponent,
	DateViewComponent,
	NotesWithTagsComponent,
	TagsOnlyComponent
} from '../../../@shared/table-components';
import {
	InputFilterComponent,
	TagsColorFilterComponent
} from '../../../@shared/table-filters';
import { StatusBadgeComponent } from '../../../@shared/status-badge';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from '../../../@shared/pagination/pagination-filter-base.component';
import { InvoiceDownloadMutationComponent } from '../invoice-download/invoice-download-mutation.component';
import { getAdjustDateRangeFutureAllowed } from '../../../@theme/components/header/selectors/date-range-picker';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoices-received',
	templateUrl: './invoices-received.component.html',
	styleUrls: ['./invoices-received.component.scss']
})
export class InvoicesReceivedComponent
	extends PaginationFilterBaseComponent
	implements OnInit, OnDestroy {
	loading: boolean = false;
	disableButton: boolean = true;
	settingsSmartTable: object;
	smartTableSource: ServerDataSource;
	selectedInvoice: IInvoice;
	invoices: IInvoice[] = [];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	organization: IOrganization;
	selectedDateRange: IDateRangePicker;
	invoices$: Subject<any> = this.subject$;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	columns: string[] = [];
	private _refresh$: Subject<any> = new Subject();

	/*
	 * getter setter for check estimate or invoice
	 */
	private _isEstimate: boolean = false;
	@Input() set isEstimate(val: boolean) {
		this._isEstimate = val;
	}
	get isEstimate() {
		return this._isEstimate;
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
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly invoicesService: InvoicesService,
		public readonly translateService: TranslateService,
		private readonly router: Router,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly toastrService: ToastrService,
		private readonly httpClient: HttpClient,
		private readonly dialogService: NbDialogService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.columns = this.getColumns();
		this._loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
	}

	ngAfterViewInit(): void {
		this.invoices$
			.pipe(
				debounceTime(100),
				tap(() => this._clearItem()),
				tap(() => this.getInvoices()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.invoices$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;
		combineLatest([storeOrganization$, storeDateRange$])
			.pipe(
				debounceTime(300),
				filter(
					([organization, dateRange]) => !!organization && !!dateRange
				),
				distinctUntilChange(),
				tap(([organization, dateRange]) => {
					this.organization = organization as IOrganization;
					this.selectedDateRange = dateRange as IDateRangePicker;
				}),
				tap(() => this._refresh$.next(true)),
				tap(() => this.invoices$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(
					() =>
						this.dataLayoutStyle ===
						ComponentLayoutStyleEnum.CARDS_GRID
				),
				tap(() => this.refreshPagination()),
				tap(() => (this.invoices = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.invoiceReceivedTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this._clearItem())
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
				tap(() => this.refreshPagination()),
				filter(
					(componentLayout) =>
						componentLayout === ComponentLayoutStyleEnum.CARDS_GRID
				),
				tap(() => (this.invoices = [])),
				tap(() => this.invoices$.next(true)),
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
		const { startDate, endDate } = getAdjustDateRangeFutureAllowed(this.selectedDateRange);

		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/invoices/pagination`,
			relations: ['payments', 'tags', 'toContact'],
			join: {
				alias: 'invoice',
				leftJoin: {
					tags: 'invoice.tags',
					toContact: 'invoice.toContact'
				},
				...(this.filters.join) ? this.filters.join : {}
			},
			where: {
				sentTo: organizationId,
				tenantId,
				isEstimate: this.isEstimate === true ? 1 : 0,
				invoiceDate: {
					startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
					endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss')
				},
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (invoice: IInvoice) => {
				return Object.assign({}, invoice, {
					status: this.statusMapper(invoice.status)
				});
			},
			finalize: () => {
				if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
					this.invoices.push(...this.smartTableSource.getData());
				}
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}

	async getInvoices() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				// Initiate GRID view pagination
				await this.smartTableSource.getElements();
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
					this._refresh$.next(true);
					this.invoices$.next(true);
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
					this._refresh$.next(true);
					this.invoices$.next(true);
					this.toastrService.success(
						'INVOICES_PAGE.INVOICE_REJECTED'
					);
				});
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}
	}

	private _loadSettingsSmartTable() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			mode: 'external',
			editable: true,
			noDataMessage: this.getTranslation(
				'SM_TABLE.NO_DATA.RECEIVE_ESTIMATE'
			),
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
					filterFunction: (invoiceNumber) => {
						this.setFilter({
							field: 'invoiceNumber',
							search: invoiceNumber
						});
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
					width: '12%',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (totalValue) => {
						this.setFilter({
							field: 'totalValue',
							search: totalValue
						});
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
					this.setFilter({ field: 'tags', search: tagIds });
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

	private _clearItem() {
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
		if (this.invoiceReceivedTable && this.invoiceReceivedTable.grid) {
			this.invoiceReceivedTable.grid.dataSet['willSelect'] = 'false';
			this.invoiceReceivedTable.grid.dataSet.deselectAll();
		}
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

	payments() {
		const { id } = this.selectedInvoice;
		this.router.navigate([`/pages/accounting/invoices/payments`, id]);
	}

	edit(selectedItem?: IInvoice) {
		this.invoicesService.changeValue(false);
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}

		const { id } = this.selectedInvoice;
		if (this.isEstimate) {
			this.router.navigate([
				`/pages/accounting/invoices/estimates/edit`,
				id
			]);
		} else {
			this.router.navigate([`/pages/accounting/invoices/edit`, id]);
		}
	}

	download(selectedItem?: IInvoice) {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService.open(InvoiceDownloadMutationComponent, {
			context: {
				invoice: this.selectedInvoice,
				isEstimate: this.isEstimate
			}
		});
	}

	ngOnDestroy() { }
}
