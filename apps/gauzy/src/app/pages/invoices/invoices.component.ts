import { Component, OnInit, ViewChild, OnDestroy, Input } from '@angular/core';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import {
	NbDialogService,
	NbToastrService,
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
	ICurrency
} from '@gauzy/models';
import { InvoicesService } from '../../@core/services/invoices.service';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { first, map, filter, tap } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { InvoiceItemService } from '../../@core/services/invoice-item.service';
import { InvoiceSendMutationComponent } from './invoice-send/invoice-send-mutation.component';
import { InvoicePaidComponent } from './table-components/invoice-paid.component';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { InvoiceEmailMutationComponent } from './invoice-email/invoice-email-mutation.component';
import { InvoiceDownloadMutationComponent } from './invoice-download/invoice-download-mutation.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { FormBuilder, FormGroup } from '@angular/forms';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';
import { StatusBadgeComponent } from '../../@shared/status-badge/status-badge.component';
import { InvoiceEstimateHistoryService } from '../../@core/services/invoice-estimate-history.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { NgxPermissionsService } from 'ngx-permissions';
import { AddInternalNoteComponent } from './add-internal-note/add-internal-note.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-invoices',
	templateUrl: './invoices.component.html',
	styleUrls: ['invoices.component.scss']
})
export class InvoicesComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	selectedInvoice: IInvoice;
	loading = true;
	disableButton = true;
	invoices: IInvoice[];
	tags: ITag[] = [];
	organization: IOrganization;
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
	form: FormGroup;
	organizationContacts: IOrganizationContact[];
	duplicate: boolean;
	perPage = 10;
	histories: IInvoiceEstimateHistory[] = [];
	currency: string = '';

	@Input() isEstimate: boolean;

	invoicesTable: Ng2SmartTableComponent;
	@ViewChild('invoicesTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.invoicesTable = content;
			this.onChangedSource();
		}
	}
	@ViewChild(NbPopoverDirective) popover: NbPopoverDirective;

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
		private organizationContactService: OrganizationContactService,
		private invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private ngxPermissionsService: NgxPermissionsService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		if (!this.isEstimate) {
			this.isEstimate = false;
		}
		this._applyTranslationOnSmartTable();
		this.loadSettingsSmartTable();
		this.initializeForm();

		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});

		this.loadMenu();
		this.loadSettings();
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

	initializeForm() {
		this.form = this.fb.group({
			invoiceNumber: [],
			organizationContact: [],
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
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
			});
	}

	loadMenu() {
		this.menuArray = [
			{
				title: 'Duplicate',
				icon: 'copy-outline',
				permission: PermissionsEnum.INVOICES_EDIT
			},
			{
				title: 'Send',
				icon: 'upload-outline',
				permission: PermissionsEnum.INVOICES_VIEW
			},
			{
				title: 'Convert to Invoice',
				icon: 'swap',
				permission: PermissionsEnum.INVOICES_EDIT
			},
			{
				title: 'Email',
				icon: 'email-outline',
				permission: PermissionsEnum.INVOICES_VIEW
			},
			{
				title: 'Delete',
				icon: 'archive-outline',
				permission: PermissionsEnum.INVOICES_EDIT
			},
			{
				title: 'Note',
				icon: 'book-open-outline',
				permission: PermissionsEnum.INVOICES_EDIT
			}
		];

		if (!this.isEstimate) {
			const paymentsObj = {
				title: 'Payments',
				icon: 'clipboard-outline',
				permission: PermissionsEnum.INVOICES_EDIT
			};
			this.menuArray.push(paymentsObj);
		}

		if (this.isEstimate) {
			this.settingsContextMenu = this.menuArray.filter(
				(item) =>
					this.ngxPermissionsService.getPermission(item.permission) !=
					null
			);
		} else {
			this.settingsContextMenu = this.menuArray
				.filter((item) => item.title !== 'Convert to Invoice')
				.filter(
					(item) =>
						this.ngxPermissionsService.getPermission(
							item.permission
						) != null
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

	bulkAction(action) {
		if (action === 'Duplicate') this.duplicated(this.selectedInvoice);
		if (action === 'Send') this.send(this.selectedInvoice);
		if (action === 'Convert to Invoice') this.convert(this.selectedInvoice);
		if (action === 'Email') this.email(this.selectedInvoice);
		if (action === 'Delete') this.delete(this.selectedInvoice);
		if (action === 'Payments') this.payments();
		if (action === 'Note') this.addInternalNote();
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
			await this.invoiceItemService.add(itemToAdd);
		}

		await this.invoiceEstimateHistoryService.add({
			action: this.isEstimate
				? 'Estimate duplicated'
				: 'Invoice duplicated',
			invoice: this.selectedInvoice,
			invoiceId: this.selectedInvoice.id,
			user: this.store.user,
			userId: this.store.userId,
			organization: this.organization,
			organizationId: this.organization.id,
			tenantId
		});

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

	async send(selectedItem?: IInvoice) {
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
				.onClose.pipe(untilDestroyed(this))
				.subscribe(async () => {
					await this.loadSettings();
				});
			this.clearItem();
		} else {
			this.toastrService.danger(
				this.getTranslation('INVOICES_PAGE.SEND.NOT_LINKED'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
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
			action: 'Estimate converted to invoice',
			invoice: this.selectedInvoice,
			invoiceId: this.selectedInvoice.id,
			user: this.store.user,
			userId: this.store.userId,
			organization: this.organization,
			organizationId: this.organization.id,
			tenantId: this.organization.tenantId
		});
		this.toastrService.primary(
			this.getTranslation('INVOICES_PAGE.ESTIMATES.ESTIMATE_CONVERT'),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);
		this.clearItem();
		await this.loadSettings();
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

			this.clearItem();
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
					isEstimate: this.isEstimate,
					saveAndSend: false
				}
			})
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async () => {
				this.clearItem();
				await this.loadSettings();
			});
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
			.onClose.pipe(untilDestroyed(this))
			.subscribe(async () => {
				this.clearItem();
				await this.loadSettings();
			});
	}

	async loadSettings() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe(async (org) => {
				if (org) {
					try {
						const { tenantId } = this.store.user;
						const { items } = await this.invoicesService.getAll(
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
							],
							{
								organizationId: org.id,
								tenantId,
								isEstimate: this.isEstimate
							}
						);
						const invoiceVM: IInvoice[] = items.map((i) => {
							return Object.assign({}, i, {
								organizationContactName: i.toContact?.name
							});
						});
						this.invoices = invoiceVM;
						this.smartTableSource.load(invoiceVM);
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
			});
	}

	async selectInvoice({ isSelected, data }) {
		this.status = null;
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
			this.histories = histories;
		}
	}

	loadSettingsSmartTable() {
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
						text: cell,
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

		if (this.columns.includes(InvoiceColumnsEnum.CONTACT)) {
			this.settingsSmartTable['columns']['organizationContactName'] = {
				title: this.getTranslation(
					'INVOICES_PAGE.INVOICES_SELECT_CONTACT'
				),
				type: 'text',
				width: '8%',
				filter: false,
				valuePrepareFunction: (cell, row) => {
					return row.toContact.name;
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

	async showPerPage() {
		if (
			this.perPage &&
			Number.isInteger(this.perPage) &&
			this.perPage > 0
		) {
			this.smartTableSource.getPaging().perPage = this.perPage;
			this.loadSettingsSmartTable();
		}
	}

	search() {
		const searchObj = this.form.value;
		const result = [];
		const filteredInvoices = this.invoices.filter(
			(invoice) =>
				(searchObj.invoiceNumber === null ||
					searchObj.invoiceNumber === +invoice.invoiceNumber) &&
				(searchObj.organizationContact === null ||
					searchObj.organizationContact.id ===
						invoice.toContact.id) &&
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
		this.currency = '';
	}

	searchContact(term: string, item: any) {
		if (item.name) {
			return item.name.toLowerCase().includes(term.toLowerCase());
		}
	}

	selectedTagsEvent(currentTagSelection: ITag[]) {
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
		this.smartTableSource.refresh();
		this.clearItem();
	}

	selectColumn($event) {
		this.columns = $event;
		this.loadSettingsSmartTable();
	}

	openPopover() {
		if (this.popover.isShown) {
			this.popover.hide();
		} else {
			this.popover.show();
			document.getElementsByClassName('arrow')[0].remove();
		}
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSettingsSmartTable();
			});
	}

	async onChangeTab(event) {
		if (event.tabId === 'search') {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			const res = await this.organizationContactService.getAll([], {
				organizationId,
				tenantId
			});

			if (res) {
				this.organizationContacts = res.items;
			}
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

	/*
	 * On Changed Currency Event Emitter
	 */
	currencyChanged($event: ICurrency) {}

	ngOnDestroy() {}
}
