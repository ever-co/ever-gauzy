import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Store } from '../../../@core/services/store.service';
import { TranslateService } from '@ngx-translate/core';
import {
	Invoice,
	OrganizationContact,
	CurrenciesEnum,
	OrganizationSelectInput,
	InvoiceItem,
	Organization,
	Employee,
	PermissionsEnum,
	InvoiceTypeEnum,
	DiscountTaxTypeEnum,
	Tag,
	Task,
	OrganizationProjects,
	Product
} from '@gauzy/models';
import { takeUntil, first } from 'rxjs/operators';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { OrganizationContactService } from '../../../@core/services/organization-contact.service';
import { Subject, Observable } from 'rxjs';
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
import { InvoiceProductsSelectorComponent } from '../table-components/invoice-product-selector.component';
import { ProductService } from '../../../@core/services/product.service';
import { TasksStoreService } from '../../../@core/services/tasks-store.service';

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
		private organizationContactService: OrganizationContactService,
		private route: ActivatedRoute,
		private employeeService: EmployeesService,
		private projectService: OrganizationProjectsService,
		private productService: ProductService,
		private tasksStore: TasksStoreService
	) {
		super(translate);
		this.observableTasks = this.tasksStore.tasks$;
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
	selectedClient: OrganizationContact;
	clients: OrganizationContact[];
	employees: Employee[];
	projects: OrganizationProjects[];
	products: Product[];
	currencies = Object.values(CurrenciesEnum);
	invoiceDate: Date;
	dueDate: Date;
	hasInvoiceEditPermission: boolean;
	tags: Tag[] = [];
	tasks: Task[];
	observableTasks: Observable<Task[]>;

	subtotal = 0;
	total = 0;
	get currency() {
		return this.form.get('currency');
	}
	private _ngDestroy$ = new Subject<void>();

	@Input() isEstimate: boolean;

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
			'invoiceItems',
			'tags'
		]);
		this.invoice = invoice;
		this.invoiceItems = this.invoice.invoiceItems;
		await this._loadOrganizationData();
	}

	async executeInitialFunctions() {
		await this.getInvoice();
		if (this.invoice) {
			this.invoiceDate = new Date(this.invoice.invoiceDate);
			this.dueDate = new Date(this.invoice.dueDate);
			this.loadSmartTable();
			this._applyTranslationOnSmartTable();
			this.seedFormData(this.invoice);
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
			client: ['', Validators.required],
			currency: ['', Validators.required],
			discountType: ['', Validators.required],
			taxType: ['', Validators.required],
			tags: []
		});
	}

	seedFormData(invoice: Invoice) {
		this.form.get('invoiceNumber').setValue(invoice.invoiceNumber);
		this.form.get('invoiceDate').setValue(this.invoiceDate);
		this.form.get('dueDate').setValue(this.dueDate);
		this.form.get('discountValue').setValue(invoice.discountValue);
		this.form.get('tax').setValue(invoice.tax);
		this.form.get('terms').setValue(invoice.terms);
		this.form.get('discountType').setValue(invoice.discountType);
		this.form.get('taxType').setValue(invoice.taxType);
		this.invoiceLoaded = true;
		this.tags = invoice.tags;
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
				this.settingsSmartTable['columns']['selectedItem'] = {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.EMPLOYEE'
					),
					filter: false,
					width: '25%',
					editor: {
						type: 'custom',
						component: InvoiceEmployeesSelectorComponent
					},
					valuePrepareFunction: (cell) => {
						if (this.employees) {
							const employee = this.employees.find(
								(e) => e.id === cell
							);
							if (employee) {
								return `${employee.user.firstName} ${employee.user.lastName}`;
							}
						}
					}
				};
				break;
			case InvoiceTypeEnum.BY_PROJECT_HOURS:
				this.settingsSmartTable['columns']['selectedItem'] = {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.PROJECT'
					),
					filter: false,
					editor: {
						type: 'custom',
						component: InvoiceProjectsSelectorComponent
					},
					valuePrepareFunction: (cell) => {
						if (this.projects) {
							const project = this.projects.find(
								(p) => p.id === cell
							);
							return `${project.name}`;
						}
					}
				};
				break;
			case InvoiceTypeEnum.BY_TASK_HOURS:
				this.settingsSmartTable['columns']['selectedItem'] = {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.TASK'
					),
					filter: false,
					editor: {
						type: 'custom',
						component: InvoiceTasksSelectorComponent
					},
					valuePrepareFunction: (cell) => {
						if (this.tasks) {
							const task = this.tasks.find((t) => t.id === cell);
							return `${task.title}`;
						}
					}
				};
				break;
			case InvoiceTypeEnum.BY_PRODUCTS:
				this.settingsSmartTable['columns']['selectedItem'] = {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.PRODUCT'
					),
					filter: false,
					editor: {
						type: 'custom',
						component: InvoiceProductsSelectorComponent
					},
					valuePrepareFunction: (cell) => {
						if (this.products) {
							const product = this.products.find(
								(p) => p.id === cell
							);
							return `${product.name}`;
						}
					}
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

					const products = await this.productService.getAll([], {
						organizationId: organization.id
					});
					this.products = products.items;

					this.tasksStore.fetchTasks();
					this.observableTasks.subscribe((data) => {
						this.tasks = data;
					});

					const projects = await this.projectService.getAll([], {
						organizationId: organization.id
					});
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

					const res = await this.organizationContactService.getAll(
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
				totalValue: +this.total.toFixed(2),
				invoiceType: this.invoice.invoiceType,
				clientId: invoiceData.client.id,
				organizationId: this.organization.id,
				tags: this.tags
			});

			for (const invoiceItem of tableData) {
				const itemToAdd = {
					description: invoiceItem.description,
					price: invoiceItem.price,
					quantity: invoiceItem.quantity,
					totalValue: invoiceItem.totalValue,
					invoiceId: this.invoice.id
				};
				switch (this.invoice.invoiceType) {
					case InvoiceTypeEnum.BY_EMPLOYEE_HOURS:
						itemToAdd['employeeId'] = invoiceItem.selectedItem;
						break;
					case InvoiceTypeEnum.BY_PROJECT_HOURS:
						itemToAdd['projectId'] = invoiceItem.selectedItem;
						break;
					case InvoiceTypeEnum.BY_TASK_HOURS:
						itemToAdd['taskId'] = invoiceItem.selectedItem;
						break;
					case InvoiceTypeEnum.BY_PRODUCTS:
						itemToAdd['productId'] = invoiceItem.selectedItem;
						break;
					default:
						break;
				}
				if (invoiceItem.id) {
					await this.invoiceItemService.update(
						invoiceItem.id,
						itemToAdd
					);
				} else {
					await this.invoiceItemService.add(itemToAdd);
				}
			}

			if (this.itemsToDelete.length) {
				for (const itemId of this.itemsToDelete) {
					this.invoiceItemService.delete(itemId);
				}
			}

			if (this.isEstimate) {
				this.toastrService.primary(
					this.getTranslation('INVOICES_PAGE.INVOICES_EDIT_ESTIMATE'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
				this.router.navigate(['/pages/accounting/invoices/estimates']);
			} else {
				this.toastrService.primary(
					this.getTranslation('INVOICES_PAGE.INVOICES_EDIT_INVOICE'),
					this.getTranslation('TOASTR.TITLE.SUCCESS')
				);
				this.router.navigate(['/pages/accounting/invoices']);
			}
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
					selectedItem: item.employeeId
				};
			} else if (item.projectId) {
				data = {
					description: item.description,
					quantity: item.quantity,
					price: item.price,
					totalValue: +item.totalValue,
					id: item.id,
					selectedItem: item.projectId
				};
			} else if (item.taskId) {
				data = {
					description: item.description,
					quantity: item.quantity,
					price: item.price,
					totalValue: +item.totalValue,
					id: item.id,
					selectedItem: item.taskId
				};
			} else if (item.productId) {
				data = {
					description: item.description,
					quantity: item.quantity,
					price: item.price,
					totalValue: +item.totalValue,
					id: item.id,
					selectedItem: item.productId
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
			event.newData.description &&
			event.newData.selectedItem
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
			event.newData.description &&
			event.newData.selectedItem
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
		if (this.isEstimate) {
			this.router.navigate(['/pages/accounting/invoices/estimates']);
		} else {
			this.router.navigate(['/pages/accounting/invoices']);
		}
	}

	payments() {
		this.router.navigate([
			`/pages/accounting/invoices/payments/${this.invoice.id}`
		]);
	}

	selectedTagsEvent(currentTagSelection: Tag[]) {
		this.tags = currentTagSelection;
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
