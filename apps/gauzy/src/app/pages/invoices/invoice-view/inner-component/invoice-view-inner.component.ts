import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { IInvoice, InvoiceTypeEnum } from '@gauzy/models';
import { LocalDataSource } from 'ng2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { UsersOrganizationsService } from 'apps/gauzy/src/app/@core/services/users-organizations.service';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-invoice-view-inner',
	templateUrl: './invoice-view-inner.component.html',
	styleUrls: ['./invoice-view-inner.component.scss']
})
export class InvoiceViewInnerComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	invoiceDate: string;
	dueDate: string;
	settingsSmartTable: object;
	isTableLoaded = false;
	smartTableSource = new LocalDataSource();
	loading: boolean;
	showInternalNote: boolean;

	@Input() invoice: IInvoice;
	@Input() isEstimate: boolean;

	constructor(
		readonly translateService: TranslateService,
		private store: Store,
		private userOrganizationService: UsersOrganizationsService
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
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.DESCRIPTION'
					),
					type: 'text',
					filter: false
				},
				quantity: {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.QUANTITY'
					),
					type: 'text',
					filter: false
				},
				price: {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.PRICE'
					),
					type: 'text',
					filter: false,
					valuePrepareFunction: (cell, row) => {
						return `${row.currency} ${row.price}`;
					}
				},
				totalValue: {
					title: this.getTranslation(
						'INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE'
					),
					type: 'text',
					filter: false,
					valuePrepareFunction: (cell, row) => {
						return `${row.currency} ${row.price * row.quantity}`;
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
						data[
							'name'
						] = `${employee.user.firstName} ${employee.user.lastName}`;
					}
					break;
				case InvoiceTypeEnum.BY_PROJECT_HOURS:
					if (item.projectId) {
						const { project } = item;
						data['name'] = project.name;
					}
					break;
				case InvoiceTypeEnum.BY_TASK_HOURS:
					if (item.projectId) {
						const { task } = item;
						data['name'] = task.title;
					}
					break;
				case InvoiceTypeEnum.BY_PRODUCTS:
					if (item.productId) {
						const { product } = item;
						data['name'] = product.name;
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
		const userOrg = await this.userOrganizationService.getAll([], {
			userId: this.store.user.id,
			organizationId: this.invoice.organizationId
		});

		if (userOrg.items.length !== 0) {
			this.showInternalNote = true;
		}
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}

	ngOnDestroy() {}
}
