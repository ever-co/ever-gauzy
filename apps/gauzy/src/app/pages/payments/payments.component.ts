import { OnInit, Component, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { filter, tap, debounceTime } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, Subject, firstValueFrom } from 'rxjs';
import { distinctUntilChange, toUTC } from '@gauzy/common-angular';
import * as moment from 'moment';
import {
	IPayment,
	ComponentLayoutStyleEnum,
	IOrganization,
	ISelectedPayment,
	IInvoice,
	ITag,
	IOrganizationContact,
	IDateRangePicker
} from '@gauzy/contracts';
import { IPaginationBase, PaginationFilterBaseComponent } from '../../@shared/pagination/pagination-filter-base.component';
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
import { ServerDataSource } from '../../@core/utils/smart-table';
import {
	ErrorHandlingService,
	InvoiceEstimateHistoryService,
	PaymentService,
	Store,
	ToastrService
} from '../../@core/services';
import {
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
export class PaymentsComponent extends PaginationFilterBaseComponent 
	implements OnInit, OnDestroy {

	settingsSmartTable: object;
	smartTableSource: ServerDataSource;
	selectedPayment: IPayment;
	payments: IPayment[] = [];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	organization: IOrganization;
	disableButton: boolean = true;
	loading: boolean = false;
	currency: string;
	projectId: string | null;
	selectedDateRange: IDateRangePicker;
	payments$: Subject<any> = this.subject$;

	paymentsTable: Ng2SmartTableComponent;
	@ViewChild('paymentsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.paymentsTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		public readonly translateService: TranslateService,
		private readonly paymentService: PaymentService,
		private readonly store: Store,
		private readonly dialogService: NbDialogService,
		private readonly toastrService: ToastrService,
		private readonly invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly route: ActivatedRoute,
		private readonly httpClient: HttpClient
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
		this.payments$
			.pipe(
				debounceTime(100),
				tap(() => this.clearItem()),
				tap(() => this.getPayments()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.payments$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const selectedDateRange$ = this.store.selectedDateRange$;
		const storeProject$ = this.store.selectedProject$;
		combineLatest([storeOrganization$, selectedDateRange$, storeProject$])
			.pipe(
				debounceTime(300),
				filter(([organization]) => !!organization),
				distinctUntilChange(),
				tap(
					([organization]) =>
						(this.currency =
							organization.currency || ENV.DEFAULT_CURRENCY)
				),
				tap(([organization, dateRange, project]) => {
					this.organization = organization;
					this.selectedDateRange = dateRange;
					this.projectId = project ? project.id : null;
				}),
				tap(() => this.refreshPagination()),
				tap(() => this.payments$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter(
					(params) =>
						!!params && params.get('openAddDialog') === 'true'
				),
				debounceTime(1000),
				tap(() => this.recordPayment()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	setView() {
		this.viewComponentName = ComponentEnum.PAYMENTS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				distinctUntilChange(),
				tap(
					(componentLayout) =>
						(this.dataLayoutStyle = componentLayout)
				),
				filter(
					(componentLayout) =>
						componentLayout === ComponentLayoutStyleEnum.CARDS_GRID
				),
				tap(() => this.refreshPagination()),
				tap(() => this.payments$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
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
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}
		this.loading = true;
		
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const request = {};
		if (this.projectId) { request['projectId'] = this.projectId; }

		const { startDate, endDate } = getAdjustDateRangeFutureAllowed(this.selectedDateRange);
		if (startDate && endDate) {
			request['paymentDate'] = {};
			if (moment(startDate).isValid()) {
				request['paymentDate']['startDate'] = toUTC(startDate).format('YYYY-MM-DD HH:mm:ss');
			}
			if (moment(endDate).isValid()) {
				request['paymentDate']['endDate'] = toUTC(endDate).format('YYYY-MM-DD HH:mm:ss');
			}
		}
		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/payments/pagination`,
			relations: [
				'invoice',
				'invoice.toContact',
				'recordedBy',
				'organizationContact',
				'project',
				'tags'
			],
			join: {
				alias: 'payment',
				leftJoin: {
					tags: 'payment.tags',
					organizationContact: 'payment.organizationContact'
				},
				...(this.filters.join ? this.filters.join : {})
			},
			where: {
				...{ organizationId, tenantId },
				...request,
				...this.filters.where
			},
			resultMap: (payment: IPayment) => {
				try {
					const {
						invoice,
						project,
						organizationContact,
						recordedBy,
						paymentMethod,
						overdue
					} = payment;
					let organizationContactName: any;
					if (organizationContact) {
						organizationContactName = organizationContact;
					} else if (invoice && invoice.toContact) {
						organizationContactName = invoice.toContact;
					}
					return Object.assign({}, payment, {
						overdue: this.statusMapper(overdue),
						invoiceNumber: invoice ? invoice.invoiceNumber : null,
						projectName: project ? project.name : null,
						recordedByName: recordedBy ? recordedBy.name : null,
						paymentMethodEnum: paymentMethod
							? this.getTranslation(
									`INVOICES_PAGE.PAYMENTS.${paymentMethod}`
							  )
							: null,
						organizationContactName: organizationContactName
					});
				} catch (error) {
					return Object.assign({}, payment);
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

	async getPayments() {
		if (!this.organization) {
			return;
		}
		try {
			this.setSmartTableSource();

			const { activePage, itemsPerPage } = this.getPagination();
			this.smartTableSource.setPaging(
				activePage,
				itemsPerPage,
				false
			);

			if (
				this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID
			) {
				// Initiate GRID view pagination
				await this.smartTableSource.getElements();
				this.payments = this.smartTableSource.getData();

				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
			}
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}
	}

	async recordPayment() {
		const result = await firstValueFrom(
			this.dialogService.open(PaymentMutationComponent, {
				context: {
					organization: this.organization
				}
			}).onClose
		);

		if (result) {
			await this.paymentService.add(result);

			if (result.invoice) {
				const { invoice, amount, currency } = result;
				const action = this.getTranslation(
					'INVOICES_PAGE.PAYMENTS.PAYMENT_AMOUNT_ADDED',
					{ amount, currency }
				);
				await this.createInvoiceHistory(action, invoice);
			}

			this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_ADD');
			this.payments$.next(true);
		}
	}

	async editPayment(selectedItem?: ISelectedPayment) {
		if (selectedItem) {
			this.selectPayment({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await firstValueFrom(
			this.dialogService.open(PaymentMutationComponent, {
				context: {
					payment: this.selectedPayment,
					invoice: this.selectedPayment.invoice
				}
			}).onClose
		);

		if (result) {
			if (!this.selectedPayment) {
				return;
			}
			await this.paymentService.update(this.selectedPayment.id, result);

			if (result.invoice) {
				const { invoice } = result;
				const action = this.getTranslation(
					'INVOICES_PAGE.PAYMENTS.PAYMENT_EDIT'
				);

				await this.createInvoiceHistory(action, invoice);
			}

			this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_EDIT');
			this.payments$.next(true);
		}
	}

	async deletePayment(selectedItem?: ISelectedPayment) {
		if (selectedItem) {
			this.selectPayment({
				isSelected: true,
				data: selectedItem
			});
		}

		const result = await firstValueFrom(
			this.dialogService.open(DeleteConfirmationComponent).onClose
		);

		if (result) {
			if (!this.selectedPayment) {
				return;
			}
			await this.paymentService.delete(this.selectedPayment.id);

			const { invoice } = this.selectedPayment;
			if (invoice) {
				const action = this.getTranslation(
					'INVOICES_PAGE.PAYMENTS.PAYMENT_DELETE'
				);
				await this.createInvoiceHistory(action, invoice);
			}

			this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_DELETE');
			this.payments$.next(true);
		}
	}

	private statusMapper = (value: string | boolean) => {
		let badgeClass: string;
		if (value) {
			badgeClass = 'danger';
			value = this.getTranslation('INVOICES_PAGE.PAYMENTS.OVERDUE');
		} else {
			badgeClass = 'success';
			value = this.getTranslation('INVOICES_PAGE.PAYMENTS.ON_TIME');
		}
		return {
			text: value,
			class: badgeClass
		};
	};

	private _loadSmartTableSettings() {
		const pagination: IPaginationBase = this.getPagination();
		this.settingsSmartTable = {
			actions: false,
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
					renderComponent: DateViewComponent
				},
				amount: {
					title: this.getTranslation('PAYMENTS_PAGE.AMOUNT'),
					type: 'custom',
					filter: false,
					width: '8%',
					renderComponent: IncomeExpenseAmountComponent
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
						this.setFilter({
							field: 'paymentMethod',
							search: value
						});
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
					width: '10%'
				},
				organizationContactName: {
					title: this.getTranslation('PAYMENTS_PAGE.CONTACT'),
					type: 'custom',
					renderComponent: ContactLinksComponent,
					valuePrepareFunction: (cell, row) => {
						return row.organizationContactName;
					},
					filter: {
						type: 'custom',
						component: OrganizationContactFilterComponent
					},
					filterFunction: (value: IOrganizationContact | null) => {
						this.setFilter({
							field: 'organizationContactId',
							search: value?.id || null
						});
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
					renderComponent: StatusBadgeComponent,
					filter: false
				},
				tags: {
					title: this.getTranslation('PAYMENTS_PAGE.TAGS'),
					type: 'custom',
					width: '8%',
					renderComponent: TagsOnlyComponent,
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

	selectPayment({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedPayment = isSelected ? data : null;
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/*
	 * Create Payment Invoice History Event
	 */
	async createInvoiceHistory(action: string, invoice: IInvoice) {
		const { tenantId, id: userId } = this.store.user;
		const { id: organizationId } = this.organization;
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

	ngOnDestroy() {}
}
