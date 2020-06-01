import { Component, OnInit, ViewChild, OnDestroy, Input } from '@angular/core';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { Invoice, PermissionsEnum, Tag } from '@gauzy/models';
import { InvoicesService } from '../../@core/services/invoices.service';
import { Router } from '@angular/router';
import { first, takeUntil } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { InvoiceItemService } from '../../@core/services/invoice-item.service';
import { Subject } from 'rxjs';
import { InvoiceSendMutationComponent } from './invoice-send/invoice-send-mutation.component';
import { OrganizationClientsService } from '../../@core/services/organization-clients.service ';
import { InvoicePaidComponent } from './table-components/invoice-paid.component';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { InvoiceEmailMutationComponent } from './invoice-email/invoice-email-mutation.component';
import { OrganizationsService } from '../../@core/services/organizations.service';
import { InvoiceDownloadMutationComponent } from './invoice-download/invoice-download-mutation.comonent';

export interface SelectedInvoice {
	data: Invoice;
	isSelected: false;
}

@Component({
	selector: 'ngx-invoices',
	templateUrl: './invoices.component.html',
	styleUrls: ['./invoices.component.scss']
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
		private organizationClientsService: OrganizationClientsService,
		private router: Router,
		private organizationService: OrganizationsService
	) {
		super(translateService);
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
	}

	add() {
		if (this.isEstimate) {
			this.router.navigate(['/pages/accounting/invoices/estimates/add']);
		} else {
			this.router.navigate(['/pages/accounting/invoices/add']);
		}
	}

	edit() {
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

	async duplicate() {
		const invoiceNumber = await this.invoicesService.getHighestInvoiceNumber();
		const createdInvoice = await this.invoicesService.add({
			invoiceNumber: +invoiceNumber['max'] + 1,
			invoiceDate: this.selectedInvoice.invoiceDate,
			dueDate: this.selectedInvoice.dueDate,
			currency: this.selectedInvoice.currency,
			discountValue: this.selectedInvoice.discountValue,
			discountType: this.selectedInvoice.discountType,
			tax: this.selectedInvoice.tax,
			taxType: this.selectedInvoice.taxType,
			terms: this.selectedInvoice.terms,
			paid: this.selectedInvoice.paid,
			totalValue: this.selectedInvoice.totalValue,
			clientId: this.selectedInvoice.clientId,
			organizationId: this.selectedInvoice.organizationId,
			invoiceType: this.selectedInvoice.invoiceType,
			tags: this.selectedInvoice.tags,
			isEstimate: this.isEstimate
		});

		if (this.selectedInvoice.invoiceItems[0].employeeId) {
			for (const item of this.selectedInvoice.invoiceItems) {
				await this.invoiceItemService.add({
					description: item.description,
					price: item.price,
					quantity: item.quantity,
					totalValue: item.totalValue,
					invoiceId: createdInvoice.id,
					employeeId: item.employeeId
				});
			}
		} else if (this.selectedInvoice.invoiceItems[0].projectId) {
			for (const item of this.selectedInvoice.invoiceItems) {
				await this.invoiceItemService.add({
					description: item.description,
					price: item.price,
					quantity: item.quantity,
					totalValue: item.totalValue,
					invoiceId: createdInvoice.id,
					projectId: item.projectId
				});
			}
		} else if (this.selectedInvoice.invoiceItems[0].taskId) {
			for (const item of this.selectedInvoice.invoiceItems) {
				await this.invoiceItemService.add({
					description: item.description,
					price: item.price,
					quantity: item.quantity,
					totalValue: item.totalValue,
					invoiceId: createdInvoice.id,
					taskId: item.taskId
				});
			}
		} else if (this.selectedInvoice.invoiceItems[0].productId) {
			for (const item of this.selectedInvoice.invoiceItems) {
				await this.invoiceItemService.add({
					description: item.description,
					price: item.price,
					quantity: item.quantity,
					totalValue: item.totalValue,
					invoiceId: createdInvoice.id,
					productId: item.productId
				});
			}
		} else {
			for (const item of this.selectedInvoice.invoiceItems) {
				await this.invoiceItemService.add({
					description: item.description,
					price: item.price,
					quantity: item.quantity,
					totalValue: item.totalValue,
					invoiceId: createdInvoice.id
				});
			}
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

	download() {
		if (this.selectedInvoice) {
			this.organizationService
				.getById(this.selectedInvoice.organizationId)
				.subscribe(async (org) => {
					const client = await this.organizationClientsService.getById(
						this.selectedInvoice.clientId
					);
					if (client.organizationId) {
						this.dialogService.open(
							InvoiceDownloadMutationComponent,
							{
								context: {
									client: client,
									invoice: this.selectedInvoice,
									organization: org,
									isEstimate: this.isEstimate,
								}
							}
						);
					}
				});
		}
	}

	async send() {
		if (this.selectedInvoice) {
			this.organizationService
				.getById(this.selectedInvoice.organizationId)
				.subscribe(async (org) => {
					const client = await this.organizationClientsService.getById(
						this.selectedInvoice.clientId
					);
					if (client.organizationId) {
						this.dialogService.open(InvoiceSendMutationComponent, {
							context: {
								client: client,
								invoice: this.selectedInvoice,
								organization: org,
								isEstimate: this.isEstimate
							}
						});
					}
				});
		}
	}

	async delete() {
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

	email() {
		if (this.selectedInvoice) {
			this.organizationService
				.getById(this.selectedInvoice.organizationId)
				.subscribe(async (org) => {
					const client = await this.organizationClientsService.getById(
						this.selectedInvoice.clientId
					);
					if (client.organizationId) {
						this.dialogService.open(InvoiceEmailMutationComponent, {
							context: {
								client: client,
								invoice: this.selectedInvoice,
								organization: org,
								isEstimate: this.isEstimate
							}
						});
					}
				});
		}
	}

	async loadSettings() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (org) => {
				if (org) {
					this.selectedInvoice = null;
					const { items } = await this.invoicesService.getAll(
						['invoiceItems', 'tags'],
						{
							organizationId: org.id,
							isEstimate: this.isEstimate
						}
					);
					this.invoices = items;
					this.loading = false;
					this.smartTableSource.load(items);
				}
			});
	}

	async selectInvoice($event: SelectedInvoice) {
		if ($event.isSelected) {
			this.selectedInvoice = $event.data;
			this.disableButton = false;
			this.invoicesTable.grid.dataSet.willSelect = false;
		} else {
			this.disableButton = true;
		}
	}

	loadSmartTable() {
		this.settingsSmartTable = {
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
					width: '40%',
					renderComponent: NotesWithTagsComponent
				},
				totalValue: {
					title: this.getTranslation('INVOICES_PAGE.TOTAL_VALUE'),
					type: 'text',
					filter: false,
					width: '40%',
					valuePrepareFunction: (cell, row) => {
						return `${row.currency} ${parseFloat(cell).toFixed(2)}`;
					}
				},
				paid: {
					title: this.getTranslation('INVOICES_PAGE.PAID_STATUS'),
					type: 'custom',
					renderComponent: InvoicePaidComponent,
					filter: false,
					width: '15%'
				}
			}
		};
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
