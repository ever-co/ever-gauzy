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
	Task
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
import { EmployeeSelectorComponent } from '../../../@theme/components/header/selectors/employee/employee.component';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { TasksService } from '../../../@core/services/tasks.service';
import { ErrorHandlingService } from '../../../@core/services/error-handling.service';

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
	smartTableSource = new LocalDataSource();
	task: Task;
	tasks: Task[];
	loadedNumber: boolean;
	organization: Organization;
	selectedClient: OrganizationClients;
	selectedProject: OrganizationProjects;
	selectedTask: Task;
	client: OrganizationClients;
	clients: OrganizationClients[];
	projects: OrganizationProjects[];
	invoiceType: string;
	shouldLoadTable: boolean;
	isEmployeeHourTable: boolean;
	isProjectHourTable: boolean;
	isTaskHourTable: boolean;
	organizationId: string;
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
		private organizationsService: OrganizationsService,
		private organizationProjectsService: OrganizationProjectsService,
		private tasksService: TasksService,
		private errorHandler: ErrorHandlingService
	) {
		super(translateService);
	}

	@ViewChild('employeeSelector', { static: false })
	employeeSelector: EmployeeSelectorComponent;

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
			invoiceType: ['', Validators.required],
			project: ['', Validators.required],
			task: ['', Validators.required]
		});
	}

	async loadSmartTable() {
		this.loadedNumber = false;
		await this.createInvoiceItemNumber();
		this.loadedNumber = true;
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
					employee: {
						title: 'Employee name',
						type: 'string'
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
					project: {
						title: 'Project name',
						type: 'string'
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
						title: 'Task',
						type: 'custom',
						renderComponent: InvoiceAddTasksComponent
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
		}
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

			this.router.navigate(['/pages/accounting/invoices']);
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
			this.formItemNumber = +items[items.length - 1].itemNumber + 1;
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
		let fakeData = [];
		if (this.invoiceType === 'By Employee Hours') {
			fakeData = [
				{
					itemNumber: 1,
					employee: 'Employee 1',
					name: 'Name 1',
					description: 'Desc 1',
					hourlyRate: 0,
					hoursWorked: 0,
					totalValue: 0
				},
				{
					itemNumber: 2,
					employee: 'Employee 2',
					name: 'Name 2',
					description: 'Desc 2',
					hourlyRate: 1,
					hoursWorked: 1,
					totalValue: 1
				},
				{
					itemNumber: 3,
					employee: 'Employee 3',
					name: 'Name 3',
					description: 'Desc 3',
					hourlyRate: 2,
					hoursWorked: 2,
					totalValue: 4
				}
			];
		} else if (this.invoiceType === 'By Project Hours') {
			fakeData = [
				{
					itemNumber: 1,
					project: 'Project 1',
					name: 'Name 1',
					description: 'Desc 1',
					hourlyRate: 0,
					hoursWorked: 0,
					totalValue: 0
				},
				{
					itemNumber: 2,
					project: 'Project 2',
					name: 'Name 2',
					description: 'Desc 2',
					hourlyRate: 1,
					hoursWorked: 1,
					totalValue: 1
				},
				{
					itemNumber: 3,
					project: 'Project 3',
					name: 'Name 3',
					description: 'Desc 3',
					hourlyRate: 2,
					hoursWorked: 2,
					totalValue: 4
				}
			];
		} else if (this.invoiceType === 'By Task Hours') {
			fakeData = [
				{
					itemNumber: 1,
					name: 'Name 1',
					description: 'Desc 1',
					hourlyRate: 0,
					hoursWorked: 0,
					totalValue: 0
				},
				{
					itemNumber: 2,
					name: 'Name 2',
					description: 'Desc 2',
					hourlyRate: 1,
					hoursWorked: 1,
					totalValue: 1
				},
				{
					itemNumber: 3,
					name: 'Name 3',
					description: 'Desc 3',
					hourlyRate: 2,
					hoursWorked: 2,
					totalValue: 4
				}
			];
		}
		this.shouldLoadTable = true;
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.smartTableSource.load(fakeData);
	}

	selectTask($event) {
		this.selectedTask = $event;
	}

	selectClient($event) {
		this.selectedClient = $event;
	}

	selectProject($event) {
		this.selectedProject = $event;
	}

	searchClient(term: string, item: any) {
		if (item.name) {
			return item.name.toLowerCase().includes(term.toLowerCase());
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
