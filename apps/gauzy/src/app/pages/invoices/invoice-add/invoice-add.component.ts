import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Store } from '../../../@core/services/store.service';
import {
	CurrenciesEnum,
	Invoice,
	OrganizationClients,
	Organization
} from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { OrganizationSelectInput } from '@gauzy/models';
import { first, takeUntil } from 'rxjs/operators';
import { InvoicesService } from '../../../@core/services/invoices.service';
import { InvoiceItemService } from '../../../@core/services/invoice-item.service';
import { LocalDataSource } from 'ng2-smart-table';
import { InvoiceAddTasksComponent } from './invoice-add-tasks.component';
import { OrganizationClientsService } from '../../../@core/services/organization-clients.service ';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';
import { NbToastrService } from '@nebular/theme';

@Component({
	selector: 'ga-invoice-add',
	templateUrl: './invoice-add.component.html',
	styleUrls: ['./invoice-add.component.scss']
})
export class InvoiceAddComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	form: FormGroup;
	invoice?: Invoice;
	formInvoiceNumber: number;
	formItemNumber: number;
	currencies = Object.values(CurrenciesEnum);
	smartTableSource = new LocalDataSource([]);
	tasks: Object[] = [];
	loadedNumber: boolean;
	organization: Organization;
	selectedClient: OrganizationClients;
	client: OrganizationClients;
	clients: OrganizationClients[];
	private _ngDestroy$ = new Subject<void>();
	get currency() {
		return this.form.get('currency');
	}

	@ViewChild('invoiceItemTable', { static: false }) invoiceItemTable;

	constructor(
		private fb: FormBuilder,
		private readonly organizationClientsService: OrganizationClientsService,
		readonly translateService: TranslateService,
		private store: Store,
		private router: Router,
		private toastrService: NbToastrService,
		private invoicesService: InvoicesService,
		private invoiceItemService: InvoiceItemService,
		private organizationsService: OrganizationsService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._loadOrganizationData();
		this.initializeForm();
		this.form.get('currency').disable();
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
	}

	async initializeForm() {
		this.createInvoiceNumber();
		this.form = this.fb.group({
			invoiceDate: ['', Validators.required],
			invoiceNumber: [this.formInvoiceNumber, Validators.required],
			dueDate: ['', Validators.required],
			currency: ['', Validators.required],
			discountValue: ['', Validators.required],
			paid: [''],
			tax: ['', Validators.required],
			terms: ['', Validators.required],
			client: ['', Validators.required]
		});
	}

	async loadSmartTable() {
		this.loadedNumber = false;
		await this.createInvoiceItemNumber();
		this.loadedNumber = true;
		this.settingsSmartTable = {
			add: {
				addButtonContent: '<i class="nb-plus"></i>',
				createButtonContent: '<i class="nb-checkmark"></i>',
				cancelButtonContent: '<i class="nb-close"></i>',
				confirmCreate: true
			},
			edit: {
				editButtonContent: '<i class="nb-edit"></i>',
				saveButtonContent: '<i class="nb-checkmark"></i>',
				cancelButtonContent: '<i class="nb-close"></i>'
			},
			delete: {
				deleteButtonContent: '<i class="nb-trash"></i>'
			},
			columns: {
				itemNumber: {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.ITEM_NUMBER'
					),
					type: 'number',
					addable: false
				},
				task: {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.TASK'
					),
					type: 'custom',
					renderComponent: InvoiceAddTasksComponent,
					addable: false,
					editable: false
				},
				name: {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.NAME'
					),
					type: 'string'
				},
				description: {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION'
					),
					type: 'string'
				},
				unitCost: {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.UNIT_COST'
					),
					type: 'number'
				},
				quantity: {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.QUANTITY'
					),
					type: 'number'
				},
				totalValue: {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE'
					),
					type: 'number',
					addable: false,
					editable: false,
					valuePrepareFunction: (cell, row) => {
						return row.unitCost * row.quantity;
					}
				}
			}
		};
	}

	async addInvoice() {
		const tableData = await this.smartTableSource.getAll();
		if (tableData.length) {
			const invoiceData = this.form.value;
			let allItemValue = 0;
			tableData.forEach((invoiceItem) => {
				invoiceItem.totalValue =
					+invoiceItem.unitCost * +invoiceItem.quantity;
				allItemValue += invoiceItem.totalValue;
			});
			const invoiceTotalValue =
				allItemValue + invoiceData.tax - invoiceData.discountValue;

			const createdInvoice = await this.invoicesService.add({
				invoiceNumber: invoiceData.invoiceNumber,
				invoiceDate: invoiceData.invoiceDate,
				dueDate: invoiceData.dueDate,
				currency: this.currency.value,
				discountValue: invoiceData.discountValue,
				tax: invoiceData.tax,
				terms: invoiceData.terms,
				paid: invoiceData.paid,
				totalValue: invoiceTotalValue,
				toClient: invoiceData.client,
				fromOrganization: this.organization
			});

			for (const invoiceItem of tableData) {
				await this.invoiceItemService.add({
					itemNumber: invoiceItem.itemNumber,
					name: invoiceItem.name,
					description: invoiceItem.description,
					unitCost: invoiceItem.unitCost,
					quantity: invoiceItem.quantity,
					totalValue: invoiceItem.totalValue,
					taskId: invoiceItem.task.id,
					invoiceId: createdInvoice.id
				});
			}

			this.toastrService.primary(
				this.getTranslation('INVOICES_PAGE.INVOICES_ADD_INVOICE'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.router.navigate(['/pages/invoices']);
		}
	}

	onCreateConfirm(event): void {
		event.newData.itemNumber = this.formItemNumber;
		this.formItemNumber++;
		event.confirm.resolve(event.newData);
	}

	private async createInvoiceItemNumber() {
		const { items } = await this.invoiceItemService.getAll();
		if (items.length) {
			console.log(items);
			this.formItemNumber = +items[0].itemNumber + 1;
		} else {
			this.formItemNumber = 1;
		}
	}

	private async createInvoiceNumber() {
		const { items } = await this.invoicesService.getAll();
		if (items.length) {
			this.formInvoiceNumber = +items[items.length - 1].invoiceNumber + 1;
		} else {
			this.formInvoiceNumber = 1;
		}
	}

	private async _loadOrganizationData() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (organization) => {
				if (organization) {
					this.organization = organization;
					const orgData = await this.organizationsService
						.getById(organization.id, [
							OrganizationSelectInput.currency
						])
						.pipe(first())
						.toPromise();

					if (orgData && this.currency && !this.currency.value) {
						this.currency.setValue(orgData.currency);
					}

					const res = await this.organizationClientsService.getAll(
						['projects'],
						{
							organizationId: organization.id
						}
					);

					if (res) {
						this.clients = res.items;
					}
				}
			});
	}

	selectClient($event) {
		this.selectedClient = $event;
	}

	searchClient(term: string, item: any) {
		if (item.name) {
			return item.name.toLowerCase().includes(term.toLowerCase());
		}
	}

	cancel() {
		this.router.navigate(['/pages/invoices']);
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
