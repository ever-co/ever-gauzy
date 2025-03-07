import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import {
	IInvoice,
	IOrganizationContact,
	IOrganization,
	IOrganizationProject,
	ITask,
	IEmployee,
	InvoiceTypeEnum,
	DiscountTaxTypeEnum,
	ITag,
	IExpense,
	ExpenseTypesEnum,
	InvoiceStatusTypesEnum,
	IInvoiceItemCreateInput,
	IProductTranslatable,
	ExpenseStatusesEnum,
	IDateRangePicker
} from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { compareDate, distinctUntilChange, extractNumber, isEmpty, isNotEmpty } from '@gauzy/ui-core/common';
import { LocalDataSource } from 'angular2-smart-table';
import { Observable, Subject, firstValueFrom, takeUntil } from 'rxjs';
import { Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import * as moment from 'moment';
import {
	DateRangePickerBuilderService,
	ExpensesService,
	InvoiceEstimateHistoryService,
	InvoiceItemService,
	InvoicesService,
	OrganizationProjectsService,
	OrganizationSettingService,
	ProductService,
	Store,
	TasksStoreService,
	ToastrService,
	TranslatableService
} from '@gauzy/ui-core/core';
import { InvoiceEmailMutationComponent } from '../invoice-email/invoice-email-mutation.component';
import { InvoiceExpensesSelectorComponent } from '../table-components/invoice-expense-selector.component';
import {
	InvoiceApplyTaxDiscountComponent,
	InvoiceEmployeesSelectorComponent,
	InvoiceProductsSelectorComponent,
	InvoiceProjectsSelectorComponent,
	InvoiceTasksSelectorComponent
} from '../table-components';
import { IPaginationBase, PaginationFilterBaseComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoice-add',
	templateUrl: './invoice-add.component.html',
	styleUrls: ['./invoice-add.component.scss']
})
export class InvoiceAddComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	settingsSmartTable: object;
	loading: boolean;
	form: UntypedFormGroup;
	invoice?: IInvoice;
	createdInvoice: IInvoice;
	formInvoiceNumber: number;
	invoiceTypes = Object.values(InvoiceTypeEnum);
	discountTaxTypes = Object.values(DiscountTaxTypeEnum);
	smartTableSource = new LocalDataSource();
	generatedTask: string;
	organization: IOrganization;
	selectedTasks: ITask[];
	observableTasks: Observable<ITask[]> = this.tasksStore.tasks$;
	tasks: ITask[];
	organizationContact: IOrganizationContact;
	selectedProjects: IOrganizationProject[];
	projects: IOrganizationProject[];
	employees: IEmployee[];
	selectedEmployeeIds: string[];
	products: IProductTranslatable[];
	selectedProducts: IProductTranslatable[];
	expenses: IExpense[];
	selectedExpenses: IExpense[];
	invoiceType: string;
	selectedInvoiceType: string;
	shouldLoadTable: boolean;
	isEmployeeHourTable: boolean;
	isProjectHourTable: boolean;
	isTaskHourTable: boolean;
	isProductTable: boolean;
	isExpenseTable: boolean;
	disableSaveButton = true;
	organizationId: string;
	discountAfterTax: boolean;
	subtotal = 0;
	total = 0;
	currencyString: string;
	selectedLanguage: string;
	selectedDateRange: IDateRangePicker;

	private readonly _destroy$ = new Subject<void>();

	get currency() {
		return this.form.get('currency');
	}

	private _isEstimate = false;
	@Input() set isEstimate(val: boolean) {
		this._isEstimate = val;
	}
	get isEstimate() {
		return this._isEstimate;
	}

	constructor(
		private readonly fb: UntypedFormBuilder,
		public readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly router: Router,
		private readonly toastrService: ToastrService,
		private readonly invoicesService: InvoicesService,
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly invoiceItemService: InvoiceItemService,
		private readonly tasksStore: TasksStoreService,
		private readonly productService: ProductService,
		private readonly dialogService: NbDialogService,
		private readonly expensesService: ExpensesService,
		private readonly invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private readonly translatableService: TranslatableService,
		private readonly organizationSettingService: OrganizationSettingService,
		private readonly dateRangePickerService: DateRangePickerBuilderService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._applyTranslationOnSmartTable();
		this.selectedLanguage = this.translateService.currentLang;
		this.dateRangePickerService.selectedDateRange$.pipe(takeUntil(this._destroy$)).subscribe((range) => {
			if (range) {
				this.selectedDateRange = range;
			}
		});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => (this.organization = organization)),
				tap(({ currency }) => (this.currencyString = currency)),
				tap((organization) => (this.discountAfterTax = organization.discountAfterTax)),
				tap(() => {
					this.initializeForm();
					this._initializeMethods();
				}),
				tap(() => {
					if (this.currencyString) {
						this.currency.setValue(this.currencyString);
						this.currency.updateValueAndValidity();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.observableTasks.pipe(untilDestroyed(this)).subscribe((data) => {
			this.tasks = data;
		});
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe((languageEvent) => {
			this.selectedLanguage = languageEvent.lang;
		});
		this.subject$
			.pipe(
				tap(() => {
					const { activePage, itemsPerPage } = this.getPagination();
					this.smartTableSource.setPaging(activePage, itemsPerPage, false);
					this.smartTableSource.refresh();
				})
			)
			.subscribe();
		this.pagination$
			.pipe(
				distinctUntilChange(),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	initializeForm() {
		this.form = this.fb.group({
			invoiceDate: [this.organizationSettingService.getDateFromOrganizationSettings(), Validators.required],
			invoiceNumber: [this.formInvoiceNumber, Validators.compose([Validators.required, Validators.min(1)])],
			dueDate: [this.getNextMonth(), Validators.required],
			currency: ['', Validators.required],
			discountValue: [0, Validators.compose([Validators.required, Validators.min(0)])],
			tax: [0, Validators.compose([Validators.required, Validators.min(0)])],
			tax2: [0, Validators.compose([Validators.required, Validators.min(0)])],
			terms: [this.organization ? this.organization.defaultInvoiceEstimateTerms || '' : ''],
			organizationContact: ['', Validators.required],
			discountType: [],
			taxType: [],
			tax2Type: [],
			invoiceType: [null, Validators.required],
			project: [],
			task: [],
			product: [],
			expense: [],
			tags: [],
			selectedEmployeeIds: [[]]
		});
	}

	loadSmartTable() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
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
		switch (this.invoiceType) {
			case InvoiceTypeEnum.BY_EMPLOYEE_HOURS:
				this.settingsSmartTable['columns']['selectedItem'] = {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.EMPLOYEE'),
					width: '13%',
					editor: {
						type: 'custom',
						component: InvoiceEmployeesSelectorComponent
					},
					valuePrepareFunction: (cell) => {
						const employee = cell;
						return `${employee.user.name}`;
					}
				};
				break;
			case InvoiceTypeEnum.BY_PROJECT_HOURS:
				this.settingsSmartTable['columns']['selectedItem'] = {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.PROJECT'),
					width: '13%',
					editor: {
						type: 'custom',
						component: InvoiceProjectsSelectorComponent
					},
					valuePrepareFunction: (cell) => {
						const project = cell;
						return `${project.name}`;
					}
				};
				break;
			case InvoiceTypeEnum.BY_TASK_HOURS:
				this.settingsSmartTable['columns']['selectedItem'] = {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.TASK'),
					width: '13%',
					editor: {
						type: 'custom',
						component: InvoiceTasksSelectorComponent
					},
					valuePrepareFunction: (cell) => {
						const task = cell;
						return `${task.title}`;
					}
				};
				break;
			case InvoiceTypeEnum.BY_PRODUCTS:
				this.settingsSmartTable['columns']['selectedItem'] = {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.PRODUCT'),
					width: '13%',
					editor: {
						type: 'custom',
						component: InvoiceProductsSelectorComponent
					},
					valuePrepareFunction: (cell) => {
						const product = cell;
						return `${this.translatableService.getTranslatedProperty(product, 'name')}`;
					}
				};
				break;
			case InvoiceTypeEnum.BY_EXPENSES:
				this.settingsSmartTable['columns']['selectedItem'] = {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.EXPENSE'),
					width: '13%',
					editor: {
						type: 'custom',
						component: InvoiceExpensesSelectorComponent
					},
					valuePrepareFunction: (cell) => {
						const expense = cell;
						return `${expense.purpose}`;
					}
				};
				break;
			default:
				break;
		}

		if (
			this.invoiceType === InvoiceTypeEnum.BY_EMPLOYEE_HOURS ||
			this.invoiceType === InvoiceTypeEnum.BY_PROJECT_HOURS ||
			this.invoiceType === InvoiceTypeEnum.BY_TASK_HOURS
		) {
			price = {
				title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.HOURLY_RATE'),
				type: 'text',
				isFilterable: false,
				width: '13%',
				valuePrepareFunction: (cell, row) => {
					return `${this.currency.value} ${cell}`;
				}
			};
			quantity = {
				title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.HOURS_WORKED'),
				type: 'text',
				isFilterable: false,
				width: '13%'
			};
		} else if (
			this.invoiceType === InvoiceTypeEnum.DETAILED_ITEMS ||
			this.invoiceType === InvoiceTypeEnum.BY_PRODUCTS ||
			this.invoiceType === InvoiceTypeEnum.BY_EXPENSES
		) {
			price = {
				title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.PRICE'),
				type: 'text',
				isFilterable: false,
				width: '13%',
				valuePrepareFunction: (cell) => {
					return `${this.currency.value} ${cell}`;
				}
			};
			quantity = {
				title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.QUANTITY'),
				type: 'text',
				width: '13%',
				isFilterable: false
			};
		}
		this.settingsSmartTable['columns']['description'] = {
			title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION'),
			type: 'text',
			width: '13%'
		};
		this.settingsSmartTable['columns']['price'] = price;
		this.settingsSmartTable['columns']['quantity'] = quantity;
		this.settingsSmartTable['columns']['totalValue'] = {
			title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE'),
			type: 'text',
			addable: false,
			editable: false,
			valuePrepareFunction: (cell) => {
				return `${this.currency.value} ${cell}`;
			},
			isFilterable: false,
			width: '13%'
		};
		if (this.organization.separateInvoiceItemTaxAndDiscount) {
			this.settingsSmartTable['columns']['applyTax'] = {
				title: this.getTranslation('INVOICES_PAGE.APPLY_TAX'),
				editor: {
					type: 'custom',
					component: InvoiceApplyTaxDiscountComponent
				},
				isFilterable: false,
				width: '10%',
				valuePrepareFunction: (cell) => {
					if (cell) {
						return this.getTranslation('INVOICES_PAGE.APPLIED');
					} else {
						return this.getTranslation('INVOICES_PAGE.NOT_APPLIED');
					}
				}
			};
			this.settingsSmartTable['columns']['applyDiscount'] = {
				title: this.getTranslation('INVOICES_PAGE.APPLY_DISCOUNT'),
				editor: {
					type: 'custom',
					component: InvoiceApplyTaxDiscountComponent
				},
				isFilterable: false,
				width: '10%',
				valuePrepareFunction: (cell) => {
					if (cell) {
						return this.getTranslation('INVOICES_PAGE.APPLIED');
					} else {
						return this.getTranslation('INVOICES_PAGE.NOT_APPLIED');
					}
				}
			};
		}
	}

	async createInvoiceEstimate(status: string, sendTo?: string) {
		if (!this.organization) {
			return;
		}
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;
		const { value: currency } = this.currency;
		const {
			invoiceNumber,
			invoiceDate,
			dueDate,
			discountValue,
			discountType,
			tax,
			tax2,
			taxType,
			tax2Type,
			terms,
			organizationContact,
			tags
		} = this.form.value;

		try {
			const createdInvoice = await this.invoicesService.add({
				invoiceNumber,
				invoiceDate: moment(invoiceDate).startOf('day').toDate(),
				dueDate: moment(dueDate).endOf('day').toDate(),
				currency,
				discountValue,
				discountType,
				tax,
				tax2,
				taxType,
				tax2Type,
				terms,
				paid: false,
				totalValue: +this.total.toFixed(2),
				toContact: organizationContact,
				organizationContactId: organizationContact.id,
				fromOrganization: this.organization,
				organizationId,
				tenantId,
				invoiceType: this.selectedInvoiceType,
				tags,
				isEstimate: this.isEstimate,
				status: status,
				sentTo: sendTo,
				isArchived: false
			});
			this.createdInvoice = createdInvoice;
			return createdInvoice;
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	async createInvoiceEstimateItems() {
		if (!this.organization) {
			return;
		}

		const createdInvoice = this.createdInvoice;
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		const tableSources = await this.smartTableSource.getAll();

		const invoiceItems: IInvoiceItemCreateInput[] = [];

		for (const invoiceItem of tableSources) {
			const id = invoiceItem.selectedItem ? invoiceItem.selectedItem.id : null;
			const itemToAdd = {
				description: invoiceItem.description,
				price: Number(invoiceItem.price),
				quantity: Number(invoiceItem.quantity),
				totalValue: invoiceItem.totalValue,
				invoiceId: createdInvoice.id,
				applyTax: invoiceItem.applyTax,
				applyDiscount: invoiceItem.applyDiscount,
				organizationId,
				tenantId
			};

			switch (this.selectedInvoiceType) {
				case InvoiceTypeEnum.BY_EMPLOYEE_HOURS:
					itemToAdd['employeeId'] = id;
					break;
				case InvoiceTypeEnum.BY_PROJECT_HOURS:
					itemToAdd['projectId'] = id;
					break;
				case InvoiceTypeEnum.BY_TASK_HOURS:
					itemToAdd['taskId'] = id;
					break;
				case InvoiceTypeEnum.BY_PRODUCTS:
					itemToAdd['productId'] = id;
					break;
				case InvoiceTypeEnum.BY_EXPENSES:
					itemToAdd['expenseId'] = id;
					break;
				default:
					break;
			}
			invoiceItems.push(itemToAdd);
		}
		try {
			return await this.invoiceItemService.createBulk(createdInvoice.id, invoiceItems);
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	async createInvoiceEstimateHistory() {
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		try {
			await this.invoiceEstimateHistoryService.add({
				action: this.isEstimate
					? this.getTranslation('INVOICES_PAGE.INVOICES_ADD_ESTIMATE')
					: this.getTranslation('INVOICES_PAGE.INVOICES_ADD_INVOICE'),
				invoice: this.createdInvoice,
				invoiceId: this.createdInvoice.id,
				user: this.store.user,
				userId: this.store.userId,
				organization: this.organization,
				organizationId,
				tenantId
			});
		} catch (error) {
			this.toastrService.danger(error);
		}
	}

	async addInvoice(status: string, sendTo?: string) {
		const tableSources = await this.smartTableSource.getAll();
		if (isEmpty(tableSources)) {
			this.toastrService.danger(
				this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.NO_ITEMS'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}

		const { invoiceNumber, invoiceDate, dueDate } = this.form.value;
		if (!invoiceDate || !dueDate || compareDate(invoiceDate, dueDate)) {
			this.toastrService.danger(
				this.getTranslation('INVOICES_PAGE.INVALID_DATES'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}

		const invoice = await this.invoicesService.getAll({
			invoiceNumber
		});

		if (invoice.items.length) {
			this.toastrService.danger(
				this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER_DUPLICATE'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}

		await this.createInvoiceEstimate(status, sendTo);
		await this.createInvoiceEstimateItems();
		await this.createInvoiceEstimateHistory();

		if (this.isEstimate) {
			this.toastrService.success(
				this.getTranslation('INVOICES_PAGE.INVOICES_ADD_ESTIMATE'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.router.navigate(['/pages/accounting/invoices/estimates'], {
				queryParams: {
					date: moment(invoiceDate).format('MM-DD-YYYY')
				}
			});
		} else {
			this.toastrService.success(
				this.getTranslation('INVOICES_PAGE.INVOICES_ADD_INVOICE'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.router.navigate(['/pages/accounting/invoices'], {
				queryParams: {
					date: moment(invoiceDate).format('MM-DD-YYYY')
				}
			});
		}
	}

	async sendToContact() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { organizationContact } = this.form.value;

		if (organizationContact.id) {
			await this.addInvoice(InvoiceStatusTypesEnum.SENT, organizationContact.id);
			try {
				await this.invoiceEstimateHistoryService.add({
					action: this.isEstimate
						? this.getTranslation('INVOICES_PAGE.ESTIMATE_SENT_TO', {
								name: organizationContact.name
						  })
						: this.getTranslation('INVOICES_PAGE.INVOICE_SENT_TO', {
								name: organizationContact.name
						  }),
					invoice: this.createdInvoice,
					invoiceId: this.createdInvoice.id,
					user: this.store.user,
					userId: this.store.userId,
					organization: this.organization,
					organizationId: this.organization.id,
					tenantId
				});
			} catch (error) {
				console.log(error, 'error');
			}
		} else {
			this.toastrService.danger(
				this.getTranslation('INVOICES_PAGE.SEND.NOT_LINKED'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
		}
	}

	async sendViaEmail() {
		const tableSources = await this.smartTableSource.getAll();
		if (isEmpty(tableSources)) {
			this.toastrService.danger(
				this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.NO_ITEMS'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}

		const { invoiceNumber, invoiceDate, dueDate } = this.form.value;
		if (!invoiceDate || !dueDate || compareDate(invoiceDate, dueDate)) {
			this.toastrService.danger(
				this.getTranslation('INVOICES_PAGE.INVALID_DATES'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}

		const invoiceExists = await this.invoicesService.getAll({
			invoiceNumber
		});
		if (invoiceExists.items.length) {
			this.toastrService.danger(
				this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER_DUPLICATE'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}

		const invoice = await this.createInvoiceEstimate(InvoiceStatusTypesEnum.SENT);
		const invoiceItems = await this.createInvoiceEstimateItems();

		await firstValueFrom(
			this.dialogService.open(InvoiceEmailMutationComponent, {
				context: {
					invoice: invoice,
					invoiceItems: invoiceItems,
					isEstimate: this.isEstimate
				}
			}).onClose
		);

		if (this.isEstimate) {
			this.toastrService.success(
				this.getTranslation('INVOICES_PAGE.INVOICES_ADD_ESTIMATE'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.router.navigate(['/pages/accounting/invoices/estimates'], {
				queryParams: {
					date: moment(invoiceDate).format('MM-DD-YYYY')
				}
			});
		} else {
			this.toastrService.success(
				this.getTranslation('INVOICES_PAGE.INVOICES_ADD_INVOICE'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
			this.router.navigate(['/pages/accounting/invoices'], {
				queryParams: {
					date: moment(invoiceDate).format('MM-DD-YYYY')
				}
			});
		}
	}

	private async _getInvoiceNumber() {
		const { tenantId } = this.store.user;
		const invoiceNumber = await this.invoicesService.getHighestInvoiceNumber(tenantId);
		if (invoiceNumber['max']) {
			this.formInvoiceNumber = +invoiceNumber['max'] + 1;
		} else {
			this.formInvoiceNumber = 1;
		}
	}

	private getAllTasks() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		this.tasksStore.fetchTasks(tenantId, organizationId).pipe(untilDestroyed(this)).subscribe();
	}

	private async _initializeMethods() {
		const { organization } = this;
		if (!organization) return;

		this._getInvoiceNumber();
	}

	/**
	 * Load employees from multiple selected employees
	 *
	 * @param employees
	 */
	public onLoadEmployees(employees: IEmployee[]) {
		this.employees = employees;
	}

	private getAllProjects() {
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		this.organizationProjectsService.getAll([], { organizationId, tenantId }).then(({ items }) => {
			this.projects = JSON.parse(JSON.stringify(items));
		});
	}

	private getAllProducts() {
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		this.productService
			.getAll(['translations'], { organizationId, tenantId }, this.selectedLanguage)
			.then(({ items }) => {
				this.products = items;
			});
	}

	private getAllExpenses() {
		const { id: organizationId } = this.organization;
		const { tenantId } = this.store.user;

		this.expensesService
			.getAll([], {
				typeOfExpense: ExpenseTypesEnum.BILLABLE_TO_CONTACT,
				organizationId,
				tenantId
			})
			.then(({ items }) => {
				this.expenses = items;
			});
	}

	onTypeChange($event) {
		this.invoiceType = $event;

		this.isEmployeeHourTable = false;
		this.isProjectHourTable = false;
		this.isTaskHourTable = false;
		this.isProductTable = false;
		this.isExpenseTable = false;

		switch ($event) {
			case InvoiceTypeEnum.BY_EMPLOYEE_HOURS:
				this.isEmployeeHourTable = true;
				this.updateEmployeeValidation();
				break;
			case InvoiceTypeEnum.BY_PROJECT_HOURS:
				this.isProjectHourTable = true;
				this.getAllProjects();
				break;
			case InvoiceTypeEnum.BY_TASK_HOURS:
				this.isTaskHourTable = true;
				this.getAllTasks();
				break;
			case InvoiceTypeEnum.BY_PRODUCTS:
				this.isProductTable = true;
				this.getAllProducts();
				break;
			case InvoiceTypeEnum.BY_EXPENSES:
				this.isExpenseTable = true;
				this.getAllExpenses();
				break;
			default:
				break;
		}
	}

	async generateTable(generateUninvoiced?: boolean) {
		if (!this.invoiceType || this.form.invalid || !this.selectedDateRange) return;
		this.selectedInvoiceType = this.invoiceType;
		this.smartTableSource.refresh();

		const fakeData = [];
		let fakePrice = 10;
		let fakeQuantity = 5;

		if (generateUninvoiced) {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			const expenses = await this.expensesService.getAll([], {
				typeOfExpense: ExpenseTypesEnum.BILLABLE_TO_CONTACT,
				status: ExpenseStatusesEnum.UNINVOICED,
				organizationId,
				tenantId
			});
			this.selectedExpenses = expenses.items;
		}

		switch (this.selectedInvoiceType) {
			case InvoiceTypeEnum.BY_EMPLOYEE_HOURS:
				if (isNotEmpty(this.selectedEmployeeIds)) {
					for (const employeeId of this.selectedEmployeeIds) {
						const employee = this.employees.find((employee) => employee.id === employeeId);
						const data = {
							description: 'Desc',
							price: fakePrice,
							quantity: fakeQuantity,
							selectedItem: employee,
							totalValue: fakePrice * fakeQuantity,
							applyTax: true,
							applyDiscount: true
						};
						fakeData.push(data);
						fakePrice++;
						fakeQuantity++;
					}
				}
				break;
			case InvoiceTypeEnum.BY_PROJECT_HOURS:
				if (isNotEmpty(this.selectedProjects)) {
					for (const project of this.selectedProjects) {
						const data = {
							description: 'Desc',
							price: fakePrice,
							quantity: fakeQuantity,
							selectedItem: project,
							totalValue: fakePrice * fakeQuantity,
							applyTax: true,
							applyDiscount: true
						};
						fakeData.push(data);
						fakePrice++;
						fakeQuantity++;
					}
				}
				break;
			case InvoiceTypeEnum.BY_TASK_HOURS:
				if (isNotEmpty(this.selectedTasks)) {
					for (const task of this.selectedTasks) {
						const data = {
							description: 'Desc',
							price: fakePrice,
							quantity: fakeQuantity,
							selectedItem: task,
							totalValue: fakePrice * fakeQuantity,
							applyTax: true,
							applyDiscount: true
						};
						fakeData.push(data);
						fakePrice++;
						fakeQuantity++;
					}
				}
				break;
			case InvoiceTypeEnum.BY_PRODUCTS:
				if (isNotEmpty(this.selectedProducts)) {
					for (const product of this.selectedProducts) {
						const data = {
							description: 'Desc',
							price: fakePrice,
							quantity: fakeQuantity,
							selectedItem: product,
							totalValue: fakePrice * fakeQuantity,
							applyTax: true,
							applyDiscount: true
						};
						fakeData.push(data);
						fakePrice++;
						fakeQuantity++;
					}
				}
				break;
			case InvoiceTypeEnum.BY_EXPENSES:
				if (isNotEmpty(this.selectedExpenses)) {
					for (const expense of this.selectedExpenses) {
						const data = {
							description: 'Desc',
							price: fakePrice,
							quantity: fakeQuantity,
							selectedItem: expense,
							totalValue: fakePrice * fakeQuantity,
							applyTax: true,
							applyDiscount: true
						};
						fakeData.push(data);
						fakePrice++;
						fakeQuantity++;
					}
				}
				break;
			default:
				break;
		}

		if (isNotEmpty(fakeData)) {
			let subtotal = 0;
			for (const data of fakeData) {
				let itemTotal = 0;
				itemTotal += +data.price * +data.quantity;
				subtotal += itemTotal;
			}
			this.subtotal = subtotal;
		} else {
			this.subtotal = 0;
		}

		this.shouldLoadTable = true;
		this.disableSaveButton = false;

		this.loadSmartTable();
		this.smartTableSource.load(JSON.parse(JSON.stringify(fakeData)));

		this.calculateTotal();
	}

	selectTask($event) {
		this.selectedTasks = $event;
	}

	selectOrganizationContact($event) {
		this.organizationContact = $event;
	}

	selectProject($event) {
		this.selectedProjects = $event;
	}

	selectProduct($event) {
		this.selectedProducts = $event;
	}

	selectExpense($event) {
		this.selectedExpenses = $event;
	}

	onMembersSelected(event) {
		this.selectedEmployeeIds = event;
	}

	async calculateTotal() {
		const discountValue =
			this.form.value.discountValue && this.form.value.discountValue > 0 ? this.form.value.discountValue : 0;
		const tax = this.form.value.tax && this.form.value.tax > 0 ? this.form.value.tax : 0;
		const tax2 = this.form.value.tax2 && this.form.value.tax2 > 0 ? this.form.value.tax2 : 0;

		let totalDiscount = 0;
		let totalTax = 0;

		const tableData = await this.smartTableSource.getAll();

		for (const item of tableData) {
			if (item.applyTax) {
				switch (this.form.value.taxType) {
					case DiscountTaxTypeEnum.PERCENT:
						totalTax += item.totalValue * (+tax / 100);
						break;
					case DiscountTaxTypeEnum.FLAT_VALUE:
						totalTax += +tax;
						break;
					default:
						totalTax = 0;
						break;
				}
				switch (this.form.value.tax2Type) {
					case DiscountTaxTypeEnum.PERCENT:
						totalTax += item.totalValue * (+tax2 / 100);
						break;
					case DiscountTaxTypeEnum.FLAT_VALUE:
						totalTax += +tax2;
						break;
					default:
						totalTax = 0;
						break;
				}
			}

			if (item.applyDiscount) {
				switch (this.form.value.discountType) {
					case DiscountTaxTypeEnum.PERCENT:
						if (!this.discountAfterTax) {
							totalDiscount += item.totalValue * (+discountValue / 100);
						}
						break;
					case DiscountTaxTypeEnum.FLAT_VALUE:
						totalDiscount += +discountValue;
						break;
					default:
						totalDiscount = 0;
						break;
				}
			}
		}

		if (this.discountAfterTax && this.form.value.discountType === DiscountTaxTypeEnum.PERCENT) {
			totalDiscount = (this.subtotal + totalTax) * (+discountValue / 100);
		}

		this.total = this.subtotal - totalDiscount + totalTax;

		if (this.total < 0) {
			this.total = 0;
		}
		this.setPagination({
			...this.getPagination(),
			totalItems: this.smartTableSource.count()
		});
		this.refreshPagination();
	}

	async applyDiscountAfterTax($event) {
		this.discountAfterTax = $event;
		this.calculateTotal();
	}

	async onCurrencyChange($event) {
		const tableData = await this.smartTableSource.getAll();
		this.smartTableSource.load(tableData);
	}

	async onCreateConfirm(event) {
		if (
			!isNaN(event.newData.quantity) &&
			!isNaN(extractNumber(event.newData.price)) &&
			event.newData.quantity &&
			event.newData.price &&
			event.newData.description &&
			(event.newData.selectedItem || this.selectedInvoiceType === InvoiceTypeEnum.DETAILED_ITEMS)
		) {
			const newData = { ...event.newData, price: extractNumber(event.newData.price) };
			const itemTotal = +event.newData.quantity * +extractNumber(event.newData.price);
			newData.totalValue = itemTotal;
			this.subtotal += itemTotal;
			await event.confirm.resolve(newData);
			await this.calculateTotal();
		} else {
			this.toastrService.danger(
				this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.INVALID_ITEM'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			event.confirm.reject();
		}
	}

	async onEditConfirm(event) {
		if (
			!isNaN(event.newData.quantity) &&
			!isNaN(extractNumber(event.newData.price)) &&
			event.newData.quantity &&
			event.newData.price &&
			event.newData.description &&
			(event.newData.selectedItem || this.selectedInvoiceType === InvoiceTypeEnum.DETAILED_ITEMS)
		) {
			const newData = { ...event.newData, price: extractNumber(event.newData.price) };
			const oldValue = +event.data.quantity * +event.data.price;
			const newValue = +newData.quantity * +extractNumber(event.newData.price);
			newData.totalValue = newValue;

			if (newValue > oldValue) {
				this.subtotal += newValue - oldValue;
			} else if (oldValue > newValue) {
				this.subtotal -= oldValue - newValue;
			}
			await event.confirm.resolve(newData);
			await this.calculateTotal();
		} else {
			this.toastrService.danger(
				this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.INVALID_ITEM'),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			event.confirm.reject();
		}
	}

	async onDeleteConfirm(event) {
		this.subtotal -= +event.data.quantity * +event.data.price;
		await event.confirm.resolve(event.data);
		await this.calculateTotal();
	}

	cancel() {
		if (this.isEstimate) {
			this.router.navigate(['/pages/accounting/invoices/estimates']);
		} else {
			this.router.navigate(['/pages/accounting/invoices']);
		}
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this.loadSmartTable()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	selectedTagsEvent(selectedTags: ITag[]) {
		this.form.get('tags').setValue(selectedTags);
		this.form.get('tags').updateValueAndValidity();
	}

	getNextMonth() {
		const date = new Date();
		const daysUntilDue = this.organization.daysUntilDue ? this.organization.daysUntilDue : null;
		if (daysUntilDue) {
			date.setDate(date.getDate() + this.organization.daysUntilDue);
		} else {
			date.setMonth(date.getMonth() + 1);
		}
		return date;
	}

	private updateEmployeeValidation() {
		const employeeControl = this.form.get('selectedEmployeeIds');
		if (this.isEmployeeHourTable) {
			employeeControl.setValidators([Validators.required]);
		} else {
			employeeControl.clearValidators();
		}

		employeeControl.updateValueAndValidity();
	}

	ngOnDestroy(): void {
		this._destroy$.next();
		this._destroy$.complete();
	}
}
