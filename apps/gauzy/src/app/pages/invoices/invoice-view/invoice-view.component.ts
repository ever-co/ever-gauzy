import { Component, OnInit, OnDestroy } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';
import { InvoicesService } from '../../../@core/services/invoices.service';
import {
	Invoice,
	InvoiceItem,
	OrganizationClients,
	Employee,
	Organization
} from '@gauzy/models';
import { InvoiceItemService } from '../../../@core/services/invoice-item.service';
import { OrganizationClientsService } from '../../../@core/services/organization-clients.service ';
import { EmployeesService } from '../../../@core/services/employees.service';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { TasksService } from '../../../@core/services/tasks.service';
import { LocalDataSource } from 'ng2-smart-table';
import * as jspdf from 'jspdf';
import * as html2canvas from 'html2canvas';
import { OrganizationsService } from '../../../@core/services/organizations.service';

@Component({
	selector: 'ga-invoice-view',
	templateUrl: './invoice-view.component.html',
	styleUrls: ['./invoice-view.component.scss']
})
export class InvoiceViewComponent extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	invoiceId: string;
	invoice: Invoice;
	invoiceDate: string;
	dueDate: string;
	invoiceItems: InvoiceItem[];
	client: OrganizationClients;
	organization: Organization;
	settingsSmartTable: object;
	loadTable = false;
	smartTableSource = new LocalDataSource();
	employees: Employee[];
	private _ngDestroy$ = new Subject<void>();

	constructor(
		readonly translateService: TranslateService,
		private route: ActivatedRoute,
		private invoicesService: InvoicesService,
		private invoiceItemService: InvoiceItemService,
		private organizationClientsService: OrganizationClientsService,
		private employeeService: EmployeesService,
		private projectService: OrganizationProjectsService,
		private taskService: TasksService,
		private organizationService: OrganizationsService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.route.paramMap.subscribe(async (params) => {
			this.invoiceId = params.get('id');
		});
		this.executeInitialFunctions();
	}

	async executeInitialFunctions() {
		await this.getInvoice();
		if (this.invoice) {
			this.loadSmartTable();
			this._applyTranslationOnSmartTable();
			this.invoiceDate = this.invoice.invoiceDate.toString().slice(0, 10);
			this.dueDate = this.invoice.dueDate.toString().slice(0, 10);
			await this.getInvoiceItems();
			this.loadTableData();
		}
	}

	async getInvoice() {
		const invoice = await this.invoicesService.getById(this.invoiceId);
		this.invoice = invoice;
		const client = await this.organizationClientsService.getById(
			this.invoice.clientId
		);
		this.client = client;
		this.organizationService
			.getById(this.invoice.organizationId)
			.subscribe((org) => (this.organization = org));
	}

	async getInvoiceItems() {
		const allItems = await this.invoiceItemService.getAll();
		const invoiceItems = allItems.items.filter(
			(i) => i.invoiceId === this.invoice.id
		);
		this.invoiceItems = invoiceItems;
	}

	loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
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
						return `${row.currency} ${row.price}`;
					}
				}
			}
		};
	}

	loadTableData() {
		this.employeeService
			.getAll(['user'])
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(async (employees) => {
				this.employees = employees.items.filter((emp) => {
					return (
						emp.orgId === this.invoice.organizationId ||
						this.invoice.organizationId === ''
					);
				});
				const items = [];
				let data;
				for (const item of this.invoiceItems) {
					if (item.employeeId) {
						const employee = this.employees.filter(
							(e) => e.id === item.employeeId
						);
						data = {
							description: item.description,
							quantity: item.quantity,
							price: item.price,
							totalValue: +item.totalValue,
							name: `${employee[0].user.firstName} ${employee[0].user.lastName}`,
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
						const task = await this.taskService.getById(
							item.taskId
						);
						data = {
							description: item.description,
							quantity: item.quantity,
							price: item.price,
							totalValue: +item.totalValue,
							id: item.id,
							name: task.title,
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
			});
	}

	download() {
		const data = document.getElementById('contentToConvert');
		(html2canvas as any)(data).then((canvas) => {
			const imgWidth = 208;
			const imgHeight = (canvas.height * imgWidth) / canvas.width;
			const contentDataURL = canvas.toDataURL('image/png');
			const pdf = new jspdf('l', 'mm', 'a4');
			const position = 0;
			pdf.addImage(
				contentDataURL,
				'PNG',
				0,
				position,
				imgWidth,
				imgHeight
			);
			pdf.save(`Invoice ${this.invoice.invoiceNumber}`);
		});
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
