import { Component, OnInit, OnDestroy, Input, TemplateRef, ViewChild } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { DiscountTaxTypeEnum, IInvoice, InvoiceTypeEnum } from '@gauzy/contracts';
import { tap } from 'rxjs/operators';
import { LocalDataSource, Angular2SmartTableComponent } from 'angular2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { Store } from '@gauzy/ui-sdk/common';
import { TranslatableService, UsersOrganizationsService } from '@gauzy/ui-sdk/core';
import { CurrencyPositionPipe } from './../../../../@shared/pipes';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoice-view-inner',
	templateUrl: './invoice-view-inner.component.html',
	styleUrls: ['./invoice-view-inner.component.scss']
})
export class InvoiceViewInnerComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	invoiceDate: string;
	dueDate: string;
	settingsSmartTable: object;
	isTableLoaded = false;
	smartTableSource = new LocalDataSource();
	loading: boolean;
	showInternalNote: boolean;
	isTaxFlatValue: boolean;
	isTax2FlatValue: boolean;
	isDiscountFlatValue: boolean;
	discountTaxTypes = DiscountTaxTypeEnum;

	invoiceViewInnerTable: Angular2SmartTableComponent;
	@ViewChild('invoiceViewInnerTable') set content(content: Angular2SmartTableComponent) {
		if (content) {
			this.invoiceViewInnerTable = content;
			this._onChangedSource();
		}
	}

	@Input() invoice: IInvoice;
	@Input() isEstimate: boolean;
	@Input() buttonsOutlet: TemplateRef<any>;

	constructor(
		readonly translateService: TranslateService,
		private readonly store: Store,
		private readonly userOrganizationService: UsersOrganizationsService,
		private readonly translatableService: TranslatableService,
		private readonly currencyPipe: CurrencyPipe,
		private readonly currencyPipePosition: CurrencyPositionPipe
	) {
		super(translateService);
	}

	ngOnInit() {
		this.checkUser();
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.invoiceDate = this.invoice.invoiceDate.toString().slice(0, 10);
		this.dueDate = this.invoice.dueDate.toString().slice(0, 10);
		this.loadTableData();
		this._deselectAll();
	}

	loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			hideSubHeader: true,
			pager: {
				display: false
			},
			columns: {
				name: {
					title: this.getTranslation('INVOICES_PAGE.ITEM'),
					type: 'text',
					filter: false
				},
				description: {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION'),
					type: 'text',
					filter: false
				},
				quantity: {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.QUANTITY'),
					type: 'text',
					filter: false
				},
				price: {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.PRICE'),
					type: 'text',
					filter: false,
					valuePrepareFunction: (cell, row) => {
						const priceTransformed = this.getPipesTransform(
							row.price * row.quantity,
							row.currency,
							this.invoice.fromOrganization.currencyPosition
						);
						return `${priceTransformed}`;
					}
				},
				totalValue: {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE'),
					type: 'text',
					filter: false,
					valuePrepareFunction: (cell, row) => {
						const priceTransformed = this.getPipesTransform(
							row.price * row.quantity,
							row.currency,
							this.invoice.fromOrganization.currencyPosition
						);
						return `${priceTransformed}`;
					}
				}
			}
		};
	}

	async loadTableData() {
		this.loading = true;
		const items = [];
		let data;
		for (const item of this.invoice.invoiceItems) {
			data = {
				description: item.description,
				quantity: item.quantity,
				price: item.price,
				totalValue: +item.totalValue,
				currency: this.invoice.currency
			};
			switch (this.invoice.invoiceType) {
				case InvoiceTypeEnum.BY_EMPLOYEE_HOURS:
					if (item.employeeId) {
						const { employee } = item;
						data['name'] = `${employee.user.firstName} ${employee.user.lastName}`;
					}
					break;
				case InvoiceTypeEnum.BY_PROJECT_HOURS:
					if (item.projectId) {
						const { project } = item;
						data['name'] = project.name;
					}
					break;
				case InvoiceTypeEnum.BY_TASK_HOURS:
					if (item.taskId) {
						const { task } = item;
						data['name'] = task.title;
					}
					break;
				case InvoiceTypeEnum.BY_PRODUCTS:
					if (item.productId) {
						const { product } = item;
						data['name'] = this.translatableService.getTranslatedProperty(product, 'name');
					}
					break;
				case InvoiceTypeEnum.BY_EXPENSES:
					if (item.expenseId) {
						const { expense } = item;
						data['name'] = expense.purpose;
					}
					break;
				default:
					delete this.settingsSmartTable['columns']['name'];
					data = {
						description: item.description,
						quantity: item.quantity,
						price: item.price,
						totalValue: +item.totalValue,
						id: item.id,
						currency: this.invoice.currency
					};
					break;
			}
			items.push(data);
		}
		this.smartTableSource.load(items);
		this.isTableLoaded = true;
		this.loading = false;
	}

	async checkUser() {
		if (this.store.user && this.store.user.id) {
			const userOrg = await this.userOrganizationService.getAll([], {
				userId: this.store.user.id,
				organizationId: this.invoice.organizationId
			});

			if (userOrg.items.length !== 0) {
				this.showInternalNote = true;
			}
		}
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this.loadSmartTable();
		});
	}
	/**
	 * This function transform simple number to currency format.
	 * @param value should be the number to transform
	 * @param currencyCode should be the currency code of invoice
	 * @param position should be the position of currency organization
	 * @returns should be a string
	 */
	getPipesTransform(value: number, currencyCode: string, position: string): string {
		const transform = this.currencyPipe.transform(value, currencyCode);
		return this.currencyPipePosition.transform(transform, position);
	}

	/*
	 * Table on changed source event
	 */
	private _onChangedSource() {
		this.invoiceViewInnerTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this._deselectAll())
			)
			.subscribe();
	}

	private _deselectAll() {
		if (this.invoiceViewInnerTable && this.invoiceViewInnerTable.grid) {
			this.invoiceViewInnerTable.grid.dataSet['willSelect'] = 'indexed';
			this.invoiceViewInnerTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() {}
}
