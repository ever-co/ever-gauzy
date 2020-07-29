import { Component, OnInit, ViewChild, OnDestroy, Input } from '@angular/core';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import {
	NbDialogService,
	NbToastrService,
	NbMenuItem,
	NbMenuService
} from '@nebular/theme';
import {
	Invoice,
	PermissionsEnum,
	Tag,
	Organization,
	InvoiceTypeEnum,
	ComponentLayoutStyleEnum,
	InvoiceStatusTypesEnum,
	EstimateStatusTypesEnum,
	InvoiceColumnsEnum,
	EstimateColumnsEnum,
	CurrenciesEnum,
	OrganizationContact
} from '@gauzy/models';
import { InvoicesService } from '../../@core/services/invoices.service';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { first, takeUntil, map } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { InvoiceItemService } from '../../@core/services/invoice-item.service';
import { Subject } from 'rxjs';
import { InvoiceSendMutationComponent } from './invoice-send/invoice-send-mutation.component';
import { InvoicePaidComponent } from './table-components/invoice-paid.component';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { InvoiceEmailMutationComponent } from './invoice-email/invoice-email-mutation.component';
import { InvoiceDownloadMutationComponent } from './invoice-download/invoice-download-mutation.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { FormBuilder, FormGroup } from '@angular/forms';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';

@Component({
	selector: 'ngx-invoices',
	templateUrl: './invoices.component.html',
	styleUrls: ['invoices.component.scss']
})
export class InvoicesComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	selectedInvoice: Invoice;
	loading = true;
	disableButton = true;
	hasInvoiceEditPermission: boolean;
	invoices: Invoice[];
	tags: Tag[] = [];
	organization: Organization;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	invoiceStatusTypes = Object.values(InvoiceStatusTypesEnum);
	estimateStatusTypes = Object.values(EstimateStatusTypesEnum);
	invoiceColumns = Object.values(InvoiceColumnsEnum);
	estimateColumns = Object.values(EstimateColumnsEnum);
	status: string;
	settingsContextMenu: NbMenuItem[];
	menuArray = [];
	columns = Object.values(InvoiceColumnsEnum);
	currencies = Object.values(CurrenciesEnum);
	form: FormGroup;
	clients: OrganizationContact[];

	private _ngDestroy$ = new Subject<void>();

	@Input() isEstimate: boolean;

	@ViewChild('invoicesTable') invoicesTable;

	constructor(
		private fb: FormBuilder,
		readonly translateService: TranslateService,
		private store: Store,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private invoicesService: InvoicesService,
		private invoiceItemService: InvoiceItemService,
		private router: Router,
		private nbMenuService: NbMenuService,
		private organizationContactService: OrganizationContactService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.initializeForm();
		if (!this.isEstimate) {
			this.isEstimate = false;
		}
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasInvoiceEditPermission = this.store.hasPermission(
					PermissionsEnum.INVOICES_EDIT
				);
			});
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.loadSettings();
		this.loadMenu();
		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
	}

	initializeForm() {
		this.form = this.fb.group({
			invoiceNumber: [],
			client: [],
			invoiceDate: [],
			dueDate: [],
			totalValue: [],
			currency: [],
			status: []
		});
	}

	setView() {
		this.viewComponentName = ComponentEnum.ESTIMATES;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	loadMenu() {
		this.menuArray = [
			{
				title: 'Duplicate',
				icon: 'copy-outline'
			},
			{
				title: 'Send',
				icon: 'upload-outline'
			},
			{
				title: 'Convert to Invoice',
				icon: 'swap'
			},
			{
				title: 'Email',
				icon: 'email-outline'
			},
			{
				title: 'Delete',
				icon: 'archive-outline'
			}
		];

		if (this.isEstimate) {
			this.settingsContextMenu = this.menuArray.filter((items) => items);
		} else {
			this.settingsContextMenu = this.menuArray.filter(
				(items) => items.title !== 'Convert to Invoice'
			);
		}
		this.nbMenuService.onItemClick().pipe(first());
	}

	selectMenu(selectedItem?: Invoice) {
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
				map(({ item: { title } }) => title)
			)
			.subscribe((title) => this.bulkAction(title));
	}

	bulkAction(action) {
		if (action === 'Duplicate') this.duplicate(this.selectedInvoice);
		if (action === 'Send') this.send(this.selectedInvoice);
		if (action === 'Convert to Invoice') this.convert(this.selectedInvoice);
		if (action === 'Email') this.email(this.selectedInvoice);
		if (action === 'Delete') this.delete(this.selectedInvoice);
	}

	add() {
		if (this.isEstimate) {
			this.router.navigate(['/pages/accounting/invoices/estimates/add']);
		} else {
			this.router.navigate(['/pages/accounting/invoices/add']);
		}
	}

	edit(selectedItem?: Invoice) {
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

	async duplicate(selectedItem?: Invoice) {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}
		const invoiceNumber = await this.invoicesService.getHighestInvoiceNumber();
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
			clientId: this.selectedInvoice.clientId,
			toClient: this.selectedInvoice.toClient,
			fromOrganization: this.organization,
			organizationId: this.selectedInvoice.organizationId,
			invoiceType: this.selectedInvoice.invoiceType,
			tags: this.selectedInvoice.tags,
			isEstimate: this.isEstimate,
			status: this.selectedInvoice.status
		});

		for (const item of this.selectedInvoice.invoiceItems) {
			const itemToAdd = {
				description: item.description,
				price: item.price,
				quantity: item.quantity,
				totalValue: item.totalValue,
				invoiceId: createdInvoice.id
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
			await this.invoiceItemService.add(itemToAdd);
		}

		if (this.isEstimate) {
			this.toastrService.primary(
				this.getTranslation(
					'INVOICES_PAGE.INVOICES_DUPLICATE_ESTIMATE'
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.router.navigate([
				`/pages/accounting/invoices/estimates/edit/${createdInvoice.id}`
			]);
		} else {
			this.toastrService.primary(
				this.getTranslation('INVOICES_PAGE.INVOICES_DUPLICATE_INVOICE'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.router.navigate([
				`/pages/accounting/invoices/edit/${createdInvoice.id}`
			]);
		}
	}

	download(selectedItem?: Invoice) {
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

	async send(selectedItem?: Invoice) {
		if (selectedItem) {
			this.selectInvoice({
				isSelected: true,
				data: selectedItem
			});
		}
		if (this.selectedInvoice.clientId) {
			this.dialogService
				.open(InvoiceSendMutationComponent, {
					context: {
						invoice: this.selectedInvoice,
						isEstimate: this.isEstimate
					}
				})
				.onClose.subscribe(async () => {
					await this.loadSettings();
				});
		} else {
			this.toastrService.danger(
				this.getTranslation('INVOICES_PAGE.SEND.NOT_LINKED'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
		}
	}

	async convert(selectedItem?: Invoice) {
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
		this.toastrService.primary(
			this.getTranslation('INVOICES_PAGE.ESTIMATES.ESTIMATE_CONVERT'),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
		await this.loadSettings();
	}

	async delete(selectedItem?: Invoice) {
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

			this.loadSettings();

			if (this.isEstimate) {
				this.toastrService.primary(
					this.getTranslation(
						'INVOICES_PAGE.INVOICES_DELETE_ESTIMATE'
					),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
			} else {
				this.toastrService.primary(
					this.getTranslation(
						'INVOICES_PAGE.INVOICES_DELETE_INVOICE'
					),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
			}
		}
		this.disableButton = true;
	}

	view() {
		this.router.navigate([
			`/pages/accounting/invoices/view/${this.selectedInvoice.id}`
		]);
	}

	email(selectedItem?: Invoice) {
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
			.onClose.subscribe(async () => {
				await this.loadSettings();
			});
	}

	async loadSettings() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (org) => {
				if (org) {
					const { items } = await this.invoicesService.getAll(
						[
							'invoiceItems',
							'tags',
							'payments',
							'fromOrganization',
							'toClient'
						],
						{
							organizationId: org.id,
							isEstimate: this.isEstimate
						}
					);

					const res = await this.organizationContactService.getAll(
						[],
						{
							organizationId: org.id
						}
					);

					if (res) {
						this.clients = res.items;
					}
					this.invoices = items;
					this.organization = org;
					this.loading = false;
					this.smartTableSource.load(items);
				}
			});
	}

	async selectInvoice({ isSelected, data }) {
		this.status = null;
		const selectedInvoice = isSelected ? data : null;
		if (this.invoicesTable) {
			this.invoicesTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
		this.selectedInvoice = selectedInvoice;
	}

	loadSmartTable() {
		this.settingsSmartTable = {
			pager: {
				display: true,
				perPage: 10
			},
			hideSubHeader: true,
			actions: false,
			columns: {
				invoiceNumber: {
					title: this.isEstimate
						? this.getTranslation(
								'INVOICES_PAGE.ESTIMATES.ESTIMATE_NUMBER'
						  )
						: this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER'),
					type: 'custom',
					sortDirection: 'asc',
					width: '10px',
					renderComponent: NotesWithTagsComponent
				}
			}
		};

		if (this.columns.includes(InvoiceColumnsEnum.INVOICE_DATE)) {
			this.settingsSmartTable['columns']['invoiceDate'] = {
				title: this.getTranslation('INVOICES_PAGE.INVOICE_DATE'),
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
				title: this.getTranslation(
					'INVOICES_PAGE.INVOICES_SELECT_DUE_DATE'
				),
				type: 'date',
				width: '11%',
				filter: false,
				valuePrepareFunction: (cell, row) => {
					return `${cell.slice(0, 10)}`;
				}
			};
		}

		if (this.columns.includes(InvoiceColumnsEnum.STATUS)) {
			this.settingsSmartTable['columns']['status'] = {
				title: this.getTranslation('INVOICES_PAGE.STATUS'),
				type: 'text',
				width: '5%',
				filter: false
			};
		}

		if (this.columns.includes(InvoiceColumnsEnum.TOTAL_VALUE)) {
			this.settingsSmartTable['columns']['totalValue'] = {
				title: this.getTranslation('INVOICES_PAGE.TOTAL_VALUE'),
				type: 'text',
				filter: false,
				width: '8%',
				valuePrepareFunction: (cell, row) => {
					return `${parseFloat(cell).toFixed(2)}`;
				}
			};
		}

		if (this.columns.includes(InvoiceColumnsEnum.TAX)) {
			this.settingsSmartTable['columns']['tax'] = {
				title: this.getTranslation('INVOICES_PAGE.INVOICES_SELECT_TAX'),
				type: 'text',
				width: '8%',
				filter: false,
				valuePrepareFunction: (cell, row) => {
					return `${cell} ${row.taxType === 'Percent' ? '%' : ''}`;
				}
			};
		}

		if (this.columns.includes(InvoiceColumnsEnum.TAX_2)) {
			this.settingsSmartTable['columns']['tax2'] = {
				title: this.getTranslation('INVOICES_PAGE.TAX_2'),
				type: 'text',
				width: '8%',
				filter: false,
				valuePrepareFunction: (cell, row) => {
					return `${cell} ${row.tax2Type === 'Percent' ? '%' : ''}`;
				}
			};
		}

		if (this.columns.includes(InvoiceColumnsEnum.DISCOUNT)) {
			this.settingsSmartTable['columns']['discountValue'] = {
				title: this.getTranslation(
					'INVOICES_PAGE.INVOICES_SELECT_DISCOUNT_VALUE'
				),
				type: 'text',
				width: '8%',
				filter: false,
				valuePrepareFunction: (cell, row) => {
					return `${cell} ${
						row.discountType === 'Percent' ? '%' : ''
					}`;
				}
			};
		}

		if (this.columns.includes(InvoiceColumnsEnum.CURRENCY)) {
			this.settingsSmartTable['columns']['currency'] = {
				title: this.getTranslation(
					'INVOICES_PAGE.INVOICES_SELECT_CURRENCY'
				),
				type: 'text',
				width: '8%',
				filter: false
			};
		}

		if (this.columns.includes(InvoiceColumnsEnum.CLIENT)) {
			this.settingsSmartTable['columns']['client'] = {
				title: this.getTranslation(
					'INVOICES_PAGE.INVOICES_SELECT_CLIENT'
				),
				type: 'text',
				width: '8%',
				filter: false,
				valuePrepareFunction: (cell, row) => {
					return row.toClient.name;
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

	search() {
		const searchObj = this.form.value;
		const result = [];
		const filteredInvoices = this.invoices.filter(
			(invoice) =>
				(searchObj.invoiceNumber === null ||
					searchObj.invoiceNumber === +invoice.invoiceNumber) &&
				(searchObj.client === null ||
					searchObj.client.id === invoice.toClient.id) &&
				(searchObj.invoiceDate === null ||
					searchObj.invoiceDate.toString().slice(0, 15) ===
						new Date(invoice.invoiceDate)
							.toString()
							.slice(0, 15)) &&
				(searchObj.dueDate === null ||
					searchObj.dueDate.toString().slice(0, 15) ===
						new Date(invoice.dueDate).toString().slice(0, 15)) &&
				(searchObj.totalValue === null ||
					searchObj.totalValue === +invoice.totalValue) &&
				(searchObj.currency === null ||
					searchObj.currency === invoice.currency) &&
				(searchObj.status === null ||
					searchObj.status === invoice.status)
		);

		for (const invoice of filteredInvoices) {
			let contains = 0;
			for (const tag of invoice.tags) {
				for (const t of this.tags) {
					if (t.id === tag.id) {
						contains++;
						break;
					}
				}
			}
			if (contains === this.tags.length) {
				result.push(invoice);
			}
		}

		this.smartTableSource.load(result);
	}

	reset() {
		this.smartTableSource.load(this.invoices);
		this.initializeForm();
		this.tags = [];
	}

	searchClient(term: string, item: any) {
		if (item.name) {
			return item.name.toLowerCase().includes(term.toLowerCase());
		}
	}

	selectedTagsEvent(currentTagSelection: Tag[]) {
		this.tags = currentTagSelection;
	}

	async selectStatus($event) {
		await this.invoicesService.update(this.selectedInvoice.id, {
			status: $event
		});
		await this.smartTableSource.update(this.selectedInvoice, {
			...this.selectedInvoice,
			status: $event
		});
	}

	selectColumn($event) {
		this.columns = $event;
		this.loadSmartTable();
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
