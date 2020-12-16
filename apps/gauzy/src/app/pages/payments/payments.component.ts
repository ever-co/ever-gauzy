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
	IInvoice,
	IOrganization,
	IOrganizationContact,
	IOrganizationProject,
	ISelectedPayment
} from '@gauzy/models';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import {
	Router,
	RouterEvent,
	NavigationEnd,
	ActivatedRoute
} from '@angular/router';
import { PaymentMutationComponent } from '../invoices/invoice-payments/payment-mutation/payment-mutation.component';
import { NbDialogService, NbToastrService } from '@nebular/theme';
import { InvoicesService } from '../../@core/services/invoices.service';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';
import { OrganizationProjectsService } from '../../@core/services/organization-projects.service';
import { NotesWithTagsComponent } from '../../@shared/table-components/notes-with-tags/notes-with-tags.component';
import { StatusBadgeComponent } from '../../@shared/status-badge/status-badge.component';
import { InvoiceEstimateHistoryService } from '../../@core/services/invoice-estimate-history.service';
import { ErrorHandlingService } from '../../@core/services/error-handling.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

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
	smartTableSource = new LocalDataSource();
	selectedPayment: IPayment;
	payments: IPayment[];
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	invoices: IInvoice[];
	organization: IOrganization;
	disableButton = true;
	currency: string;
	organizationContacts: IOrganizationContact[];
	projects: IOrganizationProject[];
	loading = true;

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
		private organizationContactService: OrganizationContactService,
		private dialogService: NbDialogService,
		private router: Router,
		private invoicesService: InvoicesService,
		private organizationProjectsService: OrganizationProjectsService,
		private toastrService: NbToastrService,
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
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization) => (this.organization = organization)),
				tap(() => this.loadSettings()),
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

	async loadSettings() {
		try {
			this.loading = true;
			this.currency = this.organization.currency;

			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;

			this.invoicesService
				.getAll([], { organizationId, tenantId, isEstimate: false })
				.then(({ items }) => {
					this.invoices = items;
				});

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
					{ organizationId, tenantId }
				)
				.then(({ items }) => {
					this.payments = items;
					this.smartTableSource.load(items);
				});

			this.organizationContactService
				.getAll([], { organizationId, tenantId })
				.then(({ items }) => {
					this.organizationContacts = items;
				});

			this.organizationProjectsService
				.getAll([], { organizationId, tenantId })
				.then(({ items }) => {
					this.projects = items;
				});

			this.loading = false;
		} catch (error) {
			this._errorHandlingService.handleError(error);
		}
	}

	async recordPayment() {
		const result = await this.dialogService
			.open(PaymentMutationComponent, {
				context: {
					invoices: this.invoices,
					organization: this.organization,
					currencyString: this.currency,
					organizationContacts: this.organizationContacts,
					projects: this.projects
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			const { tenantId } = this.store.user;
			result['organizationId'] = this.organization.id;
			result['tenantId'] = tenantId;

			await this.paymentService.add(result);
			await this.loadSettings();
			if (result.invoice) {
				await this.invoiceEstimateHistoryService.add({
					action: `Payment of ${result.amount} ${result.currency} added`,
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
					invoices: this.invoices,
					organization: this.organization,
					payment: this.selectedPayment,
					organizationContacts: this.organizationContacts,
					projects: this.projects,
					tags: this.selectedPayment.tags
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.paymentService.update(result.id, result);
			await this.loadSettings();

			const { tenantId } = this.store.user;
			await this.invoiceEstimateHistoryService.add({
				action: `Payment edited`,
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
			this.loadSettings();

			const { tenantId } = this.store.user;
			await this.invoiceEstimateHistoryService.add({
				action: `Payment deleted`,
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
			this.toastrService.primary(
				this.getTranslation('INVOICES_PAGE.PAYMENTS.PAYMENT_DELETE'),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
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
					title: 'Payment Method',
					type: 'text',
					width: '10%'
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
					title: 'Project',
					type: 'text',
					width: '10%',
					valuePrepareFunction: (cell, row) => {
						if (row.project) {
							return row.project.name;
						}
					}
				},
				tags: {
					title: 'Tags',
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
