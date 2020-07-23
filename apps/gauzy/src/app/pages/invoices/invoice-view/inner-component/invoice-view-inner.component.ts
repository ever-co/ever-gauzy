import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { Invoice, Employee, InvoiceTypeEnum } from '@gauzy/models';
import { EmployeesService } from '../../../../@core/services/employees.service';
import { Subject } from 'rxjs';
import { OrganizationProjectsService } from '../../../../@core/services/organization-projects.service';
import { TasksService } from '../../../../@core/services/tasks.service';
import { LocalDataSource } from 'ng2-smart-table';
import { ProductService } from '../../../../@core/services/product.service';
import { ExpensesService } from '../../../../@core/services/expenses.service';

@Component({
	selector: 'ga-invoice-view-inner',
	templateUrl: './invoice-view-inner.component.html',
	styleUrls: ['./invoice-view-inner.component.scss']
})
export class InvoiceViewInnerComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	invoiceDate: string;
	dueDate: string;
	settingsSmartTable: object;
	loadTable = false;
	smartTableSource = new LocalDataSource();
	employees: Employee[];
	private _ngDestroy$ = new Subject<void>();

	@Input() invoice: Invoice;
	@Input() isEstimate: boolean;

	constructor(
		readonly translateService: TranslateService,
		private employeeService: EmployeesService,
		private projectService: OrganizationProjectsService,
		private taskService: TasksService,
		private productService: ProductService,
		private expensesService: ExpensesService
	) {
		super(translateService);
	}

	ngOnInit() {
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
					const employee = await this.employeeService.getEmployeeById(
						item.employeeId,
						['user'],
						false
					);
					data[
						'name'
					] = `${employee.user.firstName} ${employee.user.lastName}`;
					break;
				case InvoiceTypeEnum.BY_PROJECT_HOURS:
					const project = await this.projectService.getById(
						item.projectId
					);
					data['name'] = project.name;
					break;
				case InvoiceTypeEnum.BY_TASK_HOURS:
					const task = await this.taskService.getById(item.taskId);
					data['name'] = task.title;
					break;
				case InvoiceTypeEnum.BY_PRODUCTS:
					const product = await this.productService.getById(
						item.productId
					);
					data['name'] = product.name;
					break;
				case InvoiceTypeEnum.BY_EXPENSES:
					const expense = await this.expensesService.getById(
						item.expenseId
					);
					data['name'] = expense.purpose;
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
		this.loadTable = true;
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
