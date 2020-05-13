import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { Invoice, PermissionsEnum } from '@gauzy/models';
import { InvoicesService } from '../../@core/services/invoices.service';
import { Router } from '@angular/router';
import { first, takeUntil } from 'rxjs/operators';
import { Store } from '../../@core/services/store.service';
import { InvoiceItemService } from '../../@core/services/invoice-item.service';
import { Subject } from 'rxjs';
import { InvoiceSendMutationComponent } from './invoice-send/invoice-send-mutation.component';
import { OrganizationClientsService } from '../../@core/services/organization-clients.service ';

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

	private _ngDestroy$ = new Subject<void>();

	@ViewChild('invoicesTable', { static: false }) invoicesTable;

	constructor(
		readonly translateService: TranslateService,
		private store: Store,
		private dialogService: NbDialogService,
		private toastrService: NbToastrService,
		private invoicesService: InvoicesService,
		private invoiceItemService: InvoiceItemService,
		private organizationClientsService: OrganizationClientsService,
		private router: Router
	) {
		super(translateService);
	}

	ngOnInit() {
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
		this.router.navigate(['/pages/accounting/invoices/add']);
	}

	edit() {
		this.router.navigate([
			`/pages/accounting/invoices/edit/${this.selectedInvoice.id}`
		]);
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
			invoiceType: this.selectedInvoice.invoiceType
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

		this.toastrService.primary(
			this.getTranslation('INVOICES_PAGE.INVOICES_DUPLICATE_INVOICE'),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);

		this.router.navigate([
			`/pages/accounting/invoices/edit/${createdInvoice.id}`
		]);
	}

	async send() {
		if (this.selectedInvoice) {
			const client = await this.organizationClientsService.getById(
				this.selectedInvoice.clientId
			);
			if (client.organizationId) {
				this.dialogService.open(InvoiceSendMutationComponent, {
					context: {
						client: client,
						invoice: this.selectedInvoice
					}
				});
			}
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
			this.toastrService.primary(
				this.getTranslation('INVOICES_PAGE.INVOICES_DELETE_INVOICE'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.disableButton = true;
	}

	view() {
		this.router.navigate([
			`/pages/accounting/invoices/view/${this.selectedInvoice.id}`
		]);
	}

	async loadSettings() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (org) => {
				if (org) {
					this.selectedInvoice = null;
					const { items } = await this.invoicesService.getAll(
						['invoiceItems'],
						{
							organizationId: org.id
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
					title: this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER'),
					type: 'text',
					sortDirection: 'asc'
				},
				totalValue: {
					title: this.getTranslation('INVOICES_PAGE.TOTAL_VALUE'),
					type: 'text',
					valuePrepareFunction: (cell, row) => {
						return `${row.currency} ${parseFloat(cell).toFixed(2)}`;
					}
				},
				paid: {
					title: this.getTranslation('INVOICES_PAGE.PAID_STATUS'),
					type: 'text'
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
