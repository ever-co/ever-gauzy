import {
	Component,
	OnInit,
	ViewChild,
	Input,
	QueryList,
	ViewChildren,
	TemplateRef,
	AfterViewInit
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Angular2SmartTableComponent, Cell, Settings } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbMenuItem, NbPopoverDirective, NbTabComponent } from '@nebular/theme';
import {
	IInvoice,
	ITag,
	IOrganization,
	ComponentLayoutStyleEnum,
	InvoiceStatusTypesEnum,
	EstimateStatusTypesEnum,
	InvoiceColumnsEnum,
	EstimateColumnsEnum,
	IInvoiceEstimateHistory,
	PermissionsEnum,
	InvoiceTabsEnum,
	DiscountTaxTypeEnum,
	IDateRangePicker,
	ICurrency
} from '@gauzy/contracts';
import { distinctUntilChange, isNotEmpty, API_PREFIX, ComponentEnum, toInvoiceDateFilter } from '@gauzy/ui-core/common';
import { Router } from '@angular/router';
import { filter, tap, debounceTime } from 'rxjs/operators';
import { Subject, firstValueFrom, combineLatest, BehaviorSubject, merge } from 'rxjs';
import moment from 'moment';
import { NgxPermissionsService } from 'ngx-permissions';
import {
	DateRangePickerBuilderService,
	InvoiceEstimateHistoryService,
	InvoicesService,
	ServerDataSource,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	ContactLinksComponent,
	DateViewComponent,
	DeleteConfirmationComponent,
	IPaginationBase,
	InvoiceTotalValueComponent,
	NotesWithTagsComponent,
	PaginationFilterBaseComponent,
	StatusBadgeComponent,
	getAdjustDateRangeFutureAllowed
} from '@gauzy/ui-core/shared';
import { InvoicePaidComponent } from '../../table-components';
import { environment as ENV } from '@gauzy/ui-config';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-invoices-by-role',
	templateUrl: './invoices-by-role.component.html',
	styleUrls: ['invoices-by-role.component.scss']
})
export class InvoicesByRoleComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit {
	settingsSmartTable: Settings;
	smartTableSource: ServerDataSource;
	selectedInvoice: IInvoice;
	loading = false;
	disableButton = true;
	canBeSend = true;
	invoices: IInvoice[] = [];
	organization: IOrganization;
	selectedDateRange: IDateRangePicker;
	viewComponentName: ComponentEnum;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	invoiceStatusTypes = this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT)
		? Object.values(InvoiceStatusTypesEnum)
		: [InvoiceStatusTypesEnum.SENT, InvoiceStatusTypesEnum.DRAFT];
	estimateStatusTypes = Object.values(EstimateStatusTypesEnum);
	settingsContextMenu: NbMenuItem[];
	columns: string[] = [];
	perPage = 10;
	histories: IInvoiceEstimateHistory[] = [];
	includeArchived = false;
	invoiceTabsEnum = InvoiceTabsEnum;
	permissionsEnum = PermissionsEnum;
	invoices$: Subject<IInvoice[]> = this.subject$;
	nbTab$: Subject<string> = new BehaviorSubject(InvoiceTabsEnum.ACTIONS);
	private readonly _refresh$: Subject<void> = new Subject();

	/*
	 * getter setter for check estimate or invoice
	 */
	private _isEstimate = false;
	@Input() set isEstimate(val: boolean) {
		this._isEstimate = val;
	}
	get isEstimate() {
		return this._isEstimate;
	}

	invoicesTable: Angular2SmartTableComponent;
	@ViewChild('invoicesTable', { static: false }) set content(table: Angular2SmartTableComponent) {
		if (table) {
			this.invoicesTable = table;
		}
	}

	@ViewChildren(NbPopoverDirective)
	public popups: QueryList<NbPopoverDirective>;

	/*
	 * Search Tab Form
	 */
	public searchForm: UntypedFormGroup = InvoicesByRoleComponent.searchBuildForm(this.fb);
	static searchBuildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			invoiceNumber: [''],
			invoiceDate: [''],
			dueDate: [''],
			totalValue: [''],
			currency: [''],
			status: [''],
			tags: ['']
		});
	}

	/*
	 * History Tab Form
	 */
	public historyForm: UntypedFormGroup = InvoicesByRoleComponent.historyBuildForm(this.fb);
	static historyBuildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			comment: ['', Validators.required],
			title: ['', Validators.required]
		});
	}

	/*
	 * Actions Buttons directive
	 */
	@ViewChild('actionButtons', { static: true })
	actionButtons: TemplateRef<void>;

	constructor(
		private readonly fb: UntypedFormBuilder,
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly invoicesService: InvoicesService,
		private readonly router: Router,
		private readonly invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private readonly ngxPermissionsService: NgxPermissionsService,
		private readonly httpClient: HttpClient
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.columns = this.getColumns();
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();

		merge(
			this.invoices$.pipe(
				debounceTime(100),
				tap((invoices) => {
					this._clearItem();
					this.getInvoices();
					this.invoices = invoices;
				})
			),
			this.pagination$.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.invoices$.next([]))
			),
			combineLatest([
				this.store.selectedOrganization$,
				this.dateRangePickerBuilderService.selectedDateRange$
			]).pipe(
				debounceTime(300),
				distinctUntilChange(),
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				tap(([organization, dateRange]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
					this._refresh$.next();
					this.invoices$.next([]);
				})
			),
			this._refresh$.pipe(
				tap(() => {
					this.refreshPagination();
					this.invoices = [];
				})
			)
		)
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				if (!this.searchForm.get('currency')?.value) {
					this.searchForm.patchValue({
						currency: this.store.selectedOrganization?.currency || ENV.DEFAULT_CURRENCY
					});
				}
			});
	}

	setView() {
		this.viewComponentName = this.isEstimate ? ComponentEnum.ESTIMATES : ComponentEnum.INVOICES;

		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => {
					this.dataLayoutStyle = componentLayout;
					this.refreshPagination();
					this.invoices = [];
					this.invoices$.next([]);
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async add() {
		await this.navigateBasedOnPermissions(this.isEstimate, 'add');
	}

	async edit(selectedItem?: IInvoice) {
		this.invoicesService.changeValue(false);
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}

		const { id } = this.selectedInvoice;
		await this.navigateBasedOnPermissions(this.isEstimate, 'edit', id);
	}

	private async navigateBasedOnPermissions(isEstimate: boolean, baseRoute: string, id?: string) {
		let route = '';

		switch (true) {
			case isEstimate:
				route = `/pages/accounting/invoices/estimates/${baseRoute}`;
				break;

			case await this.ngxPermissionsService.hasPermission(PermissionsEnum.INVOICES_EDIT):
				route = `/pages/accounting/invoices/${baseRoute}-by-role`;
				break;

			case await this.ngxPermissionsService.hasPermission(PermissionsEnum.ORG_INVOICES_EDIT):
				route = `/pages/accounting/invoices/${baseRoute}-by-organization`;
				break;

			default:
				route = '/pages/dashboard';
				break;
		}

		this.router.navigate(id ? [route, id] : [route]);
	}

	async convert(selectedItem?: IInvoice) {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}
		const { id: invoiceId } = this.selectedInvoice;

		await this.invoicesService.updateAction(invoiceId, {
			isEstimate: false,
			status: InvoiceStatusTypesEnum.DRAFT
		});

		const action = this.getTranslation('INVOICES_PAGE.ESTIMATES.CONVERTED_TO_INVOICE');
		await this.createInvoiceHistory(action);

		this.toastrService.success('INVOICES_PAGE.ESTIMATES.ESTIMATE_CONVERT');
		this._refresh$.next();
		this.invoices$.next([]);
	}

	async delete(selectedItem?: IInvoice) {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await firstValueFrom(this.dialogService.open(DeleteConfirmationComponent).onClose);

		if (result) {
			const { id } = this.selectedInvoice;
			await this.invoicesService.delete(id);

			if (this.isEstimate) {
				this.toastrService.success('INVOICES_PAGE.INVOICES_DELETE_ESTIMATE');
			} else {
				this.toastrService.success('INVOICES_PAGE.INVOICES_DELETE_INVOICE');
			}
			this._refresh$.next();
			this.invoices$.next([]);
		}
	}

	view() {
		const { id } = this.selectedInvoice;
		if (this.isEstimate) {
			this.router.navigate([`/pages/accounting/invoices/estimates/view`, id]);
		} else {
			this.router.navigate([`/pages/accounting/invoices/view`, id]);
		}
	}

	/*
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
			relations: [
				'invoiceItems',
				'invoiceItems.employee',
				'invoiceItems.employee.user',
				'invoiceItems.project',
				'invoiceItems.product',
				'invoiceItems.invoice',
				'invoiceItems.expense',
				'invoiceItems.task',
				'tags',
				'payments',
				'fromUser',
				'historyRecords',
				'historyRecords.user',
				'organization'
			],
			join: {
				alias: 'invoice',
				leftJoin: {
					organization: 'invoice.organization',
					tags: 'invoice.tags'
				},
				...(this.filters.join ? this.filters.join : {})
			},
			where: {
				organizationId,
				tenantId,
				isEstimate: this.isEstimate,
				isArchived: this.includeArchived,
				invoiceDate: {
					startDate: toInvoiceDateFilter(startDate),
					endDate: toInvoiceDateFilter(endDate)
				},
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (invoice: IInvoice) => {
				return {
					...invoice,
					status: this.statusMapper(invoice.status),
					tax: this.taxMapper(invoice.taxType, invoice.tax),
					tax2: this.taxMapper(invoice.tax2Type, invoice.tax2),
					discountValue: this.taxMapper(invoice.discountType, invoice.discountValue)
				};
			},
			finalize: () => {
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
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('NOTES.INVOICE.INVOICE_ERROR', {
					error: error.error.message || error.message
				}),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	async addComment(historyFormDirective) {
		if (this.historyForm.invalid) {
			return;
		}
		const { comment, title } = this.historyForm.value;
		const { id: invoiceId } = this.selectedInvoice;
		if (comment) {
			const action = comment;
			await this.createInvoiceHistory(action, title);

			historyFormDirective.resetForm();
			this.historyForm.reset();

			const invoice = await this.invoicesService.getById(invoiceId, [
				'invoiceItems',
				'invoiceItems.employee',
				'invoiceItems.employee.user',
				'invoiceItems.project',
				'invoiceItems.product',
				'invoiceItems.invoice',
				'invoiceItems.expense',
				'invoiceItems.task',
				'tags',
				'payments',
				'historyRecords',
				'historyRecords.user',
				'organization',
				'fromUser'
			]);

			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.TABLE) {
				this.invoicesTable.grid.getRows().forEach((row) => {
					if (row['data']['id'] === invoice.id) {
						row['data'] = invoice;
						row.isSelected = true;
					} else {
						row.isSelected = false;
					}
					return row;
				});
			} else {
				this.invoices = this.invoices.map((row: IInvoice) => {
					if (row.id === invoice.id) {
						return invoice;
					}
					return row;
				});
			}

			this.selectInvoice({
				isSelected: true,
				data: invoice
			});
		}
	}

	async selectInvoice({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedInvoice = isSelected ? data : null;

		if (isSelected) {
			this.canBeSend = data.fromUser ? isSelected : !isSelected;
		} else {
			this.canBeSend = isSelected;
		}

		if (isSelected) {
			const { historyRecords = [] } = data;
			const histories = [];
			historyRecords.forEach((h: IInvoiceEstimateHistory) => {
				const history = {
					id: h.id,
					createdAt: new Date(h.createdAt).toString().slice(0, 24),
					action: h.action,
					title: h.title ?? '',
					user: h.user
				};
				histories.push(history);
			});
			histories.sort(function (a, b) {
				return +new Date(b.createdAt) - +new Date(a.createdAt);
			});
			this.histories = histories;
		}
	}

	private readonly statusMapper = (value: string) => {
		if (!value) return { originalValue: value, text: '', class: 'danger' };

		const status = value.toLowerCase();
		let badgeClass = 'danger';
		const statusClasses = new Map([
			['sent', 'success'],
			['viewed', 'success'],
			['accepted', 'success'],
			['active', 'success'],
			['fully paid', 'success'],
			['void', 'warning'],
			['draft', 'warning'],
			['partially paid', 'warning']
		]);

		badgeClass = statusClasses.get(status) || 'danger';

		return {
			originalValue: value,
			text: this.getTranslation(`INVOICES_PAGE.STATUSES.${value.toUpperCase()}`),
			class: badgeClass
		};
	};

	private readonly taxMapper = (taxType: DiscountTaxTypeEnum, tax: number) => {
		return {
			originalValue: tax,
			value: DiscountTaxTypeEnum.PERCENT === taxType ? `${tax}%` : `${tax}`
		};
	};

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			hideSubHeader: true,
			mode: 'external',
			actions: false,
			noDataMessage: this.getTranslation(
				this.isEstimate ? 'SM_TABLE.NO_DATA.ESTIMATE' : 'SM_TABLE.NO_DATA.INVOICE'
			),
			columns: {
				invoiceNumber: {
					title: this.isEstimate
						? this.getTranslation('INVOICES_PAGE.ESTIMATES.ESTIMATE_NUMBER')
						: this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER'),
					type: 'custom',
					sortDirection: 'asc',
					width: '17%',
					renderComponent: NotesWithTagsComponent,
					componentInitFunction: (instance: NotesWithTagsComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getRawValue();
					}
				}
			}
		};
		if (
			this.columns.includes(InvoiceColumnsEnum.INVOICE_DATE) ||
			this.columns.includes(EstimateColumnsEnum.ESTIMATE_DATE)
		) {
			this.settingsSmartTable['columns']['invoiceDate'] = {
				title: this.isEstimate
					? this.getTranslation('INVOICES_PAGE.ESTIMATE_DATE')
					: this.getTranslation('INVOICES_PAGE.INVOICE_DATE'),
				type: 'custom',
				width: '10%',
				isFilterable: false,
				renderComponent: DateViewComponent,
				componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
					instance.value = cell.getValue();
				}
			};
		}
		if (this.columns.includes(InvoiceColumnsEnum.DUE_DATE)) {
			this.settingsSmartTable['columns']['dueDate'] = {
				title: this.getTranslation('INVOICES_PAGE.DUE_DATE'),
				type: 'custom',
				width: '10%',
				isFilterable: false,
				renderComponent: DateViewComponent,
				componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
					instance.value = cell.getValue();
				}
			};
		}
		if (this.columns.includes(InvoiceColumnsEnum.TOTAL_VALUE)) {
			this.settingsSmartTable['columns']['totalValue'] = {
				title: this.getTranslation('INVOICES_PAGE.TOTAL_VALUE'),
				type: 'custom',
				width: '10%',
				isFilterable: false,
				renderComponent: InvoiceTotalValueComponent,
				componentInitFunction: (instance: InvoiceTotalValueComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
					instance.value = cell.getValue();
				}
			};
		}
		if (this.columns.includes(InvoiceColumnsEnum.TAX)) {
			this.settingsSmartTable['columns']['tax'] = {
				title: this.getTranslation('INVOICES_PAGE.TAX'),
				type: 'text',
				width: '5%',
				isFilterable: false,
				valuePrepareFunction: (row) => {
					return row?.value?.toString() ?? '';
				}
			};
		}
		if (this.columns.includes(InvoiceColumnsEnum.TAX_2)) {
			this.settingsSmartTable['columns']['tax2'] = {
				title: this.getTranslation('INVOICES_PAGE.TAX_2'),
				type: 'text',
				width: '6%',
				isFilterable: false,
				valuePrepareFunction: (row) => {
					return row?.value ?? '';
				}
			};
		}
		if (this.columns.includes(InvoiceColumnsEnum.DISCOUNT)) {
			this.settingsSmartTable['columns']['discountValue'] = {
				title: this.getTranslation('INVOICES_PAGE.INVOICES_SELECT_DISCOUNT'),
				type: 'text',
				width: '5%',
				isFilterable: false,
				valuePrepareFunction: (row) => {
					return row?.value ?? '';
				}
			};
		}
		if (this.columns.includes(InvoiceColumnsEnum.CONTACT)) {
			this.settingsSmartTable['columns']['organization'] = {
				title: this.getTranslation('INVOICES_PAGE.CONTACT'),
				type: 'custom',
				width: '12%',
				isFilterable: false,
				isSortable: false,
				renderComponent: ContactLinksComponent,
				componentInitFunction: (instance: ContactLinksComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
					instance.value = cell.getRawValue();
					instance.useNavigate = false;
				}
			};
		}
		if (!this.isEstimate) {
			if (this.columns.includes(InvoiceColumnsEnum.PAID_STATUS)) {
				this.settingsSmartTable['columns']['paid'] = {
					title: this.getTranslation('INVOICES_PAGE.PAID_STATUS'),
					type: 'custom',
					width: '12%',
					isFilterable: false,
					renderComponent: InvoicePaidComponent,
					componentInitFunction: (instance: InvoicePaidComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
					}
				};
			}
		}
		if (this.columns.includes(InvoiceColumnsEnum.STATUS)) {
			this.settingsSmartTable['columns']['status'] = {
				title: this.getTranslation('INVOICES_PAGE.STATUS'),
				type: 'custom',
				width: '5%',
				isFilterable: false,
				renderComponent: StatusBadgeComponent,
				componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
					instance.value = cell.getRawValue();
				}
			};
		}
	}

	showPerPage() {
		if (this.perPage && Number.isInteger(this.perPage) && this.perPage > 0) {
			this.setPagination({
				...this.getPagination(),
				itemsPerPage: this.perPage
			});
		}
	}

	search() {
		const { dueDate, invoiceNumber, invoiceDate, totalValue, currency, status, tags = [] } = this.searchForm.value;

		if (invoiceNumber) {
			const invoiceNumberAsNumber = Number(invoiceNumber);
			if (!isNaN(invoiceNumberAsNumber)) {
				this.setFilter({ field: 'invoiceNumber', search: invoiceNumberAsNumber }, false);
			}
		}

		// Filter by invoice date
		this.setFilter(
			{
				field: 'invoiceDate',
				search: invoiceDate
					? {
							startDate: toInvoiceDateFilter(moment(invoiceDate).startOf('day')),
							endDate: toInvoiceDateFilter(moment(invoiceDate).endOf('day'))
					  }
					: null
			},
			false
		);

		// Filter by invoice due date
		this.setFilter(
			{
				field: 'dueDate',
				search: dueDate
					? {
							startDate: toInvoiceDateFilter(moment(dueDate).startOf('day')),
							endDate: toInvoiceDateFilter(moment(dueDate).endOf('day'))
					  }
					: null
			},
			false
		);

		// Filter by invoice total value
		this.setFilter({ field: 'totalValue', search: totalValue }, false);

		// Filter by invoice currency
		this.setFilter({ field: 'currency', search: currency }, false);

		// Filter by invoice status
		this.setFilter({ field: 'status', search: status }, false);

		// Filter by tags
		this.setFilter({ field: 'tags', search: isNotEmpty(tags) ? tags.map((tag) => tag.id) : null });

		if (isNotEmpty(this.filters)) {
			this.refreshPagination();
			this._refresh$.next();
			this.invoices$.next([]);
		}
	}

	toggleIncludeArchived(event) {
		this.includeArchived = event;
		this._refresh$.next();
		this.invoices$.next([]);
	}

	reset() {
		this.searchForm.reset();
		this._filters = {};
		this._refresh$.next();
		this.invoices$.next([]);
	}

	selectedTagsEvent(currentTagSelection: ITag[]) {
		this.searchForm.patchValue({
			tags: currentTagSelection
		});
	}

	async selectStatus($event) {
		const forbiddenStatuses = [InvoiceStatusTypesEnum.SENT, InvoiceStatusTypesEnum.DRAFT];
		const status = this.selectedInvoice.status as unknown as {
			class: string;
			originalValue: InvoiceStatusTypesEnum;
			text: string;
		};
		if (
			!this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT) &&
			!forbiddenStatuses.includes(status?.originalValue)
		) {
			this.toastrService.warning('INVOICES_PAGE.STATUS_WARNING');
			return;
		}
		await this.invoicesService.updateAction(this.selectedInvoice.id, {
			status: $event
		});
		this._refresh$.next();
		this.invoices$.next([]);
	}

	selectColumn($event: string[]) {
		this.columns = $event;
		this._loadSmartTableSettings();
	}

	toggleTableSettingsPopover() {
		this.popups.first.toggle();
		if (this.popups.length > 1) {
			this.popups.last.hide();
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	onChangeTab(tab: NbTabComponent) {
		this.reset();
		this.nbTab$.next(tab.tabId);
	}

	private _clearItem() {
		this.selectInvoice({
			isSelected: false,
			data: null
		});
	}

	getColumns(): string[] {
		if (this.isEstimate) {
			return Object.values(EstimateColumnsEnum);
		}
		return Object.values(InvoiceColumnsEnum);
	}

	/*
	 * Create Invoice History Event
	 */
	async createInvoiceHistory(action: string, title?: string) {
		const { tenantId, id: userId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { id: invoiceId } = this.selectedInvoice;

		await this.invoiceEstimateHistoryService.add({
			action,
			title: title ?? null,
			invoice: this.selectedInvoice,
			invoiceId,
			user: this.store.user,
			userId,
			organization: this.organization,
			organizationId,
			tenantId
		});
	}

	/**
	 * On change number of item per page option
	 * @param $event is a number
	 */
	onUpdateOption($event: number) {
		this.perPage = $event;
		this.setPagination({
			...this.getPagination(),
			itemsPerPage: this.perPage
		});
	}

	currencyChanged = (event: ICurrency) => {
		this.searchForm.patchValue({ currency: event.isoCode });
		this.searchForm.updateValueAndValidity();
	};
}
