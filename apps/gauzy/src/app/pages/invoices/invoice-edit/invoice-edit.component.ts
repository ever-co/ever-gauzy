import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Store } from '../../../@core/services/store.service';
import { TranslateService } from '@ngx-translate/core';
import {
	Invoice,
	OrganizationClients,
	CurrenciesEnum,
	OrganizationSelectInput,
	InvoiceItem,
	Organization,
	Employee
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
import { InvoiceEmployeesSelectorComponent } from '../table-components/invoice-employees-selector.component';
import { InvoiceProjectsSelectorComponent } from '../table-components/invoice-project-selector.component';
import { InvoiceTasksSelectorComponent } from '../table-components/invoice-tasks-selector.component';
import { EmployeesService } from '../../../@core/services';
import { TasksService } from '../../../@core/services/tasks.service';

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
		private route: ActivatedRoute,
		private employeeService: EmployeesService,
		private projectService: OrganizationProjectsService,
		private taskService: TasksService
	) {
		super(translate);
		this.initializeForm();
	}

	invoiceLoaded = false;
	loadedNumber: boolean;
	shouldLoadTable = false;
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
	employees: Employee[];
	currencies = Object.values(CurrenciesEnum);
	invoiceDate: Date;
	dueDate: Date;
	subtotal = 0;
	total = 0;
	get currency() {
		return this.form.get('currency');
	}
	private _ngDestroy$ = new Subject<void>();

	ngOnInit() {
		this.route.paramMap.subscribe((params) => {
			this.invoiceId = params.get('id');
		});
		this.executeInitialFunctions();
	}

	async getInvoice() {
		const invoice = await this.invoicesService.getById(this.invoiceId);
		this.invoice = invoice;
	}

	async executeInitialFunctions() {
		await this.getInvoice();
		if (this.invoice) {
			this.invoiceDate = new Date(this.invoice.invoiceDate);
			this.dueDate = new Date(this.invoice.dueDate);
			this._loadOrganizationData();
			this.seedFormData(this.invoice);
			this.loadSmartTable();
			this._applyTranslationOnSmartTable();
			this.form.get('currency').disable();
		}
	}

	initializeForm() {
		this.form = this.fb.group({
			invoiceDate: ['', Validators.required],
			invoiceNumber: ['', Validators.required],
			dueDate: ['', Validators.required],
			discountValue: ['', Validators.required],
			tax: ['', Validators.required],
			terms: ['', Validators.required],
			paid: ['', Validators.required],
			client: ['', Validators.required],
			currency: ['', Validators.required],
			discountType: ['', Validators.required],
			taxType: ['', Validators.required]
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
		this.form.get('discountType').setValue(invoice.discountType);
		this.form.get('taxType').setValue(invoice.taxType);
		this.invoiceLoaded = true;
	}

	loadSmartTable() {
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
					cancelButtonContent: '<i class="nb-close"></i>',
					confirmSave: true
				},
				delete: {
					deleteButtonContent: '<i class="nb-trash"></i>',
					confirmDelete: true
				},
				columns: {
					selectedEmployee: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.EMPLOYEE'
						),
						type: 'custom',
						renderComponent: InvoiceEmployeesSelectorComponent,
						filter: false,
						addable: false,
						editable: false,
						width: '25%'
					},
					description: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION'
						),
						type: 'text'
					},
					price: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.HOURLY_RATE'
						),
						type: 'text',
						filter: false
					},
					quantity: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.HOURS_WORKED'
						),
						type: 'text',
						filter: false
					},
					totalValue: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE'
						),
						type: 'text',
						addable: false,
						editable: false,
						valuePrepareFunction: (cell, row) => {
							return row.quantity * row.price;
						},
						filter: false
					}
				}
			};
		} else if (this.invoice.invoiceType === 'By Project Hours') {
			this.settingsSmartTable = {
				add: {
					addButtonContent: '<i class="nb-plus"></i>',
					createButtonContent: '<i class="nb-checkmark"></i>',
					cancelButtonContent: '<i class="nb-close"></i>'
				},
				edit: {
					editButtonContent: '<i class="nb-edit"></i>',
					saveButtonContent: '<i class="nb-checkmark"></i>',
					cancelButtonContent: '<i class="nb-close"></i>',
					confirmSave: true
				},
				delete: {
					deleteButtonContent: '<i class="nb-trash"></i>',
					confirmDelete: true
				},
				columns: {
					selectedProject: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.PROJECT'
						),
						type: 'custom',
						renderComponent: InvoiceProjectsSelectorComponent,
						filter: false,
						addable: false,
						editable: false
					},
					description: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION'
						),
						type: 'text'
					},
					price: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.HOURLY_RATE'
						),
						type: 'text',
						filter: false
					},
					quantity: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.HOURS_WORKED'
						),
						type: 'text',
						filter: false
					},
					totalValue: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE'
						),
						type: 'text',
						addable: false,
						editable: false,
						valuePrepareFunction: (cell, row) => {
							return row.quantity * row.price;
						},
						filter: false
					}
				}
			};
		} else if (this.invoice.invoiceType === 'By Task Hours') {
			this.settingsSmartTable = {
				add: {
					addButtonContent: '<i class="nb-plus"></i>',
					createButtonContent: '<i class="nb-checkmark"></i>',
					cancelButtonContent: '<i class="nb-close"></i>'
				},
				edit: {
					editButtonContent: '<i class="nb-edit"></i>',
					saveButtonContent: '<i class="nb-checkmark"></i>',
					cancelButtonContent: '<i class="nb-close"></i>',
					confirmSave: true
				},
				delete: {
					deleteButtonContent: '<i class="nb-trash"></i>',
					confirmDelete: true
				},
				columns: {
					selectedTask: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.TASK'
						),
						type: 'custom',
						renderComponent: InvoiceTasksSelectorComponent,
						filter: false,
						addable: false,
						editable: false
					},
					description: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION'
						),
						type: 'text'
					},
					price: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.HOURLY_RATE'
						),
						type: 'text',
						filter: false
					},
					quantity: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.HOURS_WORKED'
						),
						type: 'text',
						filter: false
					},
					totalValue: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE'
						),
						type: 'text',
						addable: false,
						editable: false,
						valuePrepareFunction: (cell, row) => {
							return row.quantity * row.price;
						},
						filter: false
					}
				}
			};
		} else {
			this.settingsSmartTable = {
				add: {
					addButtonContent: '<i class="nb-plus"></i>',
					createButtonContent: '<i class="nb-checkmark"></i>',
					cancelButtonContent: '<i class="nb-close"></i>'
				},
				edit: {
					editButtonContent: '<i class="nb-edit"></i>',
					saveButtonContent: '<i class="nb-checkmark"></i>',
					cancelButtonContent: '<i class="nb-close"></i>',
					confirmSave: true
				},
				delete: {
					deleteButtonContent: '<i class="nb-trash"></i>',
					confirmDelete: true
				},
				columns: {
					description: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION'
						),
						type: 'text'
					},
					quantity: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.QUANTITY'
						),
						type: 'text',
						filter: false
					},
					price: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.PRICE'
						),
						type: 'text',
						filter: false
					},
					totalValue: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE'
						),
						type: 'text',
						valuePrepareFunction: (cell, row) => {
							return row.quantity * row.price;
						},
						addable: false,
						editable: false,
						filter: false
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

					this.employeeService
						.getAll(['user'])
						.pipe(takeUntil(this._ngDestroy$))
						.subscribe(async (employees) => {
							this.employees = employees.items.filter((emp) => {
								return (
									emp.orgId === organization.id ||
									organization.id === ''
								);
							});
							await this.getInvoiceItems();
							this.calculateTotal();
						});

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
		if (tableData.length) {
			const invoiceData = this.form.value;
			if (invoiceData.invoiceNumber < 1) {
				this.toastrService.danger(
					this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER_VALUE'),
					this.getTranslation('TOASTR.TITLE.WARNING')
				);
				return;
			} else if (invoiceData.tax <= 0) {
				this.toastrService.danger(
					this.getTranslation('INVOICES_PAGE.TAX_VALUE'),
					this.getTranslation('TOASTR.TITLE.WARNING')
				);
				return;
			} else if (invoiceData.discountValue <= 0) {
				this.toastrService.danger(
					this.getTranslation('INVOICES_PAGE.DISCOUNT_VALUE'),
					this.getTranslation('TOASTR.TITLE.WARNING')
				);
				return;
			}

			if (
				!invoiceData.invoiceDate ||
				!invoiceData.dueDate ||
				this.compareDate(invoiceData.invoiceDate, invoiceData.dueDate)
			) {
				this.toastrService.danger(
					this.getTranslation('INVOICES_PAGE.INVALID_DATES'),
					this.getTranslation('TOASTR.TITLE.WARNING')
				);
				return;
			}

			if (tableData[0].hasOwnProperty('selectedEmployee')) {
				for (const invoiceItem of tableData) {
					if (!invoiceItem.selectedEmployee) {
						this.toastrService.danger(
							this.getTranslation(
								'INVOICES_PAGE.INVOICE_ITEM.EMPLOYEE_VALUE'
							),
							this.getTranslation('TOASTR.TITLE.WARNING')
						);
						return;
					}
				}
			} else if (tableData[0].hasOwnProperty('selectedProject')) {
				for (const invoiceItem of tableData) {
					if (!invoiceItem.selectedProject) {
						this.toastrService.danger(
							this.getTranslation(
								'INVOICES_PAGE.INVOICE_ITEM.PROJECT_VALUE'
							),
							this.getTranslation('TOASTR.TITLE.WARNING')
						);
						return;
					}
				}
			} else if (tableData[0].hasOwnProperty('selectedTask')) {
				for (const invoiceItem of tableData) {
					if (!invoiceItem.selectedTask) {
						this.toastrService.danger(
							this.getTranslation(
								'INVOICES_PAGE.INVOICE_ITEM.TASK_VALUE'
							),
							this.getTranslation('TOASTR.TITLE.WARNING')
						);
						return;
					}
				}
			}

			let allItemValue = 0;
			tableData.forEach((invoiceItem) => {
				invoiceItem.totalValue =
					+invoiceItem.price * +invoiceItem.quantity;
				allItemValue += invoiceItem.totalValue;
			});
			const invoiceTotalValue =
				allItemValue + +invoiceData.tax - +invoiceData.discountValue;

			await this.invoicesService.update(this.invoice.id, {
				invoiceNumber: invoiceData.invoiceNumber,
				invoiceDate: invoiceData.invoiceDate,
				dueDate: invoiceData.dueDate,
				currency: this.currency.value,
				discountValue: invoiceData.discountValue,
				discountType: invoiceData.discountType,
				tax: invoiceData.tax,
				taxType: invoiceData.taxType,
				terms: invoiceData.terms,
				paid: invoiceData.paid,
				totalValue: invoiceTotalValue,
				clientId: invoiceData.client.id,
				organizationId: this.organization.id
			});

			for (const invoiceItem of tableData) {
				if (invoiceItem.id) {
					if (invoiceItem.selectedEmployee) {
						await this.invoiceItemService.update(invoiceItem.id, {
							description: invoiceItem.description,
							unitCost: invoiceItem.price,
							quantity: invoiceItem.quantity,
							totalValue: invoiceItem.totalValue,
							invoiceId: this.invoice.id,
							employeeId: invoiceItem.selectedEmployee
						});
					} else if (invoiceItem.project) {
						await this.invoiceItemService.update(invoiceItem.id, {
							description: invoiceItem.description,
							unitCost: invoiceItem.price,
							quantity: invoiceItem.quantity,
							totalValue: invoiceItem.totalValue,
							invoiceId: this.invoice.id,
							projectId: invoiceItem.project.id
						});
					} else if (invoiceItem.task) {
						await this.invoiceItemService.update(invoiceItem.id, {
							description: invoiceItem.description,
							unitCost: invoiceItem.price,
							quantity: invoiceItem.quantity,
							totalValue: invoiceItem.totalValue,
							invoiceId: this.invoice.id,
							taskId: invoiceItem.task.id
						});
					} else {
						await this.invoiceItemService.update(invoiceItem.id, {
							description: invoiceItem.description,
							unitCost: invoiceItem.price,
							quantity: invoiceItem.quantity,
							totalValue: invoiceItem.totalValue,
							invoiceId: this.invoice.id
						});
					}
				} else {
					if (invoiceItem.selectedEmployee) {
						await this.invoiceItemService.add({
							description: invoiceItem.description,
							unitCost: invoiceItem.price,
							quantity: invoiceItem.quantity,
							totalValue: invoiceItem.totalValue,
							invoiceId: this.invoice.id,
							employeeId: invoiceItem.selectedEmployee
						});
					} else if (invoiceItem.project) {
						await this.invoiceItemService.add({
							description: invoiceItem.description,
							unitCost: invoiceItem.price,
							quantity: invoiceItem.quantity,
							totalValue: invoiceItem.totalValue,
							invoiceId: this.invoice.id,
							projectId: invoiceItem.project.id
						});
					} else if (invoiceItem.task) {
						await this.invoiceItemService.add({
							description: invoiceItem.description,
							unitCost: invoiceItem.price,
							quantity: invoiceItem.quantity,
							totalValue: invoiceItem.totalValue,
							invoiceId: this.invoice.id,
							taskId: invoiceItem.task.id
						});
					} else {
						await this.invoiceItemService.add({
							description: invoiceItem.description,
							unitCost: invoiceItem.price,
							quantity: invoiceItem.quantity,
							totalValue: invoiceItem.totalValue,
							invoiceId: this.invoice.id
						});
					}
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
		} else {
			this.toastrService.danger(
				this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.NO_ITEMS'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
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
			if (item.employeeId) {
				data = {
					description: item.description,
					quantity: item.quantity,
					price: item.unitCost,
					totalValue: +item.totalValue,
					id: item.id,
					allEmployees: this.employees,
					selectedEmployee: item.employeeId
				};
			} else if (item.projectId) {
				const project = await this.projectService.getById(
					item.projectId
				);
				data = {
					description: item.description,
					quantity: item.quantity,
					price: item.unitCost,
					totalValue: +item.totalValue,
					id: item.id,
					project: project
				};
			} else if (item.taskId) {
				const task = await this.taskService.getById(item.taskId);
				data = {
					description: item.description,
					quantity: item.quantity,
					price: item.unitCost,
					totalValue: +item.totalValue,
					id: item.id,
					task: task
				};
			} else {
				data = {
					description: item.description,
					quantity: item.quantity,
					price: item.unitCost,
					totalValue: +item.totalValue,
					id: item.id
				};
			}
			items.push(data);
		}
		let subtotal = 0;
		for (const item of items) {
			subtotal += +item.totalValue;
		}
		this.subtotal = subtotal;
		this.smartTableSource.load(items);
		this.shouldLoadTable = true;
	}

	calculateTotal() {
		const discountValue =
			this.form.value.discountValue && this.form.value.discountValue > 0
				? this.form.value.discountValue
				: 0;
		const tax =
			this.form.value.tax && this.form.value.tax > 0
				? this.form.value.tax
				: 0;
		let totalDiscount = 0;
		let totalTax = 0;

		switch (this.form.value.discountType) {
			case 'Percent':
				totalDiscount = this.subtotal * (discountValue / 100);
				break;
			case 'Flat':
				totalDiscount = discountValue;
				break;
			default:
				totalDiscount = 0;
				break;
		}
		switch (this.form.value.taxType) {
			case 'Percent':
				totalTax = this.subtotal * (tax / 100);
				break;
			case 'Flat':
				totalTax = tax;
				break;
			default:
				totalTax = 0;
				break;
		}

		this.total = this.subtotal - totalDiscount + totalTax;

		if (this.total < 0) {
			this.total = 0;
		}
	}

	compareDate(date1: Date, date2: Date): boolean {
		const d1 = new Date(date1);
		const d2 = new Date(date2);

		const same = d1.getTime() === d2.getTime();

		if (same) {
			return false;
		}

		if (d1 > d2) {
			return true;
		}

		if (d1 < d2) {
			return false;
		}
	}

	async onCurrencyChange() {
		const tableData = await this.smartTableSource.getAll();
		this.smartTableSource.load(tableData);
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

	onCreateConfirm(event) {
		if (event.newData.employee === '') {
			event.newData['allEmployees'] = this.employees;
		}
		if (
			!isNaN(event.newData.quantity) &&
			!isNaN(event.newData.price) &&
			event.newData.quantity &&
			event.newData.price &&
			event.newData.description
		) {
			const newData = event.newData;
			const itemTotal = +event.newData.quantity * +event.newData.price;
			newData.totalValue = itemTotal;
			this.subtotal += itemTotal;
			this.calculateTotal();
			event.confirm.resolve(newData);
		} else {
			this.toastrService.danger(
				this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.INVALID_ITEM'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			event.confirm.reject();
		}
	}

	onEditConfirm(event) {
		if (
			!isNaN(event.newData.quantity) &&
			!isNaN(event.newData.price) &&
			event.newData.quantity &&
			event.newData.price &&
			event.newData.description
		) {
			const newData = event.newData;
			const oldValue = +event.data.quantity * +event.data.price;
			const newValue = +newData.quantity * +event.newData.price;
			newData.totalValue = newValue;
			if (newValue > oldValue) {
				this.subtotal += newValue - oldValue;
			} else if (oldValue > newValue) {
				this.subtotal -= oldValue - newValue;
			}
			this.calculateTotal();
			event.confirm.resolve(newData);
		} else {
			this.toastrService.danger(
				this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.INVALID_ITEM'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			event.confirm.reject();
		}
	}

	onDeleteConfirm(event): void {
		if (event.data.id) {
			this.itemsToDelete.push(event.data.id);
		}
		this.subtotal -= +event.data.quantity * +event.data.price;
		this.calculateTotal();
		event.confirm.resolve(event.data);
	}

	cancel() {
		this.router.navigate(['/pages/accounting/invoices']);
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
