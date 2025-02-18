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
import { Angular2SmartTableComponent, Cell } from 'angular2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbMenuItem, NbMenuService, NbPopoverDirective, NbTabComponent } from '@nebular/theme';
import {
	IInvoice,
	ITag,
	IOrganization,
	InvoiceTypeEnum,
	ComponentLayoutStyleEnum,
	InvoiceStatusTypesEnum,
	EstimateStatusTypesEnum,
	InvoiceColumnsEnum,
	EstimateColumnsEnum,
	IInvoiceEstimateHistory,
	PermissionsEnum,
	IInvoiceItemCreateInput,
	InvoiceTabsEnum,
	DiscountTaxTypeEnum,
	IDateRangePicker
} from '@gauzy/contracts';
import { distinctUntilChange, isNotEmpty, toUTC } from '@gauzy/ui-core/common';
import { Router } from '@angular/router';
import { first, map, filter, tap, debounceTime } from 'rxjs/operators';
import { Subject, firstValueFrom, combineLatest, BehaviorSubject } from 'rxjs';
import * as moment from 'moment';
import { NgxPermissionsService } from 'ngx-permissions';
import { API_PREFIX, ComponentEnum } from '@gauzy/ui-core/common';
import {
	DateRangePickerBuilderService,
	InvoiceEstimateHistoryService,
	InvoiceItemService,
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
	generateCsv,
	getAdjustDateRangeFutureAllowed
} from '@gauzy/ui-core/shared';
import { InvoiceSendMutationComponent } from './invoice-send/invoice-send-mutation.component';
import { InvoicePaidComponent } from './table-components';
import { InvoiceEmailMutationComponent } from './invoice-email/invoice-email-mutation.component';
import { InvoiceDownloadMutationComponent } from './invoice-download/invoice-download-mutation.component';
import { AddInternalNoteComponent } from './add-internal-note/add-internal-note.component';
import { PublicLinkComponent } from './public-link/public-link.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-invoices',
	templateUrl: './invoices.component.html',
	styleUrls: ['invoices.component.scss']
})
export class InvoicesComponent extends PaginationFilterBaseComponent implements AfterViewInit, OnInit {
	settingsSmartTable: object;
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
	invoiceStatusTypes = Object.values(InvoiceStatusTypesEnum);
	estimateStatusTypes = Object.values(EstimateStatusTypesEnum);
	settingsContextMenu: NbMenuItem[];
	contextMenus = [];
	columns: string[] = [];
	perPage = 10;
	histories: IInvoiceEstimateHistory[] = [];
	includeArchived = false;
	invoices$: Subject<any> = this.subject$;
	invoiceTabsEnum = InvoiceTabsEnum;
	nbTab$: Subject<string> = new BehaviorSubject(InvoiceTabsEnum.ACTIONS);
	private _refresh$: Subject<any> = new Subject();

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

	/**
	 *
	 */
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
	public searchForm: UntypedFormGroup = InvoicesComponent.searchBuildForm(this.fb);
	static searchBuildForm(fb: UntypedFormBuilder): UntypedFormGroup {
		return fb.group({
			invoiceNumber: [],
			organizationContact: [],
			invoiceDate: [],
			dueDate: [],
			totalValue: [],
			currency: [],
			status: [],
			tags: []
		});
	}

	/*
	 * History Tab Form
	 */
	public historyForm: UntypedFormGroup = InvoicesComponent.historyBuildForm(this.fb);
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
	actionButtons: TemplateRef<any>;

	constructor(
		private readonly fb: UntypedFormBuilder,
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly invoicesService: InvoicesService,
		private readonly invoiceItemService: InvoiceItemService,
		private readonly router: Router,
		private readonly nbMenuService: NbMenuService,
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
		this.loadMenu();
	}

	ngAfterViewInit() {
		this.invoices$
			.pipe(
				debounceTime(100),
				tap(() => this._clearItem()),
				tap(() => this.getInvoices()),
				untilDestroyed(this)
			)
			.subscribe();
		this.nbTab$
			.pipe(
				distinctUntilChange(),
				debounceTime(100),
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this._refresh$.next(true)),
				tap(() => this.invoices$.next(true)),
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
				distinctUntilChange(),
				filter(([organization, dateRange]) => !!organization && !!dateRange),
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

	setView() {
		this.viewComponentName = this.isEstimate ? ComponentEnum.ESTIMATES : ComponentEnum.INVOICES;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				tap(() => this.closeActionsPopover()),
				tap(() => this.refreshPagination()),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => (this.invoices = [])),
				tap(() => this.invoices$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	loadMenu() {
		this.contextMenus = [
			{
				title: this.getTranslation('INVOICES_PAGE.ACTION.DUPLICATE'),
				icon: 'copy-outline',
				permission: PermissionsEnum.INVOICES_EDIT
			},
			{
				title: this.getTranslation('INVOICES_PAGE.ACTION.SEND'),
				icon: 'upload-outline',
				permission: PermissionsEnum.INVOICES_VIEW
			},
			{
				title: this.getTranslation('INVOICES_PAGE.ACTION.CONVERT_TO_INVOICE'),
				icon: 'swap',
				permission: PermissionsEnum.INVOICES_EDIT
			},
			{
				title: this.getTranslation('INVOICES_PAGE.ACTION.EMAIL'),
				icon: 'email-outline',
				permission: PermissionsEnum.INVOICES_VIEW
			},
			{
				title: this.getTranslation('INVOICES_PAGE.ACTION.DELETE'),
				icon: 'archive-outline',
				permission: PermissionsEnum.INVOICES_EDIT
			},
			{
				title: this.getTranslation('INVOICES_PAGE.ACTION.NOTE'),
				icon: 'book-open-outline',
				permission: PermissionsEnum.INVOICES_EDIT
			}
		];

		if (!this.isEstimate) {
			this.contextMenus.push({
				title: this.getTranslation('INVOICES_PAGE.ACTION.PAYMENTS'),
				icon: 'clipboard-outline',
				permission: PermissionsEnum.INVOICES_EDIT
			});
		}

		const contextMenus = this.contextMenus.filter(
			(item) => this.ngxPermissionsService.getPermission(item.permission) != null
		);
		if (this.isEstimate) {
			this.settingsContextMenu = contextMenus;
		} else {
			this.settingsContextMenu = contextMenus.filter(
				(item) => item.title !== this.getTranslation('INVOICES_PAGE.ACTION.CONVERT_TO_INVOICE')
			);
		}
		this.nbMenuService.onItemClick().pipe(first());
	}

	selectMenu(selectedItem?: IInvoice) {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}
		this.nbMenuService
			.onItemClick()
			.pipe(
				first(),
				map(({ item: { title } }) => title),
				untilDestroyed(this)
			)
			.subscribe((title) => this.bulkAction(title));
	}

	bulkAction(action: string) {
		if (action === this.getTranslation('INVOICES_PAGE.ACTION.DUPLICATE')) this.duplicated(this.selectedInvoice);
		if (action === this.getTranslation('INVOICES_PAGE.ACTION.SEND')) this.send(this.selectedInvoice);
		if (action === this.getTranslation('INVOICES_PAGE.ACTION.CONVERT_TO_INVOICE'))
			this.convert(this.selectedInvoice);
		if (action === this.getTranslation('INVOICES_PAGE.ACTION.EMAIL')) this.email(this.selectedInvoice);
		if (action === this.getTranslation('INVOICES_PAGE.ACTION.DELETE')) this.delete(this.selectedInvoice);
		if (action === this.getTranslation('INVOICES_PAGE.ACTION.PAYMENTS')) this.payments();
		if (action === this.getTranslation('INVOICES_PAGE.ACTION.NOTE')) this.addInternalNote();
	}

	add() {
		if (this.isEstimate) {
			this.router.navigate(['/pages/accounting/invoices/estimates/add']);
		} else {
			this.router.navigate(['/pages/accounting/invoices/add']);
		}
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
			this.router.navigate([`/pages/accounting/invoices/estimates/edit`, id]);
		} else {
			this.router.navigate([`/pages/accounting/invoices/edit`, id]);
		}
	}

	async duplicated(selectedItem?: IInvoice) {
		this.invoicesService.changeValue(true);
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const status: any = this.selectedInvoice.status;
		const tax: any = this.selectedInvoice.tax;
		const tax2: any = this.selectedInvoice.tax2;
		const discountValue: any = this.selectedInvoice.discountValue;

		const invoiceNumber = await this.invoicesService.getHighestInvoiceNumber(tenantId);
		const createdInvoice = await this.invoicesService.add({
			invoiceNumber: +invoiceNumber['max'] + 1,
			invoiceDate: this.selectedInvoice.invoiceDate,
			dueDate: this.selectedInvoice.dueDate,
			currency: this.selectedInvoice.currency,
			discountValue: discountValue ? discountValue.originalValue : 0,
			discountType: this.selectedInvoice.discountType,
			tax: tax ? tax.originalValue : 0,
			tax2: tax2 ? tax2.originalValue : 0,
			taxType: this.selectedInvoice.taxType,
			tax2Type: this.selectedInvoice.tax2Type,
			terms: this.selectedInvoice.terms,
			paid: this.selectedInvoice.paid,
			totalValue: this.selectedInvoice.totalValue,
			organizationContactId: this.selectedInvoice.organizationContactId,
			toContact: this.selectedInvoice.toContact,
			organizationContactName: this.selectedInvoice.toContact?.name,
			fromOrganization: this.organization,
			organizationId,
			tenantId,
			invoiceType: this.selectedInvoice.invoiceType,
			tags: this.selectedInvoice.tags,
			isEstimate: this.isEstimate,
			status: status ? status.originalValue : InvoiceStatusTypesEnum.DRAFT
		});

		const invoiceItems: IInvoiceItemCreateInput[] = [];

		for (const item of this.selectedInvoice.invoiceItems) {
			const itemToAdd = {
				description: item.description,
				price: item.price,
				quantity: item.quantity,
				totalValue: item.totalValue,
				invoiceId: createdInvoice.id,
				tenantId,
				organizationId
			};
			switch (this.selectedInvoice.invoiceType) {
				case InvoiceTypeEnum.BY_EMPLOYEE_HOURS:
					itemToAdd['employeeId'] = item.employeeId;
					break;
				case InvoiceTypeEnum.BY_PROJECT_HOURS:
					itemToAdd['projectId'] = item.projectId;
					break;
				case InvoiceTypeEnum.BY_TASK_HOURS:
					itemToAdd['taskId'] = item.taskId;
					break;
				case InvoiceTypeEnum.BY_PRODUCTS:
					itemToAdd['productId'] = item.productId;
					break;
				default:
					break;
			}

			invoiceItems.push(itemToAdd);
		}
		await this.invoiceItemService.createBulk(createdInvoice.id, invoiceItems);

		const action = this.isEstimate
			? this.getTranslation('INVOICES_PAGE.INVOICES_DUPLICATE_ESTIMATE')
			: this.getTranslation('INVOICES_PAGE.INVOICES_DUPLICATE_INVOICE');

		await this.createInvoiceHistory(action);

		const { id } = createdInvoice;
		if (this.isEstimate) {
			this.toastrService.success('INVOICES_PAGE.INVOICES_DUPLICATE_ESTIMATE');
			this.router.navigate([`/pages/accounting/invoices/estimates/edit`, id]);
		} else {
			this.toastrService.success('INVOICES_PAGE.INVOICES_DUPLICATE_INVOICE');
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

	send(selectedItem?: IInvoice) {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}
		if (this.selectedInvoice.organizationContactId) {
			this.dialogService
				.open(InvoiceSendMutationComponent, {
					context: {
						invoice: this.selectedInvoice,
						isEstimate: this.isEstimate
					}
				})
				.onClose.pipe(
					tap(() => this._refresh$.next(true)),
					tap(() => this.invoices$.next(true)),
					untilDestroyed(this)
				)
				.subscribe();
		} else {
			this.toastrService.warning('INVOICES_PAGE.SEND.NOT_LINKED');
		}
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
		this._refresh$.next(true);
		this.invoices$.next(true);
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
			this._refresh$.next(true);
			this.invoices$.next(true);
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

	email(selectedItem?: IInvoice) {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService
			.open(InvoiceEmailMutationComponent, {
				context: {
					invoice: this.selectedInvoice,
					isEstimate: this.isEstimate
				}
			})
			.onClose.pipe(
				tap(() => this._refresh$.next(true)),
				tap(() => this.invoices$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	payments() {
		const { id } = this.selectedInvoice;
		this.router.navigate([`/pages/accounting/invoices/payments`, id]);
	}

	addInternalNote() {
		this.dialogService
			.open(AddInternalNoteComponent, {
				context: {
					invoice: this.selectedInvoice
				}
			})
			.onClose.pipe(
				tap(() => this._refresh$.next(true)),
				tap(() => this.invoices$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	exportToCsv(selectedItem) {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}

		let fileName: string;
		const {
			invoiceNumber,
			invoiceDate,
			dueDate,
			status,
			totalValue,
			tax,
			tax2,
			discountValue,
			toContact,
			isEstimate
		} = this.selectedInvoice;
		if (isEstimate) {
			fileName = `${this.getTranslation('INVOICES_PAGE.ESTIMATE')}-${invoiceNumber}`;
		} else {
			fileName = `${this.getTranslation('INVOICES_PAGE.INVOICE')}-${invoiceNumber}`;
		}

		const data = [
			{
				invoiceNumber,
				invoiceDate,
				dueDate,
				status: `${this.getTranslation(`INVOICES_PAGE.STATUSES.${status}`)}`,
				totalValue,
				tax,
				tax2,
				discountValue,
				contact: toContact.name
			}
		];

		const headers = [
			isEstimate
				? this.getTranslation('INVOICES_PAGE.ESTIMATE_NUMBER')
				: this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER'),
			isEstimate
				? this.getTranslation('INVOICES_PAGE.ESTIMATE_DATE')
				: this.getTranslation('INVOICES_PAGE.INVOICE_DATE'),
			this.getTranslation('INVOICES_PAGE.DUE_DATE'),
			this.getTranslation('INVOICES_PAGE.STATUS'),
			this.getTranslation('INVOICES_PAGE.TOTAL_VALUE'),
			this.getTranslation('INVOICES_PAGE.TAX'),
			this.getTranslation('INVOICES_PAGE.TAX_2'),
			this.getTranslation('INVOICES_PAGE.INVOICES_SELECT_DISCOUNT_VALUE'),
			this.getTranslation('INVOICES_PAGE.CONTACT')
		].join(',');

		generateCsv(data, headers, fileName);
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
				'fromOrganization',
				'toContact',
				'historyRecords',
				'historyRecords.user'
			],
			join: {
				alias: 'invoice',
				leftJoin: {
					toContact: 'invoice.toContact',
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
					startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
					endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss')
				},
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (invoice: IInvoice) => {
				return Object.assign({}, invoice, {
					organizationContactName: invoice.toContact ? invoice.toContact.name : null,
					status: this.statusMapper(invoice.status),
					tax: this.taxMapper(invoice.taxType, invoice.tax),
					tax2: this.taxMapper(invoice.tax2Type, invoice.tax2),
					discountValue: this.taxMapper(invoice.discountType, invoice.discountValue)
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
				// Initiate GRID or TABLE view pagination
				await this.smartTableSource.getElements();
			}
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
				'fromOrganization',
				'toContact',
				'historyRecords',
				'historyRecords.user'
			]);

			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.TABLE) {
				this.invoicesTable.grid.getRows().map((row) => {
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

	async generatePublicLink(selectedItem: IInvoice) {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}
		this.dialogService.open(PublicLinkComponent, {
			context: {
				invoice: this.selectedInvoice
			}
		});
	}

	async archive() {
		await this.invoicesService.updateAction(this.selectedInvoice.id, {
			isArchived: true
		});
		this._refresh$.next(true);
		this.invoices$.next(true);
	}

	async selectInvoice({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedInvoice = isSelected ? data : null;

		if (isSelected) {
			this.canBeSend = data.toContact ? isSelected : !isSelected;
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

	private statusMapper = (value: string) => {
		let badgeClass;
		if (value) {
			badgeClass = ['sent', 'viewed', 'accepted', 'active', 'fully paid'].includes(value.toLowerCase())
				? 'success'
				: ['void', 'draft', 'partially paid'].includes(value.toLowerCase())
				? 'warning'
				: 'danger';
		}
		return {
			originalValue: value,
			text: this.getTranslation(`INVOICES_PAGE.STATUSES.${value.toUpperCase()}`),
			class: badgeClass
		};
	};

	private taxMapper = (taxType: DiscountTaxTypeEnum, tax: number) => {
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
			selectedRowIndex: -1,
			actions: false,
			editable: true,
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
				valuePrepareFunction: (row: { value?: any }) => {
					return row?.value ?? '';
				}
			};
		}
		if (this.columns.includes(InvoiceColumnsEnum.TAX_2)) {
			this.settingsSmartTable['columns']['tax2'] = {
				title: this.getTranslation('INVOICES_PAGE.TAX_2'),
				type: 'text',
				width: '6%',
				isFilterable: false,
				valuePrepareFunction: (row: { value?: any }) => {
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
				valuePrepareFunction: (row: { value?: any }) => {
					return row?.value ?? '';
				}
			};
		}
		if (this.columns.includes(InvoiceColumnsEnum.CONTACT)) {
			this.settingsSmartTable['columns']['toContact'] = {
				title: this.getTranslation('INVOICES_PAGE.CONTACT'),
				type: 'custom',
				width: '12%',
				isFilterable: false,
				isSortable: false,
				renderComponent: ContactLinksComponent,
				componentInitFunction: (instance: ContactLinksComponent, cell: Cell) => {
					instance.rowData = cell.getRow().getData();
					instance.value = cell.getRawValue();
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
		const {
			dueDate,
			invoiceNumber,
			invoiceDate,
			totalValue,
			currency,
			status,
			organizationContact,
			tags = []
		} = this.searchForm.value;

		if (invoiceNumber) {
			this.setFilter({ field: 'invoiceNumber', search: invoiceNumber }, false);
		}
		if (invoiceDate) {
			this.setFilter(
				{
					field: 'invoiceDate',
					search: moment(invoiceDate).format('YYYY-MM-DD')
				},
				false
			);
		}
		if (dueDate) {
			this.setFilter(
				{
					field: 'dueDate',
					search: moment(dueDate).format('YYYY-MM-DD')
				},
				false
			);
		}
		if (totalValue) {
			this.setFilter({ field: 'totalValue', search: totalValue }, false);
		}
		if (currency) {
			this.setFilter({ field: 'currency', search: currency }, false);
		}
		if (status) {
			this.setFilter({ field: 'status', search: status }, false);
		}
		if (organizationContact) {
			this.setFilter({ field: 'toContact', search: [organizationContact.id] }, false);
		}
		if (isNotEmpty(tags)) {
			const tagIds = [];
			for (const tag of tags) {
				tagIds.push(tag.id);
			}
			this.setFilter({ field: 'tags', search: tagIds });
		}
		if (isNotEmpty(this.filters)) {
			this.refreshPagination();
			this._refresh$.next(true);
			this.invoices$.next(true);
		}
	}

	toggleIncludeArchived(event) {
		this.includeArchived = event;
		this._refresh$.next(true);
		this.invoices$.next(true);
	}

	reset() {
		this.searchForm.reset();
		this._filters = {};
		this._refresh$.next(true);
		this.invoices$.next(true);
	}

	selectedTagsEvent(currentTagSelection: ITag[]) {
		this.searchForm.patchValue({
			tags: currentTagSelection
		});
	}

	async selectStatus($event) {
		await this.invoicesService.updateAction(this.selectedInvoice.id, {
			status: $event
		});
		this._refresh$.next(true);
		this.invoices$.next(true);
	}

	selectColumn($event: string[]) {
		this.columns = $event;
		this._loadSmartTableSettings();
	}

	toggleActionsPopover() {
		this.popups.last.toggle();
		this.popups.first.hide();
	}

	toggleTableSettingsPopover() {
		this.popups.first.toggle();
		if (this.popups.length > 1) {
			this.popups.last.hide();
		}
	}

	closeActionsPopover() {
		if (this.popups) {
			const actionsPopup = this.popups.first;
			const settingsPopup = this.popups.last;
			if (settingsPopup.isShown) {
				settingsPopup.hide();
			}

			if (actionsPopup.isShown) {
				actionsPopup.hide();
			}
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
		this.nbTab$.next(tab.tabId);
		this.closeActionsPopover();
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

	/**
	 * Handle event when user click outside tag
	 * @param event is a boolean
	 */
	onClickOutside(event: boolean) {
		// Close popover after click any button inside
		if (event) this.toggleActionsPopover();
	}
}
