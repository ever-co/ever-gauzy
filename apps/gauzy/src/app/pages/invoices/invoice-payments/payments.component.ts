import { Component, OnInit } from '@angular/core';
import { TranslationBaseComponent } from '@gauzy/ui-core/i18n';
import { TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Cell, LocalDataSource } from 'angular2-smart-table';
import { PaymentMutationComponent } from './payment-mutation/payment-mutation.component';
import { NbDialogService } from '@nebular/theme';
import { Subject, firstValueFrom } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { saveAs } from 'file-saver';
import { IInvoice, IPayment, InvoiceStatusTypesEnum, IOrganization, IUser } from '@gauzy/contracts';
import {
	InvoiceEstimateHistoryService,
	InvoicesService,
	PaymentService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import {
	DateViewComponent,
	DeleteConfirmationComponent,
	IncomeExpenseAmountComponent,
	StatusBadgeComponent,
	generateCsv
} from '@gauzy/ui-core/shared';
import { InvoicePaymentReceiptMutationComponent } from './payment-receipt-mutation/payment-receipt-mutation.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-payments',
	templateUrl: './payments.component.html',
	styleUrls: ['./payments.component.scss']
})
export class InvoicePaymentsComponent extends TranslationBaseComponent implements OnInit {
	public invoiceId: string;
	public invoice: IInvoice;
	public payments: IPayment[] = [];
	public totalPaid = 0;
	public leftToPay = 0;
	public barWidth = 0;
	public settingsSmartTable: object;
	public smartTableSource = new LocalDataSource();
	public selectedPayment: IPayment;
	public disableButton = true;
	public loading: boolean;
	public isDisabled: boolean;
	public organization: IOrganization = this.store.selectedOrganization;
	public subject$: Subject<any> = new Subject();

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

		// Subscribe to changes in the subject$ observable stream
		this.subject$
			.pipe(
				// Debounce the observable to wait for 200 milliseconds of inactivity
				debounceTime(200),
				// Perform the 'getInvoice' action when the observable emits a value
				tap(() => this.getInvoice()),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to changes in the route's paramMap
		this.route.paramMap
			.pipe(
				// Filter out cases where 'id' parameter is present in the paramMap
				filter((params) => !!params && !!params.get('id')),
				// Tap into the paramMap to assign the 'id' to the 'invoiceId' property
				tap((params) => (this.invoiceId = params.get('id'))),
				// Trigger the subject$ observable when the paramMap changes
				tap(() => this.subject$.next(true)),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Fetches invoice details, including invoice items, tags, organizations, contacts,
	 * payments, and their associated details. Loads payments into the smart table source
	 * and calculates the total paid amount.
	 */
	async getInvoice(): Promise<void> {
		// Check if the organization is available
		if (!this.organization) {
			return;
		}

		try {
			// Set loading indicator to true
			this.loading = true;

			// Destructure organization properties
			const { id: organizationId, tenantId } = this.organization;

			// Specify the related entities to include in the invoice details
			const relatedEntities = [
				'invoiceItems',
				'tags',
				'fromOrganization',
				'toContact',
				'payments',
				'payments.invoice',
				'payments.recordedBy'
			];

			// Fetch invoice details
			const invoice = await this.invoicesService.getById(this.invoiceId, relatedEntities, {
				organizationId,
				tenantId
			});

			// Update the component's invoice and payments properties
			this.invoice = invoice;
			this.payments = invoice.payments;

			// Load payments into the smart table source
			this.smartTableSource.load(this.payments);

			// Calculate total paid amount
			await this.calculateTotalPaid();
		} catch (error) {
			// Handle errors, e.g., log the error or show a user-friendly message
			this.toastrService.danger(error);
		} finally {
			// Set loading to false regardless of success or failure
			this.loading = false;
		}
	}

	async calculateTotalPaid() {
		this.totalPaid = 0;
		const payments = await this.smartTableSource.getAll();
		for (const payment of payments) {
			this.totalPaid += +payment.amount;
		}

		this.barWidth = +((this.totalPaid / this.invoice.totalValue) * 100).toFixed(2);

		if (this.barWidth > 100) {
			this.barWidth = 100;
		}

		const progressBar = document.getElementById('progress-bar-inner');
		progressBar.style.width = `${this.barWidth}%`;

		if (this.totalPaid >= this.invoice.totalValue) {
			if (!this.invoice.paid) {
				await this.invoicesService.updateAction(this.invoice.id, {
					paid: true
				});
			}
		} else {
			if (this.invoice.paid) {
				await this.invoicesService.updateAction(this.invoice.id, {
					paid: false
				});
			}
		}

		this.leftToPay = this.invoice.totalValue - this.totalPaid;

		if (this.leftToPay < 0) {
			this.leftToPay = 0;
		}

		this.isDisabled = this.leftToPay === 0;

		await this.invoicesService.updateAction(this.invoice.id, {
			alreadyPaid: this.totalPaid,
			amountDue: this.leftToPay
		});
	}

	async recordPayment() {
		const result = await firstValueFrom(
			this.dialogService.open(PaymentMutationComponent, {
				context: {
					invoice: this.invoice
				}
			}).onClose
		);

		if (result) {
			await this.paymentService.add(result);
			this.totalPaid = 0;
			this.subject$.next(true);
			await this.updateInvoiceStatus(+this.invoice.totalValue, this.totalPaid);

			if (result.invoice) {
				const { invoice, amount, currency } = result;
				const action = this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_AMOUNT_ADDED', { amount, currency });

				await this.createInvoiceHistory(action, invoice);
			}
		}
	}

	async editPayment() {
		const result = await firstValueFrom(
			this.dialogService.open(PaymentMutationComponent, {
				context: {
					invoice: this.invoice,
					payment: this.selectedPayment
				}
			}).onClose
		);

		if (result) {
			await this.paymentService.update(result.id, result);
			this.subject$.next(true);
			await this.updateInvoiceStatus(+this.invoice.totalValue, this.totalPaid);

			if (result.invoice) {
				const { invoice } = result;
				const action = this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_EDIT');
				await this.createInvoiceHistory(action, invoice);
			}
		}
	}

	async deletePayment() {
		const result = await firstValueFrom(this.dialogService.open(DeleteConfirmationComponent).onClose);

		if (result) {
			await this.paymentService.delete(this.selectedPayment.id);
			this.subject$.next(true);
			await this.updateInvoiceStatus(+this.invoice.totalValue, this.totalPaid);

			const { invoice } = this.selectedPayment;
			if (invoice) {
				const action = this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_DELETE');
				await this.createInvoiceHistory(action, invoice);
			}

			this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_DELETE');
		}
		this.disableButton = true;
	}

	async download() {
		const tableData = await this.smartTableSource.getAll();
		if (!tableData.length) {
			this.toastrService.danger('INVOICES_PAGE.PAYMENTS.NO_PAYMENTS_RECORDED');
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
				this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_DOWNLOAD');
			});
	}

	downloadFile(data) {
		const filename = `${this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT')}.pdf`;
		saveAs(data, filename);
	}

	/**
	 * Handles the selection/deselection of a payment.
	 * @param isSelected A boolean indicating whether the payment is selected.
	 * @param data The payment data associated with the selection.
	 */
	selectPayment({ isSelected, data }: { isSelected: boolean; data: IPayment }): void {
		// Update the disableButton property based on the isSelected value
		this.disableButton = !isSelected;

		// Update the selectedPayment property based on the isSelected value
		this.selectedPayment = isSelected ? data : null;
	}

	/**
	 * Loads and configures the settings for the Smart Table used in the context of invoices payments.
	 */
	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			selectedRowIndex: -1,
			columns: {
				paymentDate: {
					title: this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_DATE'),
					type: 'custom',
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				amount: {
					title: this.getTranslation('INVOICES_PAGE.PAYMENTS.AMOUNT'),
					type: 'custom',
					renderComponent: IncomeExpenseAmountComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				recordedBy: {
					title: this.getTranslation('INVOICES_PAGE.PAYMENTS.RECORDED_BY'),
					type: 'text',
					valuePrepareFunction: (value: IUser) => {
						return value && value.name ? `${value.name}` : '';
					}
				},
				note: {
					title: this.getTranslation('INVOICES_PAGE.PAYMENTS.NOTE'),
					type: 'text'
				},
				paymentMethod: {
					title: this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_METHOD'),
					type: 'text',
					valuePrepareFunction: (value: IPayment['paymentMethod']) =>
						this.getTranslation(`INVOICES_PAGE.PAYMENTS.${value}`) ?? ''
				},
				overdue: {
					title: this.getTranslation('INVOICES_PAGE.PAYMENTS.STATUS'),
					type: 'custom',
					width: '5%',
					renderComponent: StatusBadgeComponent,
					valuePrepareFunction: (value: IPayment['overdue']) => {
						const badgeClass = value ? 'danger' : 'success';
						const translatedCell = value
							? this.getTranslation('INVOICES_PAGE.PAYMENTS.OVERDUE')
							: this.getTranslation('INVOICES_PAGE.PAYMENTS.ON_TIME');

						return {
							text: translatedCell,
							class: badgeClass
						};
					},
					componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				}
			}
		};
	}

	async updateInvoiceStatus(totalValue: number, totalPaid: number) {
		if (totalPaid <= 0) {
			await this.invoicesService.updateAction(this.invoice.id, {
				status: InvoiceStatusTypesEnum.VIEWED
			});
		} else if (totalPaid < totalValue) {
			await this.invoicesService.updateAction(this.invoice.id, {
				status: InvoiceStatusTypesEnum.PARTIALLY_PAID
			});
		} else if (totalPaid === totalValue) {
			await this.invoicesService.updateAction(this.invoice.id, {
				status: InvoiceStatusTypesEnum.FULLY_PAID
			});
		} else {
			await this.invoicesService.updateAction(this.invoice.id, {
				status: InvoiceStatusTypesEnum.OVERPAID
			});
		}
	}

	async recordFullPayment() {
		if (!this.invoice) {
			return;
		}

		const { tenantId } = this.store.user;
		const payment = {
			amount: this.leftToPay,
			paymentDate: new Date(),
			currency: this.invoice.currency,
			invoice: this.invoice,
			invoiceId: this.invoice.id,
			organization: this.invoice.fromOrganization,
			organizationId: this.invoice.fromOrganization.id,
			tenantId,
			recordedBy: this.store.user,
			userId: this.store.userId
		};

		if (this.invoice.dueDate >= new Date()) {
			payment['overdue'] = true;
		} else {
			payment['overdue'] = false;
		}

		await this.paymentService.add(payment);
		const { amount, currency, invoice } = payment;
		if (payment.invoice) {
			const action = this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_AMOUNT_ADDED', { amount, currency });
			await this.createInvoiceHistory(action, invoice);
		}

		this.subject$.next(true);
		this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_ADD', { amount, currency });
	}

	/**
	 * Calculate and update the remaining amount for the invoice.
	 * Navigates to the invoice editing page with the remaining amount query parameter.
	 */
	async invoiceRemainingAmount(): Promise<void> {
		// Check if an invoice is available
		if (!this.invoice) {
			return;
		}

		// Update the already paid amount for the invoice
		await this.invoicesService.updateAction(this.invoice.id, {
			alreadyPaid: +this.totalPaid
		});

		// Navigate to the invoice editing page with the remaining amount query parameter
		this.router.navigate([`/pages/accounting/invoices/edit/${this.invoice.id}`], {
			queryParams: {
				remainingAmount: true
			}
		});
	}

	exportToCsv() {
		const data = [];

		this.payments.forEach((payment) => {
			data.push({
				invoiceNumber: this.invoice.invoiceNumber,
				contact: this.invoice.toContact ? this.invoice.toContact.name : '',
				paymentDate: payment.paymentDate.toString().slice(0, 10),
				amount: `${payment.currency + ' ' + payment.amount}`,
				recordedBy: payment.recordedBy.firstName + payment.recordedBy.lastName,
				note: payment.note || '',
				paymentMethod: payment.paymentMethod
					? this.getTranslation(`INVOICES_PAGE.PAYMENTS.${payment.paymentMethod}`)
					: '',
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

	/**
	 * Send a receipt for the selected payment.
	 */
	async sendReceipt(): Promise<void> {
		// Open a dialog for creating or mutating an invoice payment receipt
		await firstValueFrom(
			this.dialogService.open(InvoicePaymentReceiptMutationComponent, {
				context: {
					invoice: this.invoice,
					payment: this.selectedPayment
				}
			}).onClose
		);
	}
	/**
	 * Apply translations to the Smart Table settings when the language changes.
	 */
	private _applyTranslationOnSmartTable(): void {
		// Subscribe to the language change observable
		this.translateService.onLangChange
			.pipe(
				// Trigger the loading of Smart Table settings when the language changes
				tap(() => this._loadSmartTableSettings()),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectPayment({ isSelected: false, data: null });
	}

	/**
	 * Create a history event for a payment invoice.
	 * @param action The action or event type to be recorded in the history.
	 * @param invoice The payment invoice for which the history event is created.
	 */
	async createInvoiceHistory(action: string, invoice: IInvoice): Promise<void> {
		// Extract user information from the store
		const { tenantId, id: userId } = this.store.user;

		// Extract organization information from the store
		const { id: organizationId } = this.store.selectedOrganization;

		// Extract invoice information
		const { id: invoiceId } = invoice;

		// Create a history entry using the invoiceEstimateHistoryService
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
