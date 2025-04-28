import { Component, OnInit, OnDestroy, Input, TemplateRef, ElementRef } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { tap } from 'rxjs/operators';
import { LocalDataSource, Cell } from 'angular2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DiscountTaxTypeEnum, IInvoice, IInvoiceItem, InvoiceTypeEnum } from '@gauzy/contracts';
import { ErrorHandlingService, Store, TranslatableService } from '@gauzy/ui-core/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { CurrencyPositionPipe } from '../../../pipes/currency-position.pipe';

@UntilDestroy({ checkProperties: true })
@Component({
    selector: 'ga-invoice-view-inner',
    templateUrl: './invoice-view-inner.component.html',
    styleUrls: ['./invoice-view-inner.component.scss'],
    providers: [TranslatableService, CurrencyPipe, CurrencyPositionPipe],
    standalone: false
})
export class InvoiceViewInnerComponent extends TranslationBaseComponent implements OnInit, OnDestroy {
	public settingsSmartTable: object;
	public smartTableSource = new LocalDataSource();
	public loading: boolean = true;
	public discountTaxTypes = DiscountTaxTypeEnum;
	public showInternalNote: boolean = !!this._store.user?.tenantId;

	@Input() invoice: IInvoice;
	@Input() isEstimate: boolean = false;
	@Input() buttonsOutlet: TemplateRef<ElementRef>;

	constructor(
		readonly translateService: TranslateService,
		private readonly _store: Store,
		private readonly _translatableService: TranslatableService,
		private readonly _currencyPipe: CurrencyPipe,
		private readonly _currencyPipePosition: CurrencyPositionPipe,
		private readonly _errorHandlingService: ErrorHandlingService
	) {
		super(translateService);
	}

	ngOnInit() {
		this._applyTranslationOnSmartTable();
		this._loadSmartTableSettings();
		this._loadSmartTableData();
	}

	/**
	 * Load smart table settings
	 */
	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			hideSubHeader: true,
			selectedRowIndex: -1,
			actions: false,
			pager: {
				display: false
			},
			columns: {
				name: {
					title: this.getTranslation('INVOICES_PAGE.ITEM'),
					type: 'text',
					isFilterable: false
				},
				description: {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION'),
					type: 'text',
					isFilterable: false
				},
				quantity: {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.QUANTITY'),
					type: 'text',
					isFilterable: false
				},
				price: {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.PRICE'),
					type: 'text',
					isFilterable: false,
					valuePrepareFunction: (value: number, cell: Cell) => {
						// Get row data
						const row = cell.getRow().getData();

						// Get price transformed
						return this.getPipesTransform(
							row.price * row.quantity,
							row.currency,
							this.invoice.fromOrganization.currencyPosition
						);
					}
				},
				totalValue: {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE'),
					type: 'text',
					isFilterable: false,
					valuePrepareFunction: (value: number, cell: Cell) => {
						// Get row data
						const row = cell.getRow().getData();

						// Get price transformed
						return this.getPipesTransform(
							row.price * row.quantity,
							row.currency,
							this.invoice.fromOrganization.currencyPosition
						);
					}
				}
			}
		};
	}

	/**
	 * Apply translation on smart table
	 */
	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Load smart table data
	 */
	async _loadSmartTableData() {
		this.loading = true;

		try {
			// Map invoice items to smart table data
			const data = this.invoice.invoiceItems?.map((item) => {
				// Default inclusion
				const row = {
					description: item.description,
					quantity: item.quantity,
					price: item.price,
					totalValue: +item.totalValue,
					currency: this.invoice.currency,
					id: item.id // Default inclusion
				};

				// Add name based on invoice type
				row['name'] = this.getNameBasedOnInvoiceType(item);
				return row;
			});

			this.smartTableSource.load(data);
		} catch (error) {
			console.log('Error while loading smart table data', error);
			this._errorHandlingService.handleError(error);
		} finally {
			// Set loading to false
			this.loading = false;
		}
	}

	/**
	 * Determine name based on invoice type
	 *
	 * @param item Invoice item
	 */
	private getNameBasedOnInvoiceType(item: IInvoiceItem): string {
		// Return empty string if item is null
		if (!item) {
			return '';
		}

		switch (this.invoice.invoiceType) {
			case InvoiceTypeEnum.BY_EMPLOYEE_HOURS:
				return item.employeeId ? `${item.employee?.fullName}` : '';
			case InvoiceTypeEnum.BY_PROJECT_HOURS:
				return item.projectId ? item.project?.name : '';
			case InvoiceTypeEnum.BY_TASK_HOURS:
				return item.taskId ? item.task?.title : '';
			case InvoiceTypeEnum.BY_PRODUCTS:
				return item.productId ? this._translatableService.getTranslatedProperty(item.product, 'name') : '';
			case InvoiceTypeEnum.BY_EXPENSES:
				return item.expenseId ? item.expense?.purpose : '';
			default:
				delete this.settingsSmartTable['columns']['name'];
				return ''; // Default case for name
		}
	}

	/**
	 * This function transform simple number to currency format.
	 *
	 * @param value should be the number to transform
	 * @param currencyCode should be the currency code of invoice
	 * @param position should be the position of currency organization
	 * @returns should be a string
	 */
	getPipesTransform(value: number, currencyCode: string, position: string): string {
		const transform = this._currencyPipe.transform(value, currencyCode);
		return this._currencyPipePosition.transform(transform, position);
	}

	ngOnDestroy() {}
}
