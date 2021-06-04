import { OnInit, Component, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { first, filter, tap, debounceTime } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { NbDialogService } from '@nebular/theme';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { combineLatest, Subject } from 'rxjs';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import * as moment from 'moment';
import {
	IPayment,
	ComponentLayoutStyleEnum,
	IOrganization,
	ISelectedPayment,
	IInvoice
} from '@gauzy/contracts';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { PaymentMutationComponent } from '../invoices/invoice-payments/payment-mutation/payment-mutation.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { DateViewComponent, IncomeExpenseAmountComponent, NotesWithTagsComponent } from '../../@shared/table-components';
import { StatusBadgeComponent } from '../../@shared/status-badge/status-badge.component';
import { API_PREFIX } from '../../@core/constants';
import { ServerDataSource } from '../../@core/utils/smart-table/server.data-source';
import { ErrorHandlingService, InvoiceEstimateHistoryService, PaymentService, Store, ToastrService } from '../../@core/services';
import { OrganizationContactFilterComponent, PaymentMethodFilterComponent, TagsColorFilterComponent } from '../../@shared/table-filters';
import { environment as ENV } from './../../../environments/environment';


@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-payments',
	templateUrl: './payments.component.html',
	styleUrls: ['./payments.component.scss']
})
export class PaymentsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
		
	settingsSmartTable: object;
	smartTableSource: ServerDataSource;
	selectedPayment: IPayment;
	payments: IPayment[];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	organization: IOrganization;
	disableButton = true;
	currency: string;
	loading: boolean;
	projectId: string | null;
	selectedDate: Date;
	subject$: Subject<any> = new Subject();
	pagination: any = {
		totalItems: 0,
		activePage: 1,
		itemsPerPage: 10
	};
	/*
	* getter setter for filters 
	*/
	private _filters: any = {};
	set filters(val: any) {
		this._filters = val;
	}
	get filters() {
		return this._filters;
	}

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
		this.subject$
			.pipe(
				tap(() => this.loading = true),
				debounceTime(300),
				tap(() => this.clearItem()),
				tap(() => this.getPayments()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const selectedDate$ = this.store.selectedDate$;
		const storeProject$ = this.store.selectedProject$;
		combineLatest([storeOrganization$, selectedDate$, storeProject$])
			.pipe(
				debounceTime(300),
				filter(([organization]) => !!organization),
				tap(([organization]) => (this.organization = organization)),
				tap(([organization]) => (this.currency = organization.currency || ENV.DEFAULT_CURRENCY)),
				distinctUntilChange(),
				tap(([organization, date, project]) => {
					if (organization) {
						this.organization = organization;
						this.selectedDate = date;
						this.projectId = project ? project.id : null;

						this.refreshPagination();
						this.subject$.next();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params && params.get('openAddDialog') === 'true'),
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
				tap((componentLayout) => this.dataLayoutStyle = componentLayout),
				filter((componentLayout) => componentLayout === ComponentLayoutStyleEnum.CARDS_GRID),
				tap(() => this.refreshPagination()),
				tap(() => this.subject$.next()),
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

	searchFilter() {
		const filters: any = {
			where: {
				...this.filters.where
			},
			join: {
				alias: 'payment',
				...this.filters.join
			}
		}
		if (isNotEmpty(filters)) {
			this._filters = filters;
			this.subject$.next();
		}
	}

	/*
	* Register Smart Table Source Config 
	*/
	setSmartTableSource() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		const request = {};
		if (this.projectId) {
			request['projectId'] = this.projectId;
		}
		if (moment(this.selectedDate).isValid()) {
			request['paymentDate'] = moment(this.selectedDate).format('YYYY-MM-DD HH:mm:ss');
		}

		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/payments/search/filter`,
			relations: [
				'invoice',
				'invoice.toContact',
				'recordedBy',
				'contact',
				'project',
				'tags'
			],
			join: {
				...(this.filters.join) ? this.filters.join : {}
			},
			where: {
				...{ organizationId, tenantId },
				...request,
				...this.filters.where
			},
			resultMap: (payment: IPayment) => {
				const { invoice, project, contact, recordedBy, paymentMethod, overdue } = payment;
				let organizationContactName: string;
				if (invoice && invoice.toContact) {
					organizationContactName = invoice.toContact.name;
				} else if (contact) {
					organizationContactName = contact.name;
				}
				return Object.assign({}, payment, {
					displayOverdue: this.statusMapper(overdue),
					invoiceNumber: invoice ? invoice.invoiceNumber : null,
					projectName: project ? project.name : null,
					organizationContactName,
					recordedBy: `${recordedBy.firstName} ${recordedBy.lastName}`,
					displayPaymentMethod: this.getTranslation(`INVOICES_PAGE.PAYMENTS.${paymentMethod}`)
				});
			},
			finalize: () => {
				this.loading = false;
			}
		});
	}

	async getPayments() {
		try {
			this.setSmartTableSource();
			if (this.dataLayoutStyle === ComponentLayoutStyleEnum.CARDS_GRID) {

				// Initiate GRID view pagination
				const { activePage, itemsPerPage } = this.pagination;
				this.smartTableSource.setPaging(activePage, itemsPerPage, false);

				await this.smartTableSource.getElements();
				this.payments = this.smartTableSource.getData();

				this.pagination['totalItems'] =  this.smartTableSource.count();
			}
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}
	}

	onPageChange(selectedPage: number) {
		this.pagination['activePage'] = selectedPage;
		this.subject$.next();
	}

	async recordPayment() {
		const result = await this.dialogService
			.open(PaymentMutationComponent, {
				context: {
					organization: this.organization,
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.paymentService.add(result);

			if (result.invoice) {
				const { invoice, amount, currency } = result;
				const action = this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_AMOUNT_ADDED', { amount, currency });
				await this.createInvoiceHistory(
					action,
					invoice
				);
			}
		
			this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_ADD');
			this.subject$.next();
		}
	}

	async editPayment(selectedItem?: ISelectedPayment) {
		if (selectedItem) {
			this.selectPayment({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await this.dialogService
			.open(PaymentMutationComponent, {
				context: {
					payment: this.selectedPayment,
					invoice: this.selectedPayment.invoice
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			if (!this.selectedPayment) {
				return;
			}
			await this.paymentService.update(this.selectedPayment.id, result);

			if (result.invoice) {
				const { invoice } = result;
				const action = this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_EDIT');
	
				await this.createInvoiceHistory(
					action,
					invoice
				);
			}

			this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_EDIT');
			this.subject$.next();
		}
	}

	async deletePayment(selectedItem?: ISelectedPayment) {
		if (selectedItem) {
			this.selectPayment({
				isSelected: true,
				data: selectedItem
			});
		}

		const result = await this.dialogService
			.open(DeleteConfirmationComponent)
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			if (!this.selectedPayment) {
				return;
			}
			await this.paymentService.delete(this.selectedPayment.id);
			
			const { invoice } = this.selectedPayment;
			if (invoice) {
				const action = this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_DELETE');
				await this.createInvoiceHistory(
					action,
					invoice
				);
			}

			this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_DELETE');
			this.subject$.next();
		}
	}

	private statusMapper = (value: string | boolean) => {
		let badgeClass: string;
		if (value) {
			badgeClass = 'danger';
			value = this.getTranslation(
				'INVOICES_PAGE.PAYMENTS.OVERDUE'
			);
		} else {
			badgeClass = 'success';
			value = this.getTranslation(
				'INVOICES_PAGE.PAYMENTS.ON_TIME'
			);
		}
		return {
			text: value,
			class: badgeClass
		};
	}

	private _loadSmartTableSettings() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				amount: {
					title: this.getTranslation('PAYMENTS_PAGE.AMOUNT'),
					type: 'custom',
					filter: false,
					width: '8%',
					renderComponent: IncomeExpenseAmountComponent
				},
				paymentDate: {
					title: this.getTranslation('PAYMENTS_PAGE.PAYMENT_DATE'),
					type: 'custom',
					filter: false,
					width: '10%',
					renderComponent: DateViewComponent
				},
				displayPaymentMethod: {
					title: this.getTranslation('PAYMENTS_PAGE.PAYMENT_METHOD'),
					type: 'text',
					width: '10%',
					filter: {
						type: 'custom',
						component: PaymentMethodFilterComponent
					},
					filterFunction: (value) => {
						if (value) {
							this.filters = {
								where: { ...this.filters.where, paymentMethod: value }
							}
						} else {
							if ('paymentMethod' in this.filters.where) {
								delete this.filters.where.paymentMethod;
							}
						}
						this.searchFilter();
					}
				},
				recordedBy: {
					title: this.getTranslation('PAYMENTS_PAGE.RECORDED_BY'),
					type: 'text',
					filter: false,
					width: '10%'
				},
				note: {
					title: this.getTranslation('PAYMENTS_PAGE.NOTE'),
					type: 'text',
					width: '10%'
				},
				organizationContactName: {
					title: this.getTranslation('PAYMENTS_PAGE.CONTACT'),
					type: 'text',
					width: '12%',
					filter: {
						type: 'custom',
						component: OrganizationContactFilterComponent
					},
					filterFunction: (value) => {
						if (value) {
							this.filters = {
								where: { ...this.filters.where, contactId: value.id }
							}
						} else {
							if ('contactId' in this.filters.where) {
								delete this.filters.where.contactId;
							}
						}
						this.searchFilter();
					}
				},
				projectName: {
					title: this.getTranslation('PAYMENTS_PAGE.PROJECT'),
					type: 'text',
					width: '10%',
					filter: false,
				},
				tags: {
					title: this.getTranslation('PAYMENTS_PAGE.TAGS'),
					type: 'custom',
					width: '12%',
					renderComponent: NotesWithTagsComponent,
					filter: {
						type: 'custom',
						component: TagsColorFilterComponent
					},
					filterFunction: (tags) => {
						if (isNotEmpty(tags)) {
							const tagIds = [];
							for (const tag of tags) {
								tagIds.push(tag.id)
							}
							this.filters = {
								where: { 
									...this.filters.where,
									tags: tagIds
								},
								join: {
									leftJoin: {
										tags: 'payment.tags'
									}
								}
							}
						} else {
							if ('tags' in this.filters.where) {
								delete this.filters.where.tags;
								delete this.filters.join.leftJoin.tags;
							}
						}
						this.searchFilter();
					}
				},
				invoiceNumber: {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER'),
					type: 'text',
					filter: false,
					width: '8%'
				},
				displayOverdue: {
					title: this.getTranslation('PAYMENTS_PAGE.STATUS'),
					type: 'custom',
					width: '10%',
					renderComponent: StatusBadgeComponent,
					filter: false
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

	async selectPayment({ isSelected, data }) {
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
	async createInvoiceHistory(
		action: string,
		invoice: IInvoice
	) {
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

	/*
	* refresh pagination
	*/
	refreshPagination() {
		this.pagination['activePage'] = 1;
	}

	ngOnDestroy() {}
}
