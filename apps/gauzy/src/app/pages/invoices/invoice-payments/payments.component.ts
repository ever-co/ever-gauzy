import { Component, OnInit, ViewChild } from '@angular/core';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
	IInvoice,
	IPayment,
	InvoiceStatusTypesEnum,
	ISelectedPayment,
	IOrganization
} from '@gauzy/contracts';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { PaymentMutationComponent } from './payment-mutation/payment-mutation.component';
import { NbDialogService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { debounceTime, filter, first, tap } from 'rxjs/operators';
import { saveAs } from 'file-saver';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { DeleteConfirmationComponent } from '../../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { StatusBadgeComponent } from '../../../@shared/status-badge/status-badge.component';
import { generateCsv } from '../../../@shared/invoice/generate-csv';
import { InvoicePaymentReceiptMutationComponent } from './payment-receipt-mutation/payment-receipt-mutation.component';
import { InvoiceEstimateHistoryService, InvoicesService, PaymentService, Store, ToastrService } from '../../../@core/services';
import { DateViewComponent, IncomeExpenseAmountComponent } from '../../../@shared/table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-payments',
	templateUrl: './payments.component.html',
	styleUrls: ['./payments.component.scss']
})
export class InvoicePaymentsComponent
	extends TranslationBaseComponent
	implements OnInit {

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
	loading: boolean;
	isDisabled: boolean;
	organization: IOrganization;
	subject$: Subject<any> = new Subject();

	paymentsTable: Ng2SmartTableComponent;
	@ViewChild('paymentsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.paymentsTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private readonly route: ActivatedRoute,
		readonly translateService: TranslateService,
		private readonly invoicesService: InvoicesService,
		private readonly dialogService: NbDialogService,
		private readonly paymentService: PaymentService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private readonly router: Router
	) {
		super(translateService);
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();

		this.subject$
			.pipe(
				debounceTime(200),
				tap(() => this.getInvoice()),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.paramMap
			.pipe(
				filter((params) => !!params && !!params.get('id')),
				tap((params) => this.invoiceId = params.get('id')),
				tap(() => this.subject$.next()),
				untilDestroyed(this)
			).subscribe();
	}

	async getInvoice() {
		this.loading = true;

		const { tenantId } = this.store.user;
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
			{ tenantId }
		);

		this.invoice = invoice;
		this.payments = invoice.payments;

		this.smartTableSource.load(this.payments);
		await this.calculateTotalPaid();

		this.loading = false;
	}

	async calculateTotalPaid() {
		this.totalPaid = 0;
		const payments = await this.smartTableSource.getAll();
		for (const payment of payments) {
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

		this.isDisabled = (this.leftToPay === 0);

		await this.invoicesService.update(this.invoice.id, {
			alreadyPaid: this.totalPaid,
			amountDue: this.leftToPay
		});
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
			this.subject$.next();
			await this.updateInvoiceStatus(
				+this.invoice.totalValue,
				this.totalPaid
			);

			if (result.invoice) {
				const { invoice, amount, currency } = result;
				const action = this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_AMOUNT_ADDED', { amount, currency });
	
				await this.createInvoiceHistory(
					action,
					invoice
				);
			}
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
			this.subject$.next();
			await this.updateInvoiceStatus(
				+this.invoice.totalValue,
				this.totalPaid
			);

			if (result.invoice) {
				const { invoice } = result;
				const action = this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_EDIT');
				await this.createInvoiceHistory(
					action,
					invoice
				);
			}
		}
	}

	async deletePayment() {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.paymentService.delete(this.selectedPayment.id);
			this.subject$.next();
			await this.updateInvoiceStatus(
				+this.invoice.totalValue,
				this.totalPaid
			);

			const { invoice } = this.selectedPayment;
			if (invoice) {
				const action = this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_DELETE');
				await this.createInvoiceHistory(
					action,
					invoice
				);
			}

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

		const { id: invoiceId } = this.invoice;
		this.invoicesService
			.downloadInvoicePaymentPdf(invoiceId)
			.pipe(
				tap((data) => this.downloadFile(data)),
				untilDestroyed(this)
			)
			.subscribe(() => {
				this.toastrService.success(
					'INVOICES_PAGE.PAYMENTS.PAYMENT_DOWNLOAD'
				);
			});
	}

	downloadFile(data) {
		const filename = `${this.getTranslation(
			'INVOICES_PAGE.PAYMENTS.PAYMENT'
		)}.pdf`;
		saveAs(data, filename);
	}

	selectPayment($event: ISelectedPayment) {
		if ($event.isSelected) {
			this.selectedPayment = $event.data;
			this.disableButton = false;
		} else {
			this.disableButton = true;
		}
	}

	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				paymentDate: {
					title: this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_DATE'),				
					type: 'custom',
					renderComponent: DateViewComponent
				},
				amount: {
					title: this.getTranslation('INVOICES_PAGE.PAYMENTS.AMOUNT'),
					type: 'custom',
					renderComponent: IncomeExpenseAmountComponent
				},
				recordedBy: {
					title: this.getTranslation(
						'INVOICES_PAGE.PAYMENTS.RECORDED_BY'
					),
					type: 'text',
					valuePrepareFunction: (cell, row) => {
						if (cell && cell.name) {
							return `${cell.name}`;
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
					type: 'text',
					valuePrepareFunction: (cell, row) => {
						if (cell) {
							return this.getTranslation(
								`INVOICES_PAGE.PAYMENTS.${cell}`
							);
						} else {
							return '';
						}
					}
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
						} else if (!cell) {
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
		this.subject$.next();

		const { amount, currency, invoice } = payment;
		if (payment.invoice) {
			const action = this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_AMOUNT_ADDED', { amount, currency });
			await this.createInvoiceHistory(
				action,
				invoice
			);
		}

		this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_ADD', { amount, currency });
	}

	async invoiceRemainingAmount() {
		this.invoicesService.update(this.invoice.id, {
			alreadyPaid: +this.totalPaid
		});
		this.router.navigate(
			[`/pages/accounting/invoices/edit/${this.invoice.id}`],
			{ queryParams: { remainingAmount: true } }
		);
	}

	exportToCsv() {
		let data = [];

		this.payments.forEach((payment) => {
			data.push({
				invoiceNumber: this.invoice.invoiceNumber,
				contact: (this.invoice.toContact) ? this.invoice.toContact.name : '',
				paymentDate: payment.paymentDate.toString().slice(0, 10),
				amount: `${payment.currency + ' ' + payment.amount}`,
				recordedBy: payment.recordedBy.firstName + payment.recordedBy.lastName,
				note: payment.note || '',
				paymentMethod: payment.paymentMethod ? this.getTranslation(`INVOICES_PAGE.PAYMENTS.${payment.paymentMethod}`) : '',
				status: payment.overdue
					? this.getTranslation('INVOICES_PAGE.PAYMENTS.OVERDUE')
					: this.getTranslation('INVOICES_PAGE.PAYMENTS.ON_TIME')
			});
		});

		const headers = [
			this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER'),
			this.getTranslation('INVOICES_PAGE.CONTACT'),
			this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_DATE'),
			this.getTranslation('INVOICES_PAGE.PAYMENTS.AMOUNT'),
			this.getTranslation('INVOICES_PAGE.PAYMENTS.RECORDED_BY'),
			this.getTranslation('INVOICES_PAGE.PAYMENTS.NOTE'),
			this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_METHOD'),
			this.getTranslation('INVOICES_PAGE.PAYMENTS.STATUS')
		];

		const fileName = this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT');

		generateCsv(data, headers, fileName);
	}

	async sendReceipt() {
		await this.dialogService
			.open(InvoicePaymentReceiptMutationComponent, {
				context: {
					invoice: this.invoice,
					payment: this.selectedPayment
				}
			})
			.onClose.pipe(first())
			.toPromise();
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe()
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

	/*
	* Create Payment Invoice History Event 
	*/
	async createInvoiceHistory(
		action: string,
		invoice: IInvoice
	) {
		const { tenantId, id: userId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization;
		const { id: invoiceId } = invoice;

		await this.invoiceEstimateHistoryService.add({
			action,
			invoice,
			invoiceId,
			user: this.store.user,
			userId,
			organization: this.organization,
			organizationId,
			tenantId
		});
	}
}
