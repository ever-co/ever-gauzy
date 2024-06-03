import { OnInit, Component, OnDestroy, Input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { combineLatest, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NbDialogService } from '@nebular/theme';
import { Cell } from 'angular2-smart-table';
import {
	IInvoice,
	ComponentLayoutStyleEnum,
	IOrganization,
	EstimateColumnsEnum,
	InvoiceColumnsEnum,
	ITag,
	IDateRangePicker
} from '@gauzy/contracts';
import { API_PREFIX, ComponentEnum, distinctUntilChange, toUTC } from '@gauzy/ui-sdk/common';
import {
	DateRangePickerBuilderService,
	ErrorHandlingService,
	ServerDataSource,
	ToastrService
} from '@gauzy/ui-sdk/core';
import { Store } from '@gauzy/ui-sdk/common';
import { InvoicesService } from '../../../@core/services';
import { InvoiceEstimateTotalValueComponent, InvoicePaidComponent } from '../table-components';
import {
	ContactLinksComponent,
	DateViewComponent,
	NotesWithTagsComponent,
	TagsOnlyComponent
} from '../../../@shared/table-components';
import { InputFilterComponent, TagsColorFilterComponent } from '../../../@shared/table-filters';
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
export class InvoicesReceivedComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	public loading: boolean = false;
	public disableButton: boolean = true;
	public settingsSmartTable: object;
	public smartTableSource: ServerDataSource;
	public selectedInvoice: IInvoice;
	public invoices: IInvoice[] = [];
	public viewComponentName: ComponentEnum;
	public dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	public organization: IOrganization;
	public selectedDateRange: IDateRangePicker;
	public invoices$: Subject<any> = this.subject$;
	public componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	public columns: string[] = [];
	private _refresh$: Subject<any> = new Subject();

	/**
	 * Represents a component property for handling the estimate status.
	 */
	private _isEstimate: boolean = false;
	/**
	 * Gets the current estimate status.
	 * @returns The current estimate status.
	 */
	get isEstimate(): boolean {
		return this._isEstimate;
	}
	/**
	 * Sets the estimate status.
	 * @param val - The new estimate status value.
	 */
	@Input() set isEstimate(val: boolean) {
		this._isEstimate = val;
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
				filter(([organization, dateRange]) => !!organization && !!dateRange),
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
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => (this.invoices = [])),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Sets up the view component for the current state of the invoices.
	 */
	setView(): void {
		this.viewComponentName = ComponentEnum.INVOICE_RECEIVED;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout: ComponentLayoutStyleEnum) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.invoices = [])),
				tap(() => this.invoices$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Sets up the smart table source for fetching invoices based on the component's configuration.
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
				...(this.filters.join ? this.filters.join : {})
			},
			where: {
				sentTo: organizationId,
				tenantId,
				isEstimate: this.isEstimate,
				invoiceDate: {
					startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
					endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss')
				},
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (invoice: IInvoice) => ({
				...invoice,
				status: this.statusMapper(invoice.status)
			}),
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

	/**
	 * Asynchronously fetches invoices based on the component's configuration.
	 */
	async getInvoices(): Promise<void> {
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

	/**
	 * Navigate to the details view of the selected invoice or estimate.
	 *
	 * @param selectedItem - The selected invoice or estimate to view.
	 */
	view(selectedItem?: IInvoice): void {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});

			const { id } = this.selectedInvoice;
			const routePath = this.isEstimate
				? '/pages/accounting/invoices/estimates/view'
				: '/pages/accounting/invoices/view';

			this.router.navigate([routePath, id]);
		}
	}

	/**
	 * Accepts the selected invoice or estimate.
	 *
	 * @param selectedItem - The selected invoice or estimate to accept.
	 */
	async accept(selectedItem?: IInvoice): Promise<void> {
		try {
			if (selectedItem) {
				this.selectInvoice({
					isSelected: true,
					data: selectedItem
				});
			}

			const { id: invoiceId } = this.selectedInvoice;
			await this.invoicesService.updateEstimate(invoiceId, { isAccepted: true });

			// Refresh and notify observers
			this._refresh$.next(true);
			this.invoices$.next(true);

			this.toastrService.success('INVOICES_PAGE.INVOICE_ACCEPTED');
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Rejects the selected invoice or estimate.
	 *
	 * @param selectedItem - The selected invoice or estimate to reject.
	 */
	async reject(selectedItem?: IInvoice): Promise<void> {
		try {
			if (selectedItem) {
				this.selectInvoice({
					isSelected: true,
					data: selectedItem
				});
			}

			const { id: invoiceId } = this.selectedInvoice;
			await this.invoicesService.updateEstimate(invoiceId, { isAccepted: false });

			// Refresh and notify observers
			this._refresh$.next(true);
			this.invoices$.next(true);

			this.toastrService.success('INVOICES_PAGE.INVOICE_REJECTED');
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Loads and configures settings for the smart table based on the component's state.
	 */
	private _loadSettingsSmartTable(): void {
		//
		const pagination: IPaginationBase = this.getPagination();
		//
		this.settingsSmartTable = {
			actions: false,
			editable: true,
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			mode: 'external',
			selectedRowIndex: -1,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.RECEIVE_ESTIMATE'),
			columns: {
				invoiceNumber: {
					title: this.isEstimate
						? this.getTranslation('INVOICES_PAGE.ESTIMATE_NUMBER')
						: this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER'),
					type: this.isEstimate ? 'string' : 'custom',
					renderComponent: this.isEstimate ? null : NotesWithTagsComponent,
					sortDirection: 'asc',
					width: '20%',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (invoiceNumber: string) => {
						this.setFilter({ field: 'invoiceNumber', search: invoiceNumber });
					},
					componentInitFunction: (instance: NotesWithTagsComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				invoiceDate: {
					title: this.isEstimate
						? this.getTranslation('INVOICES_PAGE.ESTIMATE_DATE')
						: this.getTranslation('INVOICES_PAGE.INVOICE_DATE'),
					type: 'custom',
					filter: false,
					width: '10%',
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				dueDate: {
					title: this.getTranslation('INVOICES_PAGE.DUE_DATE'),
					type: 'custom',
					filter: false,
					width: '10%',
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
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
						this.setFilter({ field: 'totalValue', search: totalValue });
					},
					componentInitFunction: (instance: InvoiceEstimateTotalValueComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
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
				renderComponent: ContactLinksComponent,
				componentInitFunction: (instance: ContactLinksComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
					instance.value = cell.getRawValue();
				}
			};
		}
		if (!this.isEstimate) {
			this.settingsSmartTable['columns']['paid'] = {
				title: this.getTranslation('INVOICES_PAGE.PAID_STATUS'),
				type: 'custom',
				width: '15%',
				filter: false,
				renderComponent: InvoicePaidComponent,
				componentInitFunction: (instance: InvoicePaidComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
				}
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
				sort: false,
				componentInitFunction: (instance: TagsOnlyComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
					instance.value = cell.getValue();
				}
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
				},
				componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
					instance.value = cell.getRawValue();
				}
			};
		}
	}

	/**
	 * Handles the selection of an invoice.
	 *
	 * @param options - An object containing information about the selection.
	 * @param options.isSelected - A boolean indicating whether the invoice is selected.
	 * @param options.data - The data associated with the selected invoice.
	 */
	private selectInvoice(options: { isSelected: boolean; data: any }): void {
		this.disableButton = !options.isSelected;
		this.selectedInvoice = options.isSelected ? options.data : null;
	}

	/**
	 * Applies translation on the smart table when the language changes.
	 * Loads smart table settings after the language change.
	 * Automatically unsubscribes when the component is destroyed.
	 */
	private _applyTranslationOnSmartTable(): void {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSettingsSmartTable()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Clears the selected invoice item.
	 */
	private _clearItem(): void {
		this.selectInvoice({ isSelected: false, data: null });
	}

	/**
	 * Gets the column values based on the type (estimate or invoice).
	 *
	 * @returns An array of column values.
	 */
	getColumns(): string[] {
		return this.isEstimate ? Object.values(EstimateColumnsEnum) : Object.values(InvoiceColumnsEnum);
	}

	/**
	 * Maps invoice statuses to badge classes, texts, and original values.
	 *
	 * @param value - The invoice status value.
	 * @returns An object containing originalValue, text, and class properties.
	 */
	private statusMapper = (value: string) => {
		let badgeClass: 'success' | 'warning' | 'danger' | undefined;

		if (value) {
			const lowercaseValue = value.toLowerCase();

			if (['sent', 'viewed', 'accepted', 'active', 'fully paid'].includes(lowercaseValue)) {
				badgeClass = 'success';
			} else if (['void', 'draft', 'partially paid'].includes(lowercaseValue)) {
				badgeClass = 'warning';
			} else {
				badgeClass = 'danger';
			}
		}

		return {
			originalValue: value,
			text: this.getTranslation(`INVOICES_PAGE.STATUSES.${value.toUpperCase()}`),
			class: badgeClass
		};
	};

	/**
	 * Navigates to the payments page for the selected invoice.
	 */
	payments(): void {
		const { id } = this.selectedInvoice;

		// Check if the selected invoice has an ID before navigating
		if (id) {
			const routePath = `/pages/accounting/invoices/payments/${id}`;
			this.router.navigate([routePath]);
		} else {
			// Handle the case where the selected invoice doesn't have an ID
			console.error('Selected invoice does not have a valid ID for payments.');
			// You might want to provide user feedback or handle this case accordingly
		}
	}

	/**
	 * Initiates the editing process for the selected invoice or estimate.
	 *
	 * @param selectedItem - The selected invoice or estimate to edit.
	 */
	edit(selectedItem?: IInvoice): void {
		// Change value using invoicesService
		this.invoicesService.changeValue(false);

		if (selectedItem) {
			// Select the invoice
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}

		const { id } = this.selectedInvoice;
		const routePath = this.isEstimate
			? `/pages/accounting/invoices/estimates/edit`
			: `/pages/accounting/invoices/edit`;

		// Navigate to the edit page
		this.router.navigate([routePath, id]);
	}

	/**
	 * Initiates the download process for the selected invoice or estimate.
	 *
	 * @param selectedItem - The selected invoice or estimate to download.
	 */
	download(selectedItem?: IInvoice): void {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}

		const { selectedInvoice, isEstimate } = this;

		this.dialogService.open(InvoiceDownloadMutationComponent, {
			context: {
				invoice: selectedInvoice,
				isEstimate: isEstimate
			}
		});
	}

	ngOnDestroy() {}
}
