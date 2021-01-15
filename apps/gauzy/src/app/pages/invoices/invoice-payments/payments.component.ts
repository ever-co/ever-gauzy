import { Component, OnInit, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';
import { InvoicesService } from '../../../@core/services/invoices.service';
import {
	IInvoice,
	IPayment,
	InvoiceStatusTypesEnum,
	ISelectedPayment
} from '@gauzy/models';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { PaymentMutationComponent } from './payment-mutation/payment-mutation.component';
import { NbDialogService } from '@nebular/theme';
import { PaymentService } from '../../../@core/services/payment.service';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { filter, first, tap } from 'rxjs/operators';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { generatePdf } from '../../../@shared/payment/generate-pdf';
import { StatusBadgeComponent } from '../../../@shared/status-badge/status-badge.component';
import { Store } from '../../../@core/services/store.service';
import { InvoiceEstimateHistoryService } from '../../../@core/services/invoice-estimate-history.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../../@core/services/toastr.service';
@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-payments',
	templateUrl: './payments.component.html',
	styleUrls: ['./payments.component.scss']
})
export class InvoicePaymentsComponent
	extends TranslationBaseComponent
	implements OnInit {
	constructor(
		private route: ActivatedRoute,
		readonly translateService: TranslateService,
		private invoicesService: InvoicesService,
		private dialogService: NbDialogService,
		private paymentService: PaymentService,
		private toastrService: ToastrService,
		private store: Store,
		private invoiceEstimateHistoryService: InvoiceEstimateHistoryService
	) {
		super(translateService);
	}

	invoiceId: string;
	invoice: IInvoice;
	payments: IPayment[];
	totalPaid = 0;
	leftToPay = 0;
	barWidth = 0;
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	selectedPayment: IPayment;
	disableButton = true;
	tenantId: string;
	loading: boolean;
	translatedText: any;
	disableFullPaymentButton: boolean;

	paymentsTable: Ng2SmartTableComponent;
	@ViewChild('paymentsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.paymentsTable = content;
			this.onChangedSource();
		}
	}

	ngOnInit() {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.route.paramMap.pipe(untilDestroyed(this)).subscribe((params) => {
			this.invoiceId = params.get('id');
		});
		this.store.user$
			.pipe(
				filter((user) => !!user),
				tap((user) => (this.tenantId = user.tenantId)),
				tap(() => this.getInvoice()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async getInvoice() {
		this.loading = true;
		if (!this.invoiceId) {
			return;
		}
		const invoice = await this.invoicesService.getById(
			this.invoiceId,
			[
				'invoiceItems',
				'tags',
				'fromOrganization',
				'toContact',
				'payments',
				'payments.invoice',
				'payments.recordedBy'
			],
			{ tenantId: this.tenantId }
		);
		this.invoice = invoice;

		this.payments = invoice.payments;
		this.smartTableSource.load(invoice.payments);
		await this.calculateTotalPaid();
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

		this.leftToPay = this.invoice.totalValue - this.totalPaid;

		if (this.leftToPay < 0) {
			this.leftToPay = 0;
		}

		if (this.leftToPay === 0) {
			this.disableFullPaymentButton = true;
		} else {
			this.disableFullPaymentButton = false;
		}

		this.loading = false;
	}

	async recordPayment() {
		const result = await this.dialogService
			.open(PaymentMutationComponent, {
				context: {
					invoice: this.invoice
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.paymentService.add(result);
			this.totalPaid = 0;
			await this.getInvoice();
			await this.updateInvoiceStatus(
				+this.invoice.totalValue,
				this.totalPaid
			);
			await this.invoiceEstimateHistoryService.add({
				action: this.getTranslation(
					'INVOICES_PAGE.PAYMENT.PAYMENT_AMOUNT_ADDED',
					{
						amount: result.amount,
						currency: result.currency
					}
				),
				invoice: result.invoice,
				invoiceId: result.invoice.id,
				user: this.store.user,
				userId: this.store.userId,
				organization: this.invoice.fromOrganization,
				organizationId: this.invoice.fromOrganization.id
			});
		}
	}

	async editPayment() {
		const result = await this.dialogService
			.open(PaymentMutationComponent, {
				context: {
					invoice: this.invoice,
					payment: this.selectedPayment
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.paymentService.update(result.id, result);
			await this.getInvoice();
			await this.updateInvoiceStatus(
				+this.invoice.totalValue,
				this.totalPaid
			);
			await this.invoiceEstimateHistoryService.add({
				action: this.getTranslation(
					'INVOICES_PAGE.PAYMENT.PAYMENT_EDIT'
				),
				invoice: result.invoice,
				invoiceId: result.invoice.id,
				user: this.store.user,
				userId: this.store.userId,
				organization: this.invoice.fromOrganization,
				organizationId: this.invoice.fromOrganization.id
			});
		}
	}

	async deletePayment() {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.paymentService.delete(this.selectedPayment.id);
			await this.getInvoice();
			await this.updateInvoiceStatus(
				+this.invoice.totalValue,
				this.totalPaid
			);

			await this.invoiceEstimateHistoryService.add({
				action: this.getTranslation(
					'INVOICES_PAGE.PAYMENT.PAYMENT_DELETE'
				),
				invoice: this.invoice,
				invoiceId: this.invoice.id,
				user: this.store.user,
				userId: this.store.userId,
				organization: this.invoice.fromOrganization,
				organizationId: this.invoice.fromOrganization.id
			});

			this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_DELETE');
		}
		this.disableButton = true;
	}

	async download() {
		const tableData = await this.smartTableSource.getAll();
		if (!tableData.length) {
			this.toastrService.danger(
				'INVOICES_PAGE.PAYMENTS.NO_PAYMENTS_RECORDED'
			);
			return;
		}
		pdfMake.vfs = pdfFonts.pdfMake.vfs;

		this.translatedText = {
			overdue: this.getTranslation('INVOICES_PAGE.PAYMENTS.OVERDUE'),
			onTime: this.getTranslation('INVOICES_PAGE.PAYMENTS.ON_TIME'),
			paymentDate: this.getTranslation(
				'INVOICES_PAGE.PAYMENTS.PAYMENT_DATE'
			),
			amount: this.getTranslation('INVOICES_PAGE.PAYMENTS.AMOUNT'),
			recordedBy: this.getTranslation(
				'INVOICES_PAGE.PAYMENTS.RECORDED_BY'
			),
			note: this.getTranslation('INVOICES_PAGE.PAYMENTS.NOTE'),
			status: this.getTranslation('INVOICES_PAGE.PAYMENTS.STATUS'),
			paymentsForInvoice: this.getTranslation(
				'INVOICES_PAGE.PAYMENTS.PAYMENTS_FOR_INVOICE'
			),
			dueDate: this.getTranslation('INVOICES_PAGE.DUE_DATE'),
			totalValue: this.getTranslation(
				'INVOICES_PAGE.INVOICE_ITEM.TOTAL_VALUE'
			),
			totalPaid: this.getTranslation('INVOICES_PAGE.PAYMENTS.TOTAL_PAID'),
			receivedFrom: this.getTranslation(
				'INVOICES_PAGE.PAYMENTS.RECEIVED_FROM'
			),
			receiver: this.getTranslation('INVOICES_PAGE.PAYMENTS.RECEIVER')
		};

		const docDefinition = await generatePdf(
			this.invoice,
			this.payments,
			this.invoice.fromOrganization,
			this.invoice.toContact,
			this.totalPaid,
			this.translatedText
		);
		pdfMake
			.createPdf(docDefinition)
			.download(
				`${this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT')}.pdf`
			);
		this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_DOWNLOAD');
	}

	selectPayment($event: ISelectedPayment) {
		if ($event.isSelected) {
			this.selectedPayment = $event.data;
			this.disableButton = false;
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
						if (cell && cell.firstName && cell.lastName) {
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
				paymentMethod: {
					title: this.getTranslation(
						'INVOICES_PAGE.PAYMENTS.PAYMENT_METHOD'
					),
					type: 'text'
				},
				overdue: {
					title: this.getTranslation('INVOICES_PAGE.PAYMENTS.STATUS'),
					type: 'custom',
					width: '5%',
					renderComponent: StatusBadgeComponent,
					valuePrepareFunction: (cell, row) => {
						let badgeClass;
						if (cell && row.overdue) {
							badgeClass = 'danger';
							cell = this.getTranslation(
								'INVOICES_PAGE.PAYMENTS.OVERDUE'
							);
						} else if (cell) {
							badgeClass = 'success';
							cell = this.getTranslation(
								'INVOICES_PAGE.PAYMENTS.ON_TIME'
							);
						}
						return {
							text: cell,
							class: badgeClass
						};
					}
				}
			}
		};
	}

	async updateInvoiceStatus(totalValue: number, totalPaid: number) {
		if (totalPaid <= 0) {
			await this.invoicesService.update(this.invoice.id, {
				status: InvoiceStatusTypesEnum.VIEWED
			});
		} else if (totalPaid < totalValue) {
			await this.invoicesService.update(this.invoice.id, {
				status: InvoiceStatusTypesEnum.PARTIALLY_PAID
			});
		} else if (totalPaid === totalValue) {
			await this.invoicesService.update(this.invoice.id, {
				status: InvoiceStatusTypesEnum.FULLY_PAID
			});
		} else {
			await this.invoicesService.update(this.invoice.id, {
				status: InvoiceStatusTypesEnum.OVERPAID
			});
		}
	}

	async recordFullPayment() {
		const payment = {
			amount: this.leftToPay,
			paymentDate: new Date(),
			currency: this.invoice.currency,
			invoice: this.invoice,
			invoiceId: this.invoice.id,
			organization: this.invoice.fromOrganization,
			organizationId: this.invoice.fromOrganization.id,
			recordedBy: this.store.user,
			userId: this.store.userId
		};

		if (this.invoice.dueDate >= new Date()) {
			payment['overdue'] = true;
		} else {
			payment['overdue'] = false;
		}

		await this.paymentService.add(payment);
		await this.getInvoice();

		this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_ADD');
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.paymentsTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectPayment({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.paymentsTable && this.paymentsTable.grid) {
			this.paymentsTable.grid.dataSet['willSelect'] = 'false';
			this.paymentsTable.grid.dataSet.deselectAll();
		}
	}
}
