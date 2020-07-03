import { Component, OnInit, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';
import { InvoicesService } from '../../../@core/services/invoices.service';
import { Invoice, InvoiceItem, Payment } from '@gauzy/models';
import { LocalDataSource } from 'ng2-smart-table';
import { PaymentMutationComponent } from './payment-mutation/payment-mutation.component';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { PaymentService } from '../../../@core/services/payment.service';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { first } from 'rxjs/operators';
import { InvoicePaymentOverdueComponent } from '../table-components/invoice-payment-overdue.component';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { generatePdf } from '../../../@shared/payment/generate-pdf';

export interface SelectedPayment {
	data: Payment;
	isSelected: false;
}

@Component({
	selector: 'ga-payments',
	templateUrl: './payments.component.html',
	styleUrls: ['./payments.component.scss']
})
export class InvoicePaymentsComponent extends TranslationBaseComponent
	implements OnInit {
	constructor(
		private route: ActivatedRoute,
		readonly translateService: TranslateService,
		private invoicesService: InvoicesService,
		private dialogService: NbDialogService,
		private paymentService: PaymentService,
		private toastrService: NbToastrService
	) {
		super(translateService);
	}

	invoiceId: string;
	invoice: Invoice;
	payments: Payment[];
	totalPaid = 0;
	barWidth = 0;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	selectedPayment: Payment;
	disableButton = true;

	@ViewChild('paymentsTable') paymentsTable;

	ngOnInit() {
		this.route.paramMap.subscribe((params) => {
			this.invoiceId = params.get('id');
		});
		this.executeInitialFunctions();
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
	}

	async executeInitialFunctions() {
		await this.getInvoice();
		this.loadSettings();
		await this.calculateTotalPaid();
	}

	async getInvoice() {
		const invoice = await this.invoicesService.getById(this.invoiceId, [
			'invoiceItems',
			'tags',
			'fromOrganization',
			'toClient'
		]);
		this.invoice = invoice;
	}

	async calculateTotalPaid() {
		this.totalPaid = 0;
		const tableData = await this.smartTableSource.getAll();
		for (const payment of tableData) {
			this.totalPaid += +payment.amount;
		}
		this.barWidth = +(
			(this.totalPaid / this.invoice.totalValue) *
			100
		).toFixed(2);
		if (this.barWidth > 100) {
			this.barWidth = 100;
		}
		const progressBar = document.getElementById('progress-bar-inner');
		progressBar.style.width = `${this.barWidth}%`;
		if (this.totalPaid >= this.invoice.totalValue) {
			if (!this.invoice.paid) {
				await this.invoicesService.update(this.invoice.id, {
					paid: true
				});
			}
		} else {
			if (this.invoice.paid) {
				await this.invoicesService.update(this.invoice.id, {
					paid: false
				});
			}
		}
	}

	async recordPayment() {
		this.dialogService
			.open(PaymentMutationComponent, {
				context: {
					invoice: this.invoice
				}
			})
			.onClose.subscribe(async () => {
				this.totalPaid = 0;
				await this.loadSettings();
			});
	}

	async editPayment() {
		this.dialogService
			.open(PaymentMutationComponent, {
				context: {
					invoice: this.invoice,
					payment: this.selectedPayment
				}
			})
			.onClose.subscribe(async () => {
				await this.loadSettings();
			});
	}

	async deletePayment() {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.paymentService.delete(this.selectedPayment.id);
			this.loadSettings();

			this.toastrService.primary(
				this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_DELETE'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
		this.disableButton = true;
	}

	async download() {
		const tableData = await this.smartTableSource.getAll();
		if (!tableData.length) {
			this.toastrService.danger(
				this.getTranslation(
					'INVOICES_PAGE.PAYMENTS.NO_PAYMENTS_RECORDED'
				),
				this.getTranslation('TOASTR.TITLE.WARNING')
			);
			return;
		}
		pdfMake.vfs = pdfFonts.pdfMake.vfs;

		const docDefinition = await generatePdf(
			this.invoice,
			this.payments,
			this.invoice.fromOrganization,
			this.invoice.toClient,
			this.totalPaid
		);

		pdfMake.createPdf(docDefinition).download(`Payment.pdf`);
	}

	async selectPayment($event: SelectedPayment) {
		if ($event.isSelected) {
			this.selectedPayment = $event.data;
			this.disableButton = false;
			this.paymentsTable.grid.dataSet.willSelect = false;
		} else {
			this.disableButton = true;
		}
	}

	loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				paymentDate: {
					title: this.getTranslation(
						'INVOICES_PAGE.PAYMENTS.PAYMENT_DATE'
					),
					type: 'text',
					valuePrepareFunction: (cell, row) => {
						return `${cell.slice(0, 10)}`;
					}
				},
				amount: {
					title: this.getTranslation('INVOICES_PAGE.PAYMENTS.AMOUNT'),
					type: 'text'
				},
				recordedBy: {
					title: this.getTranslation(
						'INVOICES_PAGE.PAYMENTS.RECORDED_BY'
					),
					type: 'text',
					valuePrepareFunction: (cell, row) => {
						if (cell.firstName && cell.lastName) {
							return `${cell.firstName} ${cell.lastName}`;
						} else {
							return ``;
						}
					}
				},
				note: {
					title: this.getTranslation('INVOICES_PAGE.PAYMENTS.NOTE'),
					type: 'text'
				},
				overdue: {
					title: this.getTranslation('INVOICES_PAGE.PAYMENTS.STATUS'),
					type: 'custom',
					renderComponent: InvoicePaymentOverdueComponent
				}
			}
		};
	}

	async loadSettings() {
		const { items } = await this.paymentService.getAll(
			['invoice', 'recordedBy'],
			{ invoiceId: this.invoiceId }
		);
		this.payments = items;
		this.smartTableSource.load(items);
		await this.calculateTotalPaid();
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSmartTable();
		});
	}
}
