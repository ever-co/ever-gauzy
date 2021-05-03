import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { OnInit, Component, OnDestroy, ViewChild } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { PaymentService } from '../../@core/services/payment.service';
import { Store } from '../../@core/services/store.service';
import { first, filter, tap, debounceTime } from 'rxjs/operators';
import {
	IPayment,
	ComponentLayoutStyleEnum,
	IOrganization,
	ISelectedPayment
} from '@gauzy/contracts';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import {
	Router,
	RouterEvent,
	NavigationEnd,
	ActivatedRoute
} from '@angular/router';
import { PaymentMutationComponent } from '../invoices/invoice-payments/payment-mutation/payment-mutation.component';
import { NbDialogService } from '@nebular/theme';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { StatusBadgeComponent } from '../../@shared/status-badge/status-badge.component';
import { InvoiceEstimateHistoryService } from '../../@core/services/invoice-estimate-history.service';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { ToastrService } from '../../@core/services/toastr.service';
import { combineLatest, Subject } from 'rxjs';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-payments',
	templateUrl: './payments.component.html',
	styleUrls: []
})
export class PaymentsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	settingsSmartTable: object;
	smartTableSource = new LocalDataSource();
	selectedPayment: IPayment;
	payments: IPayment[];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	organization: IOrganization;
	disableButton = true;
	currency: string;
	loading = true;

	projectId: string | null;
	subject$: Subject<any> = new Subject();

	paymentsTable: Ng2SmartTableComponent;
	@ViewChild('paymentsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.paymentsTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		readonly translateService: TranslateService,
		private paymentService: PaymentService,
		private store: Store,
		private dialogService: NbDialogService,
		private router: Router,
		private toastrService: ToastrService,
		private invoiceEstimateHistoryService: InvoiceEstimateHistoryService,
		private _errorHandlingService: ErrorHandlingService,
		private route: ActivatedRoute
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit() {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.subject$
			.pipe(
				debounceTime(800),
				tap(() => this.getPayments()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeProject$ = this.store.selectedProject$;
		combineLatest([storeOrganization$, storeProject$])
			.pipe(
				filter(
					([organization]) => !!organization
				),
				tap(([organization, project]) => {
					if (organization) {
						this.organization = organization;
						this.projectId = project ? project.id : null;
						this.subject$.next();
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
		this.route.queryParamMap
			.pipe(
				filter((params) => !!params),
				debounceTime(1000),
				untilDestroyed(this)
			)
			.subscribe((params) => {
				if (params.get('openAddDialog') === 'true') {
					this.recordPayment();
				}
			});
	}

	setView() {
		this.viewComponentName = ComponentEnum.PAYMENTS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(untilDestroyed(this))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
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

	async getPayments() {
		try {
			this.loading = true;
			this.currency = this.organization.currency;

			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			this.paymentService
				.getAll(
					[
						'invoice',
						'invoice.toContact',
						'recordedBy',
						'contact',
						'project',
						'tags'
					],
					{
						organizationId,
						tenantId,
						...(this.projectId ? { projectId: this.projectId } : {})
					}
				)
				.then(({ items }) => {
					this.payments = items;
					this.smartTableSource.load(items);
				})
				.finally(() => {
					this.loading = false;
				});
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}
	}

	async recordPayment() {
		const result = await this.dialogService
			.open(PaymentMutationComponent, {
				context: {
					organization: this.organization,
					currencyString: this.currency
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			const { tenantId } = this.store.user;
			result['organizationId'] = this.organization.id;
			result['tenantId'] = tenantId;

			await this.paymentService.add(result);
			await this.getPayments();
			if (result.invoice) {
				await this.invoiceEstimateHistoryService.add({
					action: this.getTranslation(
						'INVOICES_PAGE.PAYMENTS.PAYMENT_AMOUNT_ADDED',
						{
							amount: result.amount,
							currency: result.currency
						}
					),
					invoice: result.invoice,
					invoiceId: result.invoice.id,
					user: this.store.user,
					userId: this.store.userId,
					organization: this.organization,
					organizationId: this.organization.id,
					tenantId
				});
			}
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
					organization: this.organization,
					payment: this.selectedPayment,
					tags: this.selectedPayment.tags
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.paymentService.update(result.id, result);
			await this.getPayments();

			const { tenantId } = this.store.user;
			await this.invoiceEstimateHistoryService.add({
				action: this.getTranslation(
					'INVOICES_PAGE.PAYMENT.PAYMENT_EDIT'
				),
				invoice: result.invoice,
				invoiceId: result.invoice.id,
				user: this.store.user,
				userId: this.store.userId,
				organization: this.organization,
				organizationId: this.organization.id,
				tenantId
			});
			this.clearItem();
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
			await this.paymentService.delete(this.selectedPayment.id);
			this.getPayments();

			const { tenantId } = this.store.user;
			await this.invoiceEstimateHistoryService.add({
				action: this.getTranslation(
					'INVOICES_PAGE.PAYMENT.PAYMENT_DELETE'
				),
				invoice: this.selectedPayment.invoice,
				invoiceId: this.selectedPayment.invoice
					? this.selectedPayment.invoice.id
					: null,
				user: this.store.user,
				userId: this.store.userId,
				organization: this.organization,
				organizationId: this.organization.id,
				tenantId
			});
			this.toastrService.success('INVOICES_PAGE.PAYMENTS.PAYMENT_DELETE');
			this.clearItem();
		}
	}

	loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				amount: {
					title: this.getTranslation('PAYMENTS_PAGE.AMOUNT'),
					type: 'text',
					filter: false,
					width: '12%',
					valuePrepareFunction: (cell, row) => {
						return `${row.currency} ${cell}`;
					}
				},
				paymentDate: {
					title: this.getTranslation('PAYMENTS_PAGE.PAYMENT_DATE'),
					type: 'text',
					width: '10%',
					valuePrepareFunction: (cell, row) => {
						return `${cell.slice(0, 10)}`;
					}
				},
				paymentMethod: {
					title: this.getTranslation('PAYMENTS_PAGE.PAYMENT_METHOD'),
					type: 'text',
					width: '10%',
					valuePrepareFunction: (cell, row) => {
						return this.getTranslation(`INVOICES_PAGE.PAYMENTS.${cell}`);
					}
				},
				recordedBy: {
					title: this.getTranslation('PAYMENTS_PAGE.RECORDED_BY'),
					type: 'text',
					filter: false,
					width: '10%',
					valuePrepareFunction: (cell, row) => {
						if (cell && cell.firstName && cell.lastName) {
							return `${cell.firstName} ${cell.lastName}`;
						} else {
							return ``;
						}
					}
				},
				note: {
					title: this.getTranslation('PAYMENTS_PAGE.NOTE'),
					type: 'text',
					filter: false,
					width: '10%'
				},
				organizationContactName: {
					title: this.getTranslation('PAYMENTS_PAGE.CONTACT'),
					type: 'text',
					width: '10%',
					valuePrepareFunction: (cell, row) => {
						if (row.invoice) {
							return row.invoice.toContact.name;
						} else if (row.contact) {
							return row.contact.name;
						}
					}
				},
				projectName: {
					title: this.getTranslation('PAYMENTS_PAGE.PROJECT'),
					type: 'text',
					width: '10%',
					valuePrepareFunction: (cell, row) => {
						if (row.project) {
							return row.project.name;
						}
					}
				},
				tags: {
					title: this.getTranslation('PAYMENTS_PAGE.TAGS'),
					type: 'custom',
					width: '10%',
					renderComponent: NotesWithTagsComponent
				},
				invoiceNumber: {
					title: this.getTranslation('INVOICES_PAGE.INVOICE_NUMBER'),
					type: 'text',
					filter: false,
					width: '8%',
					valuePrepareFunction: (cell, row) => {
						if (row.invoice) {
							return row.invoice.invoiceNumber;
						}
					}
				},
				overdue: {
					title: this.getTranslation('PAYMENTS_PAGE.STATUS'),
					type: 'custom',
					width: '10%',
					renderComponent: StatusBadgeComponent,
					valuePrepareFunction: (cell, row) => {
						let badgeClass;
						if (cell) {
							badgeClass = 'danger';
							cell = this.getTranslation(
								'INVOICES_PAGE.PAYMENTS.OVERDUE'
							);
						} else {
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

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}

	ngOnDestroy() {}
}
