import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Store } from '../../../@core/services/store.service';
import { TranslateService } from '@ngx-translate/core';
import {
	IInvoice,
	IOrganizationContact,
	IInvoiceItem,
	IOrganization,
	IEmployee,
	InvoiceTypeEnum,
	DiscountTaxTypeEnum,
	ITag,
	ITask,
	IOrganizationProject,
	IExpense,
	IInvoiceItemCreateInput,
	IProductTranslatable
} from '@gauzy/contracts';
import { filter, first, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { LocalDataSource } from 'ng2-smart-table';
import { Router, ActivatedRoute } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { compareDate } from '@gauzy/common-angular';
import { InvoiceEmailMutationComponent } from '../invoice-email/invoice-email-mutation.component';
import { 
	InvoiceEstimateHistoryService,
	InvoiceItemService,
	InvoicesService,
	ToastrService,
	TranslatableService 
} from '../../../@core/services';
import { InvoiceApplyTaxDiscountComponent, InvoiceEmployeesSelectorComponent, InvoiceExpensesSelectorComponent, InvoiceProductsSelectorComponent, InvoiceProjectsSelectorComponent, InvoiceTasksSelectorComponent } from '../table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoice-edit',
	templateUrl: './invoice-edit.component.html',
	styleUrls: ['./invoice-edit.component.scss']
})
export class InvoiceEditComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	invoiceLoaded = false;
	loadedNumber: boolean;
	shouldLoadTable = false;
	invoiceId: string;
	settingsSmartTable: object;
	formItemNumber: number;
	smartTableSource = new LocalDataSource();
	form: FormGroup;
	invoice: IInvoice;
	organization: IOrganization;
	itemsToDelete: string[] = [];
	invoiceItems: IInvoiceItem[];
	selectedOrganizationContact: IOrganizationContact;
	employees: IEmployee[];
	projects: IOrganizationProject[];
	products: IProductTranslatable[];
	invoiceDate: Date;
	dueDate: Date;
	tags: ITag[] = [];
	tasks: ITask[];
	expenses: IExpense[] = [];
	observableTasks: Observable<ITask[]>;
	duplicate: boolean;
	discountAfterTax: boolean;
	subtotal = 0;
	total = 0;
	loading: boolean;
	selectedLanguage: string;
	discountTaxTypes = Object.values(DiscountTaxTypeEnum);
	isRemainingAmount: string;
	alreadyPaid: number;
	amountDue: number;

	get currency() {
		return this.form.get('currency');
	}

	private _isEstimate: boolean = false;
	@Input() set isEstimate(val: boolean) {
		this._isEstimate = val;
	}
	get isEstimate() {
		return this._isEstimate;
	}

	constructor(
		private store: Store,
		private router: Router,
		private fb: FormBuilder,
		private invoiceItemService: InvoiceItemService,
		private translate: TranslateService,
		private invoicesService: InvoicesService,
		private toastrService: ToastrService,
		private route: ActivatedRoute,
		private dialogService: NbDialogService,
		private invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private translatableService: TranslatableService
	) {
		super(translate);
	}

	ngOnInit() {
		this._applyTranslationOnSmartTable();
		this.initializeForm();
		this.route.paramMap.pipe(untilDestroyed(this)).subscribe((params) => {
			this.invoiceId = params.get('id');
		});
		this.route.queryParamMap
			.pipe(untilDestroyed(this))
			.subscribe((params) => {
				const paramsObj = params['params'];
				if (Object.keys(paramsObj).length) {
					this.isRemainingAmount = params.get('remainingAmount');
				}
			});
		this.invoicesService.currentData
			.pipe(untilDestroyed(this))
			.subscribe((response) => {
				this.duplicate = response;
			});
		this.selectedLanguage = this.translateService.currentLang;
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe((languageEvent) => {
				this.selectedLanguage = languageEvent.lang;
			});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap(() => (this.loading = true)),
				tap((organization) => (this.organization = organization)),
				tap(() => this.getInvoiceById()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	getInvoiceById() {
		this.loading = true;
		const { tenantId } = this.store.user;
		this.invoicesService
			.getById(
				this.invoiceId,
				[
					'invoiceItems',
					'invoiceItems.employee',
					'invoiceItems.employee.user',
					'invoiceItems.project',
					'invoiceItems.product',
					'invoiceItems.expense',
					'invoiceItems.task',
					'tags',
					'toContact',
					'fromOrganization'
				],
				{ tenantId }
			)
			.then(async (invoice: IInvoice) => {
				this.invoice = invoice;
				this.invoiceItems = invoice.invoiceItems;
				this.selectedOrganizationContact = invoice.toContact;
				this.discountAfterTax =
					invoice.fromOrganization.discountAfterTax;

				await this._loadOrganizationData();
				this.updateValueAndValidity(invoice);
			})
			.finally(() => {
				this.loading = false;
			});
	}

	initializeForm() {
		this.form = this.fb.group({
			id: ['', Validators.required],
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
			tax2: [
				'',
				Validators.compose([Validators.required, Validators.min(0)])
			],
			terms: [''],
			organizationContact: ['', Validators.required],
			currency: ['', Validators.required],
			discountType: [''],
			taxType: [''],
			tax2Type: [''],
			tags: []
		});
	}

	updateValueAndValidity(invoice: IInvoice) {
		this.form.setValue({
			id: invoice.id,
			invoiceNumber: invoice.invoiceNumber,
			invoiceDate: new Date(invoice.invoiceDate),
			dueDate: new Date(invoice.dueDate),
			discountValue: invoice.discountValue,
			tax: invoice.tax,
			tax2: invoice.tax2,
			terms: invoice.terms,
			organizationContact: invoice.toContact,
			currency: invoice.currency,
			discountType: invoice.discountType,
			taxType: invoice.taxType,
			tax2Type: invoice.tax2Type,
			tags: invoice.tags
		});
		this.form.updateValueAndValidity();

		this.invoiceLoaded = true;
		this.tags = invoice.tags;
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			pager: {
				display: true,
				perPage: 5
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

		switch (this.invoice.invoiceType) {
			case InvoiceTypeEnum.BY_EMPLOYEE_HOURS:
				this.settingsSmartTable['columns']['selectedItem'] = {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.EMPLOYEE'
					),
					width: '13%',
					editor: {
						type: 'custom',
						component: InvoiceEmployeesSelectorComponent
					},
					valuePrepareFunction: (cell) => {
						const employee = cell;
						if (employee) {
							return `${cell.user.name}`;
						}
					}
				};
				break;
			case InvoiceTypeEnum.BY_PROJECT_HOURS:
				this.settingsSmartTable['columns']['selectedItem'] = {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.PROJECT'
					),
					width: '13%',
					editor: {
						type: 'custom',
						component: InvoiceProjectsSelectorComponent
					},
					valuePrepareFunction: (cell, row) => {
						const project = cell;
						if (project) {
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
					width: '13%',
					editor: {
						type: 'custom',
						component: InvoiceTasksSelectorComponent
					},
					valuePrepareFunction: (cell) => {
						const task = cell;
						if (task) {
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
					width: '13%',
					editor: {
						type: 'custom',
						component: InvoiceProductsSelectorComponent
					},
					valuePrepareFunction: (cell) => {
						const product = cell;
						if (product) {
							return `${this.translatableService.getTranslatedProperty(
								product,
								'name'
							)}`;
						}
					}
				};
				break;
			case InvoiceTypeEnum.BY_EXPENSES:
				this.settingsSmartTable['columns']['selectedItem'] = {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.EXPENSE'
					),
					width: '13%',
					editor: {
						type: 'custom',
						component: InvoiceExpensesSelectorComponent
					},
					valuePrepareFunction: (cell) => {
						const expense = cell;
						if (expense) {
							return `${expense.purpose}`;
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
				width: '13%',
				valuePrepareFunction: (cell, row) => {
					return `${this.currency.value} ${cell}`;
				}
			};
			quantity = {
				title: this.getTranslation(
					'INVOICES_PAGE.INVOICE_ITEM.HOURS_WORKED'
				),
				type: 'text',
				filter: false,
				width: '13%'
			};
		} else if (
			this.invoice.invoiceType === InvoiceTypeEnum.DETAILED_ITEMS ||
			this.invoice.invoiceType === InvoiceTypeEnum.BY_PRODUCTS ||
			this.invoice.invoiceType === InvoiceTypeEnum.BY_EXPENSES
		) {
			price = {
				title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.PRICE'),
				type: 'text',
				filter: false,
				width: '13%',
				valuePrepareFunction: (cell, row) => {
					return `${this.currency.value} ${cell}`;
				}
			};
			quantity = {
				title: this.getTranslation(
					'INVOICES_PAGE.INVOICE_ITEM.QUANTITY'
				),
				type: 'text',
				filter: false,
				width: '13%'
			};
		}
		this.settingsSmartTable['columns']['description'] = {
			title: this.getTranslation(
				'INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION'
			),
			type: 'text',
			width: '13%'
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
			filter: false,
			width: '13%'
		};
		if (
			this.organization &&
			this.organization.separateInvoiceItemTaxAndDiscount
		) {
			this.settingsSmartTable['columns']['applyTax'] = {
				title: this.getTranslation('INVOICES_PAGE.APPLY_TAX'),
				editor: {
					type: 'custom',
					component: InvoiceApplyTaxDiscountComponent
				},
				filter: false,
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
				filter: false,
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

	private async _loadOrganizationData() {
		if (!this.organization) {
			return;
		}
		this.loadSmartTable();
		await this.loadInvoiceItemData();
		await this.calculateTotal();
	}

	async updateInvoice(status: string, sendTo?: string) {
		const tableData = await this.smartTableSource.getAll();
		if (tableData.length) {
			const invoiceData = this.form.value;
			if (
				!invoiceData.invoiceDate ||
				!invoiceData.dueDate ||
				compareDate(invoiceData.invoiceDate, invoiceData.dueDate)
			) {
				this.toastrService.danger('INVOICES_PAGE.INVALID_DATES');
				return;
			}
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			const invoice = await this.invoicesService.getAll([], {
				invoiceNumber: invoiceData.invoiceNumber,
				organizationId,
				tenantId
			});

			if (
				invoice.items.length &&
				+invoice.items[0].invoiceNumber !== +this.invoice.invoiceNumber
			) {
				this.toastrService.danger(
					'INVOICES_PAGE.INVOICE_NUMBER_DUPLICATE'
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
				tax2: invoiceData.tax2,
				taxType: invoiceData.taxType,
				tax2Type: invoiceData.tax2Type,
				terms: invoiceData.terms,
				totalValue: +this.total.toFixed(2),
				invoiceType: this.invoice.invoiceType,
				organizationContactId: invoiceData.organizationContact.id,
				toContact: invoiceData.organizationContact,
				organizationId,
				tenantId,
				tags: this.tags,
				status: status,
				sentTo: sendTo,
				hasRemainingAmountInvoiced:
					this.isRemainingAmount ||
					this.invoice.hasRemainingAmountInvoiced
						? true
						: false,
				alreadyPaid: this.invoice.alreadyPaid,
				amountDue: this.invoice.amountDue
			});

			const invoiceItems: IInvoiceItemCreateInput[] = [];

			for (const invoiceItem of tableData) {
				const itemToAdd = {
					description: invoiceItem.description,
					price: invoiceItem.price,
					quantity: invoiceItem.quantity,
					totalValue: invoiceItem.totalValue,
					invoiceId: this.invoice.id,
					applyTax: invoiceItem.applyTax,
					applyDiscount: invoiceItem.applyDiscount,
					organizationId,
					tenantId
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
					case InvoiceTypeEnum.BY_EXPENSES:
						itemToAdd['expenseId'] = invoiceItem.selectedItem;
						break;
					default:
						break;
				}

				invoiceItems.push(itemToAdd);
			}

			await this.invoiceItemService.createBulk(
				this.invoice.id,
				invoiceItems
			);

			await this.invoiceEstimateHistoryService.add({
				action: this.isEstimate
					? this.getTranslation(
							'INVOICES_PAGE.INVOICES_EDIT_ESTIMATE'
					  )
					: this.getTranslation(
							'INVOICES_PAGE.INVOICES_EDIT_INVOICE'
					  ),
				invoice: this.invoice,
				invoiceId: this.invoice.id,
				user: this.store.user,
				userId: this.store.userId,
				organization: this.organization,
				organizationId,
				tenantId
			});

			if (this.isRemainingAmount) {
				await this.invoiceEstimateHistoryService.add({
					action: this.getTranslation(
						'INVOICES_PAGE.INVOICED_REMAINING_AMOUNT'
					),
					invoice: this.invoice,
					invoiceId: this.invoice.id,
					user: this.store.user,
					userId: this.store.userId,
					organization: this.invoice.fromOrganization,
					organizationId: this.invoice.fromOrganization.id
				});
			}

			if (this.isEstimate) {
				this.toastrService.success(
					'INVOICES_PAGE.INVOICES_EDIT_ESTIMATE'
				);
				this.router.navigate(['/pages/accounting/invoices/estimates']);
			} else {
				this.toastrService.success(
					'INVOICES_PAGE.INVOICES_EDIT_INVOICE'
				);
				this.router.navigate(['/pages/accounting/invoices']);
			}
		} else {
			this.toastrService.warning('INVOICES_PAGE.INVOICE_ITEM.NO_ITEMS');
		}
	}

	async sendToContact() {
		if (this.form.value.organizationContact.id) {
			await this.updateInvoice(
				'SENT',
				this.form.value.organizationContact.id
			);
			await this.invoiceEstimateHistoryService.add({
				action: this.isEstimate
					? this.getTranslation('INVOICES_PAGE.ESTIMATE_SENT_TO', {
							name: this.form.value.organizationContact.name
					  })
					: this.getTranslation('INVOICES_PAGE.INVOICE_SENT_TO', {
							name: this.form.value.organizationContact.name
					  }),
				invoice: this.invoice,
				invoiceId: this.invoice.id,
				user: this.store.user,
				userId: this.store.userId,
				organization: this.organization,
				organizationId: this.organization.id,
				tenantId: this.organization.tenantId
			});
		} else {
			this.toastrService.warning('INVOICES_PAGE.SEND.NOT_LINKED');
		}
	}

	async sendViaEmail() {
		const tableData = await this.smartTableSource.getAll();
		if (tableData.length) {
			const invoiceData = this.form.value;
			if (
				!invoiceData.invoiceDate ||
				!invoiceData.dueDate ||
				compareDate(invoiceData.invoiceDate, invoiceData.dueDate)
			) {
				this.toastrService.danger('INVOICES_PAGE.INVALID_DATES');
				return;
			}
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			const invoiceExists = await this.invoicesService.getAll([], {
				invoiceNumber: invoiceData.invoiceNumber,
				organizationId,
				tenantId
			});

			if (
				invoiceExists.items.length &&
				+invoiceExists.items[0].invoiceNumber !==
					+this.invoice.invoiceNumber
			) {
				this.toastrService.danger(
					'INVOICES_PAGE.INVOICE_NUMBER_DUPLICATE'
				);
				return;
			}

			const invoice = {
				id: invoiceData.id,
				invoiceNumber: invoiceData.invoiceNumber,
				invoiceDate: invoiceData.invoiceDate,
				dueDate: invoiceData.dueDate,
				currency: this.currency.value,
				discountValue: invoiceData.discountValue,
				discountType: invoiceData.discountType,
				tax: invoiceData.tax,
				tax2: invoiceData.tax2,
				taxType: invoiceData.taxType,
				tax2Type: invoiceData.tax2Type,
				terms: invoiceData.terms,
				paid: false,
				totalValue: +this.total.toFixed(2),
				toContact: invoiceData.organizationContact,
				organizationContactId: invoiceData.organizationContact.id,
				fromOrganization: this.organization,
				organizationId,
				tenantId,
				invoiceType: this.invoice.invoiceType,
				tags: this.tags,
				isEstimate: this.isEstimate,
				alreadyPaid: this.invoice.alreadyPaid,
				amountDue: this.invoice.amountDue,
				hasRemainingAmountInvoiced:
					this.isRemainingAmount ||
					this.invoice.hasRemainingAmountInvoiced
						? true
						: false,
				invoiceItems: []
			};

			const invoiceItems = [];

			for (const invoiceItem of tableData) {
				const itemToAdd = {
					description: invoiceItem.description,
					price: invoiceItem.price,
					quantity: invoiceItem.quantity,
					totalValue: invoiceItem.totalValue,
					applyTax: invoiceItem.applyTax,
					applyDiscount: invoiceItem.applyDiscount,
					organizationId,
					tenantId
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
					case InvoiceTypeEnum.BY_EXPENSES:
						itemToAdd['expenseId'] = invoiceItem.selectedItem;
						break;
					default:
						break;
				}
				invoiceItems.push(itemToAdd);
			}

			invoice.invoiceItems = invoiceItems;

			const result = await this.dialogService
				.open(InvoiceEmailMutationComponent, {
					context: {
						invoice: invoice,
						isEstimate: this.isEstimate
					}
				})
				.onClose.pipe(first())
				.toPromise();

			if (result) {
				await this.updateInvoice('SENT');
			}
		} else {
			this.toastrService.danger('INVOICES_PAGE.INVOICE_ITEM.NO_ITEMS');
		}
	}

	async loadInvoiceItemData() {
		const items = [];
		let data;
		let subtotal = 0;
		for (const item of this.invoiceItems) {
			data = {
				description: item.description,
				quantity: item.quantity,
				price: item.price,
				totalValue: +item.totalValue,
				id: item.id,
				applyTax: item.applyTax,
				applyDiscount: item.applyDiscount
			};

			switch (this.invoice.invoiceType) {
				case InvoiceTypeEnum.BY_EMPLOYEE_HOURS:
					data['selectedItem'] = item.employee;
					break;
				case InvoiceTypeEnum.BY_PROJECT_HOURS:
					data['selectedItem'] = item.project;
					break;
				case InvoiceTypeEnum.BY_TASK_HOURS:
					data['selectedItem'] = item.task;
					break;
				case InvoiceTypeEnum.BY_PRODUCTS:
					data['selectedItem'] = item.product;
					break;
				case InvoiceTypeEnum.BY_EXPENSES:
					data['selectedItem'] = item.expense;
					break;
				default:
					break;
			}
			subtotal += +item.totalValue;
			items.push(data);
		}

		this.subtotal = subtotal;
		this.smartTableSource.load(items);
		this.shouldLoadTable = true;
	}

	async calculateTotal() {
		const tableData = await this.smartTableSource.getAll();

		const discountValue =
			this.form.value.discountValue && this.form.value.discountValue > 0
				? this.form.value.discountValue
				: 0;
		const tax =
			this.form.value.tax && this.form.value.tax > 0
				? this.form.value.tax
				: 0;
		const tax2 =
			this.form.value.tax2 && this.form.value.tax2 > 0
				? this.form.value.tax2
				: 0;

		let totalDiscount = 0;
		let totalTax = 0;

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
							totalDiscount +=
								item.totalValue * (+discountValue / 100);
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

		if (
			this.discountAfterTax &&
			this.form.value.discountType === DiscountTaxTypeEnum.PERCENT
		) {
			totalDiscount = (this.subtotal + totalTax) * (+discountValue / 100);
		}

		this.total = this.subtotal - totalDiscount + totalTax;

		if (this.total < 0) {
			this.total = 0;
		}

		this.alreadyPaid = +this.invoice.alreadyPaid;
		this.amountDue = +this.total - +this.alreadyPaid;
	}

	async onCurrencyChange($event) {
		const tableData = await this.smartTableSource.getAll();
		this.smartTableSource.load(tableData);
	}

	selectOrganizationContact($event) {
		this.selectedOrganizationContact = $event;
	}

	_applyTranslationOnSmartTable() {
		this.translate.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this.loadSmartTable();
		});
	}

	async onCreateConfirm(event) {
		if (
			!isNaN(event.newData.quantity) &&
			!isNaN(event.newData.price) &&
			event.newData.quantity &&
			event.newData.price &&
			event.newData.description &&
			(event.newData.selectedItem ||
				this.invoice.invoiceType === InvoiceTypeEnum.DETAILED_ITEMS)
		) {
			const newData = event.newData;
			const itemTotal = +event.newData.quantity * +event.newData.price;
			newData.totalValue = itemTotal;
			this.subtotal += itemTotal;
			await event.confirm.resolve(newData);
			await this.calculateTotal();
		} else {
			this.toastrService.danger(
				'INVOICES_PAGE.INVOICE_ITEM.INVALID_ITEM'
			);
			event.confirm.reject();
		}
	}

	async onEditConfirm(event) {
		if (
			!isNaN(event.newData.quantity) &&
			!isNaN(event.newData.price) &&
			event.newData.quantity &&
			event.newData.price &&
			event.newData.description &&
			(event.newData.selectedItem ||
				this.invoice.invoiceType === InvoiceTypeEnum.DETAILED_ITEMS)
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
			await event.confirm.resolve(newData);
			await this.calculateTotal();
		} else {
			this.toastrService.danger(
				'INVOICES_PAGE.INVOICE_ITEM.INVALID_ITEM'
			);
			event.confirm.reject();
		}
	}

	async onDeleteConfirm(event) {
		if (event.data.id) {
			this.itemsToDelete.push(event.data.id);
		}
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

	async applyDiscountAfterTax($event) {
		this.discountAfterTax = $event;
		this.calculateTotal();
	}

	payments() {
		this.router.navigate([
			`/pages/accounting/invoices/payments/${this.invoice.id}`
		]);
	}

	selectedTagsEvent(currentTagSelection: ITag[]) {
		this.tags = currentTagSelection;
	}

	ngOnDestroy() {}
}
