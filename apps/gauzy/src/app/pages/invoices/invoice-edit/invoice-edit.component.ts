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
	Employee,
	PermissionsEnum
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
	employees: Employee[];
	currencies = Object.values(CurrenciesEnum);
	invoiceDate: Date;
	dueDate: Date;
	hasInvoiceEditPermission: boolean;
	get currency() {
		return this.form.get('currency');
	}
	private _ngDestroy$ = new Subject<void>();

	ngOnInit() {
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.hasInvoiceEditPermission = this.store.hasPermission(
					PermissionsEnum.INVOICES_EDIT
				);
			});
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
			currency: ['', Validators.required]
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
					employee: {
						title: 'Employee',
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
						type: 'string'
					},
					price: {
						title: 'Hourly Rate',
						type: 'number',
						filter: false
					},
					quantity: {
						title: 'Hours Worked',
						type: 'number',
						filter: false
					},
					totalValue: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE'
						),
						type: 'number',
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
					project: {
						title: 'Project',
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
						type: 'string'
					},
					price: {
						title: 'Hourly Rate',
						type: 'number',
						filter: false
					},
					quantity: {
						title: 'Hours Worked',
						type: 'number',
						filter: false
					},
					totalValue: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE'
						),
						type: 'number',
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
					task: {
						title: 'Task',
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
						type: 'string'
					},
					price: {
						title: 'Hourly Rate',
						type: 'number',
						filter: false
					},
					quantity: {
						title: 'Hours Worked',
						type: 'number',
						filter: false
					},
					totalValue: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE'
						),
						type: 'number',
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
						type: 'string'
					},
					quantity: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.QUANTITY'
						),
						type: 'number',
						filter: false
					},
					price: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.PRICE'
						),
						type: 'number',
						filter: false
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
						.subscribe((employees) => {
							this.employees = employees.items.filter((emp) => {
								return (
									emp.orgId === organization.id ||
									organization.id === ''
								);
							});
							this.getInvoiceItems();
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
		if (tableData) {
			console.log(tableData);
			const invoiceData = this.form.value;
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
				tax: invoiceData.tax,
				terms: invoiceData.terms,
				paid: invoiceData.paid,
				totalValue: invoiceTotalValue,
				clientId: invoiceData.client.id,
				organizationId: this.organization.id
			});

			for (const invoiceItem of tableData) {
				console.log(invoiceItem);
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
		}
	}

	async getInvoiceItems() {
		const allItems = await this.invoiceItemService.getAll();
		const invoiceItems = allItems.items.filter(
			(i) => i.invoiceId === this.invoice.id
		);
		console.log(invoiceItems);
		const items = [];
		let data;
		for (const item of invoiceItems) {
			if (item.employeeId) {
				data = {
					description: item.description,
					quantity: item.quantity,
					price: item.unitCost,
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
					id: item.id,
					project: project
				};
			} else if (item.taskId) {
				const task = await this.taskService.getById(item.taskId);
				data = {
					description: item.description,
					quantity: item.quantity,
					price: item.unitCost,
					id: item.id,
					task: task
				};
			} else {
				data = {
					description: item.description,
					quantity: item.quantity,
					price: item.unitCost,
					id: item.id
				};
			}
			items.push(data);
		}
		this.smartTableSource.load(items);
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
		event.newData['allEmployees'] = this.employees;
		event.confirm.resolve(event.newData);
	}

	onEditConfirm(event) {
		console.log(event);
		if (!isNaN(event.newData.quantity) && !isNaN(event.newData.price)) {
			event.confirm.resolve(event.newData);
		} else {
			event.confirm.reject();
		}
	}

	onDeleteConfirm(event): void {
		if (event.data.id) {
			this.itemsToDelete.push(event.data.id);
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
