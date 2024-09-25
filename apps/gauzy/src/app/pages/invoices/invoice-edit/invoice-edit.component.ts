import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { UntypedFormGroup, UntypedFormBuilder, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { Cell, LocalDataSource } from 'angular2-smart-table';
import { Router, ActivatedRoute } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IInvoice,
	IOrganizationContact,
	IInvoiceItem,
	IOrganization,
	InvoiceTypeEnum,
	DiscountTaxTypeEnum,
	ITag,
	IInvoiceItemCreateInput,
	IEmployee,
	IOrganizationProject,
	ITask,
	IProduct,
	IExpense
} from '@gauzy/contracts';
import { compareDate, distinctUntilChange, extractNumber } from '@gauzy/ui-core/common';
import { Store, ToastrService } from '@gauzy/ui-core/core';
import * as moment from 'moment';
import { InvoiceEmailMutationComponent } from '../invoice-email/invoice-email-mutation.component';
import {
	InvoiceEstimateHistoryService,
	InvoiceItemService,
	InvoicesService,
	OrganizationSettingService,
	TranslatableService
} from '@gauzy/ui-core/core';
import {
	InvoiceApplyTaxDiscountComponent,
	InvoiceEmployeesSelectorComponent,
	InvoiceExpensesSelectorComponent,
	InvoiceProductsSelectorComponent,
	InvoiceProjectsSelectorComponent,
	InvoiceTasksSelectorComponent
} from '../table-components';
import { any } from 'underscore';
import { IPaginationBase, PaginationFilterBaseComponent } from '@gauzy/ui-core/shared';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoice-edit',
	templateUrl: './invoice-edit.component.html',
	styleUrls: ['./invoice-edit.component.scss']
})
export class InvoiceEditComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	shouldLoadTable = false;
	invoiceId: string;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	form: UntypedFormGroup;
	invoice: IInvoice;
	organization: IOrganization;
	itemsToDelete: string[] = [];
	invoiceItems: IInvoiceItem[] = [];
	selectedOrganizationContact: IOrganizationContact;
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
	selectedItem = {
		data: any,
		isSelected: false
	};

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
		private readonly store: Store,
		private readonly router: Router,
		private readonly fb: UntypedFormBuilder,
		private readonly invoiceItemService: InvoiceItemService,
		private readonly translate: TranslateService,
		private readonly invoicesService: InvoicesService,
		private readonly toastrService: ToastrService,
		private readonly route: ActivatedRoute,
		private readonly dialogService: NbDialogService,
		private readonly invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private readonly translatableService: TranslatableService,
		private readonly organizationSettingService: OrganizationSettingService
	) {
		super(translate);
	}

	ngOnInit() {
		this._applyTranslationOnSmartTable();
		this.initializeForm();
		this.route.paramMap
			.pipe(
				tap((params) => (this.invoiceId = params.get('id'))),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap.pipe(untilDestroyed(this)).subscribe((params) => {
			const paramsObj = params['params'];
			if (Object.keys(paramsObj).length) {
				this.isRemainingAmount = params.get('remainingAmount');
			}
		});
		this.invoicesService.currentData
			.pipe(
				tap((response) => (this.duplicate = response)),
				untilDestroyed(this)
			)
			.subscribe();
		this.selectedLanguage = this.translateService.currentLang;
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe((languageEvent) => {
			this.selectedLanguage = languageEvent.lang;
		});
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				distinctUntilChange(),
				tap(() => (this.loading = true)),
				tap((organization) => (this.organization = organization)),
				tap(() => this.getInvoiceById()),
				untilDestroyed(this)
			)
			.subscribe();
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

	getInvoiceById() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

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
				{ tenantId, organizationId }
			)
			.then(async (invoice: IInvoice) => {
				this.invoice = invoice;
				this.invoiceItems = invoice.invoiceItems;
				this.selectedOrganizationContact = invoice.toContact;
				this.discountAfterTax = invoice.fromOrganization.discountAfterTax;

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
			invoiceDate: [this.organizationSettingService.getDateFromOrganizationSettings(), Validators.required],
			invoiceNumber: ['', Validators.compose([Validators.required, Validators.min(1)])],
			dueDate: ['', Validators.required],
			discountValue: ['', Validators.compose([Validators.required, Validators.min(0)])],
			tax: ['', Validators.compose([Validators.required, Validators.min(0)])],
			tax2: ['', Validators.compose([Validators.required, Validators.min(0)])],
			terms: [],
			organizationContact: ['', Validators.required],
			currency: ['', Validators.required],
			discountType: [],
			taxType: [],
			tax2Type: [],
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
	}

	async loadSmartTable() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			selectedRowIndex: -1,
			mode: 'external',
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

		switch (this.invoice.invoiceType) {
			case InvoiceTypeEnum.BY_EMPLOYEE_HOURS:
				this.settingsSmartTable['columns']['selectedItem'] = {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.EMPLOYEE'),
					width: '13%',
					editor: {
						type: 'custom',
						component: InvoiceEmployeesSelectorComponent
					},
					valuePrepareFunction: (employee: IEmployee) => {
						return employee?.user?.name || '';
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
					valuePrepareFunction: (project: IOrganizationProject) => {
						return project?.name || '';
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
					valuePrepareFunction: (task: ITask) => {
						return task?.title || '';
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
					valuePrepareFunction: (product: IProduct) => {
						return product?.name
							? `${this.translatableService.getTranslatedProperty(product, 'name')}`
							: '';
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
					valuePrepareFunction: (expense: IExpense) => {
						return expense?.purpose || '';
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
				title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.HOURLY_RATE'),
				type: 'text',
				isFilterable: false,
				width: '13%',
				valuePrepareFunction: (value: IInvoiceItem['price']) => {
					return `${this.currency.value} ${value}`;
				}
			};
			quantity = {
				title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.HOURS_WORKED'),
				type: 'text',
				isFilterable: false,
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
				isFilterable: false,
				width: '13%',
				valuePrepareFunction: (cell, row) => {
					return `${this.currency.value} ${cell}`;
				}
			};
			quantity = {
				title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.QUANTITY'),
				type: 'text',
				isFilterable: false,
				width: '13%'
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
			valuePrepareFunction: (value: IInvoiceItem['totalValue'], cell: Cell) => {
				const row = cell.getRow().getData();
				return `${this.currency.value} ${row.quantity * row.price}`;
			},
			isFilterable: false,
			width: '13%'
		};
		if (this.organization && this.organization.separateInvoiceItemTaxAndDiscount) {
			this.settingsSmartTable['columns']['applyTax'] = {
				title: this.getTranslation('INVOICES_PAGE.APPLY_TAX'),
				editor: {
					type: 'custom',
					component: InvoiceApplyTaxDiscountComponent
				},
				isFilterable: false,
				width: '10%',
				valuePrepareFunction: (isApplied: any) => {
					return isApplied
						? this.getTranslation('INVOICES_PAGE.APPLIED')
						: this.getTranslation('INVOICES_PAGE.NOT_APPLIED');
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
				valuePrepareFunction: (isApplied: any) => {
					return isApplied
						? this.getTranslation('INVOICES_PAGE.APPLIED')
						: this.getTranslation('INVOICES_PAGE.NOT_APPLIED');
				}
			};
		}
	}

	/**
	 *
	 * @param event
	 */
	onEditRowSelect({ row }) {
		row.isInEditing = true;
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
			const invoice = await this.invoicesService.getAll({
				invoiceNumber: invoiceData.invoiceNumber,
				organizationId,
				tenantId
			});

			if (invoice.items.length && +invoice.items[0].invoiceNumber !== +this.invoice.invoiceNumber) {
				this.toastrService.danger('INVOICES_PAGE.INVOICE_NUMBER_DUPLICATE');
				return;
			}

			const { invoiceDate } = this.form.getRawValue();
			await this.invoicesService.update(this.invoice.id, {
				invoiceNumber: invoiceData.invoiceNumber,
				invoiceDate: moment(invoiceData.invoiceDate).startOf('day').toDate(),
				dueDate: moment(invoiceData.dueDate).endOf('day').toDate(),
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
				tags: invoiceData.tags,
				status: status,
				sentTo: sendTo,
				hasRemainingAmountInvoiced:
					this.isRemainingAmount || this.invoice.hasRemainingAmountInvoiced ? true : false,
				alreadyPaid: this.invoice.alreadyPaid,
				amountDue: this.invoice.amountDue
			});

			const invoiceItems: IInvoiceItemCreateInput[] = [];
			for (const invoiceItem of tableData) {
				const id = invoiceItem.selectedItem ? invoiceItem.selectedItem.id : null;
				const itemToAdd = {
					description: invoiceItem.description,
					price: Number(invoiceItem.price),
					quantity: Number(invoiceItem.quantity),
					totalValue: invoiceItem.totalValue,
					invoiceId: this.invoice.id,
					applyTax: invoiceItem.applyTax,
					applyDiscount: invoiceItem.applyDiscount,
					organizationId,
					tenantId
				};
				switch (this.invoice.invoiceType) {
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

			await this.invoiceItemService.createBulk(this.invoice.id, invoiceItems);

			await this.invoiceEstimateHistoryService.add({
				action: this.isEstimate
					? this.getTranslation('INVOICES_PAGE.INVOICES_EDIT_ESTIMATE')
					: this.getTranslation('INVOICES_PAGE.INVOICES_EDIT_INVOICE'),
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
					action: this.getTranslation('INVOICES_PAGE.INVOICED_REMAINING_AMOUNT'),
					invoice: this.invoice,
					invoiceId: this.invoice.id,
					user: this.store.user,
					userId: this.store.userId,
					organization: this.invoice.fromOrganization,
					organizationId: this.invoice.fromOrganization.id
				});
			}

			if (this.isEstimate) {
				this.toastrService.success('INVOICES_PAGE.INVOICES_EDIT_ESTIMATE');
				this.router.navigate(['/pages/accounting/invoices/estimates'], {
					queryParams: {
						date: moment(invoiceDate).format('MM-DD-YYYY')
					}
				});
			} else {
				this.toastrService.success('INVOICES_PAGE.INVOICES_EDIT_INVOICE');
				this.router.navigate(['/pages/accounting/invoices'], {
					queryParams: {
						date: moment(invoiceDate).format('MM-DD-YYYY')
					}
				});
			}
		} else {
			this.toastrService.warning('INVOICES_PAGE.INVOICE_ITEM.NO_ITEMS');
		}
	}

	async sendToContact() {
		if (this.form.value.organizationContact.id) {
			await this.updateInvoice('SENT', this.form.value.organizationContact.id);
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
			const invoiceExists = await this.invoicesService.getAll({
				invoiceNumber: invoiceData.invoiceNumber,
				organizationId,
				tenantId
			});

			if (invoiceExists.items.length && +invoiceExists.items[0].invoiceNumber !== +this.invoice.invoiceNumber) {
				this.toastrService.danger('INVOICES_PAGE.INVOICE_NUMBER_DUPLICATE');
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
				tags: invoiceData.tags,
				isEstimate: this.isEstimate,
				alreadyPaid: this.invoice.alreadyPaid,
				amountDue: this.invoice.amountDue,
				hasRemainingAmountInvoiced:
					this.isRemainingAmount || this.invoice.hasRemainingAmountInvoiced ? true : false,
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

			const result = await firstValueFrom(
				this.dialogService.open(InvoiceEmailMutationComponent, {
					context: {
						invoice: invoice,
						isEstimate: this.isEstimate
					}
				}).onClose
			);

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
			this.form.value.discountValue && this.form.value.discountValue > 0 ? this.form.value.discountValue : 0;
		const tax = this.form.value.tax && this.form.value.tax > 0 ? this.form.value.tax : 0;
		const tax2 = this.form.value.tax2 && this.form.value.tax2 > 0 ? this.form.value.tax2 : 0;

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

		this.alreadyPaid = +this.invoice.alreadyPaid;
		this.amountDue = +this.total - +this.alreadyPaid;
		this.setPagination({
			...this.getPagination(),
			totalItems: this.smartTableSource.count()
		});
		this.refreshPagination();
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
			!isNaN(extractNumber(event.newData.price)) &&
			event.newData.quantity &&
			event.newData.price &&
			event.newData.description &&
			(event.newData.selectedItem || this.invoice.invoiceType === InvoiceTypeEnum.DETAILED_ITEMS)
		) {
			const newData = { ...event.newData, price: extractNumber(event.newData.price) };
			const itemTotal = +event.newData.quantity * +extractNumber(event.newData.price);
			newData.totalValue = itemTotal;
			this.subtotal += itemTotal;
			await event.confirm.resolve(newData);
			await this.calculateTotal();
		} else {
			this.toastrService.danger('INVOICES_PAGE.INVOICE_ITEM.INVALID_ITEM');
			event.confirm.reject();
		}
	}

	/**
	 *
	 * @param event
	 */
	async onEditConfirm(event) {
		if (
			!isNaN(event.newData.quantity) &&
			!isNaN(extractNumber(event.newData.price)) &&
			event.newData.quantity &&
			event.newData.price &&
			event.newData.description &&
			(event.newData.selectedItem || this.invoice.invoiceType === InvoiceTypeEnum.DETAILED_ITEMS)
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
			this.toastrService.danger('INVOICES_PAGE.INVOICE_ITEM.INVALID_ITEM');
			event.confirm.reject();
		}
	}

	async onDeleteConfirm(event) {
		if (event.data.id) {
			this.itemsToDelete.push(event.data.id);
		}
		this.subtotal -= +event.data.quantity * +event.data.price;
		//await event.confirm.resolve(event.data);
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
		if (this.invoice) {
			this.router.navigate([`/pages/accounting/invoices/payments/${this.invoice.id}`]);
		}
	}

	selectedTagsEvent(selectedTags: ITag[]) {
		this.form.get('tags').setValue(selectedTags);
		this.form.get('tags').updateValueAndValidity();
	}

	selectItem(item: any) {
		this.selectedItem = item;
	}

	ngOnDestroy() {}
}
