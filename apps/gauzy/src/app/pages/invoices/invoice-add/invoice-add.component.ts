import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Store } from '../../../@core/services/store.service';
import {
	CurrenciesEnum,
	Invoice,
	OrganizationClients,
	Organization,
	OrganizationProjects,
	Task,
	Employee
} from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { OrganizationSelectInput } from '@gauzy/models';
import { first, takeUntil } from 'rxjs/operators';
import { InvoicesService } from '../../../@core/services/invoices.service';
import { InvoiceItemService } from '../../../@core/services/invoice-item.service';
import { LocalDataSource } from 'ng2-smart-table';
import { InvoiceTasksSelectorComponent } from '../table-components/invoice-tasks-selector.component';
import { OrganizationClientsService } from '../../../@core/services/organization-clients.service ';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';
import { NbToastrService } from '@nebular/theme';
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { TasksService } from '../../../@core/services/tasks.service';
import { InvoiceProjectsSelectorComponent } from '../table-components/invoice-project-selector.component';
import { InvoiceEmployeesSelectorComponent } from '../table-components/invoice-employees-selector.component';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';
import { EmployeesService } from '../../../@core/services';

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
	currencies = Object.values(CurrenciesEnum);
	smartTableSource = new LocalDataSource();
	generatedTask: string;
	organization: Organization;
	selectedTasks: Task[];
	tasks: Task[];
	client: OrganizationClients;
	clients: OrganizationClients[];
	selectedProjects: OrganizationProjects[];
	projects: OrganizationProjects[];
	employees: Employee[];
	selectedEmployeeIds: string[];
	invoiceType: string;
	shouldLoadTable: boolean;
	isEmployeeHourTable: boolean;
	isProjectHourTable: boolean;
	isTaskHourTable: boolean;
	enableSaveButton = true;
	organizationId: string;
	private _ngDestroy$ = new Subject<void>();
	get currency() {
		return this.form.get('currency');
	}

	@ViewChild('invoiceItemTable', { static: false }) invoiceItemTable;
	@ViewChild('employeeSelector', { static: false })
	employeeSelector: EmployeeSelectorComponent;

	constructor(
		private fb: FormBuilder,
		private readonly organizationClientsService: OrganizationClientsService,
		readonly translateService: TranslateService,
		private store: Store,
		private router: Router,
		private toastrService: NbToastrService,
		private invoicesService: InvoicesService,
		private organizationsService: OrganizationsService,
		private organizationProjectsService: OrganizationProjectsService,
		private invoiceItemService: InvoiceItemService,
		private tasksService: TasksService,
		private errorHandler: ErrorHandlingService,
		private employeeService: EmployeesService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.getTasks();
		this._loadOrganizationData();
		this.initializeForm();
		this.form.get('currency').disable();
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
			client: ['', Validators.required],
			invoiceType: [''],
			project: [''],
			task: ['']
		});
	}

	async loadSmartTable() {
		if (this.invoiceType === 'By Employee Hours') {
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
					confirmEdit: true
				},
				delete: {
					deleteButtonContent: '<i class="nb-trash"></i>'
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
						type: 'string'
					},
					price: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.HOURLY_RATE'
						),
						type: 'number',
						filter: false
					},
					quantity: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.HOURS_WORKED'
						),
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
							return row.price * row.quantity;
						},
						filter: false
					}
				}
			};
		} else if (this.invoiceType === 'By Project Hours') {
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
					confirmEdit: true
				},
				delete: {
					deleteButtonContent: '<i class="nb-trash"></i>'
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
						type: 'string'
					},
					price: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.HOURLY_RATE'
						),
						type: 'number',
						filter: false
					},
					quantity: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.HOURS_WORKED'
						),
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
							return row.price * row.quantity;
						},
						filter: false
					}
				}
			};
		} else if (this.invoiceType === 'By Task Hours') {
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
					confirmEdit: true
				},
				delete: {
					deleteButtonContent: '<i class="nb-trash"></i>'
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
						type: 'string'
					},
					price: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.HOURLY_RATE'
						),
						type: 'number',
						filter: false
					},
					quantity: {
						title: this.getTranslation(
							'INVOICES_PAGE.INVOICE_ITEM.HOURS_WORKED'
						),
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
							return row.price * row.quantity;
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
					deleteButtonContent: '<i class="nb-trash"></i>'
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

	async addInvoice() {
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
				clientId: invoiceData.client.id,
				organizationId: this.organization.id,
				invoiceType: this.invoiceType
			});

			if (tableData[0].selectedEmployee) {
				for (const invoiceItem of tableData) {
					await this.invoiceItemService.add({
						description: invoiceItem.description,
						unitCost: invoiceItem.price,
						quantity: invoiceItem.quantity,
						totalValue: invoiceItem.totalValue,
						invoiceId: createdInvoice.id,
						employeeId: invoiceItem.selectedEmployee
					});
				}
			} else if (tableData[0].project) {
				for (const invoiceItem of tableData) {
					await this.invoiceItemService.add({
						description: invoiceItem.description,
						unitCost: invoiceItem.price,
						quantity: invoiceItem.quantity,
						totalValue: invoiceItem.totalValue,
						invoiceId: createdInvoice.id,
						projectId: invoiceItem.project.id
					});
				}
			} else if (tableData[0].task) {
				for (const invoiceItem of tableData) {
					await this.invoiceItemService.add({
						description: invoiceItem.description,
						unitCost: invoiceItem.price,
						quantity: invoiceItem.quantity,
						totalValue: invoiceItem.totalValue,
						invoiceId: createdInvoice.id,
						taskId: invoiceItem.task.id
					});
				}
			} else {
				for (const invoiceItem of tableData) {
					await this.invoiceItemService.add({
						description: invoiceItem.description,
						unitCost: invoiceItem.price,
						quantity: invoiceItem.quantity,
						totalValue: invoiceItem.totalValue,
						invoiceId: createdInvoice.id
					});
				}
			}

			this.toastrService.primary(
				this.getTranslation('INVOICES_PAGE.INVOICES_ADD_INVOICE'),
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
						});

					const projects = await this.organizationProjectsService.getAll(
						[],
						{ organizationId: organization.id }
					);
					this.projects = projects.items;
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

	private async getTasks() {
		this.tasksService.getAllTasks().subscribe((data) => {
			this.tasks = data.items;
		});
	}

	onTypeChange($event) {
		this.invoiceType = $event;
		if ($event === 'By Employee Hours') {
			this.isEmployeeHourTable = true;
			this.isProjectHourTable = false;
			this.isTaskHourTable = false;
		} else if ($event === 'By Project Hours') {
			this.isEmployeeHourTable = false;
			this.isProjectHourTable = true;
			this.isTaskHourTable = false;
		} else if ($event === 'By Task Hours') {
			this.isEmployeeHourTable = false;
			this.isProjectHourTable = false;
			this.isTaskHourTable = true;
		} else {
			this.isEmployeeHourTable = false;
			this.isProjectHourTable = false;
			this.isTaskHourTable = false;
		}
	}

	generateTable() {
		this.smartTableSource.refresh();
		const fakeData = [];
		let fakePrice = 10;
		let fakeQuantity = 5;
		if (this.invoiceType === 'By Employee Hours') {
			if (this.selectedEmployeeIds.length) {
				for (const employeeId of this.selectedEmployeeIds) {
					const data = {
						description: 'Desc',
						price: fakePrice,
						quantity: fakeQuantity,
						selectedEmployee: employeeId,
						allEmployees: this.employees
					};
					fakeData.push(data);
					fakePrice++;
					fakeQuantity++;
				}
			}
		} else if (this.invoiceType === 'By Project Hours') {
			if (this.selectedProjects.length) {
				for (const project of this.selectedProjects) {
					const data = {
						description: 'Desc',
						price: fakePrice,
						quantity: fakeQuantity,
						project: project
					};
					fakeData.push(data);
					fakePrice++;
					fakeQuantity++;
				}
			}
		} else if (this.invoiceType === 'By Task Hours') {
			if (this.selectedTasks.length) {
				for (const task of this.selectedTasks) {
					const data = {
						description: 'Desc',
						price: fakePrice,
						quantity: fakeQuantity,
						task: task
					};
					fakeData.push(data);
					fakePrice++;
					fakeQuantity++;
				}
			}
		}
		this.shouldLoadTable = true;
		this.enableSaveButton = false;
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.smartTableSource.load(fakeData);
	}

	selectTask($event) {
		this.selectedTasks = $event;
	}

	selectClient($event) {
		this.client = $event;
	}

	selectProject($event) {
		this.selectedProjects = $event;
	}

	searchClient(term: string, item: any) {
		if (item.name) {
			return item.name.toLowerCase().includes(term.toLowerCase());
		}
	}

	onMembersSelected(event) {
		this.selectedEmployeeIds = event;
	}

	onCreateConfirm(event) {
		if (event.newData.selectedEmployee === '') {
			event.newData['allEmployees'] = this.employees;
		}
		if (
			!isNaN(event.newData.quantity) &&
			!isNaN(event.newData.price) &&
			event.newData.quantity &&
			event.newData.price &&
			event.newData.description
		) {
			event.confirm.resolve(event.newData);
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
			!isNaN(
				event.newData.price &&
					event.newData.quantity &&
					event.newData.price &&
					event.newData.description
			)
		) {
			event.confirm.resolve(event.newData);
		} else {
			this.toastrService.danger(
				this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.INVALID_ITEM'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			event.confirm.reject();
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

	addNewClient = (name: string): Promise<OrganizationClients> => {
		this.organizationId = this.store.selectedOrganization.id;
		try {
			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_CLIENTS.ADD_CLIENT',
					{
						name: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			return this.organizationClientsService.create({
				name,
				organizationId: this.organizationId
			});
		} catch (error) {
			this.errorHandler.handleError(error);
		}
	};

	cancel() {
		this.router.navigate(['/pages/accounting/invoices']);
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
