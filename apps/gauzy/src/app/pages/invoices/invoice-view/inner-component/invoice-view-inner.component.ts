import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { TranslationBaseComponent } from '../../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { Invoice, Employee } from '@gauzy/models';
import { EmployeesService } from '../../../../@core/services/employees.service';
import { Subject } from 'rxjs';
import { OrganizationProjectsService } from '../../../../@core/services/organization-projects.service';
import { TasksService } from '../../../../@core/services/tasks.service';
import { LocalDataSource } from 'ng2-smart-table';
import { ProductService } from '../../../../@core/services/product.service';

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
		private productService: ProductService
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
			columns: {
				name: {
					title: this.getTranslation('INVOICES_PAGE.NAME'),
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
			if (item.employeeId) {
				const employee = await this.employeeService.getEmployeeById(
					item.employeeId,
					['user'],
					false
				);
				console.log(employee);
				data = {
					description: item.description,
					quantity: item.quantity,
					price: item.price,
					totalValue: +item.totalValue,
					name: `${employee.user.firstName} ${employee.user.lastName}`,
					currency: this.invoice.currency
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
					name: project.name,
					currency: this.invoice.currency
				};
			} else if (item.taskId) {
				const task = await this.taskService.getById(item.taskId);
				data = {
					description: item.description,
					quantity: item.quantity,
					price: item.price,
					totalValue: +item.totalValue,
					id: item.id,
					name: task.title,
					currency: this.invoice.currency
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
					name: product.name,
					currency: this.invoice.currency
				};
			} else {
				delete this.settingsSmartTable['columns']['name'];
				data = {
					description: item.description,
					quantity: item.quantity,
					price: item.price,
					totalValue: +item.totalValue,
					id: item.id,
					currency: this.invoice.currency
				};
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
