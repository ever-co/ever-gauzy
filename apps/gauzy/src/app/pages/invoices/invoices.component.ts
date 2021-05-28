import {
	Component,
	OnInit,
	ViewChild,
	OnDestroy,
	Input,
	QueryList,
	ViewChildren,
	TemplateRef,
	AfterViewInit,
	ChangeDetectorRef
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import {
	NbDialogService,
	NbMenuItem,
	NbMenuService,
	NbPopoverDirective
} from '@nebular/theme';
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
	IOrganizationContact,
	IInvoiceEstimateHistory,
	PermissionsEnum,
	ICurrency,
	IInvoiceItemCreateInput
} from '@gauzy/contracts';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import { Router } from '@angular/router';
import { first, map, filter, tap, debounceTime } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import * as moment from 'moment';
import { NgxPermissionsService } from 'ngx-permissions';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { InvoiceSendMutationComponent } from './invoice-send/invoice-send-mutation.component';
import { InvoicePaidComponent } from './table-components/invoice-paid.component';
import { NotesWithTagsComponent } from '../../@shared/table-components';
import { InvoiceEmailMutationComponent } from './invoice-email/invoice-email-mutation.component';
import { InvoiceDownloadMutationComponent } from './invoice-download/invoice-download-mutation.component';
import { API_PREFIX, ComponentEnum } from '../../@core/constants';
import { StatusBadgeComponent } from '../../@shared/status-badge/status-badge.component';
import { AddInternalNoteComponent } from './add-internal-note/add-internal-note.component';
import { PublicLinkComponent } from './public-link/public-link.component';
import { generateCsv } from '../../@shared/invoice/generate-csv';
import {
	InvoiceEstimateHistoryService,
	InvoiceItemService,
	InvoicesService,
	OrganizationContactService,
	Store,
	ToastrService
} from '../../@core/services';
import { ServerDataSource } from '../../@core/utils/smart-table/server.data-source';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-invoices',
	templateUrl: './invoices.component.html',
	styleUrls: ['invoices.component.scss']
})
export class InvoicesComponent
	extends TranslationBaseComponent
	implements AfterViewInit, OnInit, OnDestroy {

	settingsSmartTable: object;
	smartTableSource: ServerDataSource;
	selectedInvoice: IInvoice;
	loading: boolean = false;
	disableButton = true;
	invoices: IInvoice[] = [];
	organization: IOrganization;
	viewComponentName: ComponentEnum;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	invoiceStatusTypes = Object.values(InvoiceStatusTypesEnum);
	estimateStatusTypes = Object.values(EstimateStatusTypesEnum);
	settingsContextMenu: NbMenuItem[];
	contextMenus = [];
	columns: any;
	organizationContacts: IOrganizationContact[];
	duplicate: boolean;
	perPage = 10;
	histories: IInvoiceEstimateHistory[] = [];
	includeArchived = false;
	subject$: Subject<any> = new Subject();

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
	* getter setter for search tab filters 
	*/
	private _filters: any = {};
	set filters(val: any) {
		this._filters = val;
	}
	get filters() {
		return this._filters;
	}

	invoicesTable: Ng2SmartTableComponent;
	@ViewChild('invoicesTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.invoicesTable = content;
			this.onChangedSource();
		}
	}

	@ViewChildren(NbPopoverDirective)
	public popups: QueryList<NbPopoverDirective>;

	/*
	* Search Tab Form 
	*/
	public searchForm: FormGroup = InvoicesComponent.searchBuildForm(this.fb);
	static searchBuildForm(fb: FormBuilder): FormGroup {
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
	public historyForm: FormGroup = InvoicesComponent.historyBuildForm(this.fb);
	static historyBuildForm(fb: FormBuilder): FormGroup {
		return fb.group({
			comment: []
		});
	}

	/*
	* Actions Buttons directive 
	*/
	@ViewChild('actionButtons', { static : true }) actionButtons : TemplateRef<any>;

	constructor(
		private readonly fb: FormBuilder,
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly invoicesService: InvoicesService,
		private readonly invoiceItemService: InvoiceItemService,
		private readonly router: Router,
		private readonly nbMenuService: NbMenuService,
		private readonly organizationContactService: OrganizationContactService,
		private readonly invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private readonly ngxPermissionsService: NgxPermissionsService,
		private readonly httpClient: HttpClient,
		private readonly cdr: ChangeDetectorRef
	) {
		super(translateService);
	}

	ngOnInit() {
		this.columns = this.getColumns();
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
		this.loadMenu();
		this.setView();
	}

	ngAfterViewInit() {
		this.subject$
			.pipe(
				tap(() => this.loading = true),
				debounceTime(200),
				tap(() => this.cdr.detectChanges()),
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
		this.viewComponentName = this.isEstimate ? ComponentEnum.ESTIMATES : ComponentEnum.INVOICES;
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
				title: this.getTranslation(
					'INVOICES_PAGE.ACTION.CONVERT_TO_INVOICE'
				),
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

		const contextMenus = this.contextMenus.filter((item) => this.ngxPermissionsService.getPermission(item.permission) != null)
		if (this.isEstimate) {
			this.settingsContextMenu = contextMenus;
		} else {
			this.settingsContextMenu = contextMenus.filter((item) => item.title !== this.getTranslation('INVOICES_PAGE.ACTION.CONVERT_TO_INVOICE'));
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

	bulkAction(action) {
		if (action === this.getTranslation('INVOICES_PAGE.ACTION.DUPLICATE'))
			this.duplicated(this.selectedInvoice);
		if (action === this.getTranslation('INVOICES_PAGE.ACTION.SEND'))
			this.send(this.selectedInvoice);
		if (
			action ===
			this.getTranslation('INVOICES_PAGE.ACTION.CONVERT_TO_INVOICE')
		)
			this.convert(this.selectedInvoice);
		if (action === this.getTranslation('INVOICES_PAGE.ACTION.EMAIL'))
			this.email(this.selectedInvoice);
		if (action === this.getTranslation('INVOICES_PAGE.ACTION.DELETE'))
			this.delete(this.selectedInvoice);
		if (action === this.getTranslation('INVOICES_PAGE.ACTION.PAYMENTS'))
			this.payments();
		if (action === this.getTranslation('INVOICES_PAGE.ACTION.NOTE'))
			this.addInternalNote();
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

		if (this.isEstimate) {
			this.router.navigate([
				`/pages/accounting/invoices/estimates/edit/${this.selectedInvoice.id}`
			]);
		} else {
			this.router.navigate([
				`/pages/accounting/invoices/edit/${this.selectedInvoice.id}`
			]);
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
		const invoiceNumber = await this.invoicesService.getHighestInvoiceNumber(
			tenantId
		);
		const createdInvoice = await this.invoicesService.add({
			invoiceNumber: +invoiceNumber['max'] + 1,
			invoiceDate: this.selectedInvoice.invoiceDate,
			dueDate: this.selectedInvoice.dueDate,
			currency: this.selectedInvoice.currency,
			discountValue: this.selectedInvoice.discountValue,
			discountType: this.selectedInvoice.discountType,
			tax: this.selectedInvoice.tax,
			tax2: this.selectedInvoice.tax2,
			taxType: this.selectedInvoice.taxType,
			tax2Type: this.selectedInvoice.tax2Type,
			terms: this.selectedInvoice.terms,
			paid: this.selectedInvoice.paid,
			totalValue: this.selectedInvoice.totalValue,
			organizationContactId: this.selectedInvoice.organizationContactId,
			toContact: this.selectedInvoice.toContact,
			organizationContactName: this.selectedInvoice.toContact?.name,
			fromOrganization: this.organization,
			organizationId: this.selectedInvoice.organizationId,
			tenantId,
			invoiceType: this.selectedInvoice.invoiceType,
			tags: this.selectedInvoice.tags,
			isEstimate: this.isEstimate,
			status: this.selectedInvoice.status
		});

		const invoiceItems: IInvoiceItemCreateInput[] = [];

		for (const item of this.selectedInvoice.invoiceItems) {
			const organizationId = this.organization.id;
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
		await this.invoiceItemService.createBulk(
			createdInvoice.id,
			invoiceItems
		);

		await this.invoiceEstimateHistoryService.add({
			action: this.isEstimate
				? this.getTranslation(
					'INVOICES_PAGE.INVOICES_DUPLICATE_ESTIMATE'
				)
				: this.getTranslation(
					'INVOICES_PAGE.INVOICES_DUPLICATE_INVOICE'
				),
			invoice: this.selectedInvoice,
			invoiceId: this.selectedInvoice.id,
			user: this.store.user,
			userId: this.store.userId,
			organization: this.organization,
			organizationId: this.organization.id,
			tenantId
		});

		if (this.isEstimate) {
			this.toastrService.success(
				'INVOICES_PAGE.INVOICES_DUPLICATE_ESTIMATE'
			);
			this.router.navigate([
				`/pages/accounting/invoices/estimates/edit/${createdInvoice.id}`
			]);
		} else {
			this.toastrService.success(
				'INVOICES_PAGE.INVOICES_DUPLICATE_INVOICE'
			);
			this.router.navigate([
				`/pages/accounting/invoices/edit/${createdInvoice.id}`
			]);
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
				.onClose
				.pipe(
					tap(() => this.subject$.next()),
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
		await this.invoicesService.update(this.selectedInvoice.id, {
			isEstimate: false,
			status: InvoiceStatusTypesEnum.DRAFT
		});
		await this.invoiceEstimateHistoryService.add({
			action: this.getTranslation(
				'INVOICES_PAGE.ESTIMATES.CONVERTED_TO_INVOICE'
			),
			invoice: this.selectedInvoice,
			invoiceId: this.selectedInvoice.id,
			user: this.store.user,
			userId: this.store.userId,
			organization: this.organization,
			organizationId: this.organization.id,
			tenantId: this.organization.tenantId
		});
		this.toastrService.success('INVOICES_PAGE.ESTIMATES.ESTIMATE_CONVERT');
		this.subject$.next();
	}

	async delete(selectedItem?: IInvoice) {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			const itemsToDelete = this.selectedInvoice.invoiceItems;
			await this.invoicesService.delete(this.selectedInvoice.id);

			for (const item of itemsToDelete) {
				await this.invoiceItemService.delete(item.id);
			}
			for (const history of this.histories) {
				await this.invoiceEstimateHistoryService.delete(history.id);
			}
			if (this.isEstimate) {
				this.toastrService.success('INVOICES_PAGE.INVOICES_DELETE_ESTIMATE');
			} else {
				this.toastrService.success('INVOICES_PAGE.INVOICES_DELETE_INVOICE');
			}
			this.subject$.next();
		}
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
			.onClose
			.pipe(
				tap(() => this.subject$.next()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	payments() {
		this.router.navigate([
			`/pages/accounting/invoices/payments/${this.selectedInvoice.id}`
		]);
	}

	addInternalNote() {
		this.dialogService
			.open(AddInternalNoteComponent, {
				context: {
					invoice: this.selectedInvoice
				}
			})
			.onClose
			.pipe(
				tap(() => this.subject$.next()),
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

		let fileName;

		if (this.selectedInvoice.isEstimate) {
			fileName = `${this.getTranslation('INVOICES_PAGE.ESTIMATE')}-${this.selectedInvoice.invoiceNumber
				}`;
		} else {
			fileName = `${this.getTranslation('INVOICES_PAGE.INVOICE')}-${this.selectedInvoice.invoiceNumber
				}`;
		}

		const data = [
			{
				invoiceNumber: this.selectedInvoice.invoiceNumber,
				invoiceDate: this.selectedInvoice.invoiceDate,
				dueDate: this.selectedInvoice.dueDate,
				status: `${this.getTranslation(
					`INVOICES_PAGE.STATUSES.${this.selectedInvoice.status}`
				)}`,
				totalValue: this.selectedInvoice.totalValue,
				tax: this.selectedInvoice.tax,
				tax2: this.selectedInvoice.tax2,
				discountValue: this.selectedInvoice.discountValue,
				contact: this.selectedInvoice.toContact.name
			}
		];

		const headers = [
			this.selectedInvoice.isEstimate
				? this.getTranslation('INVOICES_PAGE.ESTIMATE_NUMBER')
				: this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER'),
			this.selectedInvoice.isEstimate
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
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/invoices/search/filter`,
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
			join: this.filters.join,
			where: {
				organizationId,
				tenantId,
				isEstimate: (this.isEstimate === true) ? 1 : 0,
				isArchived: (this.includeArchived === true) ? 1 : 0,
				...this.filters.where
			},
			resultMap: (i) => {
				return Object.assign({}, i, {
					organizationContactName: i.toContact?.name
				});
			}
		});
	}

	async getInvoices() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				await this.smartTableSource.getElements();
				this.invoices = this.smartTableSource.getData();
			}
			this.loading = false;
		} catch (error) {
			this.toastrService.danger(
				this.getTranslation('NOTES.INVOICE.INVOICE_ERROR', {
					error: error.error.message || error.message
				}),
				this.getTranslation('TOASTR.TITLE.ERROR')
			);
		}
	}

	async addComment() {
		const { comment } = this.historyForm.value;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		if (comment) {
			await this.invoiceEstimateHistoryService.add({
				action: comment,
				invoice: this.selectedInvoice,
				invoiceId: this.selectedInvoice.id,
				user: this.store.user,
				userId: this.store.userId,
				organization: this.organization,
				organizationId,
				tenantId
			});
			this.historyForm.reset();

			const selectedInvoiceId = this.selectedInvoice.id;
			const invoice = await this.invoicesService.getById(
				selectedInvoiceId,
				[
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
				]
			);

			await this.smartTableSource.update(this.selectedInvoice, {
				...invoice
			});

			this.selectInvoice({
				isSelected: true,
				data: invoice
			});
		}
	}

	async generatePublicLink(selectedItem) {
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
		await this.invoicesService.update(this.selectedInvoice.id, {
			isArchived: true
		});
		this.subject$.next();
	}

	async selectInvoice({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedInvoice = isSelected ? data : null;

		if (isSelected) {
			const { historyRecords = [] } = data;
			const histories = [];
			historyRecords.forEach((h: IInvoiceEstimateHistory) => {
				const history = {
					id: h.id,
					createdAt: new Date(h.createdAt).toString().slice(0, 24),
					action: h.action,
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

	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			pager: {
				display: true,
				perPage: this.perPage ? this.perPage : 10
			},
			hideSubHeader: true,
			actions: false,
			mode: 'external',
			editable: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
			columns: {
				invoiceNumber: {
					title: this.isEstimate
						? this.getTranslation(
							'INVOICES_PAGE.ESTIMATES.ESTIMATE_NUMBER'
						)
						: this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER'),
					type: 'custom',
					sortDirection: 'asc',
					width: '10%',
					renderComponent: NotesWithTagsComponent
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
				type: 'date',
				width: '10%',
				filter: false,
				valuePrepareFunction: (cell, row) => {
					return `${cell.slice(0, 10)}`;
				}
			};
		}
		if (this.columns.includes(InvoiceColumnsEnum.DUE_DATE)) {
			this.settingsSmartTable['columns']['dueDate'] = {
				title: this.getTranslation('INVOICES_PAGE.DUE_DATE'),
				type: 'date',
				width: '10%',
				filter: false,
				valuePrepareFunction: (cell, row) => {
					return `${cell.slice(0, 10)}`;
				}
			};
		}
		if (this.columns.includes(InvoiceColumnsEnum.STATUS)) {
			this.settingsSmartTable['columns']['status'] = {
				title: this.getTranslation('INVOICES_PAGE.STATUS'),
				type: 'custom',
				width: '5%',
				renderComponent: StatusBadgeComponent,
				filter: false,
				valuePrepareFunction: (cell, row) => {
					let badgeClass;
					if (cell) {
						badgeClass = [
							'sent',
							'viewed',
							'accepted',
							'active',
							'fully paid'
						].includes(cell.toLowerCase())
							? 'success'
							: ['void', 'draft', 'partially paid'].includes(
								cell.toLowerCase()
							)
								? 'warning'
								: 'danger';
					}
					return {
						text: this.getTranslation(
							`INVOICES_PAGE.STATUSES.${cell.toUpperCase()}`
						),
						class: badgeClass
					};
				}
			};
		}
		if (this.columns.includes(InvoiceColumnsEnum.TOTAL_VALUE)) {
			this.settingsSmartTable['columns']['totalValue'] = {
				title: this.getTranslation('INVOICES_PAGE.TOTAL_VALUE'),
				type: 'text',
				filter: false,
				width: '10%',
				valuePrepareFunction: (cell, row) => {
					return `${row.currency} ${parseFloat(cell).toFixed(2)}`;
				}
			};
		}
		if (this.columns.includes(InvoiceColumnsEnum.TAX)) {
			this.settingsSmartTable['columns']['tax'] = {
				title: this.getTranslation('INVOICES_PAGE.TAX'),
				type: 'text',
				width: '5%',
				filter: false,
				valuePrepareFunction: (cell, row) => {
					return `${cell} ${row.taxType ===
						this.getTranslation('INVOICES_PAGE.PERCENT')
						? '%'
						: ''
						}`;
				}
			};
		}
		if (this.columns.includes(InvoiceColumnsEnum.TAX_2)) {
			this.settingsSmartTable['columns']['tax2'] = {
				title: this.getTranslation('INVOICES_PAGE.TAX_2'),
				type: 'text',
				width: '5%',
				filter: false,
				valuePrepareFunction: (cell, row) => {
					return `${cell} ${row.tax2Type ===
						this.getTranslation('INVOICES_PAGE.PERCENT')
						? '%'
						: ''
						}`;
				}
			};
		}
		if (this.columns.includes(InvoiceColumnsEnum.DISCOUNT)) {
			this.settingsSmartTable['columns']['discountValue'] = {
				title: this.getTranslation(
					'INVOICES_PAGE.INVOICES_SELECT_DISCOUNT_VALUE'
				),
				type: 'text',
				width: '5%',
				filter: false,
				valuePrepareFunction: (cell, row) => {
					return `${cell} ${row.discountType ===
						this.getTranslation('INVOICES_PAGE.PERCENT')
						? '%'
						: ''
						}`;
				}
			};
		}
		if (this.columns.includes(InvoiceColumnsEnum.CONTACT)) {
			this.settingsSmartTable['columns']['organizationContactName'] = {
				title: this.getTranslation('INVOICES_PAGE.CONTACT'),
				type: 'text',
				width: '12%',
				filter: false,
				valuePrepareFunction: (cell, row) => {
					if (isNotEmpty(row.toContact)) {
						return row.toContact.name;
					}
					return '';
				}
			};
		}
		if (!this.isEstimate) {
			if (this.columns.includes(InvoiceColumnsEnum.PAID_STATUS)) {
				this.settingsSmartTable['columns']['paid'] = {
					title: this.getTranslation('INVOICES_PAGE.PAID_STATUS'),
					type: 'custom',
					width: '20%',
					renderComponent: InvoicePaidComponent,
					filter: false
				};
			}
		}
	}

	showPerPage() {
		if (
			this.perPage &&
			Number.isInteger(this.perPage) &&
			this.perPage > 0
		) {
			this.smartTableSource.getPaging().perPage = this.perPage;
			this._loadSmartTableSettings();
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
		const filters: any = {
			where: {},
			join: {
				alias: "invoice",
				leftJoin: {}
			},
		}
		if (invoiceNumber) {
			filters.where.invoiceNumber = invoiceNumber
		}
		if (invoiceDate) {
			filters.where.invoiceDate = moment(invoiceDate).format('YYYY-MM-DD')
		}
		if (dueDate) {
			filters.where.dueDate = moment(dueDate).format('YYYY-MM-DD')
		}
		if (totalValue) {
			filters.where.totalValue = totalValue
		}
		if (currency) {
			filters.where.currency = currency
		}
		if (status) {
			filters.where.status = status
		}
		if (organizationContact) {
			filters.join.leftJoin.toContact = "invoice.toContact"
			filters.where['toContact'] = { id: organizationContact.id }
		}
		if (isNotEmpty(tags)) {
			filters.join.leftJoin.tags = 'invoice.tags'
			const tagId = []
			for (const tag of tags) {
				tagId.push(tag.id)
			}
			filters.where.tags = tagId
		}
		if (isNotEmpty(filters)) {
			this._filters = filters;
			this.subject$.next();
		}
	}

	toggleIncludeArchived(event) {
		this.includeArchived = event;
		this.subject$.next();
	}

	reset() {
		this.searchForm.reset();
		this._filters = {};
		this.subject$.next();
	}

	searchContact(term: string, item: any) {
		if (item.name) {
			return item.name.toLowerCase().includes(term.toLowerCase());
		}
	}

	selectedTagsEvent(currentTagSelection: ITag[]) {
		this.searchForm.patchValue({
			tags: currentTagSelection
		});
	}

	async selectStatus($event) {
		await this.invoicesService.update(this.selectedInvoice.id, {
			status: $event
		});
		this.subject$.next();
	}

	selectColumn($event: string[]) {
		this.columns = $event;
		this._loadSmartTableSettings();
	}

	toggleActionsPopover() {
		this.popups.first.toggle();
		this.popups.last.hide();
	}

	toggleTableSettingsPopover() {
		this.popups.last.toggle();
		if (this.popups.length > 1) {
			this.popups.first.hide();
		}
	}

	closeActionsPopover() {
		const actionsPopup = this.popups.first;
		if (actionsPopup.isShown) {
			actionsPopup.hide();
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

	async onChangeTab(event) {
		if (event.tabId === 'search') {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			const { items = [] } = await this.organizationContactService.getAll([], {
				organizationId,
				tenantId
			});
			this.organizationContacts = items;
		}
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
		if (this.invoicesTable && this.invoicesTable.grid) {
			this.invoicesTable.grid.dataSet['willSelect'] = 'false';
			this.invoicesTable.grid.dataSet.deselectAll();
		}
	}

	getColumns(): string[] {
		if (this.isEstimate) {
			return Object.values(EstimateColumnsEnum);
		}
		return Object.values(InvoiceColumnsEnum);
	}

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) { }

	ngOnDestroy() { }
}
