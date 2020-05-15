import { Component, OnInit, OnDestroy } from '@angular/core';
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
	PermissionsEnum,
	InvoiceTypeEnum,
	DiscountTaxTypeEnum
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
import { InvoiceProductsSelectorComponent } from '../table-components/invoice-product-selector.component';
import { ProductService } from '../../../@core/services/product.service';

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
		private taskService: TasksService,
		private productService: ProductService
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
	hasInvoiceEditPermission: boolean;

	subtotal = 0;
	total = 0;
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
		const invoice = await this.invoicesService.getById(this.invoiceId, [
			'invoiceItems'
		]);
		this.invoice = invoice;
		this.invoiceItems = this.invoice.invoiceItems;
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
			invoiceNumber: [
				'',
				Validators.compose([Validators.required, Validators.min(1)])
			],
			dueDate: ['', Validators.required],
			discountValue: [
				'',
				Validators.compose([Validators.required, Validators.min(0)])
			],
			tax: [
				'',
				Validators.compose([Validators.required, Validators.min(0)])
			],
			terms: [''],
			paid: [''],
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
			columns: {}
		};
		let price = {};
		let quantity = {};

		switch (this.invoice.invoiceType) {
			case InvoiceTypeEnum.BY_EMPLOYEE_HOURS:
				this.settingsSmartTable['columns']['selectedEmployee'] = {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.EMPLOYEE'
					),
					type: 'custom',
					renderComponent: InvoiceEmployeesSelectorComponent,
					filter: false,
					addable: false,
					editable: false,
					width: '25%'
				};
				break;
			case InvoiceTypeEnum.BY_PROJECT_HOURS:
				this.settingsSmartTable['columns']['selectedProject'] = {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.PROJECT'
					),
					type: 'custom',
					renderComponent: InvoiceProjectsSelectorComponent,
					filter: false,
					addable: false,
					editable: false
				};
				break;
			case InvoiceTypeEnum.BY_TASK_HOURS:
				this.settingsSmartTable['columns']['selectedTask'] = {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.TASK'
					),
					type: 'custom',
					renderComponent: InvoiceTasksSelectorComponent,
					filter: false,
					addable: false,
					editable: false
				};
				break;
			case InvoiceTypeEnum.BY_PRODUCTS:
				this.settingsSmartTable['columns']['product'] = {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.PRODUCT'
					),
					type: 'custom',
					renderComponent: InvoiceProductsSelectorComponent,
					filter: false,
					addable: false,
					editable: false
				};
				break;
			default:
				break;
		}

		if (
			this.invoice.invoiceType === InvoiceTypeEnum.BY_EMPLOYEE_HOURS ||
			this.invoice.invoiceType === InvoiceTypeEnum.BY_PROJECT_HOURS ||
			this.invoice.invoiceType === InvoiceTypeEnum.BY_TASK_HOURS
		) {
			price = {
				title: this.getTranslation(
					'INVOICES_PAGE.INVOICE_ITEM.HOURLY_RATE'
				),
				type: 'text',
				filter: false,
				valuePrepareFunction: (cell, row) => {
					return `${this.currency.value} ${cell}`;
				}
			};
			quantity = {
				title: this.getTranslation(
					'INVOICES_PAGE.INVOICE_ITEM.HOURS_WORKED'
				),
				type: 'text',
				filter: false
			};
		} else if (
			this.invoice.invoiceType ===
				InvoiceTypeEnum.DETAILS_INVOICE_ITEMS ||
			this.invoice.invoiceType === InvoiceTypeEnum.BY_PRODUCTS
		) {
			price = {
				title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.PRICE'),
				type: 'text',
				filter: false,
				valuePrepareFunction: (cell, row) => {
					return `${this.currency.value} ${cell}`;
				}
			};
			quantity = {
				title: this.getTranslation(
					'INVOICES_PAGE.INVOICE_ITEM.QUANTITY'
				),
				type: 'text',
				filter: false
			};
		}
		this.settingsSmartTable['columns']['description'] = {
			title: this.getTranslation(
				'INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION'
			),
			type: 'text'
		};
		this.settingsSmartTable['columns']['price'] = price;
		this.settingsSmartTable['columns']['quantity'] = quantity;
		this.settingsSmartTable['columns']['totalValue'] = {
			title: this.getTranslation(
				'INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE'
			),
			type: 'text',
			addable: false,
			editable: false,
			valuePrepareFunction: (cell, row) => {
				return `${this.currency.value} ${row.quantity * row.price}`;
			},
			filter: false
		};
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
							await this.loadInvoiceItemData();
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
		console.log(tableData);
		if (tableData.length) {
			const invoiceData = this.form.value;
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
			} else if (tableData[0].hasOwnProperty('project')) {
				for (const invoiceItem of tableData) {
					if (!invoiceItem.project) {
						this.toastrService.danger(
							this.getTranslation(
								'INVOICES_PAGE.INVOICE_ITEM.PROJECT_VALUE'
							),
							this.getTranslation('TOASTR.TITLE.WARNING')
						);
						return;
					}
				}
			} else if (tableData[0].hasOwnProperty('task')) {
				for (const invoiceItem of tableData) {
					if (!invoiceItem.task) {
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

			const invoice = await this.invoicesService.getAll([], {
				invoiceNumber: invoiceData.invoiceNumber
			});

			if (
				invoice.items.length &&
				+invoice.items[0].invoiceNumber !== +this.invoice.invoiceNumber
			) {
				this.toastrService.danger(
					this.getTranslation(
						'INVOICES_PAGE.INVOICE_NUMBER_DUPLICATE'
					),
					this.getTranslation('TOASTR.TITLE.WARNING')
				);
				return;
			}

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
				totalValue: +this.total.toFixed(2),
				invoiceType: this.invoice.invoiceType,
				clientId: invoiceData.client.id,
				organizationId: this.organization.id
			});

			for (const invoiceItem of tableData) {
				if (invoiceItem.id) {
					if (invoiceItem.selectedEmployee) {
						await this.invoiceItemService.update(invoiceItem.id, {
							description: invoiceItem.description,
							price: invoiceItem.price,
							quantity: invoiceItem.quantity,
							totalValue: invoiceItem.totalValue,
							invoiceId: this.invoice.id,
							employeeId: invoiceItem.selectedEmployee
						});
					} else if (invoiceItem.project) {
						await this.invoiceItemService.update(invoiceItem.id, {
							description: invoiceItem.description,
							price: invoiceItem.price,
							quantity: invoiceItem.quantity,
							totalValue: invoiceItem.totalValue,
							invoiceId: this.invoice.id,
							projectId: invoiceItem.project.id
						});
					} else if (invoiceItem.task) {
						await this.invoiceItemService.update(invoiceItem.id, {
							description: invoiceItem.description,
							price: invoiceItem.price,
							quantity: invoiceItem.quantity,
							totalValue: invoiceItem.totalValue,
							invoiceId: this.invoice.id,
							taskId: invoiceItem.task.id
						});
					} else if (invoiceItem.product) {
						await this.invoiceItemService.update(invoiceItem.id, {
							description: invoiceItem.description,
							price: invoiceItem.price,
							quantity: invoiceItem.quantity,
							totalValue: invoiceItem.totalValue,
							invoiceId: this.invoice.id,
							productId: invoiceItem.product.id
						});
					} else {
						await this.invoiceItemService.update(invoiceItem.id, {
							description: invoiceItem.description,
							price: invoiceItem.price,
							quantity: invoiceItem.quantity,
							totalValue: invoiceItem.totalValue,
							invoiceId: this.invoice.id
						});
					}
				} else {
					if (invoiceItem.selectedEmployee) {
						await this.invoiceItemService.add({
							description: invoiceItem.description,
							price: invoiceItem.price,
							quantity: invoiceItem.quantity,
							totalValue: invoiceItem.totalValue,
							invoiceId: this.invoice.id,
							employeeId: invoiceItem.selectedEmployee
						});
					} else if (invoiceItem.project) {
						await this.invoiceItemService.add({
							description: invoiceItem.description,
							price: invoiceItem.price,
							quantity: invoiceItem.quantity,
							totalValue: invoiceItem.totalValue,
							invoiceId: this.invoice.id,
							projectId: invoiceItem.project.id
						});
					} else if (invoiceItem.task) {
						await this.invoiceItemService.add({
							description: invoiceItem.description,
							price: invoiceItem.price,
							quantity: invoiceItem.quantity,
							totalValue: invoiceItem.totalValue,
							invoiceId: this.invoice.id,
							taskId: invoiceItem.task.id
						});
					} else if (invoiceItem.product) {
						await this.invoiceItemService.add({
							description: invoiceItem.description,
							price: invoiceItem.price,
							quantity: invoiceItem.quantity,
							totalValue: invoiceItem.totalValue,
							invoiceId: this.invoice.id,
							productId: invoiceItem.product.id
						});
					} else {
						await this.invoiceItemService.add({
							description: invoiceItem.description,
							price: invoiceItem.price,
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

	async loadInvoiceItemData() {
		const items = [];
		let data;
		for (const item of this.invoiceItems) {
			if (item.employeeId) {
				data = {
					description: item.description,
					quantity: item.quantity,
					price: item.price,
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
					price: item.price,
					totalValue: +item.totalValue,
					id: item.id,
					project: project
				};
			} else if (item.taskId) {
				const task = await this.taskService.getById(item.taskId);
				data = {
					description: item.description,
					quantity: item.quantity,
					price: item.price,
					totalValue: +item.totalValue,
					id: item.id,
					task: task
				};
			} else if (item.productId) {
				const product = await this.productService.getById(
					item.productId
				);
				data = {
					description: item.description,
					quantity: item.quantity,
					price: item.price,
					totalValue: +item.totalValue,
					id: item.id,
					product: product
				};
			} else {
				data = {
					description: item.description,
					quantity: item.quantity,
					price: item.price,
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
				? +this.form.value.discountValue
				: 0;
		const tax =
			this.form.value.tax && this.form.value.tax > 0
				? +this.form.value.tax
				: 0;
		let totalDiscount = 0;
		let totalTax = 0;

		switch (this.form.value.discountType) {
			case DiscountTaxTypeEnum.PERCENT:
				totalDiscount = this.subtotal * (discountValue / 100);
				break;
			case DiscountTaxTypeEnum.FLAT_VALUE:
				totalDiscount = discountValue;
				break;
			default:
				totalDiscount = 0;
				break;
		}
		switch (this.form.value.taxType) {
			case DiscountTaxTypeEnum.PERCENT:
				totalTax = this.subtotal * (tax / 100);
				break;
			case DiscountTaxTypeEnum.FLAT_VALUE:
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
