import { Component, OnInit, ViewChild, OnDestroy, Input } from '@angular/core';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import {
	Invoice,
	PermissionsEnum,
	Tag,
	Organization,
	InvoiceTypeEnum,
	ComponentLayoutStyleEnum,
	InvoiceStatusTypesEnum,
	EstimateStatusTypesEnum
} from '@gauzy/models';
import { InvoicesService } from '../../@core/services/invoices.service';
import { Router, RouterEvent, NavigationEnd } from '@angular/router';
import { first, takeUntil } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { InvoiceItemService } from '../../@core/services/invoice-item.service';
import { Subject } from 'rxjs';
import { InvoiceSendMutationComponent } from './invoice-send/invoice-send-mutation.component';
import { InvoicePaidComponent } from './table-components/invoice-paid.component';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { InvoiceEmailMutationComponent } from './invoice-email/invoice-email-mutation.component';
import { InvoiceDownloadMutationComponent } from './invoice-download/invoice-download-mutation.component';
import { ComponentEnum } from '../../@core/constants/layout.constants';

@Component({
	selector: 'ngx-invoices',
	templateUrl: './invoices.component.html',
	styleUrls: ['invoices.component.scss']
})
export class InvoicesComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	invoice: Invoice;
	selectedInvoice: Invoice;
	loading = true;
	disableButton = true;
	hasInvoiceEditPermission: boolean;
	invoices: Invoice[];
	tags: Tag[];
	organization: Organization;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	invoiceStatusTypes = Object.values(InvoiceStatusTypesEnum);
	estimateStatusTypes = Object.values(EstimateStatusTypesEnum);
	status: string;

	private _ngDestroy$ = new Subject<void>();

	@Input() isEstimate: boolean;

	@ViewChild('invoicesTable') invoicesTable;

	constructor(
		readonly translateService: TranslateService,
		private store: Store,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private invoicesService: InvoicesService,
		private invoiceItemService: InvoiceItemService,
		private router: Router
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
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
		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
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
			organizationId: this.selectedInvoice.organizationId,
			invoiceType: this.selectedInvoice.invoiceType,
			tags: this.selectedInvoice.tags,
			isEstimate: this.isEstimate
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
		if (this.selectedInvoice.toClient.contactOrganizationId) {
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
					width: '25%',
					renderComponent: NotesWithTagsComponent
				},
				totalValue: {
					title: this.getTranslation('INVOICES_PAGE.TOTAL_VALUE'),
					type: 'text',
					filter: false,
					width: '25%',
					valuePrepareFunction: (cell, row) => {
						return `${row.currency} ${parseFloat(cell).toFixed(2)}`;
					}
				},
				status: {
					title: this.getTranslation('INVOICES_PAGE.STATUS'),
					type: 'text',
					filter: false,
					width: '25%'
				}
			}
		};

		if (!this.isEstimate) {
			this.settingsSmartTable['columns']['paid'] = {
				title: this.getTranslation('INVOICES_PAGE.PAID_STATUS'),
				type: 'custom',
				renderComponent: InvoicePaidComponent,
				filter: false,
				width: '25%'
			};
		}
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
