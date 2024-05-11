import { OnInit, Component, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Cell } from 'angular2-smart-table';
import { filter, tap, debounceTime } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, Subject } from 'rxjs';
import { distinctUntilChange, toUTC } from '@gauzy/common-angular';
import * as moment from 'moment';
import { ServerDataSource } from '@gauzy/ui-sdk/core';
import {
	IPayment,
	ComponentLayoutStyleEnum,
	IOrganization,
	IInvoice,
	ITag,
	IOrganizationContact,
	IDateRangePicker
} from '@gauzy/contracts';
import {
	IPaginationBase,
	PaginationFilterBaseComponent
} from '../../@shared/pagination/pagination-filter-base.component';
import { PaymentMutationComponent } from '../invoices/invoice-payments/payment-mutation/payment-mutation.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import {
	ContactLinksComponent,
	DateViewComponent,
	IncomeExpenseAmountComponent,
	TagsOnlyComponent
} from '../../@shared/table-components';
import { StatusBadgeComponent } from '../../@shared/status-badge';
import { API_PREFIX, ComponentEnum } from '../../@core/constants';
import {
	DateRangePickerBuilderService,
	ErrorHandlingService,
	InvoiceEstimateHistoryService,
	PaymentService,
	Store,
	ToastrService
} from '../../@core/services';
import {
	InputFilterComponent,
	OrganizationContactFilterComponent,
	PaymentMethodFilterComponent,
	TagsColorFilterComponent
} from '../../@shared/table-filters';
import { environment as ENV } from './../../../environments/environment';
import { getAdjustDateRangeFutureAllowed } from '../../@theme/components/header/selectors/date-range-picker';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-payments',
	templateUrl: './payments.component.html',
	styleUrls: ['./payments.component.scss']
})
export class PaymentsComponent extends PaginationFilterBaseComponent implements OnInit, OnDestroy {
	public settingsSmartTable: object;
	public smartTableSource: ServerDataSource;
	public selectedPayment: IPayment;
	public payments: IPayment[] = [];
	public viewComponentName: ComponentEnum;
	public dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	public componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	public organization: IOrganization;
	public disableButton: boolean = true;
	public loading: boolean = false;
	public currency: string;
	public projectId: string | null;
	public selectedDateRange: IDateRangePicker;
	public payments$: Subject<any> = this.subject$;
	private _refresh$: Subject<any> = new Subject();

	constructor(
		public readonly translateService: TranslateService,
		private readonly paymentService: PaymentService,
		private readonly store: Store,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly route: ActivatedRoute,
		private readonly httpClient: HttpClient,
		private readonly dateRangePickerBuilderService: DateRangePickerBuilderService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();

		// Combine all observables into one observable using combineLatest
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeDateRange$ = this.dateRangePickerBuilderService.selectedDateRange$;
		const storeProject$ = this.store.selectedProject$;

		// Subscribe to payments$ and perform actions when it emits a value
		this.payments$
			.pipe(
				// Throttle the emissions from `payments$` by 100 milliseconds.
				debounceTime(100),
				// Call the `clearItem` method when there's an emission.
				tap(() => this.clearItem()),
				// Call the `getPayments` method when there's an emission.
				tap(() => this.getPayments()),
				// Unsubscribe when the component is destroyed to avoid memory leaks.
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to expenses$ and perform actions when it emits a value
		this.pagination$
			.pipe(
				// Throttle the emissions from `pagination$` by 100 milliseconds.
				debounceTime(100),
				// Ensure that consecutive emissions with the same value are ignored.
				distinctUntilChange(),
				// Emit a value (true) on the `payments$` subject when there's an emission from `pagination$`.
				tap(() => this.payments$.next(true)),
				// Unsubscribe when the component is destroyed to avoid memory leaks.
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to the combined latest values from the all observables
		combineLatest([storeOrganization$, storeDateRange$, storeProject$])
			.pipe(
				// Throttle the emissions to avoid rapid consecutive calls.
				debounceTime(300),
				// Filter out invalid or null values.
				filter(([organization, dateRange]) => !!organization && !!dateRange),
				// Ensure that consecutive emissions with the same values are ignored.
				distinctUntilChange(),
				// Perform side effects to update component properties.
				tap(([organization]) => (this.currency = organization.currency || ENV.DEFAULT_CURRENCY)),
				tap(([organization, dateRange, project]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
					this.projectId = project ? project.id : null;
				}),
				// Trigger refresh actions by emitting values on _refresh$ and payments$ subjects.
				tap(() => this._refresh$.next(true)),
				tap(() => this.payments$.next(true)),
				// Unsubscribe when the component is destroyed to avoid memory leaks.
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to changes in the query parameters
		this.route.queryParamMap
			.pipe(
				// Filter out invalid or null parameters, and only proceed if 'openAddDialog' is 'true'.
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
				// Debounce the emissions to avoid rapid consecutive calls.
				debounceTime(1000),
				// Perform a side effect by calling the recordPayment method.
				tap(() => this.recordPayment()),
				// Unsubscribe when the component is destroyed to avoid memory leaks.
				untilDestroyed(this)
			)
			.subscribe();
		// Subscribe to _refresh$ and perform actions when it emits a value
		this._refresh$
			.pipe(
				// Filter to only proceed if the dataLayoutStyle is set to CARDS_GRID.
				filter(() => this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID),
				// Perform a side effect by calling the refreshPagination method.
				tap(() => this.refreshPagination()),
				// Perform another side effect by resetting the 'payments' array to an empty array.
				tap(() => (this.payments = [])),
				// Unsubscribe when the component is destroyed to avoid memory leaks.
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Sets the view component to 'PAYMENTS', observes changes in the component layout,
	 * and updates the data layout style accordingly. Performs additional actions based on
	 * the layout style, such as refreshing pagination and updating payments.
	 */
	setView(): void {
		// Set the view component name to 'PAYMENTS'.
		this.viewComponentName = ComponentEnum.PAYMENTS;

		// Observe changes in the component layout using the store's componentLayout$ observable.
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				// Ensure that consecutive emissions with the same value are ignored.
				distinctUntilChange(),
				// Update the dataLayoutStyle based on the emitted component layout.
				tap((componentLayout) => (this.dataLayoutStyle = componentLayout)),
				// Perform a side effect by triggering the refreshPagination method.
				tap(() => this.refreshPagination()),
				// Filter out emissions where the component layout is not CARDS_GRID.
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				// Perform additional actions specific to the CARDS_GRID layout.
				tap(() => (this.payments = [])),
				tap(() => this.payments$.next(true)),
				// Unsubscribe when the component is destroyed to avoid memory leaks.
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}
		this.loading = true;

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { startDate, endDate } = getAdjustDateRangeFutureAllowed(this.selectedDateRange);

		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/payments/pagination`,
			relations: ['invoice', 'invoice.toContact', 'recordedBy', 'organizationContact', 'project', 'tags'],
			join: {
				alias: 'payment',
				leftJoin: {
					tags: 'payment.tags',
					organizationContact: 'payment.organizationContact'
				},
				...(this.filters.join ? this.filters.join : {})
			},
			where: {
				organizationId,
				tenantId,
				paymentDate: {
					startDate: toUTC(startDate).format('YYYY-MM-DD HH:mm:ss'),
					endDate: toUTC(endDate).format('YYYY-MM-DD HH:mm:ss')
				},
				...(this.projectId ? { projectId: this.projectId } : {}),
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (payment: IPayment) => {
				try {
					const { invoice, project, recordedBy, paymentMethod, overdue } = payment;
					const organizationContact = payment.organizationContact || (invoice && invoice.toContact);

					return {
						...payment,
						overdue: this.statusMapper(overdue),
						invoiceNumber: invoice?.invoiceNumber || null,
						projectName: project?.name || null,
						recordedByName: recordedBy?.name || null,
						paymentMethodEnum: paymentMethod
							? this.getTranslation(`INVOICES_PAGE.PAYMENTS.${paymentMethod}`)
							: null,
						organizationContact
					};
				} catch (error) {
					return { ...payment };
				}
			},
			finalize: () => {
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
				this.loading = false;
			}
		});
	}

	// Define the method to get payments
	async getPayments() {
		// Check if the organization is available
		if (!this.organization) {
			return;
		}

		try {
			// Set up the Smart Table source
			this.setSmartTableSource();

			// Get pagination information
			const { activePage, itemsPerPage } = this.getPagination();

			// Set paging for the Smart Table
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);

			// Check if the data layout style is set to CARDS_GRID
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {
				// Initiate GRID view pagination
				await this.smartTableSource.getElements();

				// Push the retrieved data to the payments array
				this.payments.push(...this.smartTableSource.getData());

				// Set pagination details based on Smart Table source
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
			}
		} catch (error) {
			// Handle errors using a service or method
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Opens a dialog for adding a payment and handles the result.
	 */
	async recordPayment(): Promise<void> {
		// Check if organization is set
		if (!this.organization) {
			return;
		}

		// Open a dialog for adding payment
		const addDialogRef = this.dialogService.open(PaymentMutationComponent, {
			context: {
				organization: this.organization
			}
		});

		// Subscribe to the dialog result
		addDialogRef.onClose.pipe(untilDestroyed(this)).subscribe(async (dialogResult: IPayment) => {
			try {
				// If there is a result, proceed with creating a new payment
				if (dialogResult) {
					const payment = await this.paymentService.add(dialogResult);

					// If the payment is associated with an invoice, update the invoice history
					if (payment.invoice) {
						const { invoice, amount, currency } = payment;
						const action = this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_AMOUNT_ADDED', {
							amount,
							currency
						});
						await this.createInvoiceHistory(action, invoice);
					}

					// Display a success message
					this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_ADD');

					// Refresh the date range picker with the payment date
					this.dateRangePickerBuilderService.refreshDateRangePicker(moment(payment.paymentDate));
				}
			} catch (error) {
				// Handle errors during the process
				this.toastrService.error(error);
			} finally {
				// Trigger refresh actions
				this._refresh$.next(true);
				this.payments$.next(true);
			}
		});
	}

	/**
	 * Edits a payment by opening a dialog and updating the payment with the result.
	 * @param selectedItem - The payment item to be edited.
	 */
	async editPayment(selectedItem?: IPayment): Promise<void> {
		// If there is a selected item, update the selected payment
		if (selectedItem) {
			this.selectPayment({
				isSelected: true,
				data: selectedItem
			});
		}

		// Open the dialog to edit the income
		const dialogRef = this.dialogService.open(PaymentMutationComponent, {
			context: {
				payment: this.selectedPayment,
				invoice: this.selectedPayment?.invoice
			}
		});

		// Wait for the dialog to close and get the result
		dialogRef.onClose.pipe(untilDestroyed(this)).subscribe(async (dialogResult) => {
			try {
				if (dialogResult) {
					// If there is no selected payment, return
					if (!this.selectedPayment) {
						return;
					}

					// Update the payment using the payment service
					const payment = await this.paymentService.update(this.selectedPayment.id, dialogResult);

					// If the payment is associated with an invoice, update the invoice history
					if (payment.invoice) {
						const { invoice } = dialogResult;
						const action = this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_EDIT');
						await this.createInvoiceHistory(action, invoice);
					}

					// Display a success message
					this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_EDIT');

					// Refresh the date range picker with the payment date
					this.dateRangePickerBuilderService.refreshDateRangePicker(moment(payment.paymentDate));
				}
			} catch (error) {
				// Handle errors during the process
				this.toastrService.error(error);
			} finally {
				// Trigger refresh actions
				this._refresh$.next(true);
				this.payments$.next(true);
			}
		});
	}

	/**
	 * Deletes a payment by opening a confirmation dialog and processing the result.
	 * @param selectedItem - The payment item to be deleted.
	 */
	async deletePayment(selectedItem?: IPayment): Promise<void> {
		if (selectedItem) {
			// If a payment item is selected, mark it as selected
			this.selectPayment({
				isSelected: true,
				data: selectedItem
			});
		}

		// Open a confirmation dialog for deleting payment
		const confirmationDialogRef = this.dialogService.open(DeleteConfirmationComponent);

		// Subscribe to the confirmation dialog result
		confirmationDialogRef.onClose.pipe(untilDestroyed(this)).subscribe(async (dialogResult) => {
			try {
				if (dialogResult) {
					// If there is no selected payment, return
					if (!this.selectedPayment) {
						return;
					}

					// Delete the payment using the payment service
					await this.paymentService.delete(this.selectedPayment.id);

					// If the payment is associated with an invoice, update the invoice history
					const { invoice } = this.selectedPayment;
					if (invoice) {
						const action = this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_DELETE');
						await this.createInvoiceHistory(action, invoice);
					}

					// Display a success message
					this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_DELETE');
				}
			} catch (error) {
				// Handle errors during the process
				this.toastrService.error(error);
			} finally {
				// Trigger refresh actions
				this._refresh$.next(true);
				this.payments$.next(true);
			}
		});
	}

	/**
	 *
	 * @param value
	 * @returns
	 */
	private statusMapper = (value: string | boolean) => {
		// Initialize badgeClass with a default value
		let badgeClass: string = 'success';

		// Check if the value is truthy (overdue)
		if (value) {
			// Set badgeClass to 'danger' for overdue status
			badgeClass = 'danger';
			// Translate the 'overdue' status
			value = this.getTranslation('INVOICES_PAGE.PAYMENTS.OVERDUE');
		} else {
			// Translate the 'on time' status
			value = this.getTranslation('INVOICES_PAGE.PAYMENTS.ON_TIME');
		}

		// Return an object with text and class properties
		return {
			text: value,
			class: badgeClass
		};
	};

	/**
	 *
	 */
	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
			selectedRowIndex: -1,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.PAYMENT'),
			pager: {
				display: false,
				perPage: pagination ? pagination.itemsPerPage : 10
			},
			columns: {
				invoiceNumber: {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER'),
					type: 'text',
					filter: false,
					width: '8%',
					sort: false
				},
				paymentDate: {
					title: this.getTranslation('PAYMENTS_PAGE.PAYMENT_DATE'),
					type: 'custom',
					filter: false,
					width: '10%',
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.value = cell.getValue();
					}
				},
				amount: {
					title: this.getTranslation('PAYMENTS_PAGE.AMOUNT'),
					type: 'custom',
					filter: false,
					width: '8%',
					renderComponent: IncomeExpenseAmountComponent,
					componentInitFunction: (instance: IncomeExpenseAmountComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				paymentMethodEnum: {
					title: this.getTranslation('PAYMENTS_PAGE.PAYMENT_METHOD'),
					type: 'text',
					width: '10%',
					filter: {
						type: 'custom',
						component: PaymentMethodFilterComponent
					},
					filterFunction: (value) => {
						this.setFilter({ field: 'paymentMethod', search: value });
					}
				},
				recordedByName: {
					title: this.getTranslation('PAYMENTS_PAGE.RECORDED_BY'),
					type: 'text',
					filter: false,
					width: '10%',
					sort: false
				},
				note: {
					title: this.getTranslation('PAYMENTS_PAGE.NOTE'),
					type: 'text',
					width: '10%',
					filter: {
						type: 'custom',
						component: InputFilterComponent
					},
					filterFunction: (value: string) => {
						this.setFilter({ field: 'note', search: value });
					}
				},
				organizationContact: {
					title: this.getTranslation('PAYMENTS_PAGE.CONTACT'),
					type: 'custom',
					renderComponent: ContactLinksComponent,
					componentInitFunction: (instance: ContactLinksComponent, cell: Cell) => {
						instance.value = cell.getRawValue();
					},
					filter: {
						type: 'custom',
						component: OrganizationContactFilterComponent
					},
					filterFunction: (value: IOrganizationContact | null) => {
						this.setFilter({ field: 'organizationContactId', search: value?.id || null });
					},
					sort: false
				},
				projectName: {
					title: this.getTranslation('PAYMENTS_PAGE.PROJECT'),
					type: 'text',
					width: '12%',
					filter: false,
					sort: false
				},
				overdue: {
					title: this.getTranslation('PAYMENTS_PAGE.STATUS'),
					type: 'custom',
					width: '8%',
					filter: false,
					renderComponent: StatusBadgeComponent,
					componentInitFunction: (instance: StatusBadgeComponent, cell: Cell) => {
						instance.value = cell.getRawValue();
					}
				},
				tags: {
					title: this.getTranslation('PAYMENTS_PAGE.TAGS'),
					type: 'custom',
					width: '8%',
					renderComponent: TagsOnlyComponent,
					componentInitFunction: (instance: TagsOnlyComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					},
					filter: {
						type: 'custom',
						component: TagsColorFilterComponent
					},
					filterFunction: (tags: ITag[]) => {
						const tagIds = [];
						for (const tag of tags) {
							tagIds.push(tag.id);
						}
						this.setFilter({ field: 'tags', search: tagIds });
					},
					sort: false
				}
			}
		};
	}

	/**
	 * Clears the selected payment item.
	 */
	clearItem() {
		this.selectPayment({ isSelected: false, data: null });
	}

	/**
	 * Handles the selection of a payment method.
	 * @param isSelected - A boolean indicating whether the payment method is selected.
	 * @param data - An object of type `IPayment` representing the payment details.
	 * @returns void
	 */
	selectPayment({ isSelected, data }: { isSelected: boolean; data: IPayment }): void {
		// Update the disableButton property based on the isSelected value
		this.disableButton = !isSelected;
		// Update the selectedPayment property based on the isSelected value
		// If isSelected is true, set selectedPayment to the provided payment data; otherwise, set it to null.
		this.selectedPayment = isSelected ? data : null;
	}

	/**
	 * Listens for language changes and triggers the loading of Smart Table settings.
	 * Unsubscribes when the component is destroyed.
	 */
	private _applyTranslationOnSmartTable(): void {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Create a payment invoice history event.
	 *
	 * @param action - The action to be recorded in the history.
	 * @param invoice - The invoice object containing information about the invoice.
	 */
	async createInvoiceHistory(action: string, invoice: IInvoice): Promise<void> {
		// Extract user information from the store
		const { id: userId } = this.store.user;
		// Extract organization information from the current organization
		const { id: organizationId, tenantId } = this.organization;
		// Extract invoice information
		const { id: invoiceId } = invoice;

		try {
			// Call the service to add the invoice history event
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

			// The history event has been successfully created
		} catch (error) {
			// Handle errors, e.g., log or display an error message
			console.error('Error creating invoice history:', error);
		}
	}

	ngOnDestroy() {}
}
