import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { FormGroup, FormBuilder } from '@angular/forms';
import { Store } from '../../../@core/services/store.service';
import { TranslateService } from '@ngx-translate/core';
import {
	Invoice,
	OrganizationClients,
	CurrenciesEnum,
	OrganizationProjects,
	OrganizationSelectInput,
	InvoiceItem,
	Organization
} from '@gauzy/models';
import { takeUntil, first } from 'rxjs/operators';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { OrganizationClientsService } from '../../../@core/services/organization-clients.service ';
import { Subject } from 'rxjs';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { LocalDataSource } from 'ng2-smart-table';
import { InvoiceItemService } from '../../../@core/services/invoice-item.service';
import { Router, ActivatedRoute } from '@angular/router';
import { NbToastrService } from '@nebular/theme';
import { InvoicesService } from '../../../@core/services/invoices.service';
import { InvoiceAddEmployeesComponent } from '../invoice-add/invoice-add-employees.component';
import { InvoiceAddProjectsComponent } from '../invoice-add/invoice-add-project.component';
import { InvoiceAddTasksComponent } from '../invoice-add/invoice-add-tasks.component';

@Component({
	selector: 'ga-invoice-edit',
	templateUrl: './invoice-edit.component.html',
	styleUrls: ['./invoice-edit.component.scss']
})
export class InvoiceEditComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	constructor(
		private store: Store,
		private router: Router,
		private fb: FormBuilder,
		private invoiceItemService: InvoiceItemService,
		private translate: TranslateService,
		private invoicesService: InvoicesService,
		private toastrService: NbToastrService,
		private organizationsService: OrganizationsService,
		private organizationClientsService: OrganizationClientsService,
		private organizationProjectsService: OrganizationProjectsService,
		private route: ActivatedRoute
	) {
		super(translate);
		this.initializeForm();
	}

	@ViewChild('invoiceItemTable', { static: false }) invoiceItemTable;

	invoiceLoaded = false;
	loadedNumber: boolean;
	invoiceId: string;
	settingsSmartTable: object;
	formItemNumber: number;
	smartTableSource = new LocalDataSource();
	form: FormGroup;
	invoice: Invoice;
	organization: Organization;
	itemsToDelete: string[] = [];
	invoiceItems: InvoiceItem[];
	selectedClient: OrganizationClients;
	clients: OrganizationClients[];
	projects: OrganizationProjects[];
	currencies = Object.values(CurrenciesEnum);
	invoiceDate: Date;
	dueDate: Date;
	get currency() {
		return this.form.get('currency');
	}
	private _ngDestroy$ = new Subject<void>();

	ngOnInit() {
		this.route.paramMap.subscribe((params) => {
			this.invoiceId = params.get('id');
		});
		this.doStuff();
	}

	async getInvoice() {
		const invoice = await this.invoicesService.getById(this.invoiceId);
		this.invoice = invoice;
	}

	async doStuff() {
		await this.getInvoice();
		if (this.invoice) {
			this.invoiceDate = new Date(this.invoice.invoiceDate);
			this.dueDate = new Date(this.invoice.dueDate);
			this._loadOrganizationData();
			this.seedFormData(this.invoice);
			this.loadSmartTable();
			this._applyTranslationOnSmartTable();
			this.getInvoiceItems();
			this.form.get('currency').disable();
		}
	}

	initializeForm() {
		this.form = this.fb.group({
			invoiceDate: [''],
			invoiceNumber: [''],
			dueDate: [''],
			discountValue: [''],
			tax: [''],
			terms: [''],
			paid: [''],
			client: [''],
			currency: ['']
		});
	}

	seedFormData(invoice: Invoice) {
		this.form.get('invoiceNumber').setValue(invoice.invoiceNumber);
		this.form.get('invoiceDate').setValue(this.invoiceDate);
		this.form.get('dueDate').setValue(this.dueDate);
		this.form.get('discountValue').setValue(invoice.discountValue);
		this.form.get('tax').setValue(invoice.tax);
		this.form.get('terms').setValue(invoice.terms);
		this.form.get('paid').setValue(invoice.paid);
		this.invoiceLoaded = true;
	}

	async loadSmartTable() {
		this.loadedNumber = false;
		await this.createInvoiceItemNumber();
		this.loadedNumber = true;
		if (this.invoice.invoiceType === 'By Employee Hours') {
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
					deleteButtonContent: '<i class="nb-trash"></i>',
					confirmDelete: true
				},
				columns: {
					itemNumber: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.ITEM_NUMBER'
						),
						type: 'number',
						addable: false
					},
					employee: {
						title: 'Employee',
						type: 'custom',
						renderComponent: InvoiceAddEmployeesComponent
					},
					description: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION'
						),
						type: 'string'
					},
					hourlyRate: {
						title: 'Hourly Rate',
						type: 'number'
					},
					hoursWorked: {
						title: 'Hours Worked',
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
							return row.hourlyRate * row.hoursWorked;
						}
					}
				}
			};
		} else if (this.invoice.invoiceType === 'By Project Hours') {
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
					deleteButtonContent: '<i class="nb-trash"></i>',
					confirmDelete: true
				},
				columns: {
					itemNumber: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.ITEM_NUMBER'
						),
						type: 'number',
						addable: false
					},
					project: {
						title: 'Project',
						type: 'custom',
						renderComponent: InvoiceAddProjectsComponent
					},
					description: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION'
						),
						type: 'string'
					},
					hourlyRate: {
						title: 'Hourly Rate',
						type: 'number'
					},
					hoursWorked: {
						title: 'Hours Worked',
						type: 'number'
					},
					totalValue: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE'
						),
						type: 'number',
						addable: false,
						editable: false
					}
				}
			};
		} else if (this.invoice.invoiceType === 'By Task Hours') {
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
					deleteButtonContent: '<i class="nb-trash"></i>',
					confirmDelete: true
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
						title: 'Task',
						type: 'custom',
						renderComponent: InvoiceAddTasksComponent
					},
					description: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION'
						),
						type: 'string'
					},
					hourlyRate: {
						title: 'Hourly Rate',
						type: 'number'
					},
					hoursWorked: {
						title: 'Hours Worked',
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
							return row.hourlyRate * row.hoursWorked;
						}
					}
				}
			};
		} else {
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
					deleteButtonContent: '<i class="nb-trash"></i>',
					confirmDelete: true
				},
				columns: {
					itemNumber: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.ITEM_NUMBER'
						),
						type: 'number',
						addable: false
					},
					description: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION'
						),
						type: 'string'
					},
					quantity: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.QTY'
						),
						type: 'number'
					},
					price: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.PRICE'
						),
						type: 'number'
					},
					totalValue: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE'
						),
						type: 'number',
						valuePrepareFunction: (cell, row) => {
							return row.quantity * row.price;
						},
						addable: false,
						editable: false
					}
				}
			};
		}
	}

	private async _loadOrganizationData() {
		this.store.selectedOrganization$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (organization) => {
				if (organization) {
					this.organization = organization;
					const projects = await this.organizationProjectsService.getAll(
						[],
						{ organizationId: organization.id }
					);
					this.projects = projects.items;
					const orgData = await this.organizationsService
						.getById(organization.id, [
							OrganizationSelectInput.currency
						])
						.pipe(first())
						.toPromise();

					if (orgData && this.currency) {
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
						const client = this.clients.filter(
							(c) => c.id === this.invoice.clientId
						);
						this.selectedClient = client[0];
					}
				}
			});
	}

	async updateInvoice() {
		const tableData = await this.smartTableSource.getAll();
		if (tableData) {
			const invoiceData = this.form.value;
			let allItemValue = 0;
			tableData.forEach((invoiceItem) => {
				invoiceItem.totalValue =
					+invoiceItem.price * +invoiceItem.quantity;
				allItemValue += invoiceItem.totalValue;
			});
			const invoiceTotalValue =
				allItemValue + invoiceData.tax - invoiceData.discountValue;

			await this.invoicesService.update(this.invoice.id, {
				invoiceNumber: invoiceData.invoiceNumber,
				invoiceDate: invoiceData.invoiceDate,
				dueDate: invoiceData.dueDate,
				currency: this.currency.value,
				discountValue: invoiceData.discountValue,
				tax: invoiceData.tax,
				terms: invoiceData.terms,
				paid: invoiceData.paid,
				totalValue: invoiceTotalValue,
				clientId: invoiceData.client.id,
				organizationId: this.organization.id
			});

			for (const invoiceItem of tableData) {
				if (invoiceItem.id) {
					await this.invoiceItemService.update(invoiceItem.id, {
						itemNumber: invoiceItem.itemNumber,
						description: invoiceItem.description,
						unitCost: invoiceItem.price,
						quantity: invoiceItem.quantity,
						totalValue: invoiceItem.totalValue,
						invoiceId: this.invoice.id
					});
				} else {
					await this.invoiceItemService.add({
						itemNumber: invoiceItem.itemNumber,
						description: invoiceItem.description,
						unitCost: invoiceItem.price,
						quantity: invoiceItem.quantity,
						totalValue: invoiceItem.totalValue,
						invoiceId: this.invoice.id
					});
				}
			}

			if (this.itemsToDelete.length) {
				for (const itemId of this.itemsToDelete) {
					this.invoiceItemService.delete(itemId);
				}
			}

			this.toastrService.primary(
				this.getTranslation('INVOICES_PAGE.INVOICES_EDIT_INVOICE'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.router.navigate(['/pages/accounting/invoices']);
		}
	}

	async getInvoiceItems() {
		const allItems = await this.invoiceItemService.getAll();
		const invoiceItems = allItems.items.filter(
			(i) => i.invoiceId === this.invoice.id
		);
		const items = [];
		let data;
		for (const item of invoiceItems) {
			data = {
				itemNumber: item.itemNumber,
				description: item.description,
				quantity: item.quantity,
				price: item.unitCost,
				id: item.id
			};
			items.push(data);
		}
		this.smartTableSource.load(items);
	}

	private async createInvoiceItemNumber() {
		const { items } = await this.invoiceItemService.getAll();
		console.log(items);
		if (items.length) {
			this.formItemNumber = +items[0].itemNumber + 1;
		} else {
			this.formItemNumber = 1;
		}
	}

	searchClient(term: string, item: any) {
		if (item.name) {
			return item.name.toLowerCase().includes(term.toLowerCase());
		}
	}

	selectClient($event) {
		this.selectedClient = $event;
	}

	_applyTranslationOnSmartTable() {
		this.translate.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}

	onCreateConfirm(event): void {
		event.newData.itemNumber = this.formItemNumber;
		this.formItemNumber++;
		event.confirm.resolve(event.newData);
	}

	onDeleteConfirm(event): void {
		if (event.data.id) {
			this.itemsToDelete.push(event.data.id);
			console.log(this.itemsToDelete);
		}
		event.confirm.resolve(event.newData);
	}

	cancel() {
		this.router.navigate(['/pages/accounting/invoices']);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
